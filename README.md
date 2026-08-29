# gstack-pilot

**Advisor / Commander / Execute mode system for Claude Code, natively
chained into [gstack](https://github.com/garrytan/gstack).**

If your project runs [`role-modes`](https://github.com/muhaiminul00/role-modes)
for its three-mode operating system *and* gstack for its skill suite,
today those two things only connect through whatever your CLAUDE.md
happens to say — a human (or Commander itself) has to remember to
invoke gstack's planning skills, and re-check their output by hand
afterward. `gstack-pilot` closes that gap: the same three modes, but
Commander's planning phase and Execute's wrap-up actually chain into
gstack's own skills as part of the mode itself, not as a step someone
has to remember.

Use `gstack-pilot` if your project also runs gstack. Use plain
`role-modes` if it doesn't — the two are designed as alternatives for a
given project, not meant to be co-installed together (see
[A real design constraint](#a-real-design-constraint)).

---

## Table of contents

- [What this actually does](#what-this-actually-does)
- [What's different from role-modes](#whats-different-from-role-modes)
- [Install](#install)
- [Usage guide](#usage-guide)
- [Composition mechanism](#composition-mechanism)
- [A real design constraint](#a-real-design-constraint)
- [Gates and stop conditions](#gates-and-stop-conditions)
- [Releases](#releases)
- [Status](#status)
- [License](#license)

---

## What this actually does

Three modes, persisted per project in `.claude/hooks/state/mode.json`:

- **Advisor** (default) — low-effort Q&A. No build actions, no plans
  committed to any file, no gstack chaining. A leaf state: only a human
  enters or leaves it.
- **Commander** — plans work. Before scoping a unit of work, it chains
  into gstack's own planning skills for the plan's actual substance
  (see [Usage guide](#usage-guide) for the exact sequence), then
  packages the result into a Build Card (your project's own format if
  it has one, or this plugin's generic `build-cards` fallback skill)
  and hands off to Execute.
- **Execute** — full build authority within an approved scope. Every
  wrap-up — state-doc update, decision-log entry, and the actual
  change — goes out **PR-first**: feature branch → PR → gstack's
  `review` → `qa` → `ship` → merge. No exemption for small or doc-only
  changes; that's a deliberate choice (see the table below), not an
  oversight.

## What's different from role-modes

| | `role-modes` | `gstack-pilot` |
|---|---|---|
| Commander's planning phase | Plans directly, or per your project's own protocol | Chains into gstack's `office-hours` (new-idea framing) → `plan-eng-review` → optionally `autoplan`, **before** scoping a Build Card |
| Execute's wrap-up | Your project's own git workflow, whatever that is | **PR-first, no exemption for trivial changes**: state-doc update → feature branch → PR → gstack's `review` → `qa` → `ship` → merge, every time |
| SessionEnd hook | None | A fast, stderr-only reminder if a session ends mid-wrap-up. (`SessionEnd` has no way to feed context back to Claude — this hook is a plain terminal message for the human, not a disguised instruction to the model.) |
| SessionStart briefing | Mode-behavior text only | Same, plus: in Commander mode, if your project declares a `State Doc:` path in `.claude/CLAUDE.md`, an excerpt of it is read and injected automatically — Commander starts every session already briefed |
| CLAUDE.md seed block | Mode explanation only | Mode explanation + a **Mode–gstack Bridge** section describing the chain sequence — written so it doesn't duplicate gstack's own separate routing-table injection if your project has both |

If none of the right-hand column matters to you, you don't need this
plugin — `role-modes` alone is simpler and has one less moving part.

## Install

```
/plugin marketplace add https://github.com/muhaiminul00/gstack-pilot
/plugin install gstack-pilot@gstack-pilot
/gstack-pilot:init
```

That third line matters — see [why below](#plugin-install-doesnt-activate-immediately).

**If your project also wants gstack itself, team-installed:**

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack
./setup --team
```

then, once, from inside the *consuming* project's own repo:

```bash
gstack-team-init required   # or `optional` for a softer nudge instead of a hard block
```

`gstack-pilot` does not install or wrap gstack's own installer —
gstack is a global skill-collection git clone, not a Claude Code
plugin, and stays installed exactly the way gstack's own docs describe.
This plugin only assumes gstack is *discoverable* once installed; it
never manages gstack's lifecycle.

**If your project also wants a portable Wiki-style memory system:**

```
/plugin marketplace add https://github.com/muhaiminul00/project-memory
/plugin install project-memory@project-memory
```

Commander's memory-system check picks this up automatically the first
time it runs in a project — recommends it if installed, asks once
otherwise, and never asks again.

### Plugin install doesn't activate immediately

Claude Code has no hook that fires the instant a plugin is enabled —
`SessionStart` only fires at a real session boundary (a fresh session,
`/clear`, `compact`, `fork`). Until one of those happens, the
CLAUDE.md starter block and `mode.json` won't exist yet. Run
`/gstack-pilot:init` right after installing to skip the wait — it does
exactly what the `SessionStart` hook would have done, on demand.

## Usage guide

**Day to day**, you mostly just switch modes and let the plugin do the
rest:

```
/gstack-pilot:commander
```

Confirms the mode switch. From here, describe what you want built.
Commander plans it — and if the request is a genuinely new idea not
yet scoped, it first chains into gstack's `office-hours` skill (the
same one `/office-hours` would run) before moving to `plan-eng-review`
for the architecture-level plan. If you'd rather get the full batched
review in one pass, ask for that and Commander chains into `autoplan`
instead of stepping through individually. Either way, the plan that
comes back is gstack's real output — Commander's job is packaging it
into a Build Card and getting your approval, not writing the plan
itself.

Once you approve, Commander hands off to Execute automatically — you
don't need to type `/gstack-pilot:execute` yourself unless you want to
switch modes without an in-progress plan.

Execute builds the approved scope, then wraps up: state-doc and
decision-log updates land, a feature branch goes up, a PR opens, and
gstack's `review` → `qa` → `ship` chain runs against it before merge.
`ship` itself mandatorily runs gstack's `document-release` step near
the end — expect that, it's not optional even though this plugin
didn't ask for it directly.

If gstack isn't installed or discoverable when a chain point is
reached, both modes say so plainly and fall back to planning/wrap-up
without it, rather than silently skipping the chain and pretending it
happened.

**A worked example:**

```
You:       /gstack-pilot:commander
Claude:    Mode: Commander (persisted).

You:       I want to add a webhook retry queue for failed deliveries.
Claude:    [chains into plan-eng-review/SKILL.md - runs gstack's real
           architecture review, asks clarifying questions if needed,
           produces a build-ready spec]
           Here's the plan: <spec>. Packaging into a Build Card now -
           approve to hand off to Execute?

You:       Approved, go.
Claude:    [writes mode.json to "execute", begins building]
           ...
           [implementation done]
           Wrapping up: state doc updated, branch feature/webhook-retry-
           queue pushed, PR #12 opened.
           [chains into review/SKILL.md, then qa/SKILL.md, then
           ship/SKILL.md - document-release fires automatically inside
           ship]
           PR #12 merged. Handing back to Commander.
```

**Advisor mode** is for everything else — quick questions, no build
intent:

```
/gstack-pilot:advisor
```

Never chains into gstack, never commits a plan to any file. If you ask
something gstack-shaped while in Advisor, expect a pointer to the
relevant gstack skill, not an automatic invocation of it.

## Composition mechanism

Chaining uses **file-reference chaining** — the same pattern gstack's
own `autoplan` skill uses internally to run its four review phases
("Follow `plan-eng-review/SKILL.md` — all sections, full depth").
Commander's and Execute's command files literally instruct the agent to
read and execute a named gstack `SKILL.md` inline, in the same run —
not a nested cross-plugin Skill-tool call, which has no precedent
anywhere in gstack's own codebase and risks bypassing its mandatory
preamble, telemetry, and STOP/plan-mode gates. Live-verified before
shipping: gstack's real preamble script (`gstack-skill-start`) is
caller-agnostic — it produces identical output regardless of which
agent context invokes it, which is exactly what this mechanism depends
on.

## A real design constraint

`gstack-pilot` and `role-modes` share the same mode-state file path
(`.claude/hooks/state/mode.json`) by design — `gstack-pilot` is meant
as `role-modes`' successor for a given project, never co-installed
alongside it in the same project. The CLAUDE.md seed marker and
sentinel filename ARE namespaced separately (`gstack-pilot-plugin:v1`
/ `.claude-md-seeded-gstack-pilot`) so at minimum both plugins' one-time
CLAUDE.md seeding can coexist without a collision, but `mode.json`
itself is not. If your project genuinely needs both installed at once,
treat that as unverified — namespace the state file path yourself
before relying on it.

## Gates and stop conditions

Same as `role-modes`: Advisor is a leaf state (and never chains into
gstack either — the same rule, one level up), Commander/Execute's
bounded auto-handoff still respects the 5-consecutive-card / any-
live-infra-write safe-gate (override the number in your project's own
`.claude/CLAUDE.md`), and any gstack STOP/plan-mode gate ends the turn
exactly like any other stop condition — never bypassed to keep an
auto-handoff moving. A credential gate, an unresolved conflict, or a
"decision needed" flag always ends the turn and waits for you.

## Releases

`plugin.json` is the sole version source — no duplicate `version`
field in `marketplace.json` (a proven drift trap in the sibling
plugins' own history: Claude Code silently prefers `plugin.json` if
both are set, so a stray duplicate just rots). `/plugin update`
compares this field and does nothing for already-installed copies if
it's unchanged — **every user-facing change needs a version bump
alongside it**, not after the fact.

Current release: **v0.1.0** — deliberately pre-1.0. Everything in this
README is real and live-tested except one disclosed gap: the
hook-coexistence behavior between this plugin's `SessionStart` hook and
gstack's own `--team`-mode global auto-update hook is reasoned from
strong existing evidence (Claude Code's plugin-hook and
settings.json-hook registration paths are additive, confirmed via a
live sibling-plugin precedent) but not yet fully live-run end to end.
v1.0.0 lands once that's proven live on a real multi-hook project, not
before.

## Status

Built and validated in isolation. Not yet run against a real team
project end to end — that's the next real proof point, not a
formality. If you hit something this README doesn't cover, that's a
gap in the plugin's testing, not yours to route around silently — open
an issue.

## License

MIT
