# TODOS

Deferred work with enough context to pick back up later. Not a backlog of
vague ideas — each entry should let someone in 3 months understand why this
was deferred and where to start.

## Semantic collision detection for the PR-scope check

**What:** Extend the Execute pre-flight collision check beyond
exact-path-or-prefix matching (`Scope` field vs. open PR file lists) to
catch collisions through shared APIs, migrations, generated clients,
database contracts, and other indirect coupling.

**Why:** The current design (see `docs/designs/sync-gate-and-collision-check.md`)
deliberately catches only direct file-path overlap. The outside-voice review
that shaped this design correctly noted this misses a real class of
collisions — two tasks touching different files that still break each other
through a shared contract.

**Pros:** Catches a collision category the shipped design structurally can't
see. Reduces the chance of a "clean" pre-flight check that still lands two
agents on a conflicting change.

**Cons:** Genuinely hard — requires understanding what "shared contract"
means per language/framework, not a generic git/gh operation. Almost
certainly Approach-C-scale effort, not a small addition.

**Context:** Start from `docs/designs/sync-gate-and-collision-check.md`'s
"NOT in scope" section. The shipped `Scope`-field mechanism is the
foundation to extend, not replace — this would add a second, heavier check
alongside it, not swap it out.

**Depends on / blocked by:** The base sync-gate + PR-scope check (this
plugin's current Build Card) needs to actually ship and get real usage first
— building semantic detection before knowing how often simple path-overlap
collisions actually occur in practice would be solving an unmeasured
problem.

---

## Local-branch collision detection

**What:** Extend the PR-scope collision check to also compare against
other *local* (not-yet-pushed) branches on the same machine, not just open
GitHub PRs.

**Why:** Two Claude sessions on the same machine, one of which hasn't pushed
yet, are currently invisible to each other's collision check.

**Pros:** Closes a real gap — the current design only sees pushed work.

**Cons:** Deliberately deferred in the original design pass: a teammate's
local unpushed branch on a *different* machine is still invisible regardless
of this feature, so it only helps the narrower same-machine case. Low payoff
relative to the PR-scope check, which covers the more common cross-person
scenario.

**Context:** `docs/designs/sync-gate-and-collision-check.md`'s Open
Questions section flagged this as deferred from the start, re-flagged as
NOT-in-scope after the outside-voice review reinforced the same call.

**Depends on / blocked by:** Nothing structural — could be added to
`scripts/pre-flight-sync.js` independently once that script exists.

---

## Base-branch override field on Build Cards

**What:** A new field on `build-cards/SKILL.md` letting a Build Card name a
non-default integration branch as the sync gate's base, instead of always
resolving to the repo's GitHub default branch.

**Why:** `gh repo view --json defaultBranchRef` is the only base-resolution
path in the current design. A project using a non-default integration
branch (a `develop` branch, a release-train branch) has no way to point the
sync gate at it.

**Pros:** Removes a real limitation for any future project with a
non-default integration-branch workflow.

**Cons:** No current project (Zenny, zm-brain, gstack-pilot itself) needs
this — pure speculative future-proofing today. Also needs its own schema
addition to `build-cards/SKILL.md` alongside the `Scope` field this Build
Card is already adding — better to land as its own small card once the need
is real, not bundled preemptively.

**Context:** `docs/designs/sync-gate-and-collision-check.md`'s Recommended
Approach, step 2, explicitly deferred this with the same reasoning.

**Depends on / blocked by:** The base sync-gate landing first, so there's a
`Scope`-field precedent to follow for how a new Build Card field gets added.

---

## Re-nudge on gh auth regression

**What:** Extend the one-time gh-setup nudge (BC-2026-08-31-gh-setup-loud-nudge)
so it fires again if `gh` auth breaks *after* the sentinel already got
written clean - not just on the very first check ever.

**Why:** The sentinel is written once the check has run, regardless of
outcome - including "already fine." A teammate who sets up `gh` cleanly,
gets no nudge, then loses auth three months later (token expired, revoked,
`gh auth logout` run by accident) gets nothing but the existing per-task
`DISCLOSED:` line in `pre-flight-sync.js` - real-time-accurate, but quiet
and easy to miss in exactly the way the loud nudge was built to fix in the
first place.

**Pros:** Closes the loudness gap for the "regressed after working" case,
not just the "never set up" case the shipped nudge covers.

**Cons:** Needs its own staleness/TTL logic (or an explicit re-check trigger)
that the current design deliberately doesn't have - "sentinel written once,
ever" is simple and was judged good enough for a first ship. Building this
before knowing how often gh auth actually regresses in practice on a real
team would be solving an unmeasured problem, same reasoning the other two
deferred items above already apply.

**Context:** Raised during `/plan-eng-review` for BC-2026-08-31-gh-setup-loud-nudge
(`docs/designs/gh-setup-loud-nudge.md`) and explicitly deferred there rather
than built - see that design doc's NOT-in-scope section and Decision 4.

**Depends on / blocked by:** BC-2026-08-31-gh-setup-loud-nudge shipping
first, so there's a real sentinel mechanism to extend.

---

## Smarter mid-run skill-selection routing

**What:** Replace or augment the fixed 4-case decision table in Execute's
mid-run planning/investigation chain (`investigate` / `plan-eng-review` /
`cso` / `office-hours` / open fallback) with a scored match across all
55 gstack skills, so Execute doesn't have to fall back on its own
judgment for anything outside the four named cases.

**Why:** The fixed table covers the common cases predictably, but the
open fallback ("Execute's own judgment, any gstack skill") has no
structure - it might miss a good fit a scored match would catch more
reliably.

**Pros:** Could meaningfully widen and sharpen the set of situations the
mid-run chain resolves well, instead of leaning on unstructured judgment
outside the four named cases.

**Cons:** Building a scoring system across 55 skills is real effort, and
solving it now would be guessing at a problem that hasn't been measured
yet - we don't know how often the open-fallback path actually misfires
in practice.

**Context:** Raised during `/plan-eng-review` for
BC-2026-08-31-execute-midrun-planning-chain
(`docs/designs/execute-midrun-planning-chain.md`) and explicitly
deferred there rather than built - see that design doc's NOT-in-scope
section.

**Depends on / blocked by:** BC-2026-08-31-execute-midrun-planning-chain
shipping first and getting real mid-run trigger usage, so there's actual
evidence the fixed table's coverage is insufficient before building a
replacement for it.
