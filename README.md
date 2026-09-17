# lean-and-mean

A Claude Code plugin: terse prose and YAGNI code, written into your project's
`CLAUDE.md` once so it runs every session with nothing else in the loop. Plus
`/endsession`, which closes a session by writing what was learned back into
`CLAUDE.md` and `SUMMARY.md`, then stops.

Three axes:

- **Prose** — drop articles, filler, hedging, pleasantries. Fragments are fine.
  Code, error text, commit messages, PR bodies, security warnings, and anything
  you explicitly asked to be readable stay in full normal English.
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
dependencies; the hook is a 16-line POSIX shell script.

Manual install: copy `skills/lean-and-mean/` and `skills/endsession/` into
`~/.claude/skills/`, copy `hooks/session-start.sh` somewhere, and add the
`SessionStart` entry from `hooks/hooks.json` to `~/.claude/settings.json`,
pointing the command at that script.

## Use

| Command | Effect |
|---------|--------|
| `/lean-and-mean` | Create `CLAUDE.md` from the template, or review an existing one: refresh the Operating Mode block, restructure, prune, split anything over 250 lines. Idempotent |
| `/lean-and-mean debt` | List every `// lean:` shortcut marker with its ceiling and upgrade path |
| `/endsession` | Final message of the session. Runs the `/lean-and-mean` review and prune, turns this session's mistakes into Rules, rewrites Next and Todo, prepends a `SUMMARY.md` entry, then prints a plain-language summary of what was done, what was updated, and what is next. Then stops |

Installed as a plugin the skills are namespaced: `/lean-and-mean:endsession`
and `/lean-and-mean:lean-and-mean`. A manual install into `~/.claude/skills/`
gives the bare `/endsession` and `/lean-and-mean`.

`/endsession` is a hard stop. Anything you pass as an argument that looks like
a task is written under `## Next`, not done. The model never invokes it on its
own. It asks nothing unless a delete would destroy a Rule, note, or P1 Todo it
cannot judge; then it asks once, up front, at most three items, and carries on.
Clearly stale entries are dropped without asking.

## How it works

`CLAUDE.md` is loaded by Claude Code natively, so once the `## Operating Mode`
block is in it the mode is on for that project with no hook, flag, or per-turn
reminder. The block is `skills/lean-and-mean/operating-mode.md`, pasted
verbatim.

One hook, `SessionStart`: if `CLAUDE.md` has the block it says nothing, unless
the file is over 250 lines, in which case it prints one line. If the block is
missing it prints the block into context, so the mode is active anyway, and
asks you to run `/lean-and-mean` to make it permanent.

`SUMMARY.md` is history only, newest first, capped at ten entries; the oldest
drops when `/endsession` writes a new one. Lessons worth keeping longer are
already in `## Rules` by then.

Off: delete the block from `CLAUDE.md`, or disable the plugin.

## Boundaries

This governs code shape, spoken terseness, and context files. It does not review
correctness — pair it with `/code-review`. Bloat review of code is `/simplify`.

## License

MIT. See [LICENSE](LICENSE).
