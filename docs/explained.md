# How lean-and-mean works

## The problem it solves

Claude Code is an AI assistant that works inside your project: it reads files,
runs commands, and writes code. Two things go wrong with assistants like it:

1. **They say and build too much.** Long, padded answers. Extra helper
   functions, config options and abstractions nobody asked for. All of that is
   more to read, review, test and maintain.
2. **They forget.** Every new session starts blank. A mistake you corrected
   yesterday can happen again today.

lean-and-mean fixes both by writing a short set of instructions into a file the
assistant already reads at the start of every session.

## The key idea: one file the assistant always reads

Claude Code automatically loads a file called `CLAUDE.md` from the root of
your project (Codex, a similar tool, uses `AGENTS.md`). Whatever is in it, the
assistant treats as standing instructions.

lean-and-mean puts its rules in that file. After that, the plugin barely needs
to do anything: the instructions are just *there*, every session, for free.

## What it does, point by point

### 1. Short, direct answers
- The answer comes first. No "Great question!", no filler, no hedging.
- Explanations still use full sentences; status updates can be terse.

### 2. Minimal code (the "YAGNI ladder")
YAGNI means "You Aren't Gonna Need It". Before writing code, the assistant
walks down this list and stops at the first step that works:

1. Is this only *maybe* needed later? Then skip it and say so.
2. Does the project already have code that does this? Reuse it.
3. Does the language's standard library do it? Use that.
4. Does the platform do it natively (the browser, the OS, the framework)? Use that.
5. Is there an already-installed library for it? Use that.
6. Can it be one line? Make it one line.
7. Only then: write the smallest new code that works.

### 3. Things it never cuts
Being minimal never means being careless. It always keeps:
- checking untrusted input (user input, network data),
- error handling that prevents losing data,
- security,
- accessibility,
- anything you explicitly asked for.

### 4. Fix the cause, not the symptom
When fixing a bug, fix it at the shared place it comes from, not separately in
every spot that shows it.

### 5. Shortcuts are labeled
If the assistant takes a deliberate shortcut, it leaves a comment like
`// lean: handles up to 1,000 rows, switch to streaming if larger`. Later,
`/lean-and-mean debt` lists every such comment so you can see your shortcuts in
one place.

### 6. One test for tricky code
Logic with branches, loops, parsing, money or security gets one check you can
actually run. Not a giant test suite, but not nothing.

### 7. A short "what I skipped" note
After writing code, the assistant adds at most three lines: what it left out,
and when you would want to add it.

### 8. Memory that survives sessions (Rules)
`CLAUDE.md` has a `## Rules` section. Every time the assistant makes a mistake
and you correct it, that lesson becomes one line there, with the date. Because
the file is read every session, the same mistake doesn't repeat. Capped at 15
rules so the list stays readable.

### 9. A "where we left off" note (Next and Todo)
- `## Next`: the very next task, so a new session knows where to start.
- `## Todo`: a short, prioritized backlog.
- History is not kept in the file; `git log` already has it.

### 10. A tidy, fixed layout for CLAUDE.md
The file always has the same sections in the same order: Operating Mode,
Project & Stack, Commands, Architecture & Layout, Conventions, Rules, Next,
Todo, Notes & Pointers. It must stay under 250 lines; anything bigger is moved
into a separate file with a link. A small file is cheaper because the assistant
re-reads it on every step.

## The commands

| Command | What it does |
|---|---|
| `/lean-and-mean` | Sets up `CLAUDE.md` the first time, or cleans up an existing one: updates the instructions, reorders sections, checks that listed commands and paths are real, deletes stale lines. Safe to run repeatedly. You rarely need to type it. |
| `/lean-and-mean debt` | Lists every `// lean:` shortcut in the project. Changes nothing. |
| `/endsession` | Wraps up a work session: offers to commit your work, saves lessons as Rules, updates Next and Todo, then stops. Ending sessions at natural break points keeps them cheap and focused. |

In Claude Code the plugin versions are spelled `/lean-and-mean:lean-and-mean`
and `/lean-and-mean:endsession`.

## What happens automatically

A tiny script (a "hook") runs each time you start a session. It stays silent
unless one of these is true:

- **The instructions aren't in `CLAUDE.md` yet.** It loads them for this
  session anyway and suggests running `/lean-and-mean` to make it permanent.
- **A cleanup is due.** The plugin was updated, the file grew past 250 lines,
  or the last `/endsession` asked for a review. It tells the assistant to run
  the cleanup before your first task.
- **No advisor is set** (Claude Code only). It suggests turning one on; see below.

## Extras that come with it

- **Advisor tip.** Claude Code can consult a second, stronger model at key
  moments: before a plan, when the same error keeps coming back, and before
  declaring "done". Turn it on once with `/advisor fable` (or `opus`). It costs
  more the longer a session runs, which is one more reason to use `/endsession`.
- **Effort tip.** Run your main session at high effort and hand routine
  side-jobs to a cheaper model (Sonnet) at medium effort. Details in the
  README's "Why use it".
- **dashboard-builder.** For long tasks, builds a self-refreshing web page
  in `.dashboard/` showing progress, open questions and results.
- **typesafe-ai.** A bundled guide for building app features with TypeSafe's
  Jev model, which makes quick, structured yes/no and pick-one decisions.

## Turning it off

Disable the plugin **and** delete the `## Operating Mode` section from
`CLAUDE.md`. Disabling alone isn't enough, because the instructions live in the
file, not in the plugin.

## Glossary

- **Session**: one conversation with the assistant, from start until you close it.
- **Plugin**: an add-on you install into Claude Code.
- **Hook**: a small script Claude Code runs automatically at a set moment.
- **Context**: everything the assistant has read in the current session. Bigger context costs more per step.
- **YAGNI**: "You Aren't Gonna Need It", meaning don't build for imagined future needs.
