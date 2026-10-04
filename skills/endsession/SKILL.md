---
name: endsession
description: >
  Close the session. Writes Rules, Next and Todo into the context file, then
  commits, pushes (PR if needed), ships per `## Done` when the work is complete,
  prints a plain summary, stops.
  Hard stop — final message, no follow-ups. User-invoked only.
disable-model-invocation: true
license: MIT
---

# End session — final message

Do the pass, print the summary, stop. No offers, no "next I could", no new
work. Anything in `$ARGUMENTS` that is a task goes under `## Next`, not done now,
except the token `auto` (the session band's timed run): it means skip shipping.

This pass is deliberately light: context is at its largest now, so every extra
step is expensive. The full context file review runs at the start of a later
session, on a fresh context, when the SessionStart hook asks for it.

## Context file

Root `AGENTS.md` on both hosts (Git root, or the session working directory
outside Git); `CLAUDE.md` is only the `@AGENTS.md` stub. Overflow is
`agents-<category>.md`. Below, "context file" means root `AGENTS.md`.

Claude invokes these skills with `/lean-and-mean` and `/endsession`; Codex
uses `$lean-and-mean` and `$endsession` (select the installed skill if the UI
shows a qualified name). Slash commands below describe the same workflow
on either host. In Codex, treat text following the skill invocation as its
arguments; `$ARGUMENTS` is Claude's notation, not a required environment variable.

## Questions

Ask only about destructive prunes, max 3, in one batch before any file is
written: dropping or merging a Rule or a P1 Todo that would destroy
information you cannot recover from the code, git, or this session, when you
cannot tell whether it still matters. Clearly stale → drop without asking.
More undecidable items than slots → keep them, list them under Todo as
`P3 — confirm: <item>`. Never ask whether to commit or push: invoking
`/endsession` is the yes.

## Pass

1. No context file, or `CLAUDE.md` is not the stub → run `/lean-and-mean`,
   then continue.
2. **Rules** — scan this session for corrections the user made, approaches
   that failed, commands that didn't exist, wrong assumptions. Each becomes one
   line under `## Rules`: `- <imperative>. <why — the cost>. <YYYY-MM-DD>`.
   Same area as an existing rule → tighten it. Over 15 → merge the two weakest.
   Nothing learned → add nothing.
3. **Auto memory** — Claude Code only. Built-in memory files for this project
   (`~/.claude/projects/<project>/memory/`) of type `feedback` or `project`
   → promote each into a Rule or Next/Todo line, then delete the file and its
   `MEMORY.md` line: the committed context file is the one memory. Leave
   `user` and `reference` memories alone.
4. **Done?** — read `## Done`; missing → add it before `## Rules` as
   `- Committed and pushed; PR open if the branch needs one.` plus Todo
   `P3 — confirm: define ## Done (merge? deploy command?)`. The session is
   complete only if all hold: what the user asked this session is finished; the
   `## Commands` test/lint passed this session (not run → run once now); no open
   question; `$ARGUMENTS` is not `auto`. Ambiguous → not complete.
5. **Next and Todo** — rewrite `## Next` to the real next action. Not complete
   and `## Done` lists more than the push → first line
   `Not done: <remaining Done items> — <why>`. Delete finished Todo items, add
   newly required ones.
6. **Review flag** — this session changed something the context file describes
   outside Rules/Next/Todo (layout, commands, stack, conventions) → add
   `<!-- lean-and-mean: review -->` as the last line of the context file, once
   (skip if already there). The next session start runs the full pass and
   removes it. Do not do that pass now.
7. **Commit** — not a git repo or nothing changed → skip. Otherwise stage the
   session's changes plus the context file and commit, after the edits above.
   Full-English message in the project's commit format. Never stage files that
   look like secrets (`.env`, keys, credentials); leave them out and name them
   in the summary.
8. **Push** — no remote → skip. Use the push command the context file names,
   if any, else `git push` (`-u origin <branch>` when no upstream).
   - On a non-default branch: push, then open a PR with `gh pr create --fill`
     unless one is already open for the branch.
   - On the default branch: push. Rejected as protected or requiring a PR →
     create `session/<YYYY-MM-DD>-<short-topic>`, push it, open a PR.
   - Rejected as behind the remote → stop and report; never force-push or
     rebase.
   - Any other failure (auth, network) → one attempt only; report it and put
     `Unpushed: <branch> — <reason>` as the first line of `## Next`, amending
     the commit.
9. **Ship** — complete only. Run the `## Done` items in order, using only
   commands written in `## Done` or `## Commands`; never infer a merge or
   deploy from CI files or scripts. Merging a PR: `gh pr merge` with the
   strategy `## Done` names (default `--squash`) and `--delete-branch`, then on
   the default branch `git pull`, `git fetch --prune`, and `git branch -d`
   (never `-D`) every local branch `git branch --merged` lists, except the
   default; a `-d` refusal goes in the summary, never stops the chain.
   Squash-merged older branches and other remote branches stay. Any other
   failure stops the chain: write `Not done: <remaining items> — <error>` as
   the first line of `## Next`, commit it as a new commit, push per step 8.

No session log: history is `git log`. Do not write SUMMARY.md.

## Summary

Plain, simple language. Full sentences, no jargon, no fragments. This is the
final output.

```
Session closed.

Done this session:
- <what was built or fixed, one line each>

Updated:
- <selected filename>: <rules added or tightened, Next/Todo changes, review flagged>
- Committed: <short hash and subject>
- Pushed: <branch>, PR <url>, or "Not pushed: <reason>"
- Shipped: <merged PR, branches deleted, deployed where>, or "Not done: <what remains and why>"

Next time:
- <the first thing to do, from ## Next>
```

Omit any line that would say "nothing". Then stop.
