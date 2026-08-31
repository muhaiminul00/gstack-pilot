# gstack-pilot

**The team layer for [gstack](https://github.com/garrytan/gstack) — a
Claude Code plugin that decides which gstack skill to run, prompts it
correctly, and lets a whole team drive one project through it, not just
its original author.**

---

## Table of contents

- [The problem this solves](#the-problem-this-solves)
- [Who this is for](#who-this-is-for)
- [What this actually does](#what-this-actually-does)
- [Example use cases](#example-use-cases)
- [Pairs well with project-memory](#pairs-well-with-project-memory)
- [Install](#install)
- [How to use it — day to day](#how-to-use-it--day-to-day)
- [What's different from role-modes](#whats-different-from-role-modes)
- [Composition mechanism](#composition-mechanism)
- [A real design constraint](#a-real-design-constraint)
- [Gates and stop conditions](#gates-and-stop-conditions)
- [Releases](#releases)
- [Status](#status)
- [License](#license)

---

## The problem this solves

gstack is a genuinely powerful skill suite — 55+ skills covering
planning, review, QA, shipping, and more. But powerful and usable aren't
the same thing, and gstack has two real costs that show up the moment
more than one person is on the project:

1. **You have to remember which skill to invoke, and when.** Is this an
   `/office-hours` conversation or a `/plan-eng-review`? Does this diff
   need `/review` or `/adversarial-review`? gstack has an answer for
   almost everything — but only if you already know its name.
2. **Invoking the right skill isn't enough — it needs the right prompt.**
   gstack's skills are opinionated and thorough; a thin, under-specified
   prompt gets a thin, under-specified result back. Getting real value
   out of `/plan-eng-review` means feeding it the right framing, not
   just typing the command.

gstack was built assuming a solo founder who already knows its skill
map by heart. `gstack-pilot` is what makes it work for **a team of
builders on the same project** instead: three modes (Advisor / Commander
/ Execute) that decide which gstack skill a given moment calls for,
construct the prompt that actually gets a good result from it, and chain
straight from planning into execution without a human having to
remember any of it — the same experience whether you're the person who
set gstack up or the teammate who joined last week and has never typed
a gstack skill name in their life.

## Who this is for

- **A team sharing one gstack-powered project.** gstack itself doesn't
  care who invokes it, but *knowing what to invoke* is tribal knowledge
  that lives in one person's head by default. `gstack-pilot` moves that
  knowledge into the plugin, so it doesn't matter who's driving.
- **Anyone who wants to talk through a build, not memorize a command
  reference.** You don't need to know gstack exists. Talk to Commander
  like you'd talk to a technical co-founder — describe what you want,
  it figures out which gstack skill gets you there and drives the
  conversation.
- **Teams that want planning and execution kept visibly separate.** The
  three modes aren't cosmetic — Commander only plans (and cannot make a
  live-infra or git-write change even if it wanted to), Execute only
  builds against an already-approved scope. If your team has been
  burned by an agent quietly executing something nobody signed off on,
  this is the guardrail.
- **Solo builders too** — everything above still helps one person; it's
  just not the only person it helps.

## What this actually does

Three modes, persisted per project in `.claude/hooks/state/mode.json`,
each one a different **persona you talk to**, not a settings toggle you
configure once and forget:

- **Advisor** (default) — low-effort Q&A. No build actions, no plans
  committed to any file, no gstack chaining. Talk to it like you'd ask
  a quick question of a teammate who happens to know the codebase.
- **Commander** — plans work, out loud, with you. Describe what you
  want; before scoping anything, it chains into gstack's own planning
  skills for the plan's actual substance (`office-hours` for a fresh
  idea, `plan-eng-review` for locking in architecture, `autoplan` if
  you want the full batched pass) — deciding which one *and* carrying
  the framing that gets a real answer out of it, not a generic one.
  The plan that comes back is packaged into a Build Card for your
  approval.
- **Execute** — full build authority within an approved scope. A
  pre-flight sync gate checks for a dirty working tree, fast-forwards a
  stale base, and checks the task's declared scope against currently
  open PRs for a real collision with someone else's in-flight work —
  structurally enforced by a hook, not just prose. Wrap-up goes
  PR-first every time: branch → PR → gstack's `review` → `qa` → `ship`
  → merge, with `document-release` firing automatically inside `ship`.

Approve a plan in Commander and it hands off to Execute on its own — you
never have to remember to type `/gstack-pilot:execute` yourself.

## Example use cases

**A 3-person team building a product on gstack, only one of whom set it
up.** The other two never learn gstack's skill names — they run
`/gstack-pilot:commander`, describe what they want, and get the same
quality of plan the person who configured everything would get.
Execute's collision check is what actually matters here: if two people
approve overlapping work at the same time, the second one gets stopped
before it becomes a merge conflict, not after.

**A solo builder who doesn't want to hold gstack's command reference in
their head.** Talk through the idea in Commander; it figures out
whether this is an `/office-hours` conversation or an architecture
lock-in and drives you there.

**A team wanting a hard line between "we talked about it" and "it's
being built."** Commander literally cannot make a live-infra or
git-write change — it hands off to Execute for that, no exceptions,
even for something that looks trivial. If your team needs that
separation enforced rather than promised, this is that enforcement.

## Pairs well with project-memory

gstack has its own optional memory layer (`gbrain`). If your team isn't
using that — or isn't using any persistent memory system — Commander's
first real session in a project checks for one and recommends
[`project-memory`](https://github.com/muhaiminul00/project-memory), a
portable Wiki-style store, if it's installed; otherwise it asks once and
never asks again. The two plugins are designed to be installed
together: `gstack-pilot` for *which skill, with what prompt, in what
order*, `project-memory` for *what the team already decided and why*.

## Install

**Prerequisite — gstack itself must be installed first.** `gstack-pilot`
is a chaining layer over gstack's own skill suite — without gstack
present, there's nothing here to chain into and the plugin has nothing
useful to do. Install it before (or, at the latest, immediately after)
the plugin below, not as an optional extra.

This is plain shell, so don't type it yourself — paste it as a message
into your own Claude Code session and let it run and retry on failure:

> Check if gstack is installed globally: `test -d ~/.claude/skills/gstack/bin`.
> If not, clone it (`git clone --depth 1 https://github.com/garrytan/gstack.git
> ~/.claude/skills/gstack`) and run `./setup --team` inside it. If any step
> fails, diagnose why (missing `bun`, `PATH` issues, etc.), fix it, and retry
> until it actually succeeds — don't just report the error and stop.

then, once, from inside the *consuming* project's own repo:

```bash
gstack-team-init required   # or `optional` for a softer nudge instead of a hard block
```

`gstack-pilot` does not install or wrap gstack's own installer —
gstack is a global skill-collection git clone, not a Claude Code
plugin, and stays installed exactly the way gstack's own docs describe.
This plugin only assumes gstack is *discoverable* once installed; it
never manages gstack's lifecycle. (It does check, once, whether gstack's
own global config looks sane and tells you what it finds — see
[How to use it — day to day](#how-to-use-it--day-to-day) — but it never
installs or edits anything on gstack's behalf.)

**Now install the plugin itself.** These are interactive Claude Code
commands with no tool-equivalent — Claude can't run them on your behalf,
you have to type them yourself. Either form works, pick whichever fits
how you already drive Claude Code — the interactive session UI:

```
/plugin marketplace add https://github.com/muhaiminul00/gstack-pilot
/plugin install gstack-pilot@gstack-pilot
/gstack-pilot:init
```

or the CLI-equivalent from a shell, if you already have a terminal-based
Claude Code workflow:

```bash
claude plugin marketplace add https://github.com/muhaiminul00/gstack-pilot
claude plugin install gstack-pilot@gstack-pilot
```
(then run `/gstack-pilot:init` inside your next Claude Code session — see below)

**Don't skip that third line.** This is the single most common real
mistake: the plugin shows up as installed in `/plugin` listings but does
nothing in your current project until `/gstack-pilot:init` runs — see
[why below](#plugin-install-doesnt-activate-immediately).

**Onboarding a whole team?** [`TEAM_SETUP.md`](TEAM_SETUP.md) is a short,
copy-pasteable setup sequence for teammates (including how to hand the
gstack-install step to their own Claude Code session for retry-on-failure),
and [`VERIFICATION_CHECKLIST.md`](VERIFICATION_CHECKLIST.md) gives concrete,
checkable behaviors for judging whether the install actually worked.

**If your project also wants a portable Wiki-style memory system**
(see [Pairs well with project-memory](#pairs-well-with-project-memory)
above):

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

## How to use it — day to day

You mostly just switch modes and talk:

```
/gstack-pilot:commander
```

Confirms the mode switch. From here, describe what you want built —
plain language, no gstack knowledge required. Commander plans it, and
if the request is a genuinely new idea not yet scoped, it first chains
into gstack's `office-hours` skill (the same one `/office-hours` would
run) before moving to `plan-eng-review` for the architecture-level
plan. If you'd rather get the full batched review in one pass, ask for
that and Commander chains into `autoplan` instead of stepping through
individually. Either way, the plan that comes back is gstack's real
output — Commander's job is deciding which skill gets you there,
prompting it well, packaging the result into a Build Card, and getting
your approval, not writing the plan itself.

Once you approve, Commander hands off to Execute automatically.

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

**Two one-time, informational-only nudges** fire the first time a
session (or `/gstack-pilot:init`) runs in a project: one checks whether
`gh` is installed and authenticated (needed for Execute's PR-scope
collision check — see [Gates and stop conditions](#gates-and-stop-conditions)),
the other surfaces the current values of gstack's own *global* config
(`~/.gstack/config.yaml` — `proactive`, `checkpoint_mode`,
`routing_declined`) so you know what you're working with. Neither
ever blocks anything, and the gstack-config one never writes to that
file — it's global, per-machine, and this plugin only reports what's
already there, pointing you at the file's own comments to change
anything yourself.

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
Claude:    [writes mode.json to "execute"]
           [runs scripts/pre-flight-sync.js: working tree clean, base
           branch fast-forwarded, no open-PR overlap with this task's
           Scope - preflight-ok marker written]
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

## What's different from role-modes

[`role-modes`](https://github.com/muhaiminul00/role-modes) is this
plugin's sibling — the same three-mode shape, without the gstack chain.
It's what you'd use on a project that doesn't run gstack. The two share
a mode-state file path by design (see [A real design
constraint](#a-real-design-constraint)) and are meant as alternatives
for a given project, never co-installed together.

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
"decision needed" flag always ends the turn and waits for you — unless
the decision is something Execute can actually research itself
(architecture, bug root cause, security), in which case it gets one
mid-run gstack invocation (`investigate` / `plan-eng-review` / `cso` /
`office-hours`, or Execute's own judgment) before falling back to the
same stop-and-wait behavior.

Execute has one more, structural rather than prose: the pre-flight sync
gate. A dirty working tree, a base branch that can't fast-forward
cleanly (diverged, never forced), or an open PR overlapping the task's
`Scope` all stop Execute (interactive) or report BLOCKED (headless/
spawned — no human to answer) before any file is touched. A `gh` that's
missing or unauthenticated degrades the collision check to a disclosed
skip rather than a hard block — the sync gate itself still runs. A
`PreToolUse` hook backs this up independently: any `Write`/`Edit` call
in Execute mode is denied without a valid, current-branch, fresh
`.claude/hooks/state/preflight-ok` marker — a corrupted or unreadable
marker is treated the same as a missing one (fails closed), never
treated as permission to proceed.

## Releases

`plugin.json` is the sole version source — no duplicate `version`
field in `marketplace.json` (a proven drift trap in the sibling
plugins' own history: Claude Code silently prefers `plugin.json` if
both are set, so a stray duplicate just rots). `/plugin update`
compares this field and does nothing for already-installed copies if
it's unchanged — **every user-facing change needs a version bump
alongside it**, not after the fact.

Current release: **v1.3.1**. Patch bump over v1.3.0: README trim — the
"Repo hygiene" section (our own internal git-tracking process for
`docs/build-cards`/`docs/designs`, no relevance to plugin users) was
removed entirely, and "What's different from role-modes" was cut from
a full feature-comparison table down to a short paragraph stating the
one thing that actually matters to a reader: the shared `mode.json`
path and never-co-install rule. Docs-only, no behavior change.

Prior release: **v1.3.0**. Minor bump over v1.2.1: four repo-hygiene/
onboarding fixes. `docs/build-cards/` and `docs/designs/` are now
`.gitignore`d (kept on disk, no longer public); the Install section
now states gstack as a mandatory prerequisite, moved before the
plugin-install commands
(previously worded as an optional extra, which undersold that
`gstack-pilot` does nothing useful without it); and a new one-time,
informational-only nudge surfaces gstack's own global config
(`~/.gstack/config.yaml`) values at first session/`init`, mirroring the
`gh`-setup nudge's mechanism exactly (new sentinel
`.claude/hooks/state/.gstack-config-checked-gstack-pilot`) — never
writes to that file, since it's per-machine, not per-project. `CLAUDE.md`
was checked and confirmed correct as-is, no change. (Full build record:
`BC-2026-08-31-public-repo-hygiene-and-gstack-mandatory` — kept on disk,
not tracked in this public repo.)

Patch bump in v1.2.1 over v1.2.0: a full README
repositioning (the problem gstack-pilot solves, who it's for, example
use cases, the project-memory pairing) — docs-only, no behavior change
on its own — plus a real behavioral fix riding the same release:
Commander's and Execute's "session running long?" guidance now
recommends `/compact` when more approved work is still queued this
session (keeps branch state and decisions, cheaper than a fresh
session re-deriving them) versus `/clear` when nothing else is
pending, instead of defaulting to one regardless of context. (Full
build record: `BC-2026-08-31-readme-reposition-and-clear-compact` —
kept out of this public repo as internal build history, not a resolvable
path in your clone.)

Minor bump in v1.2.0 over v1.1.0: a one-time, loud
nudge (in `hooks/session-start.js` and `commands/init.md`, sharing one
sentinel `.claude/hooks/state/.gh-setup-checked-gstack-pilot`) fires the
first time `gh` is found missing or unauthenticated, pointing at
`TEAM_SETUP.md` step 3 — closing the "silent-forever" gap the
v1.1.0 design doc explicitly flagged and accepted: a team that never
finishes `gh` setup previously got nothing but a per-task line that's easy
to miss. That per-task `DISCLOSED:` line in `pre-flight-sync.js` is
untouched — the nudge is a loud first impression, not a replacement for
the ongoing, real-time-accurate signal. Never blocks, in any session kind.
`TODOS.md` gained a fourth deferred item (re-nudging if `gh` auth
regresses *after* the one-time check already passed clean). (Full
design/build record: `gh-setup-loud-nudge` — kept on disk, not tracked
in this public repo.)

Minor bump in v1.1.0 over v1.0.1: Execute now runs a
pre-flight sync gate (`scripts/pre-flight-sync.js`) before any branch or
file mutation — dirty-tree check, stale-base fast-forward, and a live
open-PR-scope collision check against a new `Scope` field on Build
Cards — enforced structurally by a new `PreToolUse` hook
(`hooks/pre-tool-use.js`), not left to prose alone. Landed via
`/office-hours` → `/plan-eng-review` (3 adversarial review rounds + 1
Codex outside-voice pass; the outside-voice pass is why this became a
real hook instead of stronger wording — prose telling Execute to check
doesn't guarantee it runs every time). `TEAM_SETUP.md` now names `gh`
CLI install as a prerequisite step. (Full design/build record:
`sync-gate-and-collision-check` — kept on disk, not tracked in this
public repo.)

Patch fix in v1.0.1 over v1.0.0: first real-world
use (on `zm-brain`, see Status below) found the `office-hours` vs
`plan-eng-review` branch-selection criterion under-specified —
tentative-sounding phrasing ("propose reviving X") could misroute
already-scoped work to `office-hours` instead of `plan-eng-review`.
Nothing executed on the wrong branch during the test (no side effects)
— the self-correction before acting is exactly the chain mechanism's
safety property working as intended, not luck. Fixed: `commander.md`'s
criterion now has an explicit disambiguator — a prior document already
naming the work as scoped wins over surface phrasing, always.

v0.1.0 shipped with one disclosed gap —
hook-coexistence between this plugin's `SessionStart` hook and gstack's
own `--team`-mode global auto-update hook was reasoned, not directly
tested. That gap is closed as of v1.0.0: `gstack --team` was actually
run for real against a live multi-hook Claude Code environment. What
was directly verified, not just reasoned:
- The real global `~/.claude/settings.json` diff shows gstack's new
  `SessionStart` hook entry appended additively into an array that
  already had 5 pre-existing entries from an unrelated source
  (`codebase-memory-mcp`) — none removed, none overwritten, valid JSON
  throughout.
- The registered hook script itself (`gstack-session-update`) runs
  clean (exit 0) when invoked directly, the same way `SessionStart`
  would invoke it.
- This plugin's own `SessionStart` hook uses the identical Claude Code
  plugin-hooks.json registration mechanism as its sibling `role-modes`
  plugin, which was independently confirmed, live, throughout this same
  verification session, to coexist correctly alongside a project's own
  `settings.json`-registered hooks (`role-modes`' `SessionStart` hook
  fires every session with zero entry for it anywhere in that project's
  own `settings.json`).

What's still inference rather than a byte-for-byte replica: this
plugin (`gstack-pilot`) itself wasn't literally installed side-by-side
with `gstack --team` in one project during this test — the coexistence
proof is by structural equivalence (identical hook-registration
mechanism, directly observed working on both sides), not a literal
repeat of every piece at once. Flagged here plainly rather than
implied to be more than it is.

## Status

Proven end to end on a real team project, not just built in isolation.
`zm-brain` (github.com/muhaiminul00/zm-brain) has run this plugin
through three real changes, each the full route: feature branch → PR →
gstack's actual `review` skill → merge —

- A full `CLAUDE.md` governance rewrite (real onboarding gate
  surfaced and handled, one real doc-accuracy finding auto-fixed by
  `review`).
- A `README.md` fix + onboarding pointer (a second real finding, at
  its actual source this time).
- A canonical-docs re-verification note (zero findings; scope-drift
  detection correctly caught an unrelated uncommitted change sitting
  in the repo, three consecutive times, and correctly left it alone).

That live use is also what surfaced v1.0.1's real routing bug (see
Releases above) — proof the verification loop itself works, not just
the plugin.

**What's not yet proven:** every run above, and every run since, has
had one person driving. The team-collaboration case this README leads
with — two people approving overlapping work at the same time, Execute's
collision check catching it — hasn't happened for real yet. That's the
next real proof point, not a formality; watch it closely the first time
it fires.

If you hit something this README doesn't cover, that's a gap in the
plugin's testing, not yours to route around silently — open an issue.

## License

MIT
