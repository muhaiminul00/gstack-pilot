---
description: Manually initialize gstack-pilot now, without waiting for a session restart
---

`/plugin install` never triggers this plugin's `SessionStart` hook (Claude Code has
no hook that fires the instant a plugin is enabled - see the README's "Caveat,
stated plainly", same real limitation the sibling `role-modes` plugin documents).
This command does the two things that hook would otherwise do, right now, without
a `/clear` or restart:

**1. Mode state.** Check `.claude/hooks/state/mode.json`. If it's missing or
unreadable, create it with `{"mode": "advisor"}` (the default). If it already
exists and parses, leave it untouched - do not reset an existing mode choice.
Running any of `/gstack-pilot:advisor`, `/gstack-pilot:commander`, or
`/gstack-pilot:execute` also writes this file, so this step is often a
no-op - it's here so `/gstack-pilot:init` is a complete, self-sufficient
setup step on its own.

**2. CLAUDE.md starter block.** Check `.claude/CLAUDE.md` for the marker
`<!-- gstack-pilot-plugin:v1 -->`. If it's already present, leave the file
alone. If it's absent, append this exact block (create `.claude/CLAUDE.md`
first if it doesn't exist yet; add one blank line before the block if the
file has other content and doesn't already end in a blank line):

```
<!-- gstack-pilot-plugin:v1 -->
## Role Modes + gstack Bridge (gstack-pilot plugin)

This project has the `gstack-pilot` plugin installed - the `role-modes`
three-mode system, natively chained into the gstack skill suite. Modes persist
across sessions in `.claude/hooks/state/mode.json`. Invoke them as
`/gstack-pilot:advisor`, `/gstack-pilot:commander`,
`/gstack-pilot:execute` - Claude Code namespaces every plugin slash command
with the plugin name, so a bare `/commander` will not resolve to this command.

- `/gstack-pilot:advisor` - default. Low-effort Q&A only, no build actions,
  no gstack chaining.
- `/gstack-pilot:commander` - plans work, chains into gstack's office-hours /
  plan-eng-review / autoplan for the plan's substance, may execute only trivial/
  safe/read-only single-file actions directly, hands off anything else to
  `/gstack-pilot:execute`.
- `/gstack-pilot:execute` - full build authority within an approved scope of
  work; wraps up PR-first (no trivial-housekeeping exemption) through gstack's
  review -> qa -> ship chain before merging.

**Mode-gstack Bridge - this section only, not a routing table:** the two bullets
above are the actual mode->skill chain this plugin fires automatically. If this
project also has gstack's own onboarding-injected flat trigger->skill routing
table elsewhere in this file (a separate "## Skill routing" style section,
gstack's own `preamble-routing-injection` output) - that section is
complementary, not duplicative: it covers ad-hoc "which skill handles this
request" dispatch, this section covers the ordered mode-chain sequence. Do not
merge or re-derive one from the other.

Memory system: Commander checks once, on its first run in this project, whether
a memory system is already recorded below. If none is, it recommends the
`project-memory` plugin (https://github.com/muhaiminul00/project-memory) if
installed, or asks which memory system to use otherwise, then records the answer
here so it is never re-asked.

Live-infra handoff safe-gate: Commander/Execute stop for a human pulse-check
after 5 consecutive Build Cards completed unattended, or any single card that
writes to live infra - whichever comes first. Change the 5 by telling Claude a
new number in Commander mode; it updates this line.

Fill in the specifics that make this useful for THIS project:
- State Doc: (name this project's state-tracking doc / decision log, if any -
  Commander's pre-session briefing hook reads this path automatically once set).
- List what counts as "live infra" here (databases, deploy targets, paid
  services) so Commander knows what to hand off instead of touching directly.
- Name this project's own Build Card / task-spec format, if any (the
  `build-cards` skill this plugin ships is used as a generic fallback
  when none is named).
- Env/tooling convention (if any) - e.g. venv-only installs + a tracked
  requirements file so teammates share a synced environment via GitHub, or none.
<!-- gstack-pilot-plugin:v1 -->
```

After writing it, also create the sentinel file
`.claude/hooks/state/.claude-md-seeded-gstack-pilot` (empty file) so the
`SessionStart` hook doesn't try to seed a second, duplicate block the next
time a real session boundary happens. This sentinel filename is namespaced
on purpose - never `.claude-md-seeded` bare, which is already known to
collide with the sibling `role-modes`/`project-memory` plugins if any of
them were ever co-installed in the same project.

**Maintenance note for whoever edits this plugin:** this block is a literal
copy of the one `hooks/session-start.js`'s `seedClaudeMd()` writes - there is
no way for a slash-command to `require()` or otherwise share code with a hook
script (`${CLAUDE_PLUGIN_ROOT}` is only readable from hooks/MCP/LSP/monitor
processes, not from a command's own execution context). If you change the
starter block's wording in one place, change it in the other too, then run
`node scripts/check-init-sync.js` to verify - it actually runs the hook
against a scratch project and byte-diffs the output against this file,
instead of relying on this comment alone to catch drift.

Report exactly what was created (mode.json, the CLAUDE.md block, or both), and
what already existed and was left alone.
