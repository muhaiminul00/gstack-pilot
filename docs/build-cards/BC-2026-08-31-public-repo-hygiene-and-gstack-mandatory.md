# Build Card: BC-2026-08-31-public-repo-hygiene-and-gstack-mandatory

No separate design doc — four small, independently-scoped fixes, decided
directly with the human this session (2 real decisions via AskUserQuestion,
2 fact-checks that resolved to "no change needed" / "straightforward
reorder"). Packaged together because they're all repo-hygiene/onboarding
fixes, not because they're related in mechanism.

**Note on this card's own file:** this Build Card itself, once merged,
becomes one of the very files Target 1 below moves out of git tracking —
that's expected, not a bug. Write it to `docs/build-cards/` as normal for
now (matches existing precedent, keeps this session's audit trail intact
until the untrack step runs), Target 1's `git rm --cached` sweep picks it
up along with the rest.

## Scope

- `docs/build-cards/*.md` (untrack, not delete from disk)
- `docs/designs/*.md` (untrack, not delete from disk)
- `.gitignore`
- `README.md` (doc-reference fix + Install section reorder)
- `hooks/session-start.js` (new gstack-config nudge)
- `commands/init.md` (same nudge, shared sentinel)
- `.claude-plugin/plugin.json` (minor bump — Target 3 is new user-facing behavior)

## Target 1 — untrack `docs/build-cards/` and `docs/designs/` from git, keep on disk

**Decision locked with human:** these stay on disk (so `plan-eng-review`'s
repo-local design-doc search still finds them when we're the ones
developing gstack-pilot) but stop being public — a plugin consumer
browsing GitHub doesn't need our internal Build-Card/design-doc history,
same category of thing as Zenny's own Wiki tracking page.

Steps:
1. Add to `.gitignore`:
   ```
   # Internal build history — kept on disk for plan-eng-review's local
   # design-doc search, but not public. See
   # BC-2026-08-31-public-repo-hygiene-and-gstack-mandatory.
   docs/build-cards/
   docs/designs/
   ```
2. `git rm -r --cached docs/build-cards docs/designs` (untracks, does NOT
   delete the files from the working tree — verify after with `git status`
   that the files still exist on disk and now show as untracked, not
   deleted).
3. This is a one-way change for the *current* tracked history going
   forward (existing commits in git history still contain these files —
   purging git history itself is explicitly NOT part of this card, don't
   attempt a history rewrite).

## Target 2 — `CLAUDE.md`: no change, confirmed correct as-is

Explicitly not part of this card's scope — flagged to the human this
session and confirmed: this repo's root `CLAUDE.md` (gstack's own flat
skill-routing table) is used for real, every time a Claude Code session
(ours, via `/gstack-pilot:execute`) works ON this repo — it's what makes
gstack's own `/review`/`/ship` route correctly when dogfooding on
gstack-pilot's own PRs. It is never read by a consuming project that
installs gstack-pilot as a plugin. Do not touch this file as part of this
card.

## Target 3 — gstack global-config nudge (new, mirrors the gh-setup nudge pattern)

**Decision locked with human (AskUserQuestion):** build it, informational
only, never writes to the file.

`~/.gstack/config.yaml` is gstack's own global, per-machine config (NOT
project-scoped, lives outside any repo) — the file backing settings like
`proactive`, `checkpoint_mode`, `routing_declined`, `skip_eng_review`,
etc. (see the file's own extensive inline comments for the full list;
don't re-derive or duplicate that list into the nudge text — point at the
file instead). Most of these already default sensibly (`proactive`
defaults `true`), so this is a lighter-weight version of the gh-nudge, not
an urgent gap — but the human wants it built now while the same mechanism
is fresh.

**Mechanism — mirror `gh-setup-loud-nudge` exactly, new sentinel:**
- New sentinel: `.claude/hooks/state/.gstack-config-checked-gstack-pilot`
  (namespaced, following the existing convention exactly — never bare).
- `hooks/session-start.js`: on first run (sentinel absent), if
  `~/.gstack/config.yaml` exists, read it and append a short summary to
  `additionalContext` — current values for `proactive`, `checkpoint_mode`,
  and `routing_declined` (the three most relevant to how gstack-pilot's
  own chaining behaves), plus one line pointing at
  `~/.gstack/config.yaml`'s own comments for the full list and how to
  change them. If the file doesn't exist at all (gstack not installed, or
  installed but never configured), say that plainly instead — don't guess
  values. Write the sentinel either way once the check has run, same
  "written regardless of outcome" semantics as the gh nudge.
- `commands/init.md`: identical check as a numbered step, sharing the same
  sentinel, same no-double-fire logic as the gh-nudge's Target 2 (session-
  start.js and init.md must not both nudge if the other already ran the
  check first).
- **Never blocks, never writes to `~/.gstack/config.yaml`.** Purely
  informational, in every session kind (interactive, headless, spawned) —
  same discipline as the gh nudge's Acceptance Criteria 6.
- Reuse the gh-nudge's actual code shape (read a file, check for its
  existence, append text to `additionalContext` / init report) rather
  than reinventing the check logic from scratch — same file, same
  function if that's cleaner, just don't duplicate logic patterns that
  already exist correctly in this repo for the gh check.

## Target 4 — README: gstack install is mandatory, not optional — fix the ordering

**Fact confirmed this session:** `TEAM_SETUP.md` already gets this right
(gstack install is step 1, before the plugin, with an explicit "required
before your first `/gstack-pilot:execute`" framing on the `gh` step
right next to it). The main `README.md`'s own **Install** section is the
one that's wrong — it currently lists gstack under a soft "If your
project also wants gstack itself, team-installed" heading, positioned
*after* the plugin-install commands, symmetric with the genuinely-optional
project-memory install right below it. That's backwards: gstack-pilot's
entire stated purpose (chaining into gstack skills) does nothing useful
without gstack present.

Fix, in the README's `## Install` section:
1. Move the gstack-install block to come **before** the
   `/plugin marketplace add .../gstack-pilot` commands, not after.
2. Reword its heading from "**If your project also wants gstack itself,
   team-installed:**" to something that states it's a prerequisite, not
   an option — e.g. "**Prerequisite — gstack itself must be installed
   first:**" (exact wording is Execute's call, keep it accurate to what
   Target 3 and the rest of this README already say about gstack being
   the thing this plugin wraps).
3. Keep the existing accurate technical caveat sentence ("gstack-pilot
   does not install or wrap gstack's own installer...") — that's correct
   and shouldn't be softened, just move with the block.
4. The project-memory install block stays genuinely optional, unchanged,
   still positioned after the plugin install — do not conflate the two;
   only gstack's status is changing here.
5. Fix the 5 broken/soon-to-be-broken README references to
   `docs/build-cards/...` and `docs/designs/...` (lines ~361, 375-376,
   389-390, per this session's grep) — those paths still exist on disk
   after Target 1 (untracked, not deleted), so the files themselves
   aren't gone, but a public README pointing a reader at a path that
   doesn't exist in their clone (since Target 1 stops them being tracked)
   is misleading. Either drop the sentence that cites them (state the
   rationale inline instead, briefly) or reword to make clear these are
   internal references not expected to resolve for external readers —
   Execute's judgment on which reads better in context, but don't leave
   a dead-looking path reference unexplained.

## Acceptance Criteria

1. `git status` after Target 1 shows `docs/build-cards/*.md` and
   `docs/designs/*.md` as untracked (not deleted) — files still present
   on disk, verified by `ls`.
2. `.gitignore` has the new `docs/build-cards/` / `docs/designs/` entries,
   with the explanatory comment.
3. A fresh `git clone` of the pushed repo does NOT contain
   `docs/build-cards/` or `docs/designs/` — verified live (clone to a
   scratch directory, check).
4. `CLAUDE.md` is byte-identical to before this card — confirmed
   untouched.
5. `hooks/session-start.js` and `commands/init.md` both implement the
   gstack-config nudge, sharing sentinel
   `.gstack-config-checked-gstack-pilot`, no double-fire — verified live
   in a scratch repo the same way the gh-nudge's AC1/AC2/AC4 were
   verified (first session nudges once, second doesn't, init.md path
   shares the sentinel correctly).
6. The nudge never writes to `~/.gstack/config.yaml` — confirmed by
   diffing the file's mtime/content before and after a nudge fires.
7. The nudge never blocks — confirmed no new exit-with-error path in
   either touched file.
8. README's Install section lists gstack as a prerequisite, before the
   plugin-install commands, worded as mandatory not optional — verified
   by reading the file after edit.
9. project-memory's install block is unchanged in status (still optional,
   still after) — confirmed by reading the file, not just diffed
   mentally.
10. All 5 `docs/build-cards`/`docs/designs` path references in README are
    resolved (either removed or clearly reworded) — verified by re-
    grepping `docs/build-cards\|docs/designs` in README.md after the edit
    and confirming each remaining hit reads sensibly for an external
    reader.
11. `.claude-plugin/plugin.json` bumped (minor — Target 3 is new
    user-facing behavior; Targets 1/4 are hygiene/doc fixes that don't
    independently require a bump but ride along).

## Test Cases / Testing Instructions

No automated test framework in this repo (same as prior cards this
session). Live verification:
- Scratch clone of the pushed repo, confirm docs/ subfolders absent.
- Scratch repo, no sentinel: first session shows the gstack-config nudge
  in `additionalContext` (or the "file doesn't exist" message if gstack
  isn't installed there); second session doesn't repeat it.
- `/gstack-pilot:init` run manually before any session, same no-
  double-fire check as the gh-nudge's precedent.
- Confirm `~/.gstack/config.yaml` unchanged after the nudge fires (content
  diff).
- Read README's Install section end to end — confirm it reads naturally
  with gstack first, not just grammatically patched.

## Definition of Done / Expected Outputs

- All 7 files/targets in Scope changed as scoped, all 11 Acceptance
  Criteria verified live.
- Version bumped, tag + GitHub release cut in the same sitting as the
  merge — same discipline as every prior card this session.
- `gstack-pilot`'s own mandatory wrap-up: feature branch → PR → gstack's
  `review` → `qa` (or explicitly-disclosed substitute) → `ship` → merge.
- `00_Project_Control/Wiki/reference/gstack-pilot-plugin.md` (Zenny's
  tracking page) gets a new entry once this ships.

## Explicitly NOT part of this card

- Purging `docs/build-cards`/`docs/designs` content from git *history* —
  only current/future tracking changes.
- Any change to `CLAUDE.md` — confirmed correct as-is (Target 2 is a
  no-op, documented for completeness).
- Forcing or writing to `~/.gstack/config.yaml` — informational nudge
  only, per the locked decision.
- `gstack-team-init` / any change to how gstack itself gets installed —
  this card only reorders/rewords the existing README instructions, it
  doesn't touch the mechanism.
