#!/usr/bin/env node
'use strict';

// gstack-pilot plugin - SessionStart hook
// Reads/creates the per-project mode-state file and injects the current
// mode's instructions into context, chained to gstack's skill suite.
// Also seeds this project's CLAUDE.md with a starter block (once), and,
// when the resolved mode is "commander", briefs it with this project's
// own declared state-doc content so Commander starts every session
// already caught up instead of having to remember to read it first.
//
// Runs under plain Node.js so it behaves identically on Windows/macOS/Linux -
// no OS-specific shell scripts or dispatcher shims needed. Same design as
// the sibling `role-modes` plugin this one is adapted from.

const fs = require('fs');
const path = require('path');
const os = require('os');

const { execFileSync } = require('child_process');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(projectDir, '.claude', 'hooks', 'state');
const stateFile = path.join(stateDir, 'mode.json');
const dotClaudeDir = path.join(projectDir, '.claude');
const claudeMdPath = path.join(dotClaudeDir, 'CLAUDE.md');

// State schema is just { "mode": "advisor" | "commander" | "execute" }.
// Shares the same mode.json PATH as role-modes on purpose - gstack-pilot
// is designed as role-modes' successor for a given project, never expected
// to be co-installed alongside it in the same project. If that assumption
// is ever wrong for a real project, this state file (and the sentinel/marker
// below, which ARE already namespaced) would need its own path too - flagged
// in the README, not silently assumed safe.
let mode = 'advisor';

try {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (state.mode) mode = state.mode;
} catch (err) {
  // Missing, corrupt, or unreadable state file - fall back to the default
  // mode for this run, and try to (re)create the file with that default.
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ mode }, null, 2), 'utf8');
  } catch (writeErr) {
    // Best-effort; the session still gets a correct default mode this run
    // even if persisting it fails.
  }
}

const modeInstructions = {
  commander:
    'MODE: /gstack-pilot:commander (persisted). Effort: MEDIUM. Plan, break work into scoped units, review ' +
    'results, flag architectural concerns. Execute directly ONLY for read-only/single-file/non-destructive ' +
    'actions with no credential or live-infra impact and no git-write - hand off to /gstack-pilot:execute ' +
    'for anything else, including read-only queries against live infra. Before scoping a Build Card, chain into ' +
    "gstack's planning skills for the plan's substance (office-hours if a new idea, then plan-eng-review, or " +
    'autoplan for the full batched run) rather than authoring the plan yourself - see this command\'s own file ' +
    'for the exact chain. On your first run in this project, if no memory system is recorded in .claude/CLAUDE.md ' +
    "yet, recommend `project-memory` if it's installed, else ask which memory system to use, then record the " +
    'answer there. Stop for a human pulse-check after 5 consecutive Build Cards completed unattended (or fewer ' +
    'if this project\'s CLAUDE.md overrides the number), or any single card writing to live infra. Follow this ' +
    'project\'s own Commander protocol if its CLAUDE.md names one.',
  execute:
    'MODE: /gstack-pilot:execute (persisted). Effort: MEDIUM. Full build authority within the current ' +
    'approved scope of work - self-orchestrate, live-verify assumptions against real systems before building on ' +
    'them, test what you build, report precisely. Before any branch/file mutation, this task\'s first action is ' +
    '`node scripts/pre-flight-sync.js` (dirty-tree/stale-base/PR-scope-collision gate) - this applies even on a ' +
    'resumed session, not just a freshly-invoked one, and a PreToolUse hook independently blocks Write/Edit ' +
    'without a valid marker from it. Wrap-up is PR-first, no trivial-housekeeping exemption: state-doc updates ' +
    'land, then a commit on the task branch the pre-flight step already created, a PR, and gstack\'s ' +
    "review -> qa -> ship chain, before merging - see this command's own file for the exact chain. Follow this " +
    "project's own Executor protocol if its CLAUDE.md names one.",
  advisor:
    'MODE: /gstack-pilot:advisor (persisted/default). Effort: LOW. Advisory Q&A only - no build actions, no ' +
    'plans committed to any file, no execution, no gstack chaining (leaf state, same as Commander/Execute\'s own ' +
    'chains never apply here).'
};

const modeInstruction = modeInstructions[mode] || modeInstructions.advisor;

const contextParts = [
  modeInstruction,
  '',
  "This project may define its own state-tracking doc, decision store, and infra list in its .claude/CLAUDE.md " +
    'or root CLAUDE.md - read those before starting work if they exist. None is assumed by default.'
];

if (mode === 'commander') {
  const briefing = buildCommanderBriefing(projectDir, claudeMdPath);
  if (briefing) {
    contextParts.push('', briefing);
  }
}

const ghNudge = checkGhSetupOnce(stateDir);
if (ghNudge) {
  contextParts.push('', ghNudge);
}

const gstackConfigNudge = checkGstackConfigOnce(stateDir);
if (gstackConfigNudge) {
  contextParts.push('', gstackConfigNudge);
}

const context = contextParts.join('\n');

const output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: context
  }
};

// Emit the hook's actual required output first; CLAUDE.md seeding below is
// a one-time convenience side effect and shouldn't sit ahead of it.
process.stdout.write(JSON.stringify(output));

seedClaudeMd(projectDir);

// Pre-session Commander briefing: look for a "State Doc: <path>" line in
// this project's .claude/CLAUDE.md (the same fill-in-the-blank convention
// the starter block below asks the human to complete). If found, read that
// file and hand back its first chunk as ready-made context, so Commander
// starts already briefed instead of needing to remember to read it first.
// Best-effort throughout - a missing/unreadable state doc just means no
// briefing gets added, never a hook failure.
function buildCommanderBriefing(dir, claudeMdFilePath) {
  let claudeMd;
  try {
    claudeMd = fs.readFileSync(claudeMdFilePath, 'utf8');
  } catch (err) {
    return null;
  }

  const match = claudeMd.match(/^-?\s*State Doc:\s*(.+)$/m);
  if (!match) return null;

  const declaredPath = match[1].trim();
  if (!declaredPath) return null;

  const resolvedPath = path.isAbsolute(declaredPath)
    ? declaredPath
    : path.join(dir, declaredPath);

  let content;
  try {
    content = fs.readFileSync(resolvedPath, 'utf8');
  } catch (err) {
    return null;
  }

  const MAX_CHARS = 4000;
  const excerpt = content.length > MAX_CHARS
    ? content.slice(0, MAX_CHARS) + '\n... (truncated - read the full file for more)'
    : content;

  return [
    `Commander pre-session briefing (from ${declaredPath}, this project's declared State Doc):`,
    excerpt
  ].join('\n');
}

// One-time, loud gh install+auth nudge (BC-2026-08-31-gh-setup-loud-nudge).
// Reuses pre-flight-sync.js's own gh-installed / gh-authenticated check
// logic and message wording - not new copy, just a louder, once-only
// surface for it. Gated by a namespaced sentinel (same pattern as the
// CLAUDE.md-seed sentinel above): checked once ever, written regardless of
// outcome (including the "already fine" case) so a later `gh auth logout`
// doesn't retroactively need a nudge that would just duplicate the
// per-task DISCLOSED line in pre-flight-sync.js - that line is untouched
// and stays the real-time-accurate signal (see TODOS.md's "Re-nudge on gh
// auth regression" entry for closing that specific gap for real).
// commands/init.md carries an identical check sharing this same sentinel -
// same hook/command duplication reason as seedClaudeMd() above.
// Never blocks: this function only ever returns nudge text or null, never
// throws past its own try/catch, in any session kind.
function checkGhSetupOnce(dir) {
  const sentinelFile = path.join(dir, '.gh-setup-checked-gstack-pilot');
  if (fs.existsSync(sentinelFile)) return null;

  let nudge = null;
  try {
    let ghInstalled = true;
    try {
      execFileSync('gh', ['--version'], { stdio: 'ignore' });
    } catch (err) {
      ghInstalled = false;
    }

    if (!ghInstalled) {
      nudge =
        'GH SETUP: gh CLI not installed - Execute\'s pre-flight PR-scope collision check ' +
        'runs without it (soft dependency, nothing blocks), but you lose real collision ' +
        'detection until it\'s set up. See TEAM_SETUP.md step 3. (One-time notice - won\'t ' +
        'repeat; the per-task DISCLOSED line in pre-flight-sync.js still flags this on every ' +
        'Execute task in the meantime.)';
    } else {
      let ghAuthed = true;
      try {
        execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
      } catch (err) {
        ghAuthed = false;
      }
      if (!ghAuthed) {
        nudge =
          'GH SETUP: gh CLI installed but not authenticated (`gh auth login`) - Execute\'s ' +
          'pre-flight PR-scope collision check runs without it (soft dependency, nothing ' +
          'blocks), but you lose real collision detection until it\'s authenticated. See ' +
          'TEAM_SETUP.md step 3. (One-time notice - won\'t repeat; the per-task DISCLOSED ' +
          'line in pre-flight-sync.js still flags this on every Execute task in the meantime.)';
      }
    }

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(sentinelFile, '', 'utf8');
  } catch (err) {
    // Best-effort, same as seedClaudeMd() - never let this block the session.
  }

  return nudge;
}

// One-time, informational-only nudge surfacing gstack's own GLOBAL config
// (BC-2026-08-31-public-repo-hygiene-and-gstack-mandatory). Unlike the gh
// nudge above, this reads a file that lives outside any project entirely -
// ~/.gstack/config.yaml, gstack's own per-machine settings (proactive,
// checkpoint_mode, routing_declined, etc.) - so this function NEVER writes
// to that file, only reads it. Forcing or silently editing another tool's
// global config from inside one project's plugin hook would affect every
// other project the human touches; that's a materially bigger blast radius
// than mode.json (project-scoped) and was explicitly rejected in favor of
// "surface it, point at the real file, let the human decide."
// Gated by its own namespaced sentinel, written once ever regardless of
// outcome (file present or missing) - same semantics as checkGhSetupOnce().
// commands/init.md carries an identical check sharing this same sentinel -
// same hook/command duplication reason as seedClaudeMd() above.
// Never blocks: only ever returns nudge text or null, never throws past its
// own try/catch, in any session kind.
function checkGstackConfigOnce(dir) {
  const sentinelFile = path.join(dir, '.gstack-config-checked-gstack-pilot');
  if (fs.existsSync(sentinelFile)) return null;

  let nudge = null;
  try {
    const configPath = path.join(os.homedir(), '.gstack', 'config.yaml');
    let configText = null;
    try {
      configText = fs.readFileSync(configPath, 'utf8');
    } catch (err) {
      configText = null;
    }

    if (configText === null) {
      nudge =
        'GSTACK CONFIG: no ~/.gstack/config.yaml found - either gstack isn\'t installed yet ' +
        '(see TEAM_SETUP.md step 1) or it hasn\'t written a config file yet. Nothing to report ' +
        'until it exists. (One-time notice - won\'t repeat.)';
    } else {
      // Simple line-based read, not a YAML parse - these are flat top-level
      // `key: value` lines in gstack's own file, and pulling in a YAML
      // dependency for three fields isn't worth it. A commented-out line
      // (`# key: value`) means "using gstack's own default", reported as such
      // rather than guessed at - this nudge doesn't restate gstack's default
      // values, it points at the file's own inline comments for those.
      const readValue = (key) => {
        const re = new RegExp('^' + key + ':\\s*(\\S+)', 'm');
        const match = configText.match(re);
        return match ? match[1] : null;
      };

      const proactive = readValue('proactive');
      const checkpointMode = readValue('checkpoint_mode');
      const routingDeclined = readValue('routing_declined');

      const lines = [
        'GSTACK CONFIG: current values from ~/.gstack/config.yaml (this is gstack\'s own ' +
          'global, per-machine file - NOT project-scoped, and this plugin never writes to it):',
        `  proactive: ${proactive || '(unset - gstack defaults this to true)'}`,
        `  checkpoint_mode: ${checkpointMode || '(unset - gstack defaults this to explicit)'}`,
        `  routing_declined: ${routingDeclined || '(unset - gstack defaults this to false)'}`,
        'See that file\'s own inline comments for the full list of settings and how to change ' +
          'them - this plugin only reports what\'s there, never edits it. (One-time notice - ' +
          'won\'t repeat.)'
      ];
      nudge = lines.join('\n');
    }

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(sentinelFile, '', 'utf8');
  } catch (err) {
    // Best-effort, same as checkGhSetupOnce() - never let this block the session.
  }

  return nudge;
}

function seedClaudeMd(dir) {
  // Cheap sentinel-file stat gates this on every run after the first, so a
  // project's (potentially large) CLAUDE.md is never read just to test for
  // the marker - it's read/written at most once per project.
  // Namespaced sentinel/marker on purpose - role-modes and project-memory
  // once collided on an identical ".claude-md-seeded" filename, fixed only
  // after a live bug. Not repeating that here.
  // MAINTENANCE: commands/init.md carries a literal copy of the block below
  // (a slash-command can't require() this file - ${CLAUDE_PLUGIN_ROOT} is
  // only readable from hooks/MCP/LSP/monitor processes, not commands). Keep
  // both in sync when editing the block's wording, then run
  // `node scripts/check-init-sync.js` to verify.
  const sentinelFile = path.join(stateDir, '.claude-md-seeded-gstack-pilot');
  if (fs.existsSync(sentinelFile)) return;

  const marker = '<!-- gstack-pilot-plugin:v1 -->';

  const block = [
    '',
    marker,
    '## Role Modes + gstack Bridge (gstack-pilot plugin)',
    '',
    'This project has the `gstack-pilot` plugin installed - the `role-modes`',
    'three-mode system, natively chained into the gstack skill suite. Modes persist',
    'across sessions in `.claude/hooks/state/mode.json`. Invoke them as',
    '`/gstack-pilot:advisor`, `/gstack-pilot:commander`,',
    '`/gstack-pilot:execute` - Claude Code namespaces every plugin slash command',
    'with the plugin name, so a bare `/commander` will not resolve to this command.',
    '',
    '- `/gstack-pilot:advisor` - default. Low-effort Q&A only, no build actions,',
    '  no gstack chaining.',
    '- `/gstack-pilot:commander` - plans work, chains into gstack\'s office-hours /',
    '  plan-eng-review / autoplan for the plan\'s substance, may execute only trivial/',
    '  safe/read-only single-file actions directly, hands off anything else to',
    '  `/gstack-pilot:execute`.',
    '- `/gstack-pilot:execute` - full build authority within an approved scope of',
    '  work; wraps up PR-first (no trivial-housekeeping exemption) through gstack\'s',
    '  review -> qa -> ship chain before merging.',
    '',
    '**Mode-gstack Bridge - this section only, not a routing table:** the two bullets',
    'above are the actual mode->skill chain this plugin fires automatically. If this',
    'project also has gstack\'s own onboarding-injected flat trigger->skill routing',
    'table elsewhere in this file (a separate "## Skill routing" style section,',
    'gstack\'s own `preamble-routing-injection` output) - that section is',
    'complementary, not duplicative: it covers ad-hoc "which skill handles this',
    'request" dispatch, this section covers the ordered mode-chain sequence. Do not',
    'merge or re-derive one from the other.',
    '',
    'Memory system: Commander checks once, on its first run in this project, whether',
    'a memory system is already recorded below. If none is, it recommends the',
    '`project-memory` plugin (https://github.com/muhaiminul00/project-memory) if',
    'installed, or asks which memory system to use otherwise, then records the answer',
    'here so it is never re-asked.',
    '',
    'Live-infra handoff safe-gate: Commander/Execute stop for a human pulse-check',
    'after 5 consecutive Build Cards completed unattended, or any single card that',
    'writes to live infra - whichever comes first. Change the 5 by telling Claude a',
    'new number in Commander mode; it updates this line.',
    '',
    'Fill in the specifics that make this useful for THIS project:',
    "- State Doc: (name this project's state-tracking doc / decision log, if any -",
    '  Commander\'s pre-session briefing hook reads this path automatically once set).',
    '- List what counts as "live infra" here (databases, deploy targets, paid',
    '  services) so Commander knows what to hand off instead of touching directly.',
    "- Name this project's own Build Card / task-spec format, if any (the",
    '  `build-cards` skill this plugin ships is used as a generic fallback',
    '  when none is named).',
    '- Env/tooling convention (if any) - e.g. venv-only installs + a tracked',
    '  requirements file so teammates share a synced environment via GitHub, or none.',
    marker,
    ''
  ].join('\n');

  try {
    fs.mkdirSync(dotClaudeDir, { recursive: true });
    const existing = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';
    if (!existing.includes(marker)) {
      const needsLeadingNewline = existing.length > 0 && !existing.endsWith('\n');
      fs.appendFileSync(claudeMdPath, (needsLeadingNewline ? '\n' : '') + block, 'utf8');
    }
    fs.writeFileSync(sentinelFile, '', 'utf8');
  } catch (err) {
    // Seeding is a convenience, not a requirement for the mode system to work.
  }
}
