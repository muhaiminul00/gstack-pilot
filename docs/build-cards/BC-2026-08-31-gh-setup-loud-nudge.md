# Build Card: BC-2026-08-31-gh-setup-loud-nudge

**Design doc:** `docs/designs/gh-setup-loud-nudge.md` (locked via
`/plan-eng-review`, 2 decisions confirmed with human — read it in full before
starting; this card is the packaging, not a substitute).

## Scope

- `hooks/session-start.js`
- `commands/init.md`
- `TODOS.md`
- `.claude-plugin/plugin.json`
- `README.md`

## Target

Five files in `gstack-pilot`:
1. `hooks/session-start.js` (edit — one-time gh install+auth check, gated by
   new sentinel `.claude/hooks/state/.gh-setup-checked-gstack-pilot`, nudge
   text appended to `additionalContext`)
2. `commands/init.md` (edit — identical check as a numbered step, same
   shared sentinel — no double-fire if `session-start.js` already ran it)
3. `TODOS.md` (edit — add "Re-nudge on gh auth regression" entry, per the
   design doc's NOT-in-scope deferral)
4. `.claude-plugin/plugin.json` (edit — minor version bump, new user-facing
   behavior)
5. `README.md` (edit — mention the new one-time gh-setup nudge if it
   changes what a teammate should expect at first session/`init`)

## Objective

**Purpose:** Close the "silent-forever" gap in `pre-flight-sync.js`'s
already-correct soft-degrade behavior — nothing today distinguishes "team
deliberately doesn't use gh" from "gh was never set up and the per-task
`DISCLOSED:` line has been scrolling by unnoticed."

**Inputs:** `gh --version` / `gh auth status` exit status, the sentinel
file's presence.

**Outputs:** either (a) no nudge (sentinel already present, or gh checks
out clean — sentinel written either way) or (b) a one-time nudge naming
exactly what's missing (not installed vs not authenticated) and pointing at
`TEAM_SETUP.md` step 3, surfaced via `additionalContext` (session-start.js)
or the init report (init.md). Never blocks, in any session kind.

## Dependencies

- Reuses `pre-flight-sync.js`'s existing gh-installed / gh-authenticated
  check logic and message wording — do not invent new copy for these two
  states.
- Reuses the existing namespaced-sentinel mechanism `init.md` and
  `session-start.js` already implement for the CLAUDE.md starter block
  (`.claude-md-seeded-gstack-pilot`) — same pattern, new sentinel name.
- Does not touch `pre-flight-sync.js` itself — the per-task `DISCLOSED:`
  line there is explicitly kept as-is (design doc Decision 4).

## Acceptance Criteria

1. On a fresh repo/session with no prior sentinel, the first `SessionStart`
   that resolves gh as missing or unauthenticated appends a clear,
   once-only nudge to `additionalContext` naming which of the two it is and
   pointing at `TEAM_SETUP.md` step 3 — verified live in a scratch repo.
2. After the nudge fires once (sentinel written), a second `SessionStart`
   in the same repo does NOT re-print it.
3. If gh is already installed+authenticated at first check, no nudge text
   appears, but the sentinel is still written (verified by checking the
   file exists after a clean-gh session).
4. `/gstack-pilot:init`'s manual path performs the identical check and
   shares the same sentinel — no double-fire when `session-start.js` already
   ran it first, and vice versa (`init.md` run before any real session on a
   fresh install still nudges once).
5. The existing per-task `DISCLOSED: ...` line in `pre-flight-sync.js` is
   byte-identical to before this card — untouched, still fires on every
   task where gh is unavailable regardless of the one-time nudge's outcome.
6. The nudge never blocks in any session kind (interactive, headless,
   spawned) — confirmed no new exit-with-error path exists in either
   touched file.
7. Nudge wording distinguishes "not installed" vs "not authenticated" using
   the same two messages `pre-flight-sync.js` already uses — verified by
   direct comparison, not just visual similarity.
8. `TODOS.md` has the new "Re-nudge on gh auth regression" entry, in the
   same format (What/Why/Pros/Cons/Context/Depends-on) as the three
   existing entries.
9. `.claude-plugin/plugin.json`'s version is bumped (minor) — and this time,
   a matching `git tag` + `gh release create` is cut in the same sitting as
   part of this card's own wrap-up (the exact step that was missed on the
   1.1.0 release — see `Wiki/reference/gstack-pilot-plugin.md`'s
   after-the-fact correction note).
10. `README.md` reflects the new nudge if it's genuinely a teammate-visible
    behavior change (check what a fresh install now shows at first
    session/`init` that it didn't before).

## Shared Utilities / Placement

- The gh-check logic itself should be near-identical text/structure in both
  `session-start.js` and `init.md`, matching how the CLAUDE.md starter
  block is already deliberately duplicated between the two (no
  `require()`-sharing possible across the hook/command execution-context
  boundary — documented in `init.md`'s own "Maintenance note").
- Sentinel path convention: `.claude/hooks/state/.gh-setup-checked-gstack-pilot`
  (empty marker file), following the existing `.claude-md-seeded-gstack-pilot`
  naming convention exactly (namespaced, never bare).

## Test Cases / Testing Instructions

No automated test framework exists in this repo (same as BC-2026-08-31).
Live-dogfood verification, per `docs/designs/gh-setup-loud-nudge.md`'s Test
Plan and Failure Modes table. At minimum, before Definition of Done:

- Fresh scratch repo, no sentinel → first session nudges once, sentinel
  written.
- Second session, same repo → no repeat nudge.
- gh already clean at first check → no nudge text, sentinel still written.
- `/gstack-pilot:init` run manually before any real session → nudges once,
  shared sentinel prevents a later session from double-nudging.
- `/gstack-pilot:init` run after `session-start.js` already nudged → no
  duplicate.
- Missing gh vs unauthenticated gh → two distinct, correctly-worded
  messages.
- Confirm in every case above: nothing exits non-zero, nothing blocks.

## Definition of Done / Expected Outputs

- All 5 files listed under Target changed as scoped.
- All 10 Acceptance Criteria verified live, per the Test Cases above —
  output logs, not assumed.
- Version bump AND the matching git tag + GitHub release cut in the same
  sitting — do not repeat BC-2026-08-31's release-step gap.
- `gstack-pilot`'s own mandatory wrap-up: feature branch → PR → gstack's
  `review` → `qa` (or explicitly-disclosed substitute, same as BC-2026-08-31
  precedent) → `ship` → merge.
- `00_Project_Control/Wiki/reference/gstack-pilot-plugin.md` (Zenny's
  tracking page) gets a new entry once this ships.

## Open Verification Items Resolved by This Card

- The "silent-forever soft-degrade" gap the parent design doc
  (`sync-gate-and-collision-check.md`) explicitly flagged and accepted as a
  known risk at ship time — resolved here via the one-time loud nudge.

## Explicitly NOT part of this card

- Auto-installing or auto-authenticating `gh` (interactive OAuth/browser
  flow, cannot be delegated — see design doc NOT-in-scope).
- Silencing the existing per-task `DISCLOSED:` line.
- Periodic re-nudge on later gh-auth regression — logged to `TODOS.md`
  instead of built here.
