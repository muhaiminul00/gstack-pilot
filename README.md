# gstack-pilot

A portable three-mode operating system for Claude Code (Advisor / Commander
/ Execute), natively chained into the [gstack](https://github.com/garrytan/gstack)
skill suite. Sibling plugin to [`role-modes`](https://github.com/muhaiminul00/role-modes)
- same mode system, but Commander's planning phase actually chains into
gstack's planning skills and Execute's wrap-up actually chains into
gstack's review/QA/ship pipeline, instead of a human (or Commander itself)
having to remember to invoke gstack manually and re-check its output
after the fact.

Use `gstack-pilot` if your project also runs gstack. Use plain
`role-modes` if it doesn't - they are not meant to be co-installed in the
same project (see "A real design constraint" below).

## What's different from `role-modes`

| | `role-modes` | `gstack-pilot` |
|---|---|---|
| Commander's planning phase | Plans directly, or per this project's own protocol | Chains into gstack's `office-hours` (new-idea framing) → `plan-eng-review` → optionally `autoplan`, **before** scoping a Build Card |
| Execute's wrap-up | This project's own git workflow, whatever that is | **PR-first, no trivial-housekeeping exemption**: state-doc updates → feature branch → PR → gstack's `review` → `qa` → `ship` → merge, every time |
| SessionEnd hook | None | New: a fast, stderr-only human reminder if wrap-up wasn't finished before the session ends (SessionEnd has no Claude-visible context-injection mechanism - this hook doesn't pretend otherwise) |
| SessionStart briefing | Mode-behavior prose only | Same, plus: when the resolved mode is `commander`, reads this project's declared `State Doc:` path (if set in `.claude/CLAUDE.md`) and injects an excerpt as a pre-session briefing |
| CLAUDE.md seed block | Mode explanation only | Mode explanation + a **Mode–gstack Bridge** section (the ordered chain above) - explicitly designed not to duplicate gstack's own separate flat trigger→skill routing-table injection, if that's also present in the same file |

## Composition mechanism

Chaining uses **file-reference chaining** - the same pattern gstack's own
`autoplan` skill uses internally to run its four review phases ("Follow
`plan-eng-review/SKILL.md` - all sections, full depth"). Commander's and
Execute's command files literally instruct the agent to read and execute
a named gstack `SKILL.md` inline, in the same run - not a nested
cross-plugin Skill-tool call, which has no precedent anywhere in gstack's
own codebase and risks bypassing its mandatory preamble/telemetry/STOP
gates.

## Install

1. `/plugin marketplace add https://github.com/muhaiminul00/gstack-pilot`
2. `/plugin install gstack-pilot@gstack-pilot`
3. Run `/gstack-pilot:init` once (see "Caveat, stated plainly" below
   for why this manual step exists).
4. If this project also wants gstack itself team-installed:
   `git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup --team`,
   then `gstack-team-init required` (or `optional`) run once inside the
   consuming project's repo. `gstack-pilot` does not install or wrap
   gstack's own installer - gstack is a skill-collection git clone, not a
   Claude Code plugin, and stays installed the way gstack's own docs
   describe.
5. Also install [`project-memory`](https://github.com/muhaiminul00/project-memory)
   if this project wants a portable Wiki-style state/decision system -
   Commander's memory-system check will pick it up automatically once
   installed.

## Caveat, stated plainly

`/plugin install` never fires this plugin's `SessionStart` hook mid-session
(Claude Code has no hook that fires the instant a plugin is enabled) - so
the CLAUDE.md starter block and mode-state file won't exist until either a
real session boundary (`/clear`, a restart, `compact`, `fork`) happens, or
`/gstack-pilot:init` is run manually. Run `/gstack-pilot:init`
right after installing if you don't want to wait.

## A real design constraint

`gstack-pilot` and `role-modes` share the same mode-state file path
(`.claude/hooks/state/mode.json`) by design - `gstack-pilot` is meant
as `role-modes`' successor for a given project, never co-installed
alongside it in the same project. The CLAUDE.md seed marker and sentinel
filename ARE namespaced separately (`gstack-pilot-plugin:v1` /
`.claude-md-seeded-gstack-pilot`) so at minimum both plugins' one-time
CLAUDE.md seeding can coexist without a collision, but the mode-state file
itself is not namespaced. If your project genuinely needs both installed
at once, treat that as unverified and namespace the state file path
yourself before relying on it.

## Gates and stop conditions

Same as `role-modes`: Advisor is a leaf state (never chains into gstack
either - same rule, one level up), Commander/Execute's bounded auto-
handoff still respects the 5-consecutive-card / any-live-infra-write
safe-gate, and any gstack STOP/plan-mode gate ends the turn exactly like
any other stop condition - never bypassed to keep an auto-handoff moving.

## Releases

Every user-facing change bumps `version` in `.claude-plugin/plugin.json`
(the sole version source - no duplicate in `marketplace.json`, a proven
drift trap in the sibling plugins' own history). `/plugin update` compares
this field and silently does nothing for already-installed copies if it's
unchanged, so this discipline is not optional.

## License

MIT
