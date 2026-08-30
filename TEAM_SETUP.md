# Team Setup Guide

A short, copy-pasteable setup sequence for a teammate joining a project that
runs `gstack-pilot`. Five steps — two different mechanisms, on purpose (see
[why below](#why-two-mechanisms)).

## The steps

**1. Get gstack installed globally.** This is plain shell, so you can hand
the whole thing to your own Claude Code session and let it run and retry on
failure — paste this as a message:

> Check if gstack is installed globally: `test -d ~/.claude/skills/gstack/bin`.
> If not, clone it (`git clone --depth 1 https://github.com/garrytan/gstack.git
> ~/.claude/skills/gstack`) and run `./setup --team` inside it. If any step
> fails, diagnose why (missing `bun`, `PATH` issues, etc.), fix it, and retry
> until it actually succeeds — don't just report the error and stop.

**2. Install the plugins.** Type these four lines yourself, directly in
Claude Code — see [why below](#why-two-mechanisms) for why this step can't be
delegated to Claude:

```
/plugin marketplace add https://github.com/muhaiminul00/gstack-pilot
/plugin install gstack-pilot@gstack-pilot
/plugin marketplace add https://github.com/muhaiminul00/project-memory
/plugin install project-memory@project-memory
```

**3. Install and authenticate the `gh` CLI — required before your first
`/gstack-pilot:execute`.** Execute's pre-flight sync gate uses it for the
PR-scope collision check (see `docs/designs/sync-gate-and-collision-check.md`);
without it, Execute still runs, but silently loses collision detection,
which defeats half the point. Install per
[cli.github.com](https://cli.github.com/), then:

```bash
gh auth login
```

**4. Activate it in this project, once:**

```
/gstack-pilot:init
```

**5. Bootstrap this repo's own gstack requirement — only needed once, ever,
per repo.** Skip this if the repo already has it (check for a `## gstack`
section in its root `CLAUDE.md`):

```bash
gstack-team-init required
```

## Why two mechanisms

Step 1 is plain shell — Claude Code can run it directly via its own tools,
see the real output, and retry if something fails (missing dependency,
transient network error, whatever). No reason to make you babysit that by
hand.

Step 2 is different: `/plugin marketplace add` and `/plugin install` are
interactive Claude Code CLI commands with **no tool-equivalent** — there is
no way for Claude to invoke them on your behalf, in this or any session. If
a message asks Claude to "install the plugin for you," the honest answer is
that it can't; only you, typing the command directly, makes it happen. This
guide is written to match that reality, not to paper over it.

## After setup

Verify it actually worked — see
[`VERIFICATION_CHECKLIST.md`](VERIFICATION_CHECKLIST.md) for the concrete,
checkable behaviors that tell you the install is genuinely working versus
just quietly broken.
