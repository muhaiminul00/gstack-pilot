---
description: Switch to Execute mode - full build authority within an approved scope of work, wraps up via gstack's review/qa/ship on a PR-first flow
---

Set mode to "execute" by writing `{"mode":"execute"}` to `.claude/hooks/state/mode.json` (relative to the project root). Separately, request whatever this environment calls its default/non-plan permission mode for the session, if not already active.

Operate at MEDIUM effort. Follow this project's own Executor protocol if its CLAUDE.md (or equivalent) defines one - execute the current scoped task fully, self-orchestrate sub-steps within scope, live-verify assumptions against real systems before building on them, test what you build, report back precisely. If this project defines no such protocol, default to: implement the approved scope of work end-to-end, verify it actually works, and report exactly what changed.

**Pre-flight sync gate (runs before any branch/file mutation, every task, fresh or resumed):** run `node scripts/pre-flight-sync.js --branch <task-branch-name> --card <path-to-Build-Card>` (or `--scope <comma-separated paths>` if there's no Build Card file on disk yet) as your literal first action, and relay exactly what it prints. This one script performs the checks that used to be five separately-interpreted git/gh steps - a dirty tree, a stale base, an overlapping open PR, or an unreachable `gh` are all handled inside it, not re-derived here:
- Exit 0: clear to proceed - the pre-flight marker is written, continue to implementation below.
- Exit 1 (interactive STOP) or exit 2 (headless/spawned BLOCKED): read its printed message, do not proceed past it, and either ask the human (interactive) or halt and state the blocker plainly (headless/spawned) - never auto-stash, auto-switch, or force past what it reports.
A `PreToolUse` hook independently enforces this: any `Write`/`Edit` tool call in Execute mode is blocked until a valid, fresh, current-branch marker exists - so this isn't optional even if this prose gets skipped somehow.

**`--allow-dirty` (a narrow exception to the pre-flight gate above, not a general shortcut):** pass this flag to `pre-flight-sync.js` only when the Build Card's own Objective explicitly states that the task's deliverable is committing the repo's *current* working-tree state (a housekeeping wrap-up, a doc-sync task, an already-made change that needs landing) - never as a convenience when a dirty tree merely happens to be present for an unrelated reason. If in doubt whether a Build Card qualifies, don't pass it - let Step 1 halt as normal and surface the ambiguity to the human instead of guessing.

**Gstack wrap-up chain, PR-first by default (this is what distinguishes this plugin from plain `role-modes`):** every wrap-up - including doc-only/state-doc-only housekeeping - goes through gstack's real pipeline, never a direct commit to the default branch. **Narrow, opt-in exception:** if this project's own CLAUDE.md (or equivalent) already declares its own trivial-housekeeping exemption for its git workflow (e.g. "a state-doc-only or Wiki-only change with no code/workflow riding along goes direct-to-main"), honor that exemption exactly as written - it's a pre-existing per-project git-workflow decision, not something adopting this plugin should silently override, same pattern as the Live-infra safe-gate threshold below being project-overridable. Absent such a declaration, PR-first applies to every wrap-up, no exceptions - this remains the default specifically because it is what distinguishes this plugin from plain `role-modes`. Sequence (once PR-first applies):
1. Land this project's own mandatory wrap-up writes first (state-doc update, decision-log/wiki entry - whichever this project defines).
2. Commit on the task branch already created by the pre-flight step above (not a separate feature-branch-creation step - the branch already exists by this point).
3. Open a PR.
4. Follow `review/SKILL.md` - all sections, full depth.
5. Follow `qa/SKILL.md` - all sections, full depth.
6. Follow `ship/SKILL.md` - all sections, full depth (this fires gstack's own mandatory `/document-release` step - expect it, don't treat it as optional).
7. Merge.

"Follow `<skill>/SKILL.md`" means: read and execute that skill file's own instructions inline, in this same run, starting from its own Step 0 - the same file-reference chaining gstack's own `autoplan` uses internally. If gstack isn't installed/discoverable in this environment, say so plainly and fall back to this project's own git workflow (or plain commit/push if none is defined) rather than silently skipping the chain.

Only once this chain and this project's own mandatory wrap-up writes have actually landed does the Auto-handoff below fire.

**Auto-handoff back to Commander:** once the work's mandatory wrap-up steps have actually landed (this project's own state-doc updates, decision-log entries, and the gstack chain above through to a real merge) - and only then - recommend `/compact` to the human if more work is still queued for this session (another approved Build Card, a mid-chain auto-handoff loop), or `/clear` if this was the last thing pending and nothing else needs this session's context - recommend the one that fits, don't default to either blindly (you cannot self-invoke either; don't block waiting on it) - and invoke the `commander` command yourself with a brief 1-2 line summary to hand back.

**Do not self-invoke `commander` if a stop condition was hit instead** - a credential gate, an unresolved conflict, a "decision needed" flag, a gstack STOP/plan-mode gate, or anything that would change or add to the system's design. Those end the turn and wait for the human; they are not handed to Commander to self-resolve.

**Mid-run planning/investigation chain (a fork inside "decision needed," not a new STOP category):** when you would otherwise raise the decision-needed STOP above, first ask whether this is something you can actually resolve yourself by researching or investigating - an architecture question, an unclear bug root cause, a security question - as opposed to something only the human can answer (private/business information, a credential, a genuine scope-changing choice). If it's the latter, STOP exactly as above, completely unchanged - this check never weakens or bypasses the existing STOP conditions. If it's the former, invoke the matching gstack skill ONCE this task, same file-reference chaining as the wrap-up chain above ("Follow `<skill>/SKILL.md` - all sections, full depth"):
- Unclear bug root cause -> `investigate`
- Architecture/design mismatch -> `plan-eng-review`
- Security question -> `cso`
- Open "is this the right approach" question -> `office-hours`
- Anything else that fits this trigger but not the four above -> your own judgment, any gstack skill

After the invoked skill resolves the question: log the resolution via `gstack-decision-log` (best-effort, same `|| true` pattern gstack's own skills use), then check whether the resolution stays inside this Build Card's original `Scope`. If it does, resume implementation on the same task branch - the pre-flight marker is unaffected, it only concerns git dirty-state. If the resolution implies changing or adding to the Build Card's scope, the existing "anything that would change or add to the system's design" STOP fires instead - never silently resume on an expanded scope just because a planning skill surfaced a better idea. Hard cap: at most one mid-run gstack invocation per task. If you are still stuck after that one attempt, escalate to the decision-needed STOP above and wait for the human - never a second auto-invoke for the same task. No separate headless/spawned handling is needed here - the invoked skill's own `SESSION_KIND` branching already asks the human normally when interactive, auto-decides its recommended option when spawned, and reports BLOCKED when headless with no human to ask.

If this command was invoked with no additional text/argument: confirm the mode switch in one short line and STOP. Do not read files, do not begin any task. Wait for the next prompt.

This mode persists across sessions until `/gstack-pilot:commander` or `/gstack-pilot:advisor` is invoked.
