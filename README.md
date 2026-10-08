# lean-and-mean

**Overview → [spinlockdevelopment.github.io/lean-and-mean](https://spinlockdevelopment.github.io/lean-and-mean/) · [in-depth guide](https://spinlockdevelopment.github.io/lean-and-mean/guide.html)**

A Claude Code and Codex plugin. It writes concise prose and YAGNI code rules
into your project's `AGENTS.md` once, so they apply every session with no
plugin code in the loop. `/endsession` closes a session: it writes what was
learned back into that file, commits, pushes, then stops.

- **Prose.** Answer first. Concise, active sentences in plain technical
  English, broadly following ASD-STE100. No filler or repetition. A diagram or
  an HTML page when that explains it better.
- **Code.** A YAGNI ladder: skip speculative work, then reuse the repo, stdlib,
  the platform, an installed dependency, one line, and only then new code.
  Never cut input validation, data-loss handling, security, or accessibility.
- **Memory.** Each correction becomes one binding line under `## Rules`, so it
  does not happen twice.

## Why use it

Faster, fewer tokens, lower cost: short answers, less code to review, and
short sessions that keep each request's context small. The measured numbers:
[why sessions should be short](https://spinlockdevelopment.github.io/lean-and-mean/guide.html#cost).

## Install

**Claude Code** (or `/plugin marketplace add …` and `/plugin install …` in the app):

```sh
claude plugin marketplace add spinlockdevelopment/lean-and-mean
claude plugin install lean-and-mean@lean-and-mean
```

Restart Claude Code, then run `/lean-and-mean:lean-and-mean` once per project.

**Codex:**

```sh
codex plugin marketplace add spinlockdevelopment/lean-and-mean
codex plugin add lean-and-mean@lean-and-mean
```

Start a new session at the project root, trust the SessionStart hook when
prompted, and run `$lean-and-mean` once.

Local checkouts, manual installs, and Codex notes:
[install details](https://spinlockdevelopment.github.io/lean-and-mean/guide.html#manual).

## Use

| Claude Code | Codex | Effect |
|-------------|-------|--------|
| `/lean-and-mean:lean-and-mean` | `$lean-and-mean` | Create or review `AGENTS.md`: refresh the block, reorder, verify commands and paths, prune, split past 250 lines. Usually runs on its own |
| `/lean-and-mean:lean-and-mean debt` | `$lean-and-mean debt` | List every `// lean:` shortcut with its upgrade path |
| `/lean-and-mean:endsession` | `$endsession` | Save Rules and Next, commit, push, and run `## Done` steps when the work is complete. Then stop. [Details](https://spinlockdevelopment.github.io/lean-and-mean/guide.html#endsession) |
| Session Status Mod | — | Colored cache countdown on top, task checklist, End session button, auto `/endsession` with 5 minutes of cache left, a Rehydrate / Clear first question when the cache has gone cold. Off in `/config`. [Details](https://spinlockdevelopment.github.io/lean-and-mean/guide.html#band) |
| `@agent-lean-and-mean:explainer` | — | Explainer Agent: local `.pages/<slug>.html` explainer page with inline SVG diagrams |

A manual install into `~/.claude/skills/` gives the bare `/lean-and-mean` and
`/endsession`.

Extras (`/lean-and-mean:statusline`, `/lean-and-mean:typesafe-ai`): [extras](https://spinlockdevelopment.github.io/lean-and-mean/extras.html).

## How it works

Claude Code loads `AGENTS.md` through a one-line `CLAUDE.md` stub
(`@AGENTS.md`); Codex loads it directly. Once the `## Operating Mode` block is
in it, the mode is on. One SessionStart hook stays silent unless the block is
missing or a review is due. [Hook details](https://spinlockdevelopment.github.io/lean-and-mean/guide.html#hook).

Off: disable the plugin **and** delete the Operating Mode block. Disabling
alone leaves the rules active.

It governs code shape, prose, and context files, not correctness. Pair it with
`/code-review`; `/simplify` reviews code bloat.

## Development

```sh
python3 -m unittest discover -s tests -v
claude plugin validate .claude-plugin/plugin.json && claude plugin test .
```

The Codex skill validators reject Claude's `argument-hint` and
`disable-model-invocation` frontmatter. That is a known exception: the fields
stay for Claude, and Codex's explicit-only policy is in
`skills/endsession/agents/openai.yaml`.

## License

MIT. See [LICENSE](LICENSE).

`skills/typesafe-ai/` is copied from
[typesafe-ai/skills](https://github.com/typesafe-ai/skills), tracked as the
`vendor/typesafe-ai-skills` submodule. Copyright and credit belong to
TypeSafe AI (MIT, Copyright (c) 2026 TypeSafe AI; see
[skills/typesafe-ai/LICENSE](skills/typesafe-ai/LICENSE)). The only change is
routing Jev calls through OpenRouter.
