---
name: endsession
description: >
  Close the session. Offers to commit, writes Rules, Next and Todo into
  CLAUDE.md, flags a full review if needed, prints a plain summary, stops.
  Hard stop — final message, no follow-ups. User-invoked only.
disable-model-invocation: true
license: MIT
---

# End session — final message

Do the pass, print the summary, stop. No offers, no "next I could", no new
work. Anything in `$ARGUMENTS` that is a task goes under `## Next`, not done now.

This pass is deliberately light: context is at its largest now, so every extra
step is expensive. The full CLAUDE.md review runs at the start of a later
session, on a fresh context, when the SessionStart hook asks for it.

## Questions

All questions in one batch, before any file is written, max 3.

1. **Commit** — always ask when there is something to commit. Run
   `git status --short`; if it lists changes, ask: "Uncommitted changes in
   <files>. Commit them before closing?" Skip when clean or not a git repo.
2. **Destructive prunes** — ask only when dropping or merging a Rule or a P1
   Todo would destroy information you cannot recover from the code, git, or
   this session, and you cannot tell whether it still matters. Clearly stale →
   drop without asking. More undecidable items than slots → keep them, list
   them under Todo as `P3 — confirm: <item>`.

Nothing about the project itself.

## Pass

1. No CLAUDE.md → run `/lean-and-mean` to create it, then continue.
2. **Rules** — scan this session for corrections the user made, approaches
   that failed, commands that didn't exist, wrong assumptions. Each becomes one
   line under `## Rules`: `- <imperative>. <why — the cost>. <YYYY-MM-DD>`.
   Same area as an existing rule → tighten it. Over 15 → merge the two weakest.
   Nothing learned → add nothing.
3. **Next and Todo** — rewrite `## Next` to the real next action. Delete
   finished Todo items, add newly required ones. Commit declined → first line
   of Next: `Uncommitted: <files> — commit or discard.`
4. **Review flag** — this session changed something CLAUDE.md describes
   outside Rules/Next/Todo (layout, commands, stack, conventions) → add
   `<!-- lean-and-mean: review -->` as the last line of CLAUDE.md, once. The
   next session start runs the full pass and removes it. Do not do that pass
   now.
5. **Commit** — if the user said yes, commit now, after the edits above, so a
   tracked CLAUDE.md goes in too. Full-English message in the project's commit
   format. Don't push.

No session log: history is `git log`. Do not write SUMMARY.md.

## Summary

Plain, simple language. Full sentences, no jargon, no fragments. This is the
final output.

```
Session closed.

Done this session:
- <what was built or fixed, one line each>

Updated:
- CLAUDE.md: <rules added or tightened, Next/Todo changes, review flagged>
- Committed: <short hash and subject>, or "Not committed: <files>"

Next time:
- <the first thing to do, from ## Next>
```

Omit any line that would say "nothing". Then stop.
