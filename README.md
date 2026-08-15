# lean-and-mean

A Claude Code plugin: terse prose, YAGNI code, and automatic upkeep of your
context files. It is one operating mode, re-asserted every turn by hooks, plus a
skill that owns `CLAUDE.md` and `SUMMARY.md`.

Two axes, one switch:

- **Prose** — drop articles, filler, hedging, pleasantries. Fragments are fine.
  Code, error text, commit messages, PR bodies, security warnings, and anything
  you explicitly asked to be readable stay in full normal English at every level.
- **Code** — a YAGNI ladder. Skip speculative work, reuse what is already in the
  repo, then stdlib, then the native platform feature, then an installed
  dependency, then one line, and only then new code. Never cut input validation
  at trust boundaries, error handling that prevents data loss, security, or
  accessibility.

Plus a memory axis: every correction, failed approach, and footgun from a
session becomes one binding line under `## Rules` in `CLAUDE.md`, so it does not
happen twice.

## Install

```
/plugin marketplace add spinlockdevelopment/lean-and-mean
/plugin install lean-and-mean@lean-and-mean
```

Requires Node.js on `PATH` (the hooks are plain Node scripts, no dependencies).

Manual install, if you would rather not use the plugin system: copy
`skills/lean-and-mean/` into `~/.claude/skills/`, copy `hooks/*.js` into
`~/.claude/hooks/lean-and-mean/`, and add the four entries from
`hooks/hooks.json` to `~/.claude/settings.json`, replacing
`${CLAUDE_PLUGIN_ROOT}/hooks` with `$HOME/.claude/hooks/lean-and-mean`.

## Use

The mode activates itself at level `full` on first session start and stays on
until you turn it off.

| Command | Effect |
|---------|--------|
| `/lean-and-mean lite` | Build as asked, name the lazier alternative in one line, prose near-normal |
| `/lean-and-mean full` | Ladder and terse prose both enforced. Default |
| `/lean-and-mean ultra` | YAGNI-extremist code, maximally compressed prose |
| `/lean-and-mean md review` | Restructure and prune `CLAUDE.md` + `SUMMARY.md`, promote lessons into Rules |
| `/lean-and-mean md init` | Create a `CLAUDE.md` from the template |
| `/lean-and-mean md split` | Force overflow sections out to `claude-<category>.md` |
| `/lean-and-mean rules` | One-shot retro: this session's mistakes become Rules |
| `/lean-and-mean review diff\|repo` | Bloat review — over-engineering only, not correctness |
| `/lean-and-mean debt` | List every `// lean:` shortcut marker with its ceiling and upgrade path |
| `stop lean-and-mean` / `normal mode` | Off. Deletes the flag; every hook goes silent |

## What the hooks do

| Hook | Event | Does |
|------|-------|------|
| `lean-and-mean-activate.js` | SessionStart | Asserts the mode on any project, emits the ruleset and the project's Rules, and prints one maintenance line (usually "nothing due") |
| `lean-and-mean-mode-tracker.js` | UserPromptSubmit | Level switching and a short per-turn reinforcement |
| `lean-and-mean-wrapup.js` | Stop | At most once per session, and only after real edits: asks for the Next / Rules / `SUMMARY.md` wrap-up pass |
| `lean-and-mean-age-summary.js` | SessionEnd | Mechanically ages `SUMMARY.md` by priority TTL and the 10-entry cap. No model involved |

State lives in `~/.claude/.lean-and-mean-active` (the level) and
`~/.claude/.lean-and-mean-state/` (per-session, so the Stop hook nudges once).
Set `CLAUDE_CONFIG_DIR` to relocate both.

`SUMMARY.md` aging never deletes a P1 or P2 entry. Past its TTL it is flagged
` · AGED` and survives until the next `md review` either promotes its lesson
into `## Rules` or drops it, so a hard-won rule cannot vanish on a timer.

## Test

```
node hooks/lean-and-mean-age-summary.js --selftest
```

## Boundaries

This governs code shape, spoken terseness, and context files. It does not review
correctness — pair it with `/code-review` for that.

## License

MIT. See [LICENSE](LICENSE).
