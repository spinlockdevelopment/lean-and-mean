---
name: endsession
description: >
  Close the session. Writes Rules, Next, Todo into CLAUDE.md and a SUMMARY.md
  entry, then stops. Hard stop — final message, no questions, no follow-ups.
  User-invoked only; never triggered by the model.
disable-model-invocation: true
license: MIT
---

# End session — final message

This is the last message of the session. Do the pass, print the report, stop.

Hard stop means: no questions, no offers, no "next I could", no new work.
Anything in `$ARGUMENTS` that is a task goes under `## Next`, not done now.
Do not end with a question or an offer. The report line is the final output.

## Pass

1. **Rules** — scan this session for corrections the user made, approaches
   that failed, commands that didn't exist, wrong assumptions. Each becomes one
   line under `## Rules` in CLAUDE.md: `- <imperative>. <why — the cost>. <YYYY-MM-DD>`.
   Same area as an existing rule → tighten it. Nothing learned → add nothing.
2. **Next** — rewrite `## Next` to the real next action. Delete finished
   `## Todo` items, add newly required ones.
3. **Sanity** — Commands still run, Architecture & Layout paths exist,
   CLAUDE.md under 250 lines.
4. **SUMMARY.md** — prepend `## <today> · <focus, ≤6 words>` with 1–2 fragment
   bullets. Keep the newest 10 entries, delete the rest. Refresh `_Updated:`.
   Create the file if missing.
5. No CLAUDE.md → run `/lean-and-mean` first, then 1–4.

## Report

One line, then stop:

`session closed. rules +<k>. next: <one line>. summary +1.`
