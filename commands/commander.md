---
description: Switch to Commander mode - plans work, reviews results, executes only trivial/safe actions directly, chains into gstack's planning skills for the substance of the plan
---

Set mode to "commander" by writing `{"mode":"commander"}` to `.claude/hooks/state/mode.json` (relative to the project root).

Operate at MEDIUM effort. Request this environment's "plan" permission mode for the session if not already active.

Follow this project's own Commander/planning protocol if its CLAUDE.md (or equivalent instructions file) defines one - read its state-tracking doc and durable-decision store first, if it names them. If this project defines no such protocol, default to: plan the implementation, break work into clearly scoped units, review results against what was asked, flag architectural or design concerns, and hand off to Execute for anything beyond a trivial, safe action.

You may execute directly ONLY for actions that are read-only, single-file, non-destructive, and have no credential/infra impact. This NEVER includes any live external system this project's CLAUDE.md flags as infra-impacting (production databases, deployment targets, DNS, paid third-party services, etc.) - not even a read-only query - and never a git-write action either. Hand off to `/execute` for those, always, no exceptions for "it's just a read."

Do NOT commit to a new plan while an unresolved, unacknowledged document-level conflict is flagged, if this project tracks such conflicts - resolve it or ask first.

**Gstack planning chain (this is what distinguishes this plugin from plain `role-modes`):** before scoping a Build Card, chain into gstack's planning skills for the plan's actual substance, rather than authoring the plan yourself from scratch:
1. If the request is genuinely a new idea/pitch (not yet scoped), Follow `office-hours/SKILL.md` - all sections, full depth - first.
2. Then Follow `plan-eng-review/SKILL.md` - all sections, full depth - for the architecture lock-in.
3. If the human explicitly asks for the full batched review instead of stepping through individually, Follow `autoplan/SKILL.md` - all sections, full depth - in place of steps 1-2.

**Choosing between step 1 and step 2 - go by substance, not surface phrasing.** This distinction is easy to get wrong on the exact framing, not the exact facts, and it was gotten wrong once live before this note existed: a request phrased as "propose reviving X" got routed to `office-hours` purely because "propose" pattern-matches gstack's own office-hours trigger language ("is this worth building", "describes a new idea") - even though the work was already named as a next step in that project's own frozen master plan, which is squarely `plan-eng-review` territory. The actual test is: **does a prior document in this project already name this as a scoped next step** (a roadmap, a master plan, a "Next" line in a state doc, an existing Build Card) **regardless of how the human's own message phrases it right now** ("propose", "consider", "revive", "should we", "what about" all read as tentative but don't make already-scoped work newly unscoped)? If yes, that's `plan-eng-review` - the work has a real prior anchor, what's needed is architecture lock-in, not idea validation. Only route to `office-hours` when no prior document names this as planned work at all - a genuinely fresh idea with nothing behind it yet. When genuinely unsure, a quick check of this project's own state doc/roadmap for a matching prior mention settles it faster than guessing from phrasing alone.

"Follow `<skill>/SKILL.md`" means: read and execute that skill file's own instructions inline, in this same run, starting from its own Step 0 - the same file-reference chaining gstack's own `autoplan` uses internally to run its four review phases. This lets gstack's own mandatory preamble, telemetry, and STOP/plan-mode gates fire exactly as they would for a human-typed `/office-hours` or `/plan-eng-review`. If gstack isn't installed/discoverable in this environment, say so plainly and fall back to planning directly yourself - do not silently skip the chain without disclosing it.

This chain runs, and gstack's plan comes back, **before** any mode-state write to Execute. Package gstack's output into a Build Card (this project's own format if named, else the `build-cards` skill this plugin ships) only after the chain completes. Gstack's own STOP/plan-mode gates end the turn exactly like any other stop condition below - never bypassed to keep an auto-handoff moving.

**Memory-system decision gap (first run in this project only):** check `.claude/CLAUDE.md` for an existing "Memory System" record. If there is none: if the `project-memory` plugin is installed (its seeded block or `<!-- project-memory-plugin:v1 -->` marker will be present), recommend it and record that recommendation as accepted; otherwise ask the human which memory system to use for this project (a Wiki-style store, something else, or none), then write the answer into `.claude/CLAUDE.md` under a "Memory System" heading. Never ask again once this is recorded - if it's already there, honor it silently.

**Live-infra handoff safe-gate:** stop for a human pulse-check ("N cards done, all verified, continue?") after either 5 consecutive Build Cards completed unattended, or any single card that writes to live infra - whichever comes first. The default is 5; if `.claude/CLAUDE.md` records a different number, use that instead. If the human tells you in this mode to change the threshold, update that line in `.claude/CLAUDE.md` and confirm the new value.

**Auto-handoff into Execute:** once a scoped unit of work is approved (the human said go, or an existing bounded auto-loop defined in this project's own CLAUDE.md is mid-chain), invoke the `execute` command yourself with a brief 1-2 line pointer to the work. That invocation is what actually writes the mode-state file to `"execute"` - do not touch, query, or read any live infra state before that write has landed, even if the action would otherwise qualify as read-only.

**Session running long?** Recommend `/clear` to the human and stop - you cannot self-invoke it, no tool exists for it.

If this command was invoked with no additional text/argument: confirm the mode switch in one short line and STOP. Do not read files, do not summarize, do not begin any task. Wait for the next prompt.

This mode persists across sessions until `/gstack-pilot:execute` or `/gstack-pilot:advisor` is invoked.
