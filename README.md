# lean-and-mean

**[Explainer and overview → spinlockdevelopment.github.io/lean-and-mean](https://spinlockdevelopment.github.io/lean-and-mean/)**

A Claude Code plugin: concise prose and YAGNI code, written into your project's
`CLAUDE.md` once so it runs every session with nothing else in the loop. Plus
`/endsession`, which closes a session by offering to commit and writing what
was learned back into `CLAUDE.md`, then stops.

Three axes:

- **Prose** — lead with the answer; no filler, hedging, or pleasantries. Full
  sentences for explanations and trade-offs, fragments only for status.
- **Code** — a YAGNI ladder. Skip speculative work, reuse what is already in the
  repo, then stdlib, then the native platform feature, then an installed
  dependency, then one line, and only then new code. Never cut input validation
  at trust boundaries, error handling that prevents data loss, security, or
  accessibility.
- **Memory** — every correction, failed approach, and footgun becomes one
  binding line under `## Rules` in `CLAUDE.md`, so it does not happen twice.

[Why use it](#why-use-it) covers the cost model behind these choices.

## Why use it

The figures below are modeled from Anthropic's API list prices (September
2026) and round-number session shapes, not measured from real sessions.
Subscription plans meter the same tokens against usage limits, so the
proportions carry over.

| Per million tokens | Claude Fable 5.1 | Claude Opus 5 |
|---|---|---|
| Output | $50 | $25 |
| Input, uncached | $10 | $5 |
| Cache write, 1-hour TTL (2× input) | $20 | $10 |
| Cache read | $0.25 | $0.50 |

### Long sessions cost more per turn than they look

Every request in a session resends the whole conversation, and every tool
call is a request. Caching makes each resend cheap, but it is billed every
time, so read cost grows with the number of requests times the size of the
context.

Take 200K–500K token sessions, a common shape: one session growing from 30K to
500K over about 300 requests, with about 2K output tokens per request.

| | One 500K session | Three sessions, restarted between tasks |
|---|---|---|
| Average context per request | ~265K | ~110K |
| Cache reads, Fable 5.1 | ~$20 | ~$8 |
| Total, Fable 5.1 | ~$60 | ~$49 (about 20% less) |
| Total, Opus 5 | ~$60 | ~$37 (about 40% less) |

A restart costs well under a dollar: the system prompt, tools and `CLAUDE.md`
are written to cache once. Fable's cheap cache reads shrink the percentage,
but the dollar saving per long session stays around $10.

### Rehydration: coming back to a big session

Claude Code caches for an hour. Step away longer than that and the next turn
has to write the whole context back into cache at 2× the input price before it
does any work:

| Context when you come back | Fable 5.1 | Opus 5 |
|---|---|---|
| 400K | ~$8 | ~$4 |
| Fresh session (~30K) | ~$0.60 | ~$0.30 |

One idle gap on a big session can cost more than a day of cold starts. That is
the strongest case for `/endsession` before a break.

### Why `/endsession` instead of running to compaction

- Compaction fires late. By then you have paid the large-context read cost on
  every turn before it.
- Compaction's summary is uncontrolled and lossy. `/endsession` writes a
  deliberate handoff: new Rules, the real next action under `## Next`, and an
  updated Todo, so the next session starts small and knows exactly where to
  pick up.
- It is light on purpose. It runs when the context is at its largest, so it
  only does the cheap work (about 10 requests, around $1 on Fable at 400K) and
  defers the full review to the next session's fresh context.
- It offers to commit first, so `git log` stays the history and nothing is left
  half-done between sessions.

Rule of thumb: keep going in the same session for tightly related follow-ups
within the hour; end and restart at task boundaries and before any break.

### YAGNI versus letting the model do what it wants

Output is the most expensive token, and code is most of what a session
outputs. Code that nobody asked for is paid for three times:

1. Once as output when it is written (a 150-line speculative helper plus tests
   is roughly 3K tokens, about $0.15 on Fable).
2. Again as context on every later request in the session (3K tokens across
   200 requests is about another $0.15 on Fable), and again whenever it is
   edited.
3. Most of all in your time: every extra line has to be reviewed, tested and
   maintained.

The per-instance dollar amounts are small; the cost adds up across a project
and lands mostly on review. The ladder (reuse, then stdlib, then the platform,
then an installed dependency, then one line, then new code) stops that at the
source. "One runnable check" for non-trivial logic keeps tests proportionate
instead of sprawling. `// lean:` markers record each shortcut's ceiling and
upgrade path, so skipping work is a visible decision, not a silent one;
`/lean-and-mean debt` lists them.

Concise prose is not a real cost lever: chat prose is a small share of output
tokens, and trimming it saves a few percent at most. It is there for
readability.

### Readable and consistent

- Answers lead with the result. Explanations stay in full sentences; status
  updates can be short.
- The same Operating Mode block is in every project, so behaviour does not
  drift between repos or sessions. The hook notices when a project's copy is
  out of date and refreshes it.
- Every session ends the same way: commit, Rules, Next, Todo, and a
  plain-language summary of what was done and what comes next.

### A structured CLAUDE.md

`CLAUDE.md` is loaded on every request, so its size and shape matter.

- **Fixed sections in a fixed order.** Claude always knows where to find the
  commands, the layout, the conventions and the binding Rules, and where to
  write new ones.
- **A 250-line cap.** The file stays cheap to carry on every turn. Anything
  bigger is split into `claude-<category>.md` files with a pointer.
- **Rules instead of repeat mistakes.** A correction or a failed approach
  becomes one dated line that Claude must follow next time. One line like "push
  with the gh credential helper; plain push 403'd three times" saves every
  future session from repeating that loop, and every avoided turn is a
  full-context read avoided.
- **Verified commands and paths.** Commands that don't run and paths that no
  longer exist are pruned, so Claude doesn't waste turns on stale
  instructions.
- **`## Next` makes restarts cheap.** A new session reads one line and starts
  on the right task, without re-reading a long history.

### Hygiene that runs itself

You rarely run anything by hand after setup. At session start, on a fresh
and cheap context, the hook asks Claude to run the full review when:

- the Operating Mode block differs from the plugin's current version,
- `CLAUDE.md` is over 250 lines, or
- the last `/endsession` flagged that the session changed the project's
  layout, commands, stack or conventions.

The review re-checks commands and paths, restructures, prunes finished Todo
items and Rules the tooling now enforces, and splits the file if it has grown
past the cap. Otherwise the hook prints nothing.

## Install

In Claude Code:

```
/plugin marketplace add spinlockdevelopment/lean-and-mean
/plugin install lean-and-mean@lean-and-mean
```

Or from your shell:

```
claude plugin marketplace add spinlockdevelopment/lean-and-mean
claude plugin install lean-and-mean@lean-and-mean
```

Restart Claude Code afterwards — the hook only loads at session start. No
dependencies; the hook is a short POSIX shell script.

Manual install: copy `skills/lean-and-mean/` and `skills/endsession/` into
`~/.claude/skills/`, copy `hooks/session-start.sh` somewhere, and add the
`SessionStart` entry from `hooks/hooks.json` to `~/.claude/settings.json`,
pointing the command at that script.

## Use

| Command | Effect |
|---------|--------|
| `/lean-and-mean` | Create `CLAUDE.md` from the template, or review an existing one: refresh the Operating Mode block, restructure, prune, split anything over 250 lines. Idempotent. After setup it runs on its own when due, so you rarely type it |
| `/lean-and-mean debt` | List every `// lean:` shortcut marker with its ceiling and upgrade path |
| `/endsession` | Final message of the session. Offers to commit uncommitted work, turns this session's mistakes into Rules, rewrites Next and Todo, flags a full review for next session if the project's layout or commands changed, then prints a plain-language summary of what was done, what was updated, and what is next. Then stops |

Installed as a plugin the skills are namespaced: `/lean-and-mean:endsession`
and `/lean-and-mean:lean-and-mean`. A manual install into `~/.claude/skills/`
gives the bare `/endsession` and `/lean-and-mean`.

`/endsession` is a hard stop. Anything you pass as an argument that looks like
a task is written under `## Next`, not done. The model never invokes it on its
own. It asks once, up front, at most three items: whether to commit (when the
tree is dirty), and any delete that would destroy a Rule or P1 Todo it cannot
judge. Clearly stale entries are dropped without asking. It is kept light on
purpose: the context is largest at the end of a session, so the full review
waits for the next session's fresh context.

## How it works

`CLAUDE.md` is loaded by Claude Code natively, so once the `## Operating Mode`
block is in it the mode is on for that project with no hook, flag, or per-turn
reminder. The block is `skills/lean-and-mean/operating-mode.md`, pasted
verbatim.

One hook, `SessionStart`. If the block is missing it prints the block into
context, so the mode is active anyway, and asks you to run `/lean-and-mean` to
make it permanent. If the block is there it says nothing, unless the full
`/lean-and-mean` pass is due, in which case it tells Claude to run it before
your first task:

- the block differs from the plugin's current `operating-mode.md` (plugin updated),
- `CLAUDE.md` is over 250 lines, or
- the last `/endsession` left a `<!-- lean-and-mean: review -->` flag.

There is no session log: `git log` is the history, which is why `/endsession`
offers to commit first.

Off: delete the block from `CLAUDE.md`, or disable the plugin.

## Boundaries

This governs code shape, prose, and context files. It does not review
correctness — pair it with `/code-review`. Bloat review of code is `/simplify`.

## License

MIT. See [LICENSE](LICENSE).
