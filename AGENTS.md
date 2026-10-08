# lean-and-mean — AGENTS.md

## Operating Mode
Lean and mean. Active every response.

Prose: Answer first. Use concise, active sentences and plain technical
English, broadly following ASD-STE100. Avoid filler, repetition, and
unnecessary explanation. Full sentences for explanations; fragments fine
for status. Explain in the cheapest form that lands: a sentence; a diagram
for a mechanism, flow, or structure; an HTML page for long or revisited
material. Never state the audience, level, or style; write that way.

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

Rules below are binding: read them before acting in their area, never
re-litigate. A correction or failed approach this session becomes one new
Rule line. `/endsession` closes the session: Rules, Next, commit, push, then
ships per `## Done` when the work is complete.
History is `git log`.

## Project & Stack
Claude Code and Codex plugin. Puts a concise-prose + YAGNI operating-mode
block into a project's AGENTS.md (Claude loads it via a `@AGENTS.md` stub
CLAUDE.md) so it runs natively; `/endsession` promotes session mistakes
into Rules, rewrites Next, commits, pushes (PR if needed), then hard-stops. Full
AGENTS.md review runs at next session start when the hook says it is due.
v5.7.0, published via the spinlockdevelopment/lean-and-mean marketplace.
- POSIX sh (one hook), Markdown skills, JSON manifests, one TSX function-hooks module (Claude only). Python stdlib tests for the hook; `claude plugin test` for the module.
- Version bump in all three manifests together. Breaking behavior → major.
- Hook stays POSIX sh, under 35 lines, zero output in the common case.
- Any change to `extras/statusline.sh` bumps its line-2 breadcrumb (`# lean-and-mean statusline <n>`); the hook compares that line with `~/.claude/statusline.sh`.
- Skill descriptions short: every installed skill's description costs context each turn.
- Commit messages full English, end with `Co-Authored-By: <running model> <noreply@anthropic.com>`, e.g. `Claude Opus 5`.

## Commands
sh -n hooks/session-start.sh
claude plugin validate .claude-plugin/plugin.json && claude plugin test .
python3 -m unittest discover tests
CLAUDE_PROJECT_DIR=/path/to/project sh hooks/session-start.sh
node -e 'for (const f of ["hooks/hooks.json",".claude-plugin/plugin.json",".claude-plugin/marketplace.json",".codex-plugin/plugin.json"]) JSON.parse(require("fs").readFileSync(f))'
git -c credential.helper= -c credential.helper='!gh auth git-credential' push

## Architecture & Layout
SessionStart hook prints the block when AGENTS.md lacks it, or asks for the
full pass when the block is stale, AGENTS.md is over 250 lines,
`/endsession` left the review flag, or (Claude) CLAUDE.md
is not the `@AGENTS.md` stub. Claude only: it suggests installing the extras
status line when `~/.claude/statusline.sh` lacks the current breadcrumb. Skills are
prose the model follows. The session band module is the only code that runs per turn.

| Path | Purpose |
|------|---------|
| `skills/lean-and-mean/operating-mode.md` | The block, source of truth; pasted verbatim into AGENTS.md |
| `skills/lean-and-mean/SKILL.md` | `/lean-and-mean` create-or-review pass, AGENTS.md structure and CLAUDE.md migration, `debt` |
| `skills/endsession/SKILL.md` | `/endsession` light hard-stop wrap-up: Rules, auto-memory promotion, Done check, Next, review flag, commit, push/PR, then ship per `## Done`; `disable-model-invocation: true` |
| `skills/endsession/agents/openai.yaml` | Codex metadata for `$endsession` |
| `skills/typesafe-ai/` | Copy of TypeSafe AI's skill (MIT, their credit), Jev routed via OpenRouter; disabled (`disable-model-invocation: true`); an extra, documented only in `docs/extras.html`; resync from `vendor/typesafe-ai-skills` submodule |
| `hooks/session-start.sh` | Only hook; silent unless block missing, full pass due, or status line not current (Claude only) |
| `hooks/register.tsx`, `hooks/judge.ts`, `types/index.d.ts` | Session band mod (Claude only): cache countdown on top on every surface (green >30m, yellow >15m, orange >10m, red), Haiku-judged checklist with hide toggle, End session button, auto `/endsession auto` (never ships) at 5m cache left; cold-cache question on the next prompt (Rehydrate / Clear first); `userConfig.sessionBand` toggles it |
| `extras/statusline.sh` | Optional bash+jq status line for a new machine (user copies it; plugins can't set `statusLine`); no cache countdown, the band has it |
| `tests/session-band.test.ts`, `tests/band-module.test.tsx` | Band parser, countdown color and auto-end threshold tests; module tests with a stubbed Haiku judge, hide toggle, mocked-clock auto-end and countdown, and the `sessionBand: false` toggle (`claude plugin test .`) |
| `tests/test_session_start.py` | Hook tests: both hosts, stub check, 3.x and 5.6 layouts, status line note; fake HOME |
| `agents/explainer.md` | Local explainer-page subagent (`.pages/`, STE prose, inline SVG); `STYLE?` round trip |
| `hooks/hooks.json` | Wires the hook via `${CLAUDE_PLUGIN_ROOT}` and the band under `modules` |
| `docs/index.html` | GitHub Pages overview; GitHub link in top bar, raw SKILL.md links, inline links into `guide.html` |
| `docs/guide.html` | Pages deep dive: /endsession, hook, cost model, session band, explainer, install details; keep figures in sync with README "Why use it" headlines and `docs/index.html` stats |
| `docs/extras.html` | Pages extras: status line setup, typesafe-ai; README and index link it in one line |
| `docs/style.css` | Shared Pages styles |
| `.claude-plugin/`, `.codex-plugin/` | Claude plugin.json + marketplace.json, Codex plugin.json; versions must match |
| `AGENTS.md`, `CLAUDE.md` | This file, committed; CLAUDE.md is the `@AGENTS.md` stub |

## Done
- Tests and validate pass; committed and pushed to main (the marketplace serves main). No merge or deploy step.

## Rules
- Push with the `gh` credential command in Commands; plain `git push` uses a stale keychain token (403'd three times). A fine-grained PAT needs resource owner `spinlockdevelopment` plus Contents write, and Pages write to enable Pages via API; reading a public repo proves nothing about push rights. 2026-09-17
- Document plugin skills as `/lean-and-mean:<skill>`. Bare `/endsession` only exists for manual installs. 2026-09-15
- In the hook, match markers as whole lines (`grep -qx`) and wrap `wc -l` as `$(($(wc -l < f)))`. AGENTS.md quotes the review flag inline, so a substring match fired falsely; macOS pads the count with spaces. 2026-09-17
- On Fable, spawn subagents as fresh agents with `model: opus` or `sonnet` (Sonnet 5.5 via the alias, `effort: medium` in agent files; planner's pick), never `fork`: forks inherit Fable and ignore the override. Fable only when the user asks. Fable output costs 2× Opus, 5× Sonnet. 2026-09-17
- Jev is OpenRouter-only: no `OPENROUTER_JEV_API_KEY` means don't use Jev, never fall back to `TYPESAFE_API_KEY` or `api.typesafe.ai`. typesafe-ai stays disabled (out of the Operating Mode block, `disable-model-invocation: true`) until the user asks to check it again. Jev is on OpenRouter at `/api/alpha/decisions`, absent from `/api/v1/models`: check provider docs before calling a model unavailable. 2026-10-01
- Size card grids to divide the card count (4 cards → 2×2), not `auto-fit`. Auto-fit wrapped four cards to 3+1 on the Pages site. 2026-09-17
- Shell limits: hand the user a `!` command for pushes of third-party routing text and for `git restore` of their changes (auto mode blocks both; retrying wastes turns); `source ~/.zshrc` in the same Bash call after they add an env var (the tool env is snapshotted at session start). 2026-09-28. The Bash tool is zsh: never start a word with `=` (`echo ====` died as a `=cmd` expansion 2026-10-06).
- In this repo, a stale-block notice from the hook means the installed plugin is older than the repo: report the pass as a no-op, never paste the installed block back. 5.2.0 installed vs 5.3.0 repo fired it 2026-10-05.
- Plugin agents can't enforce a folder scope: they ignore `hooks` and `permissionMode`, and `tools` takes names only. Scope by instruction plus omitting Bash. 2026-09-28
- Read x.com posts via `curl -s https://api.fxtwitter.com/<user>/status/<id>`. WebFetch on x.com returns 402. 2026-09-30
- Give every context-file layout change a hook test that starts from the previous release's project state. 4.0.0 nearly shipped with the 3.x migration unreachable behind the block-missing exit; only the advisor caught it. 2026-10-01
- In mods, write `atom({ plugin: '<literal>', key: '<literal>' })` inline, the literal being the owning plugin's name; rename it when porting a mod into this plugin. A shared `const P` and a leftover `session-band` owner both failed `claude plugin validate`. In mod tests, register every engine stand-in (`session.start` answering `{ cwd }`, `turn.start`) before the first `$` call, and give `turn.complete` a `usage` when cache time matters; each omission failed a run. 2026-10-03. `ui.render` is pure: an `update` there gets the hook skipped (blanked the band 2026-10-06); decide per-surface facts from `$.session.surfaces()` in a timer or `session.start`, stub it in tests, and read `e.surface` only to branch the tree. A `$.clock.now()` with no `mock.clock` stand-in skips the whole hook, so read cheap state first and call the clock only when needed; the 55m auto-end fires in any test that advances past it; `tool.call` args are flat on `e` (`e.questions`), not `e.input`; `ui.find` does not match a Text's `key`, so query Text by `text`. Each cost a failed run 2026-10-07. Call models by alias (`model: 'haiku'`), never a pinned id: the user reverted `claude-haiku-5-5` 2026-10-07.
- Plugins can't set the main `statusLine` (plugin settings honor only `agent`, `subagentStatusLine`); ship status line scripts in `extras/` for the user to copy. It ticks while idle only with `refreshInterval`; cache expiry is `prompt_cache.expires_at` (epoch s). 2026-10-03
- Delete an agent's `~/.claude/agent-memory/<agent>/` after a trial run. An agent trial saved an invented style there, which would have skipped `STYLE?` on real use. 2026-10-03
- Default to a minor version bump; major only when the user agrees the change is breaking. 5.0.0 was called too aggressive for an additive release. 2026-10-03

## Next
After 5.7.0 is published, update and restart. Confirm the band's countdown sits on top in the terminal and desktop, ticks while idle, turns yellow / orange / red at 30 / 15 / 10m left, and stays when tasks are hidden; End session runs `/lean-and-mean:endsession`; auto-end fires at 55m; a cold-cache prompt asks Rehydrate / Clear first; the `/config` toggle hides the band; the hook suggests the status line on a machine without it. Call `@agent-lean-and-mean:explainer` for real (trigger, `STYLE?`, path + diagrams reply), then delete its agent memory.
- P2 — compress Rules with the user, carefully (the mods rule is ~10 lines); no merges without asking.
- P3 — confirm: append `rate_limits.five_hour.used_percentage` with a timestamp to a log in `extras/statusline.sh`, so plan-limit questions get measured numbers. Only usage-scan candidate worth adding.

## Notes & Pointers
- History: `git log`.
- Subagents load AGENTS.md (checked 2026-10-03), so no SubagentStart hook is needed.
- explainer stand-in trial 2026-10-05 (session band page): good page, facts checked against code; its reply added an off-topic false claim, so the reply is now path + diagrams only.
- Usage scan 2026-10-03: logs from 2026-09-03 only, no rate-limit % recorded anywhere. On Max 5x, ≤10 of 39 5h windows and ≤1 week (all Sep 4–9) would have capped; none since Sep 10. Feature scan of 2,672 prompts: nothing else clears the bar.
- graphify: adopt only above ~500 files, AGENTS.md section only, no hook-guard, rebuild from git post-commit not Stop.
<!-- lean-and-mean: review -->
