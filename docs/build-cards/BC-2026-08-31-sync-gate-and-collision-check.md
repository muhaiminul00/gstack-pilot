# Build Card: BC-2026-08-31-sync-gate-and-collision-check

**Design doc:** `docs/designs/sync-gate-and-collision-check.md` (APPROVED,
survived 3 rounds of adversarial review + 1 outside-voice/Codex pass — read
it in full before starting; this card is the packaging, not a substitute).

## Target

Six files in `gstack-pilot`:
1. `scripts/pre-flight-sync.js` (new)
2. `hooks/pre-tool-use.js` (new) + `hooks/hooks.json` (edit — add `PreToolUse` entry)
3. `commands/execute.md` (edit — pre-flight block + wrap-up step 2 reword)
4. `hooks/session-start.js` (edit — extend `modeInstructions.execute`)
5. `skills/build-cards/SKILL.md` (edit — add `Scope` field)
6. `TEAM_SETUP.md` (edit — add `gh` CLI install step)
7. `.claude-plugin/plugin.json` (edit — minor version bump)

## Objective

**Purpose:** Close the gap where `gstack-pilot`'s Execute mode has no
git-freshness awareness at task start — a resumed or fresh Execute session
can branch from a stale base, run over a dirty working tree, or start work
that collides with an already-open PR touching the same files, with no
teammate or Claude session any the wiser until a merge conflict surfaces.

**Inputs:** the repo's git/GitHub state (working tree status, base branch
freshness, open PRs authored by others) and the current Build Card's new
`Scope` field.

**Outputs:** either (a) a written `.claude/hooks/state/preflight-ok` marker
and implementation proceeds, or (b) a STOP (interactive) / BLOCKED (headless)
with a plain-language reason and no marker written — enforced structurally
by a new `PreToolUse` hook, not left to prose compliance alone.

## Dependencies

- `gh` CLI, authenticated — soft dependency for the collision check
  specifically (sync gate + hook enforcement work without it); must be
  documented as an expected install in `TEAM_SETUP.md` (task 6).
- This card adds the `Scope` field to `build-cards/SKILL.md` — it is not
  reusing an existing field. Any Build Card written *after* this one ships
  should include `Scope` if it wants the collision check to see it.

## Acceptance Criteria

1. A dirty working tree stops Execute before any branch/file mutation,
   every time — enforced by the `PreToolUse` hook, not just by
   `execute.md`'s prose, in both fresh and resumed sessions.
2. A stale local base is fast-forwarded via `git fetch origin <base>:<base>`
   (no checkout) before the task branch is created; a diverged base stops
   and reports, never forces.
3. An open PR (excluding the current `gh` user's own PRs) touching files
   that overlap the Build Card's `Scope` field triggers a real stop-and-ask
   (interactive) or BLOCKED (headless) — not a warning that can be skipped
   past.
4. Missing `gh` CLI and unauthenticated `gh` produce two distinct disclosure
   messages, each naming the actual fix.
5. Hitting the `gh pr list --limit 200` cap discloses "more open PRs than
   checked" rather than silently claiming full coverage.
6. A resumed Execute session (mode already `execute` in `mode.json`) still
   sees the pre-flight requirement via `session-start.js`'s injected
   context, and the `PreToolUse` hook still blocks it from mutating files
   without a valid marker for the current branch.
7. A corrupted or unparseable `preflight-ok` marker is treated as **missing**
   (fails closed) — this is the Failure Modes critical gap and is
   non-negotiable, not an implementation shortcut to take.
8. `build-cards/SKILL.md`'s field table documents `Scope` alongside the
   existing fields, worded consistently with how those fields are
   documented.
9. `TEAM_SETUP.md` names `gh` CLI as a setup step, ordered before first
   `/gstack-pilot:execute` use.
10. `.claude-plugin/plugin.json`'s version is bumped (minor) and no
    `marketplace.json` copy exists to drift (per this project's own
    versioning discipline).

## Shared Utilities / Placement

- `scripts/pre-flight-sync.js` follows the existing `scripts/check-init-sync.js`
  precedent for this repo's script conventions (plain Node.js, no OS-specific
  shell).
- `hooks/pre-tool-use.js` follows `hooks/session-start.js`'s and
  `hooks/session-end.js`'s existing conventions (plain Node.js, reads
  `.claude/hooks/state/`).
- `hooks/hooks.json`'s new `PreToolUse` entry follows the file's existing
  `type: command`, `node`, `${CLAUDE_PLUGIN_ROOT}`, `timeout` shape exactly.

## Test Cases / Testing Instructions

No automated test framework exists in this repo (confirmed during
`/plan-eng-review`). Verification is live-dogfood, per the Test Plan
artifact (`~/.gstack/projects/muhaiminul00-gstack-pilot/muhai-main-eng-review-test-plan-*.md`)
and the Failure Modes table in the design doc. At minimum, before Definition
of Done:

- Dirty tree → confirm STOP names exact files, no marker written, `Write`/`Edit` blocked.
- Stale base → confirm silent fast-forward, no human interruption.
- Diverged base → confirm STOP, never a forced push/checkout.
- Resumed session with an existing task branch → confirm no duplicate branch created.
- Own open PR overlapping `Scope` → confirm NOT flagged (self-overlap exclusion works).
- Another author's open PR overlapping `Scope` → confirm STOP/BLOCKED fires.
- `gh` uninstalled → confirm the "not installed" message, distinct from "not authenticated."
- `gh auth logout` → confirm the "not authenticated" message.
- Corrupt the marker file by hand → confirm `Write`/`Edit` is blocked (fail-closed), not allowed through.
- Headless/spawned invocation hitting any STOP condition → confirm BLOCKED, never a silent proceed.

## Definition of Done / Expected Outputs

- All 7 files listed under Target changed as scoped.
- All 10 Acceptance Criteria verified live, per the Test Cases above —
  screenshots/output logs, not assumed.
- `gstack-pilot`'s own mandatory wrap-up: feature branch → PR → gstack's
  `review` → `qa` → `ship` chain → merge (this repo's established PR-first
  practice — confirm whether gstack-pilot still commits direct-to-main by
  convention or has since adopted the branch/PR flow before starting).
- `README.md` updated if the pre-flight/collision-check behavior changes
  what a teammate should expect from `/gstack-pilot:execute` (check
  `document-release`'s output from the `ship` chain for what it flags).
- `Wiki/reference/gstack-pilot-plugin.md` (Zenny's tracking page) gets a new
  entry noting this Build Card once it ships, per Zenny's own Standing
  Rule — Per-Workflow Documentation-adjacent practice for this initiative.

## Open Verification Items Resolved by This Card

- The persisted-mode gap (session resumed mid-Execute never seeing new
  behavior) — resolved by task 4 + the `PreToolUse` hook's own independent
  enforcement (belt and suspenders: even if `session-start.js`'s prose is
  somehow missed, the hook still blocks).
- The prose-only-enforcement gap the outside-voice review raised — resolved
  by adding real hook enforcement instead of stronger wording.

## Explicitly NOT part of this card

See the design doc's "NOT in scope" section — task-ownership registry,
worktrees, GitHub Issues, semantic collision detection, local-branch
collision detection, and base-branch override are all out of scope here,
3 of them logged to `TODOS.md` for future consideration.
