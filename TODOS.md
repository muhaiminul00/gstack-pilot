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

---

## Mid-build fact-indexing as an automatic chain step

**What:** Add a step to Execute's existing chains (wrap-up and/or mid-run
planning) that indexes a durable fact into this project's memory system
as soon as it's learned mid-build, instead of only at end-of-session
wrap-up.

**Why:** Raised during a real Zenny session (2026-09-01): a project's
end-of-session-only indexing means a fact learned early in a long Execute
run sits unindexed for the whole session - if the session ends abnormally
(context exhaustion, crash, human interrupt) before wrap-up, the fact is
lost even though it was genuinely learned and used.

**Pros:** Closes a real loss window that the current wrap-up-only design
structurally can't close. Would make gstack-pilot's memory-system
integration meaningfully more robust for long Execute runs specifically.

**Cons:** No real usage data yet on how often this loss window actually
bites in practice (the mid-run chain shipped 2026-08-31 already reduces
how long Execute goes without a checkpoint) - building an automatic
indexing step needs its own design pass first: what counts as "durable
enough to index immediately" vs. noise that would thrash a project's
Wiki/memory-system with low-value entries, and how the step composes
with "this project's own mandatory wrap-up writes" (already generic,
already project-defined) without duplicating it.

**Context:** Raised alongside the Zenny -> gstack-pilot migration
(`docs/designs/zenny-launch-blueprint.md` is unrelated; see Zenny's own
Wiki entry for this migration, cross-referenced from `Wiki/reference/
gstack-pilot-plugin.md`). Not Zenny-specific in substance - relevant to
any project using gstack-pilot's chains, since indexing is currently
always end-of-session regardless of project.

**Depends on / blocked by:** Real usage evidence that the loss window
matters in practice - same "don't solve an unmeasured problem" standard
this file already applies to the two entries above it.

---

## Conditional project-memory writes in native commands

**What:** When a project's recorded Memory System is the `project-memory`
plugin (not a project's own Wiki/docs system), have gstack-pilot's native
chains (wrap-up, mid-run) write facts/decisions via `project-memory`'s own
commands instead of generic "land this project's own mandatory wrap-up
writes" prose.

**Why:** Raised during the same Zenny session (2026-09-01) as the entry
above - a genuinely portable-plugin-level idea, not Zenny-specific (Zenny
itself uses the raw Wiki, not `project-memory`, so this wouldn't change
anything for Zenny's own migration). Right now gstack-pilot's chains defer
entirely to "this project's own protocol if its CLAUDE.md names one" -
that already works for a `project-memory`-using project today (its own
CLAUDE.md can just say "write facts via project-memory's commands"), so
this would be an optimization/convenience, not closing a real gap.

**Pros:** Would remove one indirection for `project-memory` users
specifically - the chain "just knows" to use the right mechanism instead
of relying on the project's own CLAUDE.md to spell it out.

**Cons:** No project has hit the generic "defer to this project's own
protocol" mechanism as insufficient yet. Building project-memory-specific
branching into gstack-pilot's own native commands is real coupling
between two separate plugins that currently have zero direct dependency
on each other - worth being sure the generic mechanism is actually
inadequate before adding it.

**Context:** Raised alongside the Zenny -> gstack-pilot migration; see
Zenny's Wiki entry for that migration (cross-referenced from `Wiki/
reference/gstack-pilot-plugin.md`) for the full raw idea as the human
phrased it.

**Depends on / blocked by:** A real project using both `gstack-pilot` and
`project-memory` together, hitting the generic mechanism as actually
insufficient in practice - not yet observed anywhere.
