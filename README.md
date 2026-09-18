# lean-and-mean

**[Explainer and overview → spinlockdevelopment.github.io/lean-and-mean](https://spinlockdevelopment.github.io/lean-and-mean/)**

A Claude Code and Codex plugin: concise prose and YAGNI code, written into your project's
`CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex) once so it runs every session with nothing else in the loop. Plus
`/endsession`, which closes a session by offering to commit and writing what
was learned back into that file, then stops.

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

Figures are modeled from API list prices (September 2026), not measured.
These illustrative estimates are not a subscription billing model or a Codex
pricing claim; actual costs depend on the host, model, caching, and context policy.

| Per million tokens | Fable 5.1 | Opus 5 |
|---|---|---|
| Output | $50 | $25 |
| Cache write, 1-hour (2× input) | $20 | $10 |
| Cache read | $0.25 | $0.50 |

**Long sessions cost more per turn.** Every tool call resends the whole
context as cache reads, so cost scales with requests × context size. A session
growing from 30K to 500K over ~300 requests:

| | One 500K session | Three, restarted between tasks |
|---|---|---|
| Fable 5.1 | ~$60 | ~$49 (−20%) |
| Opus 5 | ~$60 | ~$37 (−40%) |

A restart costs under $1 to re-cache the system prompt and `CLAUDE.md`.

**Walking away is the expensive part.** The cache lasts an hour. After that,
the next turn re-writes the whole context at 2× input: ~$8 for 400K on Fable,
versus ~$0.60 for a fresh session. Compaction doesn't help: it fires late,
after the large-context turns are paid for, and its summary is lossy.
`/endsession` writes a deliberate handoff (Rules, Next, Todo, a commit) for
about $1, so end at task boundaries and before any break.

**Unrequested code is paid three times:** as output (a 150-line speculative
helper with tests is ~3K tokens, ~$0.15 on Fable), as context on every later
turn (~$0.15 more over 200 requests), and in review and maintenance, which is
the real cost. The YAGNI ladder stops it at the source; "one runnable check"
keeps tests proportionate; `// lean:` markers keep skipped work visible.

**Concise prose is for readability, not cost.** Chat prose is a small share of
output; trimming it saves a few percent.

**A structured `CLAUDE.md` keeps every session consistent.** It is loaded on
every request, so it stays small and predictable:

- Fixed sections in a fixed order: Claude always knows where commands, layout,
  conventions and Rules live.
- Rules turn each correction into one binding line, so a mistake costs one
  session, not every session.
- `## Next` lets a fresh session start on the right task from one line;
  `git log` is the history.
- A 250-line cap, with overflow split into `claude-<category>.md`.
- Self-maintaining: at session start, on a cheap context, the hook triggers a
  full review when the block is out of date, the file is over the cap, or
  `/endsession` flagged changed layout or commands. The review re-verifies
  commands and paths and prunes stale entries. Otherwise it stays silent.

## Install

### Codex

From your shell, using a Codex version with plugin support:

```sh
codex plugin marketplace add spinlockdevelopment/lean-and-mean
codex plugin add lean-and-mean@lean-and-mean
```

Or install from a local checkout containing the Codex support (use this path
when testing changes that have not been pushed to GitHub):

```sh
codex plugin marketplace add ~/src/lean-and-mean
codex plugin add lean-and-mean@lean-and-mean
```

Codex can read the existing `.claude-plugin/marketplace.json`; its plugin
metadata lives in `.codex-plugin/plugin.json`. Start a new Codex session after
installation. Review and trust the bundled SessionStart hook when prompted;
installation alone does not authorize hooks. The hook requires a POSIX shell
(macOS, Linux, or WSL).

Open your project in a new Codex session and select the installed skill in the
picker. Run `$lean-and-mean` once to create or review its context file. Use
`$lean-and-mean debt` to list shortcut markers, and `$endsession` to save the
handoff and close the session. Both hosts share the skills and Operating Mode
text. Codex maintains root `AGENTS.md` (or nonempty `AGENTS.override.md` when
present); Claude maintains `CLAUDE.md`. They do not synchronize those files.
Start Codex at the project root for the same scope as the maintenance hook.
Existing nested instruction files still apply and are not rewritten.

Without plugin/hook support, copy both skill folders into `~/.agents/skills/`
and invoke `$lean-and-mean` manually. This installs the persistent mode but
provides no automatic session-start review.

See [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
for plugin discovery and hook trust requirements.

### Claude Code

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

Use the command for your host. The context file is `CLAUDE.md` in Claude Code
and `AGENTS.md` (or its nonempty override) in Codex.

| Claude Code | Codex | Effect |
|-------------|-------|--------|
| `/lean-and-mean` | `$lean-and-mean` | Create the context file from the template, or review an existing one: refresh the Operating Mode block, restructure, prune, split anything over 250 lines. Idempotent. After setup it runs on its own when due, so you rarely type it |
| `/lean-and-mean debt` | `$lean-and-mean debt` | List every `// lean:` shortcut marker with its ceiling and upgrade path |
| `/endsession` | `$endsession` | Final message of the session. Offers to commit uncommitted work, turns this session's mistakes into Rules, rewrites Next and Todo, flags a full review for next session if the project's layout or commands changed, then prints a plain-language summary of what was done, what was updated, and what is next. Then stops |

In Claude Code, plugin skills are namespaced: `/lean-and-mean:endsession`
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

Off: disable the plugin **and** delete its Operating Mode block from the
context file. Disabling alone leaves persisted rules active; deleting alone
lets the enabled hook suggest setup again.

## Boundaries

This governs code shape, prose, and context files. It does not review
correctness — pair it with `/code-review`. Bloat review of code is `/simplify`.

## License

MIT. See [LICENSE](LICENSE).

## Development checks

Run `python3 -m unittest discover -s tests -v` for the shared hook regression tests.

Compatibility validation: the Codex skill loader accepts both skills. The bundled
plugin/skill authoring validators currently reject Claude's `argument-hint`
and/or `disable-model-invocation: true` frontmatter. These are deliberately
retained for Claude compatibility; Codex's explicit-only policy is separately
set in `skills/endsession/agents/openai.yaml`. Treat those validator diagnostics
as known compatibility exceptions, not a clean validation result.
