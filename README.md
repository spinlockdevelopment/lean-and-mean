# lean-and-mean

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

This governs code shape, spoken terseness, and context files. It does not review
correctness — pair it with `/code-review`. Bloat review of code is `/simplify`.

## License

MIT. See [LICENSE](LICENSE).
