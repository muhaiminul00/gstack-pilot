---
name: build-cards
description: Use in Commander mode when scoping a unit of work for Execute, if this project doesn't already define its own task-spec/Build Card format. Generic fallback for turning a plan into a scoped, checkable work order.
---

# Build Cards

A generic fallback format for scoping one unit of work before handing it to
Execute. This exists because Commander needs *some* consistent shape for
"here is exactly what to build and how to know it's done" - if this
project's own `CLAUDE.md` already names a Build Card / task-spec format,
use that instead and ignore this skill; this is only for projects that
haven't defined one.

Note for `gstack-pilot` specifically: this skill scopes the card
*after* the gstack planning chain (office-hours/plan-eng-review/autoplan)
has already produced the plan's substance - it is the packaging format for
that output, not a substitute for the chain itself.

## When to use this

- You're in Commander mode, a scope of work has been approved, and you're
  about to hand off to Execute.
- This project's `CLAUDE.md` (root or `.claude/CLAUDE.md`) does not name
  its own Build Card / task-spec convention.

## The fields

Every card should have, at minimum:

- **ID** - short, stable identifier (`BC-001`, a ticket number, whatever
  this project already uses elsewhere - invent a scheme only if none
  exists).
- **Target** - the specific thing being built or changed (a file, a
  function, a workflow, a migration - not "the feature" in general).
- **Objective** - purpose, inputs, outputs. What this card exists to
  accomplish, concretely enough that "done" is checkable.
- **Dependencies** - anything this card assumes already exists or is
  already true.
- **Scope** - a list of concrete file/directory paths this card touches.
  Filled in at the same time as `Target`/`Dependencies`, scoped to this
  card's lifetime - it goes stale at exactly the rate `Target` would, which
  is a normal, accepted cost of scoping work, not a new risk. Used by
  Execute's pre-flight sync gate (`scripts/pre-flight-sync.js`) to check
  open PRs for real file-path overlap before this task's branch starts -
  without a `Scope` field there's nothing structured to diff PR file lists
  against.
- **Acceptance Criteria** - the specific, checkable conditions that make
  this card done. Not "works well" - the exact behavior/output expected.
- **Verification** - how Execute proves the criteria are met (a test to
  run, a live check to perform, an output to inspect) - not just "it
  compiles."
- **Definition of Done** - what must exist on disk/in the system when this
  card is finished (files changed, docs updated, anything committed,
  the gstack review/qa/ship chain actually run through to a merged PR).

## How Commander uses this

1. Scope the work into the smallest correct unit that satisfies what was
   asked - no speculative extra scope.
2. Fill in the fields above plainly; skip a field only if it's genuinely
   not applicable, don't pad with boilerplate.
3. Get human approval (or use it as your own handoff pointer when the
   human already said go) before invoking `/gstack-pilot:execute`.
4. Execute treats Acceptance Criteria + Verification as the actual
   contract - not the prose description above them - and reports back
   against those fields specifically.

## What this deliberately doesn't do

No enforced numbering scheme, no required storage location for cards, no
review-workflow ceremony beyond what's above. If a project needs more
structure than this, that belongs in that project's own `CLAUDE.md`, not
in this skill.
