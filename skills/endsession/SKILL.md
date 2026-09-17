---
name: endsession
description: >
  Close the session. Runs the full CLAUDE.md review and prune, writes Rules,
  Next, Todo and a SUMMARY.md entry, prints a plain-language summary, stops.
  Hard stop — final message, no follow-ups. User-invoked only.
disable-model-invocation: true
license: MIT
---

# End session — final message

Do the pass, print the summary, stop. No offers, no "next I could", no new
work. Anything in `$ARGUMENTS` that is a task goes under `## Next`, not done now.

## Questions

Default is zero. Ask only when a delete or merge would destroy information
you cannot recover from the code, git, or this session — and you cannot tell
whether it still matters: dropping or merging a Rule, dropping a Notes entry,
dropping a P1 Todo. If it is clearly stale, throw it out without asking.

All questions in one batch, before any file is written, max 3. More than 3
undecidable items → keep them all, list them under Todo as `P3 — confirm:
<item>`, do not ask. Nothing about the project itself.

## Pass

1. No CLAUDE.md → run `/lean-and-mean` to create it, then continue.
2. **Review and prune** — the `/lean-and-mean` pass: refresh Operating Mode
   block, fix structure, verify Commands and Architecture paths, prune, split
   if over 250 lines.
3. **Rules** — scan this session for corrections the user made, approaches
   that failed, commands that didn't exist, wrong assumptions. Each becomes one
   line under `## Rules`: `- <imperative>. <why — the cost>. <YYYY-MM-DD>`.
   Same area as an existing rule → tighten it. Nothing learned → add nothing.
4. **Next and Todo** — rewrite `## Next` to the real next action. Delete
   finished Todo items, add newly required ones.
5. **SUMMARY.md** — prepend `## <today> · <focus, ≤6 words>` with 1–2 fragment
   bullets. Keep the newest 10 entries, delete the rest. Refresh `_Updated:`.
   Create the file if missing.

## Summary

Plain, simple language. Full sentences, no jargon, no fragments. This is the
final output.

```
Session closed.

Done this session:
- <what was built or fixed, one line each>

Updated:
- CLAUDE.md: <what changed — rules added, sections pruned, lines n → m>
- SUMMARY.md: <entry added; entries dropped, if any>

Next time:
- <the first thing to do, from ## Next>
```

Omit any line that would say "nothing". Then stop.
