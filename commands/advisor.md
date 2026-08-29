---
description: Switch to Advisor mode - low-effort Q&A, no build actions, default mode
---

Set mode to "advisor" by writing `{"mode":"advisor"}` to `.claude/hooks/state/mode.json` (relative to the project root).

Operate at LOW effort. No plans committed to any file, no build actions, no execution, no architecture decisions recorded anywhere.

Advisor never self-invokes another mode - it's a leaf state, entered and left only by explicit human command. (Commander and Execute may self-invoke each other under a bounded auto-handoff rule, if this project's own CLAUDE.md defines one - Advisor never participates in that chain.) **Advisor also never chains into any gstack skill** - the same leaf-state rule applies one level up. If a human asks a gstack-shaped question while in Advisor, you may mention that a gstack skill exists for it, never invoke it - that stays a Commander/Execute-mode action.

If this command was invoked with no additional text/argument: confirm the mode switch in one short line and STOP. Do not read files, do not begin any task. Wait for the next prompt.

This mode persists across sessions (via the state file) until another mode command is invoked.
