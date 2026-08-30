# Design: One-time loud gh-setup nudge (follow-up to BC-2026-08-31)

**Supersedes:** none — additive follow-up to
`docs/designs/sync-gate-and-collision-check.md` (shipped v1.1.0). That design
explicitly flagged, and accepted, the risk this closes: "a team that skips
installing [gh] gets a plugin that silently runs without collision detection,
which defeats half the point of this card, even though nothing breaks"
(sync-gate-and-collision-check.md:299-301).

## Problem

`scripts/pre-flight-sync.js` already soft-degrades correctly when `gh` is
missing or unauthenticated: the sync gate (dirty-tree, base-freshness) still
runs, only the PR-scope collision check is skipped, and it prints
`DISCLOSED: PR-scope collision check unavailable — gh CLI not installed` (or
`— gh not authenticated`) every time this happens.

The gap: that line reprints on *every single task, forever*, with no
escalation and no distinct signal for "never set up" versus "set up, later
broke." Nothing distinguishes a team that deliberately doesn't use GitHub PRs
from a team that never got past `TEAM_SETUP.md` step 3. In a headless/spawned
run especially, the line can scroll by unseen indefinitely.

## Decisions locked (via /plan-eng-review, human-confirmed)

1. **Placement — session-start.js + init.md, shared sentinel.** Both files
   run the identical gh install+auth check, gated by one new sentinel
   `.claude/hooks/state/.gh-setup-checked-gstack-pilot`. This is the same
   duplication pattern the plugin already uses for the CLAUDE.md starter
   block (`init.md` and `hooks/session-start.js` both write it,
   byte-verified by `scripts/check-init-sync.js`) — chosen over
   session-start.js alone because `/plugin install` never fires
   `SessionStart` (documented limitation, same one `init.md` already
   exists to work around), so a teammate running `/gstack-pilot:init`
   manually right after install would otherwise wait for a later real
   session boundary to see the nudge.
2. **Never a hard block.** `gh` stays a soft dependency per the parent
   design doc. The nudge is informational only — it never exits non-zero,
   never stops `session-start.js`'s or `init.md`'s other work, in any
   session kind (interactive, headless, spawned).
3. **What "loud" means.** For `session-start.js`: the nudge text is appended
   to `additionalContext` alongside the existing mode-instructions text —
   the same channel Commander/Execute mode prose already uses, so it's
   impossible to miss without reading past what's already read every
   session. For `init.md`: an explicit line in the command's existing
   "report exactly what was created" step. Same two-message wording as the
   existing per-task check (distinct "not installed" vs "not
   authenticated" messages), for voice consistency.
4. **Existing per-task DISCLOSED line: untouched, kept forever.** Not
   silenced after the one-time nudge fires. The one-time nudge is a
   loud first impression; the per-task line stays the real-time-accurate
   signal (a teammate can set up gh clean, get no nudge, then lose auth
   three months later — only the per-task line would catch that; see
   TODOS.md's new "Re-nudge on gh auth regression" entry for closing that
   gap for real).
5. **Sentinel semantics.** Written once the check has *run*, regardless of
   outcome — including the "already fine" case (gh installed and
   authenticated at first check) — so a later `gh auth logout` doesn't
   retroactively need a nudge that would be redundant with the per-task
   line. Deleting the sentinel file re-arms the nudge, same mechanism as
   the existing `.claude-md-seeded-gstack-pilot` pattern.

## What already exists (reused, not rebuilt)

- `pre-flight-sync.js`'s own `gh --version` / `gh auth status` check logic
  and message wording — the new one-time check reuses the same two
  messages, doesn't invent new copy.
- The namespaced-sentinel + "check once, write file, never re-fire"
  mechanism `init.md` and `session-start.js` already implement for the
  CLAUDE.md starter block.
- `TEAM_SETUP.md` step 3 — the nudge points at it, doesn't duplicate its
  content.

## NOT in scope

- **Auto-installing or auto-authenticating `gh`.** `gh auth login` is an
  interactive OAuth/browser flow; nothing can complete it behind an
  approval click. Same reasoning `TEAM_SETUP.md`'s "why two mechanisms"
  section already states for plugin-install steps.
- **Silencing the per-task DISCLOSED line** after the one-time nudge fires
  — deliberately kept, see Decision 4.
- **Periodic re-nudge on later gh-auth regression** — deferred to
  `TODOS.md` (new entry, this session).

## Test Plan (live-dogfood — no automated test framework in this repo, per
BC-2026-08-31 precedent)

- Fresh scratch repo, `gstack-pilot` installed, no sentinel: first real
  session → nudge appears once in `additionalContext`, sentinel written.
- Same repo, second session: no repeat nudge.
- `gh` already installed+authenticated at first check: no nudge text, but
  sentinel is still written (verify by checking the file exists after a
  clean-gh session).
- `/gstack-pilot:init` run manually on a repo where `session-start.js`
  hasn't fired yet: nudge appears via `init.md`'s report; sentinel written;
  a subsequent real session does NOT re-nudge (shared sentinel confirmed).
- `/gstack-pilot:init` run on a repo where the sentinel already exists
  (session-start.js fired first): no duplicate nudge.
- Missing vs unauthenticated `gh` produce the two distinct, already-worded
  messages.
- Confirm in all of the above: nothing exits non-zero, nothing blocks.

## Failure modes

| Codepath | Failure | Test/handling | Silent? |
|---|---|---|---|
| Sentinel write | Disk full / permissions error | Not fatal — hook continues; next session just re-nudges (self-healing, non-critical since nudge is advisory-only) | Visible next session |
| `gh --version` / `gh auth status` subprocess | Hangs or errors unexpectedly | Same risk profile as the existing, already-shipped per-task check in `pre-flight-sync.js` — no new exposure | N/A, pre-existing |
| Shared sentinel race (session-start.js and init.md both check "did it fire" near-simultaneously) | Double nudge, once each | Low-severity, cosmetic only (never blocks); not worth mutex complexity for an advisory-only, once-ever event | Visible, harmless |

No critical gaps — every codepath here is advisory-only by design (soft
dependency, never blocks), so no failure mode escalates to loss of build
functionality.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 2 issues found (placement, TODO capture), both resolved with user |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | SKIPPED | Codex/outside-voice infra not exercised this pass — small, low-risk, single-repo follow-up; environment constraints (no confirmed codex CLI) made the round trip not worth the cost for a 4-file advisory-only change. Disclosed, not silently skipped. |

**VERDICT:** ENG CLEARED — ready to implement. (Codex/outside-voice
deliberately skipped and disclosed above, not run-and-hidden; CEO/Design
reviews not applicable to this backend-only, non-product-scope change.)

NO UNRESOLVED DECISIONS
