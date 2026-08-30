# Build Card: BC-2026-08-31-readme-reposition-and-clear-compact

No separate design doc — this is content authorship (README repositioning,
human-dictated) plus a small, precisely-specified prose fix (contextual
`/clear` vs `/compact` suggestion). Neither is an architecture decision, so
this card skips the `/plan-eng-review` chain and packages directly, per
Commander's own judgment that copy/prose work doesn't need architecture
lock-in.

## Scope

- `README.md`
- `commands/commander.md`
- `commands/execute.md`
- `.claude-plugin/plugin.json`

## Target

### 1. `README.md` — full replace

A drafted replacement already exists at:
`C:\Users\muhai\AppData\Local\Temp\claude\E--Programming-Zenny---breakthrough\67c45a76-867f-40c0-98e1-743972295ca3\scratchpad\gstack-pilot-README-draft.md`

Read it in full and use it as the new `README.md` content, with these
checks before placing it:
- Every internal anchor link in the new Table of Contents actually resolves
  to a heading in the file (verify by reading the rendered heading text,
  not just eyeballing the slugs).
- The "Releases" section's changelog history (v0.1.0 → v1.2.0) is preserved
  verbatim from the current README — this is historical record, not part
  of the repositioning, and must not be rewritten or trimmed.
- The repositioning itself (new opening framing, "The problem this solves,"
  "Who this is for," "Example use cases," "Pairs well with project-memory"
  sections) is human-dictated content — place it as drafted; this is not an
  invitation to further rewrite the positioning, only to verify technical
  accuracy against the current codebase (e.g., confirm `gbrain` is genuinely
  gstack's own memory-layer name before that claim ships — grep gstack's own
  skill files/docs for it) and fix anything that's factually wrong.
- Add a new "Releases" entry for the version bump this card produces (see
  Target 4 below), same voice/format as the existing entries.

### 2. `commands/commander.md` — reword the "Session running long?" line

Current (line 32):
> **Session running long?** Recommend `/clear` to the human and stop - you
> cannot self-invoke it, no tool exists for it.

Replace with:
> **Session running long?** Recommend `/compact` if there's more work still
> queued this session (an approved plan not yet executed, a pending Build
> Card, mid-chain auto-handoff) — it trims token usage while keeping this
> session's context, branch state, and decisions intact, cheaper than a
> fresh session re-deriving all of it. Recommend `/clear` instead if the
> current unit of work is fully done and nothing else is pending — a clean
> slate costs nothing extra when there's no continuity to preserve. You
> cannot self-invoke either; recommend and stop, don't block waiting on it.

### 3. `commands/execute.md` — reword the auto-handoff line's `/clear`-or-`/compact` clause

Current (line 27), the relevant clause:
> ...recommend `/clear` or `/compact` to the human (you cannot self-invoke
> either; don't block waiting on it) and invoke the `commander` command
> yourself...

Replace with:
> ...recommend `/compact` to the human if more work is still queued for
> this session (another approved Build Card, a mid-chain auto-handoff
> loop), or `/clear` if this was the last thing pending and nothing else
> needs this session's context — recommend the one that fits, don't
> default to either blindly (you cannot self-invoke either; don't block
> waiting on it) — and invoke the `commander` command yourself...

Keep the rest of that sentence (the mandatory-wrap-up-steps preamble and
the "invoke the `commander` command yourself with a brief 1-2 line
summary" tail) unchanged — only the `/clear`-or-`/compact` clause itself
changes.

### 4. `.claude-plugin/plugin.json` — patch version bump

This is a behavioral refinement (what Commander/Execute actually recommend
to the human), not a new capability — patch bump, `1.2.0` → `1.2.1`. The
README rewrite itself is docs-only and doesn't independently require a
bump; it rides along with this same release.

## Rationale (from Commander's session with the human)

The prior wording (`/clear` in commander.md; `/clear` or `/compact`
undifferentiated in execute.md) didn't distinguish two genuinely different
situations: a session with more approved work still queued benefits from
`/compact` (keeps branch state, decisions, and in-flight context — cheaper
than a fresh session that has to re-derive all of it), while a session
where the current unit of work is the last thing pending has nothing left
to preserve, so `/clear`'s clean slate costs nothing extra. The fix is
contextual guidance, not a blanket preference for one over the other.

## Acceptance Criteria

1. `README.md`'s new content matches the drafted repositioning verbatim in
   substance (framing, section order, new sections) — technical corrections
   only, no further rewriting of the positioning itself.
2. Every anchor link in the new README's Table of Contents resolves to a
   real heading — verified by reading the file, not assumed.
3. The Releases section's existing v0.1.0–v1.2.0 history is preserved
   verbatim, with a new entry appended for this card's own version bump.
4. `commander.md`'s "Session running long?" line gives contextual guidance
   (queued work → `/compact`; nothing left pending → `/clear`) — verified
   by reading the file after the edit, not just diffed mentally.
5. `execute.md`'s auto-handoff line gives the same contextual guidance,
   consistent wording with commander.md's version.
6. `plugin.json` version is `1.2.1`.
7. `gbrain`'s existence as gstack's own memory-layer name is verified
   against gstack's actual installed files/docs before the README ships
   with that claim (per Target 1's accuracy-check instruction) — if it
   turns out inaccurate, fix the README claim, don't ship it unverified.

## Test Cases / Testing Instructions

No automated test framework in this repo (same as prior cards). Live
verification:
- Render/read the full new `README.md`, click-check (or manually trace)
  every TOC anchor.
- Read `commander.md` and `execute.md` after editing — confirm the new
  wording reads naturally in context, not just as an isolated pasted
  sentence.
- Confirm `plugin.json` reads `1.2.1`.
- Grep gstack's installed skill files for `gbrain` to confirm the README's
  claim about it is accurate before merge.

## Definition of Done / Expected Outputs

- All 4 files in Target changed as scoped, all 7 Acceptance Criteria
  verified live.
- Version bumped to `1.2.1`, and — same discipline as the last two cards —
  a matching `git tag v1.2.1` + `gh release create` cut in the same
  sitting as the merge, not deferred.
- `gstack-pilot`'s own mandatory wrap-up: feature branch → PR → gstack's
  `review` → `qa` (or explicitly-disclosed substitute) → `ship` → merge.
- `00_Project_Control/Wiki/reference/gstack-pilot-plugin.md` (Zenny's
  tracking page) gets a new entry once this ships.

## Explicitly NOT part of this card

- Further rewriting the README's positioning/messaging beyond factual
  corrections — that's the human's own drafted content, not open for
  independent rewriting.
- Any change to `VERIFICATION_CHECKLIST.md` — optional nice-to-have, not
  required for this card's Definition of Done.
- Any change to the actual `/clear`/`/compact` mechanism itself — this
  card only changes what's *recommended in prose*; neither mode can
  self-invoke either command, and that limitation is unchanged.
