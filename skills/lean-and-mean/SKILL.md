---
name: lean-and-mean
description: >
  Concise prose + YAGNI code, installed into the project's context file so it runs
  without help. Owns the context file (structure, 250-line cap, Rules, Next, Todo).
  `/lean-and-mean` creates or reviews the context file, idempotent; runs on its own
  when the SessionStart hook asks. `/lean-and-mean debt` lists `// lean:` markers.
  Trigger: "lean and mean", "lean mode", "yagni", "be terse", "set up
  claude.md", "review claude.md", "clean up claude.md", "set up agents.md",
  "review agents.md", "context files".
  Do NOT compress requests needing full prose (reports, readable docs).
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

## Host and context file

Use `CLAUDE.md` in Claude Code and `AGENTS.md` in Codex, at the project
root (Git root, or the session working directory outside Git). In Codex,
use a nonempty root `AGENTS.override.md` instead when present. Respect any
additional instructions applying to the files you edit; do not flatten or
rewrite nested instruction files. Never edit the other host's file implicitly.
Below, "context file" means that selected file. Use `claude-<category>.md`
for Claude overflow and `agents-<category>.md` for Codex overflow; substitute
that prefix for `context-<category>.md` in the template.

Claude invokes these skills with `/lean-and-mean` and `/endsession`; Codex
uses `$lean-and-mean` and `$endsession` (select the installed skill if the UI
shows a qualified name). Slash commands below describe the same workflow
on either host. In Codex, treat text following the skill invocation as its
arguments; `$ARGUMENTS` is Claude's notation, not a required environment variable.

## `/lean-and-mean` — set up or review context file

Idempotent. Rerunning converges. Rarely run by hand: the SessionStart hook
asks for this pass, before the user's first task, when the Operating Mode
block is out of date, the context file is over 250 lines, or `/endsession` left the
`<!-- lean-and-mean: review -->` flag. Run it then without asking, report the
one line, and carry on with the user's request.

1. No context file → create from the structure below. Fill Project & Stack,
   Commands, Architecture & Layout from the repo. Leave Rules empty.
2. Paste `operating-mode.md` verbatim under `## Operating Mode`; replace any
   older version.
3. Reorder to the structure below; merge stray headings into nearest section.
4. Verify Architecture & Layout against the tree: add modules, drop dead
   paths, fix wrong purposes. Verify Commands run.
5. Prune — cut, never rewrite longer: restates the code; stale paths or
   commands (verify first); narrative history → delete, `git log` has it;
   legacy SUMMARY.md (old `/endsession`) → delete it and its pointer; `[x]` Todo →
   delete; Rules the tooling now enforces (lint, type, test) → delete.
6. Next must name the real next action. Empty Next on a live project is a defect.
7. Over 250 lines → move largest non-core sections to `context-<category>.md`
   (H1 + one-line purpose at top), leave a pointer in Notes & Pointers.
   Operating Mode, Commands, Rules, Next, Todo never move.
8. Remove the `<!-- lean-and-mean: review -->` flag if present.
9. Report one line: `<n> → <m> lines. cut: <X>. moved: <Y>. rules +<k>.`

## Structure

Exact order, exact H2 names. Drop a section only if truly empty.

```markdown
# <Project> — <selected filename>

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
- [context-<category>.md](context-<category>.md) — <scope>
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
