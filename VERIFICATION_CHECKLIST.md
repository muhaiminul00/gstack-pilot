# Verification Checklist

Seven concrete, checkable behaviors — how to tell `gstack-pilot` is actually
working versus quietly broken after setup. Each one has an expected result;
anything different is a real finding, not something to route around. Run
this after following [`TEAM_SETUP.md`](TEAM_SETUP.md).

## 1. Mode state exists

`.claude/hooks/state/mode.json` exists, contains `{"mode":"advisor"}` right
after install (or `"commander"`/`"execute"` if you've already switched
modes since).

## 2. CLAUDE.md seed block landed correctly

`.claude/CLAUDE.md` contains a block wrapped in
`<!-- gstack-pilot-plugin:v1 -->` markers, with a "## Role Modes + gstack
Bridge" heading. If `project-memory` is also installed, a second block
wrapped in `<!-- project-memory-plugin:v1 -->` markers sits alongside it —
no collision, no missing block, both present.

## 3. Memory-system check fires on real work

Run `/gstack-pilot:commander` **with a real task attached** — a bare
invocation deliberately does nothing but confirm the mode switch, and that's
correct behavior, not a bug; the memory check only fires once Commander is
actually doing something. On the first real invocation in a project, it
should either auto-recommend `project-memory` (if installed, no question
asked) or ask which memory system to use — and record the answer in
`.claude/CLAUDE.md` under a "Memory System" heading so it's never asked
again.

## 4. Chain routing is correct on already-scoped work

Give Commander something that's **already named as a next step** in a
project document (a roadmap line, a "Next" note in a state doc). Ask it to
plan that. It should explicitly tell you which gstack skill it's chaining
into — `plan-eng-review`, not `office-hours` — and cite the actual
disambiguator (a prior document already names this as scoped) as the reason.
It should not silently plan the work itself, and it should not misroute
already-scoped work to `office-hours` just because the request is phrased
tentatively ("propose", "consider", "revive").

## 5. Wrap-up is PR-first by default

Approve a real (even tiny) piece of work and let Execute run it to
completion. Wrap-up should go: feature branch → PR → gstack's `review` →
`qa` → `ship` chain → merge. There should be no "this is too small, I'll
just commit to main" exception unless *this project's own CLAUDE.md*
declares a narrow trivial-housekeeping exemption (v1.6.0+) — a project
that hasn't declared one should never see Execute skip the chain.

## 6. Missing gstack is disclosed, not silently skipped

If gstack itself isn't installed or discoverable when a chain point is
reached, both modes should say so plainly and fall back to planning/wrap-up
without it — never silently skip the chain and behave as if it happened
anyway.

## 7. gh setup nudges once, never repeats, never blocks

On a fresh project where `gh` is missing or unauthenticated, your first
real session should surface a one-time `GH SETUP:` nudge naming exactly
which of the two it is and pointing at `TEAM_SETUP.md` step 3. A second
session in the same project should NOT repeat it — check
`.claude/hooks/state/.gh-setup-checked-gstack-pilot` exists after the
first. Either way, nothing should ever block: Execute's pre-flight
collision check still runs (degraded), and every other behavior on this
checklist should work exactly the same whether `gh` is set up or not.

---

Any deviation from the above is worth reporting precisely — file, exact
behavior observed, exact behavior expected — the same standard this
plugin's own live-verification passes were held to during development.
