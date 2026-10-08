---
name: lean-and-mean
description: >
  Creates or reviews AGENTS.md/CLAUDE.md with the concise-prose + YAGNI block; `debt` lists `// lean:` markers.
  Trigger: "lean and mean", "yagni", "set up/review claude.md or agents.md", or when the SessionStart hook asks.
argument-hint: "[debt]"
license: MIT
---

# Lean and Mean

Senior dev, few words, minimal code. The mode is the `## Operating Mode`
block in `operating-mode.md` (next to this file). It lives in the project's
context file, which the host loads natively — no hook, no flag, no per-turn
reinforcement. The SessionStart hook is silent unless the block is missing
or the pass below is due.

Off: disable the plugin and remove its Operating Mode block from the context
file. Disabling alone does not undo persisted instructions.

## Context file

`AGENTS.md` at the project root (Git root, or the session working directory
outside Git), on both hosts. Beside it, `CLAUDE.md` contains exactly
`@AGENTS.md`: Claude Code loads `AGENTS.md` through that import on every
version, even with a `CLAUDE.local.md` present. Overflow goes to
`agents-<category>.md`. `AGENTS.override.md` is unsupported (Codex reads it
instead of `AGENTS.md`). Respect nested instruction files; do not flatten or
rewrite them. A sub-project's own `AGENTS.md` uses the same structure, scoped
to it; Notes & Pointers links to it. Below, "context file" means root `AGENTS.md`.

Claude invokes these skills with `/lean-and-mean` and `/endsession`; Codex
uses `$lean-and-mean` and `$endsession` (select the installed skill if the UI
shows a qualified name). Slash commands below describe the same workflow
on either host. In Codex, treat text following the skill invocation as its
arguments.

## `/lean-and-mean` — set up or review context file

Idempotent. Rerunning converges. Rarely run by hand: the SessionStart hook
asks for this pass, before the user's first task, when the Operating Mode
block is out of date, the context file is over 250 lines, `/endsession` left the
`<!-- lean-and-mean: review -->` flag, or `CLAUDE.md` is not the stub. Run it
then without asking, report the one line, and carry on with the user's request.

1. Root `CLAUDE.md` other than the stub → merge its content into `AGENTS.md`
   (create it if absent), rename `claude-<category>.md` to
   `agents-<category>.md` and fix pointers, then write the stub. No context
   file → create from the structure below. Fill Project & Stack, Commands,
   Architecture & Layout from the repo. Done gets the default line plus a Next item
   `P3 — confirm: define ## Done`; never infer a deploy step. Leave Rules empty, except: over ~500
   source files with `graphify` installed → one Rule to prefer `graphify query`
   over cross-module grep. Either way, write the stub.
2. Paste `operating-mode.md` verbatim under `## Operating Mode`; replace any
   older version.
3. Reorder to the structure below; merge stray headings into nearest section.
   Older layouts: `## Todo` items join the Next backlog, sorted P1 → P3;
   `## Conventions` becomes the last part of Project & Stack.
4. Verify Architecture & Layout against the tree: add modules, drop dead
   paths, fix wrong purposes. Verify Commands run, and that every command
   `## Done` names exists in Commands or the repo.
5. Prune — cut, never rewrite longer: restates the code; stale paths or
   commands (verify first); narrative history → delete, `git log` has it;
   legacy SUMMARY.md (old `/endsession`) → delete it and its pointer; finished Next items →
   delete; Rules the tooling now enforces (lint, type, test) → delete.
6. Next must name the real next action. Empty Next on a live project is a defect.
7. Over 250 lines → move largest non-core sections to `agents-<category>.md`
   (H1 + one-line purpose at top), leave a pointer in Notes & Pointers.
   Operating Mode, Commands, Done, Rules, Next never move.
8. Remove the `<!-- lean-and-mean: review -->` flag if present.
9. Report one line: `<n> → <m> lines. cut: <X>. moved: <Y>. rules +<k>.`
10. Mid-session, re-read `AGENTS.md` after the pass: the new file replaces
    the copy the host loaded at session start. Follow only the new one.

## Structure

Exact order, exact H2 names. Drop a section only if truly empty.

```markdown
# <Project> — AGENTS.md

## Operating Mode
<operating-mode.md, verbatim>

## Project & Stack
One paragraph: what, for whom, current state. Then languages/runtimes/key deps, one line each.
Then conventions: naming, formatting, imports, error handling, commit format.

## Commands
Build / run / test / lint / typecheck. Copy-pasteable, one per line.

## Architecture & Layout
Key components and the main flow, then:
| Path | Purpose |
|------|---------|
| `src/foo/` | <what lives here, why> |
Modules and entry points only. Skip what the name already says.

## Done
- Committed and pushed; PR open if the branch needs one.
What finished means here, in order, with the exact commands, e.g.
`gh pr merge --squash --delete-branch`, `make deploy-staging`. `/endsession`
runs these when the session's work is complete; otherwise Next says what remains.

## Rules
- <imperative>. <why — the mistake it cost>. <YYYY-MM-DD>
Binding. Cap 15: over cap, merge the two weakest. Same area as an existing
rule → tighten it, don't add. Generalize one step, no further. No rule for a
one-off typo or anything the tooling already catches.

## Next
<the immediate next action, 1–3 lines>
- P1 — <item>
- P2 — <item>
- P3 — <item>
Backlog under the next action, sorted by priority, P1 first. Finished items
are deleted at the next pass.

## Notes & Pointers
- [agents-<category>.md](agents-<category>.md) — <scope>
- [<sub>/AGENTS.md](<sub>/AGENTS.md) — <sub-project>; same structure, scoped to it
- History: `git log`, not this file.
- <constraint, footgun, "do not touch X">
```

## `/lean-and-mean debt`

`grep -rnE '(#|//) ?lean:' .` (skip node_modules/.git/build). List each
marker's ceiling and upgrade path. Changes nothing.

## Boundaries

Code shape, terseness, context files. Not correctness — use the host's available
code-review workflow. In Claude Code, `/code-review` and
`/simplify` may be available; do not assume these commands exist in Codex.
