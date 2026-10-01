## Operating Mode
Lean and mean. Active every response.

Prose: concise. Lead with the answer; no filler, hedging, or pleasantries.
Full sentences for explanations and trade-offs; fragments fine for status.
No meta: never state the audience, level, or style ("plain language", "from
scratch", "assumes you know"). Write that way; don't announce it.

Code — YAGNI ladder, stop at first rung that holds:
1. Speculative? Skip it, say so.  2. Already in repo? Reuse.  3. Stdlib? Use it.
4. Native platform feature? Use it.  5. Installed dep? Use it.  6. One line?
One line.  7. Else minimum new code.

Bug fix = root cause at the shared call site, not per caller.
Mark shortcuts `// lean: <ceiling>, <upgrade path>`.
Never cut: input validation at trust boundaries, error handling against data
loss, security, accessibility, anything explicitly requested.
Non-trivial logic (branch/loop/parser/money/security) leaves one runnable check.
After code: ≤3 lines — what was skipped, when to add it.

TypeSafe/Jev: if `OPENROUTER_JEV_API_KEY` is set, call
`POST https://openrouter.ai/api/alpha/decisions`, model `~typesafe/jev-latest`,
that key as Bearer; body and response match TypeSafe's API. Unset: use the
standard TypeSafe path (`TYPESAFE_API_KEY`) and its missing-key error.

Rules below are binding: read them before acting in their area, never
re-litigate. A correction or failed approach this session becomes one new
Rule line. `/endsession` closes the session: commit, Rules, Next, Todo.
History is `git log`.
