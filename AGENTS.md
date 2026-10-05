# lean-and-mean — AGENTS.md

## Operating Mode
Lean and mean. Active every response.

Prose: ~80% ASD-STE100 — one idea per sentence, ≤20 words, active voice,
common words, one term per thing. Lead with the answer; no filler, hedging,
or pleasantries. Full sentences for explanations; fragments fine for status.
Explain in the cheapest form that lands: a sentence; a diagram for a
mechanism, flow, or structure; an HTML page for long or revisited material.
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

Rules below are binding: read them before acting in their area, never
re-litigate. A correction or failed approach this session becomes one new
Rule line. `/endsession` closes the session: Rules, Next, Todo, commit, push, then
ships per `## Done` when the work is complete.
History is `git log`.

## Project & Stack
Claude Code and Codex plugin. Puts a concise-prose + YAGNI operating-mode
block into a project's AGENTS.md (Claude loads it via a `@AGENTS.md` stub
CLAUDE.md) so it runs natively; `/endsession` promotes session mistakes
into Rules, rewrites Next/Todo, commits, pushes (PR if needed), then hard-stops. Full
AGENTS.md review runs at next session start when the hook says it is due.
v5.4.0, published via the spinlockdevelopment/lean-and-mean marketplace.
- POSIX sh (one hook), Markdown skills, JSON manifests, one TSX function-hooks module (Claude only). Python stdlib tests for the hook; `claude plugin test` for the module.

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
`/endsession` left `<!-- lean-and-mean: review -->`, or (Claude) CLAUDE.md
is not the `@AGENTS.md` stub. Skills are
prose the model follows. The session band module is the only code that runs per turn.

| Path | Purpose |
|------|---------|
| `skills/lean-and-mean/operating-mode.md` | The block, source of truth; pasted verbatim into AGENTS.md |
| `skills/lean-and-mean/SKILL.md` | `/lean-and-mean` create-or-review pass, AGENTS.md structure and CLAUDE.md migration, `debt` |
| `skills/endsession/SKILL.md` | `/endsession` light hard-stop wrap-up: Rules, auto-memory promotion, Done check, Next, Todo, review flag, commit, push/PR, then ship per `## Done`; `disable-model-invocation: true` |
| `skills/endsession/agents/openai.yaml` | Codex metadata for `$endsession` |
| `skills/typesafe-ai/` | Copy of TypeSafe AI's skill (MIT, their credit), Jev routed via OpenRouter; disabled (`disable-model-invocation: true`); resync from `vendor/typesafe-ai-skills` submodule |
| `hooks/session-start.sh` | Only hook; silent unless block missing, full pass due, or no `advisorModel` (Claude only) |
| `hooks/register.tsx`, `hooks/judge.ts`, `types/index.d.ts` | Session band mod (Claude only): Haiku-judged checklist with hide toggle, End session button, auto `/endsession auto` (never ships) at 5m cache left; `userConfig.sessionBand` toggles it |
| `extras/statusline.sh` | Optional bash+jq status line (user copies it; plugins can't set `statusLine`): ctx + cache expiry bar from `prompt_cache.expires_at` |
| `tests/session-band.test.ts`, `tests/band-module.test.tsx` | Band parser and auto-end threshold tests; module tests with a stubbed Haiku judge, hide toggle, mocked-clock auto-end, and the `sessionBand: false` toggle (`claude plugin test .`) |
| `tests/test_session_start.py` | Hook tests: both hosts, stub check, advisor note; fake HOME |
| `agents/dashboard-builder.md` | Progress-dashboard subagent; its description carries the trigger rule |
| `agents/explainer.md` | Local explainer-page subagent (`.pages/`, STE prose, inline SVG); same `STYLE?` round trip |
| `hooks/hooks.json` | Wires the hook via `${CLAUDE_PLUGIN_ROOT}` and the band under `modules` |
| `docs/index.html` | GitHub Pages overview; GitHub link in top bar, raw SKILL.md links, inline links into `guide.html` |
| `docs/guide.html` | Pages deep dive: /endsession, hook, cost model, advisor, dashboard-builder, explainer, session band, typesafe-ai, manual install; keep figures in sync with README "Why use it" |
| `docs/style.css` | Shared Pages styles |
| `.claude-plugin/`, `.codex-plugin/` | Claude plugin.json + marketplace.json, Codex plugin.json; versions must match |
| `AGENTS.md`, `CLAUDE.md` | This file, committed; CLAUDE.md is the `@AGENTS.md` stub |

## Conventions
- Version bump in all three manifests together. Breaking behavior → major.
- Hook stays POSIX sh, under 35 lines, zero output in the common case.
- Skill descriptions short: every installed skill's description costs context each turn.
- Commit messages full English, end with `Co-Authored-By: <running model> <noreply@anthropic.com>`, e.g. `Claude Opus 5`.

## Done
- Tests and validate pass; committed and pushed to main (the marketplace serves main). No merge or deploy step.

## Rules
- Push with the `gh` credential command in Commands; plain `git push` uses a stale keychain token (403'd three times). A fine-grained PAT needs resource owner `spinlockdevelopment` plus Contents write, and Pages write to enable Pages via API; reading a public repo proves nothing about push rights. 2026-09-17
- Document plugin skills as `/lean-and-mean:<skill>`. Bare `/endsession` only exists for manual installs. 2026-09-15
- In the hook, match markers as whole lines (`grep -qx`) and wrap `wc -l` as `$(($(wc -l < f)))`. AGENTS.md quotes the review flag inline, so a substring match fired falsely; macOS pads the count with spaces. 2026-09-17
- On Fable, spawn subagents as fresh agents with `model: opus` or `sonnet` (Sonnet 5.5 via the alias, `effort: medium` in agent files; planner's pick), never `fork`: forks inherit Fable and ignore the override. Fable only when the user asks. Fable output costs 2× Opus, 5× Sonnet. 2026-09-17
- Jev is OpenRouter-only: no `OPENROUTER_JEV_API_KEY` means don't use Jev, never fall back to `TYPESAFE_API_KEY` or `api.typesafe.ai`. typesafe-ai stays disabled (out of the Operating Mode block, `disable-model-invocation: true`) until the user asks to check it again. Jev is on OpenRouter at `/api/alpha/decisions`, absent from `/api/v1/models`: check provider docs before calling a model unavailable. 2026-10-01
- Size card grids to divide the card count (4 cards → 2×2), not `auto-fit`. Auto-fit wrapped four cards to 3+1 on the Pages site. 2026-09-17
- Hand the user a `!` command for pushes of third-party routing text and for `git restore` of their changes. Auto mode blocks both for me; retrying wastes turns. 2026-09-28
- `source ~/.zshrc` in the same Bash call after the user adds an env var. The tool's shell env is snapshotted at session start. 2026-09-28
- Plugin agents can't enforce a folder scope: they ignore `hooks` and `permissionMode`, and `tools` takes names only. Scope by instruction plus omitting Bash. 2026-09-28
- Read x.com posts via `curl -s https://api.fxtwitter.com/<user>/status/<id>`. WebFetch on x.com returns 402. 2026-09-30
- Give every context-file layout change a hook test that starts from the previous release's project state. 4.0.0 nearly shipped with the 3.x migration unreachable behind the block-missing exit; only the advisor caught it. 2026-10-01
- In mods, write `atom({ plugin: '<literal>', key: '<literal>' })` inline, the literal being the owning plugin's name; rename it when porting a mod into this plugin. A shared `const P` and a leftover `session-band` owner both failed `claude plugin validate`. In mod tests, register every engine stand-in (`session.start` answering `{ cwd }`, `turn.start`) before the first `$` call, and give `turn.complete` a `usage` when cache time matters; each omission failed a run. 2026-10-03
- Plugins can't set the main `statusLine` (plugin settings honor only `agent`, `subagentStatusLine`); ship status line scripts in `extras/` for the user to copy. It ticks while idle only with `refreshInterval`; cache expiry is `prompt_cache.expires_at` (epoch s). 2026-10-03
- Delete an agent's `~/.claude/agent-memory/<agent>/` after a trial run. The dashboard-builder trial saved an invented style there, which would have skipped `STYLE?` on real use. 2026-10-03
- Default to a minor version bump; major only when the user agrees the change is breaking. 5.0.0 was called too aggressive for an additive release. 2026-10-03

## Next
After 5.4.0 is published, update and restart, then confirm the band shows (if not, try Terminal.app: Warp may hide it), hide tasks folds the list, the End session button runs `/lean-and-mean:endsession`, an idle session auto-runs it at 55m, and the `/config` toggle hides the band. Check the installed status line ticks with `refreshInterval: 60`. Watch the first auto-commit/push `/endsession` run in another repo, including its auto-memory step. Call `@agent-lean-and-mean:explainer` for real: check its trigger, the `STYLE?` round trip (or reuse of dashboard-builder's style), and that the reply is only path + diagrams; then delete its agent memory.

## Todo
- P3 — confirm: append `rate_limits.five_hour.used_percentage` with a timestamp to a log in `extras/statusline.sh`, so plan-limit questions get measured numbers. Only usage-scan candidate worth adding.

## Notes & Pointers
- History: `git log`. SUMMARY.md dropped in v3.
- Subagents load AGENTS.md (checked 2026-10-03), so no SubagentStart hook is needed.
- explainer stand-in trial 2026-10-05 (session band page): good page, facts checked against code; its reply added an off-topic false claim, so the reply is now path + diagrams only.
- dashboard-builder trial 2026-10-03: the `STYLE?` round trip works; it was not delegated unprompted during a 10-step task.
- Usage scan 2026-10-03: logs from 2026-09-03 only, no rate-limit % recorded anywhere. On Max 5x, ≤10 of 39 5h windows and ≤1 week (all Sep 4–9) would have capped; none since Sep 10. Feature scan of 2,672 prompts: nothing else clears the bar.
- graphify: adopt only above ~500 files, AGENTS.md section only, no hook-guard, rebuild from git post-commit not Stop.
