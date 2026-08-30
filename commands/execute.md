---
description: Switch to Execute mode - full build authority within an approved scope of work, wraps up via gstack's review/qa/ship on a PR-first flow
---

Set mode to "execute" by writing `{"mode":"execute"}` to `.claude/hooks/state/mode.json` (relative to the project root). Separately, request whatever this environment calls its default/non-plan permission mode for the session, if not already active.

Operate at MEDIUM effort. Follow this project's own Executor protocol if its CLAUDE.md (or equivalent) defines one - execute the current scoped task fully, self-orchestrate sub-steps within scope, live-verify assumptions against real systems before building on them, test what you build, report back precisely. If this project defines no such protocol, default to: implement the approved scope of work end-to-end, verify it actually works, and report exactly what changed.

**Pre-flight sync gate (runs before any branch/file mutation, every task, fresh or resumed):** run `node scripts/pre-flight-sync.js --branch <task-branch-name> --card <path-to-Build-Card>` (or `--scope <comma-separated paths>` if there's no Build Card file on disk yet) as your literal first action, and relay exactly what it prints. This one script performs the checks that used to be five separately-interpreted git/gh steps - a dirty tree, a stale base, an overlapping open PR, or an unreachable `gh` are all handled inside it, not re-derived here:
- Exit 0: clear to proceed - the pre-flight marker is written, continue to implementation below.
- Exit 1 (interactive STOP) or exit 2 (headless/spawned BLOCKED): read its printed message, do not proceed past it, and either ask the human (interactive) or halt and state the blocker plainly (headless/spawned) - never auto-stash, auto-switch, or force past what it reports.
A `PreToolUse` hook independently enforces this: any `Write`/`Edit` tool call in Execute mode is blocked until a valid, fresh, current-branch marker exists - so this isn't optional even if this prose gets skipped somehow.

**Gstack wrap-up chain, PR-first, no trivial-housekeeping exemption (this is what distinguishes this plugin from plain `role-modes`):** every wrap-up - including doc-only/state-doc-only housekeeping - goes through gstack's real pipeline, never a direct commit to the default branch. Sequence:
1. Land this project's own mandatory wrap-up writes first (state-doc update, decision-log/wiki entry - whichever this project defines).
2. Commit on the task branch already created by the pre-flight step above (not a separate feature-branch-creation step - the branch already exists by this point).
3. Open a PR.
4. Follow `review/SKILL.md` - all sections, full depth.
5. Follow `qa/SKILL.md` - all sections, full depth.
6. Follow `ship/SKILL.md` - all sections, full depth (this fires gstack's own mandatory `/document-release` step - expect it, don't treat it as optional).
7. Merge.

"Follow `<skill>/SKILL.md`" means: read and execute that skill file's own instructions inline, in this same run, starting from its own Step 0 - the same file-reference chaining gstack's own `autoplan` uses internally. If gstack isn't installed/discoverable in this environment, say so plainly and fall back to this project's own git workflow (or plain commit/push if none is defined) rather than silently skipping the chain.

Only once this chain and this project's own mandatory wrap-up writes have actually landed does the Auto-handoff below fire.

**Auto-handoff back to Commander:** once the work's mandatory wrap-up steps have actually landed (this project's own state-doc updates, decision-log entries, and the gstack chain above through to a real merge) - and only then - recommend `/clear` or `/compact` to the human (you cannot self-invoke either; don't block waiting on it) and invoke the `commander` command yourself with a brief 1-2 line summary to hand back.

**Do not self-invoke `commander` if a stop condition was hit instead** - a credential gate, an unresolved conflict, a "decision needed" flag, a gstack STOP/plan-mode gate, or anything that would change or add to the system's design. Those end the turn and wait for the human; they are not handed to Commander to self-resolve.

If this command was invoked with no additional text/argument: confirm the mode switch in one short line and STOP. Do not read files, do not begin any task. Wait for the next prompt.

This mode persists across sessions until `/gstack-pilot:commander` or `/gstack-pilot:advisor` is invoked.
