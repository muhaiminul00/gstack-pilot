#!/usr/bin/env node
'use strict';

// gstack-pilot plugin - Execute pre-flight sync gate + PR-scope collision
// check (BC-2026-08-31, design: docs/designs/sync-gate-and-collision-check.md).
//
// A deterministic script, not prose, so Execute's first action in every
// task is "run this and relay exactly what it prints" instead of five
// separately-interpreted git/gh steps. Performs, in order:
//   0. session-kind gate (interactive STOP vs headless/spawned BLOCKED)
//   1. dirty-working-tree check (git status --porcelain)
//   2. base-branch resolve + no-checkout fast-forward
//   3. task-branch create-or-reuse
//   4. PR-scope collision check (self-overlap excluded, soft-degrades if
//      gh is missing/unauthenticated)
//   5. write .claude/hooks/state/preflight-ok on success
//
// Exit codes: 0 = clear to proceed, marker written.
//             1 = STOP (interactive blocking condition, message on stdout).
//             2 = BLOCKED (headless/spawned blocking condition).
//
// --- Implementation-time decisions (the design doc deliberately left these
// as script-level judgment calls, not architecture choices - see its NOT-
// in-scope section and Open Questions) ---
// 1. PR base-branch filtering: gh pr list results are filtered to PRs whose
//    baseRefName matches the resolved base branch - reduces false positives
//    from PRs targeting an unrelated branch.
// 2. Draft PRs: included, not excluded. Parallel work often lives in drafts.
// 3. No-local-base fallback: `git fetch origin <base>:<base>` creates the
//    local ref if it doesn't exist yet, so a fresh clone needs no special
//    handling - this refspec's destination need not pre-exist.
// 4. Task-branch idempotency: if --branch names a branch that already
//    exists locally, it's checked out and reused (never recreated). This is
//    intentionally not "switching to an unrelated branch without asking" -
//    it's the one branch this exact invocation was told is the task branch.
// 5. Unpushed local commits on an otherwise-clean tree are NOT treated as
//    dirty - a known, documented gap (see design doc's Failure Modes table),
//    not fixed here.
// 6. Untracked files DO surface via plain `git status --porcelain` (shown as
//    `??`) and count as dirty. Git-ignored files do not, and neither do
//    submodule/nested-repo states beyond git's own default porcelain
//    reporting - a known, documented gap, not fixed here.
// 7. Marker freshness ("current session," per the design doc's wording) is
//    approximated with a fixed TTL rather than a true session-id match: a
//    plain script invoked via a Bash tool call has no reliable way to learn
//    Claude Code's own session id (PreToolUse hooks receive one on stdin,
//    but this script isn't a hook). A TTL is the honest, practical stand-in
//    documented here rather than silently assumed equivalent.
//
// --allow-dirty (BC-2026-08-31-preflight-allow-dirty, design:
// docs/designs/preflight-allow-dirty.md): a narrow, explicit escape hatch
// for the one real case Step 1 has no way to express - a Build Card whose
// entire deliverable IS committing the repo's current dirty tree (a
// live-hit deadlock on zm-brain: no flag existed, so the only way through
// was routing mutations around this gate entirely via Bash instead of
// Edit/Write). When passed, Step 1 is skipped in full - all-or-nothing,
// no partial "only files outside Scope" filtering - and execution proceeds
// straight to Step 2. Every other invocation (the overwhelming majority)
// is unaffected: no flag, no behavior change, still fails closed. See the
// design doc for why this is a flag Execute passes deliberately rather
// than a text-matching heuristic on the Build Card's own prose.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MARKER_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours - see decision 7 above.

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'hooks', 'state');
const markerPath = path.join(stateDir, 'preflight-ok');

function parseArgs(argv) {
  const args = { sessionKind: 'interactive', allowDirty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--branch') args.branch = argv[++i];
    else if (a === '--card') args.card = argv[++i];
    else if (a === '--scope') args.scope = argv[++i];
    else if (a === '--session-kind') args.sessionKind = argv[++i];
    else if (a === '--allow-dirty') args.allowDirty = true;
  }
  return args;
}

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', ...opts });
}

function tryGit(args, opts = {}) {
  try {
    return { ok: true, out: git(args, opts) };
  } catch (err) {
    return { ok: false, out: (err.stdout || '') + (err.stderr || ''), err };
  }
}

function gh(args) {
  return execFileSync('gh', args, { cwd: projectDir, encoding: 'utf8' });
}

// step 0 result carrier: halt(message) picks STOP vs BLOCKED based on
// session-kind and exits immediately - every blocking condition below
// routes through this so the gate is applied uniformly, not re-decided
// at each call site.
function halt(sessionKind, message) {
  if (sessionKind === 'headless' || sessionKind === 'spawned') {
    console.log('BLOCKED — ' + message);
    process.exit(2);
  }
  console.log('STOP — ' + message);
  process.exit(1);
}

function parseScopeFromCard(cardPath) {
  let text;
  try {
    text = fs.readFileSync(cardPath, 'utf8');
  } catch (err) {
    return null;
  }
  // Looks for a "## Scope" (or "**Scope**"/"- Scope:") section and reads
  // the bulleted paths under it, stopping at the next heading/blank-then-
  // heading boundary. Matches skills/build-cards/SKILL.md's new Scope field
  // convention (a bullet list of concrete file/directory paths).
  const lines = text.split(/\r?\n/);
  let inScope = false;
  const paths = [];
  for (const line of lines) {
    if (/^\s*##\s*Scope\b/i.test(line) || /^\*\*Scope\*\*/i.test(line)) {
      inScope = true;
      continue;
    }
    if (inScope) {
      if (/^\s*##\s/.test(line)) break; // next section
      const m = line.match(/^\s*[-*]\s+`?([^`\s][^`]*?)`?\s*$/);
      if (m) paths.push(m[1].trim());
    }
  }
  return paths.length > 0 ? paths : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sessionKind = args.sessionKind || 'interactive';

  // ---- Step 1: dirty working tree ----
  if (args.allowDirty) {
    console.log('OK: dirty tree allowed (--allow-dirty passed) - Step 1 skipped.');
  } else {
    const status = tryGit(['status', '--porcelain']);
    if (!status.ok) {
      halt(sessionKind, 'could not read git status: ' + status.out.trim());
    }
    if (status.out.trim().length > 0) {
      const files = status.out.trim().split('\n').map((l) => l.trim()).join(', ');
      halt(
        sessionKind,
        'working tree is not clean before starting this task. Files: ' + files +
          '. Commit, stash, or confirm these changes belong to this task before continuing - never auto-stashed. ' +
          'If this task\'s own deliverable is committing this exact working-tree state, rerun with --allow-dirty.'
      );
    }
    console.log('OK: working tree clean.');
  }

  // ---- Step 2: resolve base branch, no-checkout fetch ----
  // Deliberately never falls back to "whatever's currently checked out" -
  // on a resumed session that's already on its task branch, that fallback
  // would silently treat the task branch itself as the base (caught live
  // during this Build Card's own verification pass, not a hypothetical).
  let base;
  try {
    const ghBase = execFileSync('gh', ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'], {
      cwd: projectDir,
      encoding: 'utf8'
    }).trim();
    if (ghBase) base = ghBase;
  } catch (err) {
    // gh unavailable/unauthenticated for this call specifically - the
    // collision check below will separately disclose gh unavailability.
  }
  if (!base) {
    // Local, gh-independent fallback: ask git itself what origin's default
    // branch is (works offline once the remote has been fetched at least
    // once).
    const symref = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    if (symref.ok) {
      base = symref.out.trim().replace(/^origin\//, '');
    }
  }
  if (!base) {
    base = 'main';
    console.log('NOTE: could not resolve default branch via gh or origin/HEAD - falling back to "main". Verify this is correct.');
  }

  const currentBranchRes = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const currentBranch = currentBranchRes.ok ? currentBranchRes.out.trim() : null;

  let fetchResult;
  if (currentBranch === base) {
    // Can't update a ref via fetch refspec while it's checked out - use an
    // ff-only pull instead, which is safe on a clean tree (already verified
    // above).
    fetchResult = tryGit(['pull', '--ff-only', 'origin', base]);
  } else {
    fetchResult = tryGit(['fetch', 'origin', base + ':' + base]);
  }
  if (!fetchResult.ok) {
    halt(
      sessionKind,
      'could not fast-forward local "' + base + '" to origin - it may have diverged or local changes conflict. ' +
        'Never forced automatically. Details: ' + fetchResult.out.trim()
    );
  }
  console.log('OK: base branch "' + base + '" is current.');

  // ---- Step 3: task branch create-or-reuse ----
  let taskBranch = args.branch;
  if (!taskBranch) {
    if (currentBranch && currentBranch !== base) {
      taskBranch = currentBranch; // resumed session already on its task branch
      console.log('OK: reusing already-checked-out task branch "' + taskBranch + '".');
    } else {
      halt(sessionKind, 'no task branch name given (--branch <name>) and currently on the base branch - cannot infer a task branch.');
    }
  } else {
    const branchExists = tryGit(['rev-parse', '--verify', '--quiet', taskBranch]).ok;
    if (currentBranch === taskBranch) {
      console.log('OK: already on task branch "' + taskBranch + '".');
    } else if (branchExists) {
      const co = tryGit(['checkout', taskBranch]);
      if (!co.ok) halt(sessionKind, 'could not check out existing task branch "' + taskBranch + '": ' + co.out.trim());
      console.log('OK: checked out existing task branch "' + taskBranch + '".');
    } else {
      const co = tryGit(['checkout', '-b', taskBranch, base]);
      if (!co.ok) halt(sessionKind, 'could not create task branch "' + taskBranch + '" from "' + base + '": ' + co.out.trim());
      console.log('OK: created task branch "' + taskBranch + '" from "' + base + '".');
    }
  }

  // ---- Step 4: PR-scope collision check (soft-degrades without gh) ----
  let ghInstalled = true;
  try {
    execFileSync('gh', ['--version'], { cwd: projectDir, stdio: 'ignore' });
  } catch (err) {
    ghInstalled = false;
  }

  if (!ghInstalled) {
    console.log('DISCLOSED: PR-scope collision check unavailable — gh CLI not installed.');
  } else {
    let ghAuthed = true;
    try {
      execFileSync('gh', ['auth', 'status'], { cwd: projectDir, stdio: 'ignore' });
    } catch (err) {
      ghAuthed = false;
    }

    if (!ghAuthed) {
      console.log('DISCLOSED: PR-scope collision check unavailable — gh not authenticated (run `gh auth login`).');
    } else {
      const scope = args.scope
        ? args.scope.split(',').map((s) => s.trim()).filter(Boolean)
        : args.card
        ? parseScopeFromCard(args.card)
        : null;

      if (!scope || scope.length === 0) {
        console.log('NOTE: no Scope provided (--scope or --card) — skipping PR-scope collision check.');
      } else {
        let currentUser = null;
        try {
          currentUser = execFileSync('gh', ['api', 'user', '--jq', '.login'], { cwd: projectDir, encoding: 'utf8' }).trim();
        } catch (err) {
          // Without a login we can't safely exclude our own PRs - fail
          // toward disclosure rather than a false self-collision.
          console.log('NOTE: could not resolve current gh user — self-overlap exclusion skipped, results may include your own PRs.');
        }

        let prJson;
        try {
          prJson = gh(['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,headRefName,baseRefName,files,author,isDraft']);
        } catch (err) {
          console.log('DISCLOSED: PR-scope collision check unavailable — `gh pr list` failed: ' + (err.stderr || err.message));
          prJson = null;
        }

        let prs = null;
        if (prJson) {
          try {
            prs = JSON.parse(prJson);
          } catch (err) {
            console.log('DISCLOSED: PR-scope collision check unavailable — `gh pr list` returned unparseable output.');
            prs = null;
          }
        }

        if (prs) {
          if (prs.length >= 200) {
            console.log('DISCLOSED: gh pr list returned 200 results (the --limit cap) — there may be more open PRs than checked.');
          }

          const relevant = prs.filter((pr) => {
            if (pr.baseRefName !== base) return false;
            if (currentUser && pr.author && pr.author.login === currentUser) return false;
            return true;
          });

          const overlaps = [];
          for (const pr of relevant) {
            const prFiles = (pr.files || []).map((f) => f.path);
            const hit = prFiles.find((fp) => scope.some((s) => fp === s || fp.startsWith(s.replace(/\/$/, '') + '/')));
            if (hit) overlaps.push({ number: pr.number, headRefName: pr.headRefName, file: hit, draft: pr.isDraft });
          }

          if (overlaps.length > 0) {
            const desc = overlaps
              .map((o) => '#' + o.number + ' (' + o.headRefName + (o.draft ? ', draft' : '') + ') touches ' + o.file)
              .join('; ');
            halt(
              sessionKind,
              'open PR(s) overlap this task\'s Scope: ' + desc + '. Proceed, coordinate with the author, or adjust Scope before continuing.'
            );
          }
          console.log('OK: no open-PR overlap with Scope (' + relevant.length + ' PR(s) checked against base "' + base + '").');
        }
      }
    }
  }

  // ---- Step 5: write marker ----
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    markerPath,
    JSON.stringify({ branch: taskBranch, timestamp: new Date().toISOString() }, null, 2),
    'utf8'
  );
  console.log('OK: pre-flight complete — .claude/hooks/state/preflight-ok written for branch "' + taskBranch + '". Clear to proceed.');
  process.exit(0);
}

module.exports = { MARKER_TTL_MS };

if (require.main === module) {
  main();
}
