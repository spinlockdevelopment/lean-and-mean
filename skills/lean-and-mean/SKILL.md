---
name: lean-and-mean
description: >
  Terse prose + YAGNI code, installed into the project's CLAUDE.md so it runs
  without help. Owns CLAUDE.md (structure, 250-line cap, Rules, Next, Todo)
  and SUMMARY.md (last 10 sessions). `/lean-and-mean` creates or reviews
  CLAUDE.md, idempotent. `/lean-and-mean debt` lists `// lean:` markers.
  Trigger: "lean and mean", "lean mode", "yagni", "be terse", "set up
  claude.md", "review claude.md", "clean up claude.md", "context files".
  Do NOT compress requests needing full prose (reports, readable docs).
argument-hint: "[debt]"
license: MIT
---

# Lean and Mean

Senior dev, few words, minimal code. The mode is the `## Operating Mode`
block in `operating-mode.md` (next to this file). It lives in the project's
CLAUDE.md, which Claude Code loads natively — no hook, no flag, no per-turn
reinforcement. The SessionStart hook only speaks when the block is missing.

Off: remove the block from CLAUDE.md, or disable the plugin.

## `/lean-and-mean` — set up or review CLAUDE.md

Idempotent. Rerunning converges. `/endsession` runs this same pass before it
writes Rules, Next, Todo and SUMMARY.md, so run it by hand only for setup or
a mid-session tidy.

1. No CLAUDE.md → create from the structure below. Fill Project & Stack,
   Commands, Architecture & Layout from the repo. Leave Rules empty.
2. Paste `operating-mode.md` verbatim under `## Operating Mode`; replace any
   older version.
3. Reorder to the structure below; merge stray headings into nearest section.
4. Verify Architecture & Layout against the tree: add modules, drop dead
   paths, fix wrong purposes. Verify Commands run.
5. Prune — cut, never rewrite longer: restates the code; stale paths or
   commands (verify first); narrative history → SUMMARY.md; `[x]` Todo →
   delete; Rules the tooling now enforces (lint, type, test) → delete.
6. Next must name the real next action. Empty Next on a live project is a defect.
7. Over 250 lines → move largest non-core sections to `claude-<category>.md`
   (H1 + one-line purpose at top), leave a pointer in Notes & Pointers.
   Operating Mode, Commands, Rules, Next, Todo never move.
8. Report one line: `<n> → <m> lines. cut: <X>. moved: <Y>. rules +<k>.`

## Structure

Exact order, exact H2 names. Drop a section only if truly empty.

```markdown
# <Project> — CLAUDE.md

## Operating Mode
<operating-mode.md, verbatim>

## Project & Stack
One paragraph: what, for whom, current state. Then languages/runtimes/key deps, one line each.

## Commands
Build / run / test / lint / typecheck. Copy-pasteable, one per line.

## Architecture & Layout
Key components and the main flow, then:
| Path | Purpose |
|------|---------|
| `src/foo/` | <what lives here, why> |
Modules and entry points only. Skip what the name already says.

## Conventions
Naming, formatting, imports, error handling, commit format.

## Rules
- <imperative>. <why — the mistake it cost>. <YYYY-MM-DD>
Binding. Cap 15: over cap, merge the two weakest. Same area as an existing
rule → tighten it, don't add. Generalize one step, no further. No rule for a
one-off typo or anything the tooling already catches.

## Next
Immediate next task first. 1–5 lines, no backlog.

## Todo
- [ ] P1 — <item>
Priority-ordered. Checked items are deleted at the next pass.

## Notes & Pointers
- [claude-<category>.md](claude-<category>.md) — <scope>
- [SUMMARY.md](SUMMARY.md) — last 10 sessions
- <constraint, footgun, "do not touch X">
```

## SUMMARY.md

History only, written by `/endsession`. Newest first, max 10 entries, oldest
dropped. Absolute dates. Bullets are fragments.

```markdown
# Summary

_Updated: YYYY-MM-DD_

## YYYY-MM-DD · <session focus, ≤6 words>
- <what changed>
- <second point, only if there was one>
```

## `/lean-and-mean debt`

`grep -rnE '(#|//) ?lean:' .` (skip node_modules/.git/build). List each
marker's ceiling and upgrade path. Changes nothing.

## Boundaries

Code shape, terseness, context files. Not correctness — pair with
`/code-review`. Bloat review of code → `/simplify`.
