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
