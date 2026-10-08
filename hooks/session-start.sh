#!/bin/sh
# lean-and-mean — SessionStart hook. Silent in the common case. Block missing
# from AGENTS.md: print it plus a nudge. Block stale, over the 250-line cap,
# review flag set by /endsession, or (Claude) CLAUDE.md not the `@AGENTS.md`
# stub: tell the model to run the full pass on this fresh context.
# Codex sets PLUGIN_ROOT and runs hooks in the session working directory.
if [ -n "${PLUGIN_ROOT:-}" ]; then
  project=$(git rev-parse --show-toplevel 2>/dev/null) || project=$PWD
  invoke='$lean-and-mean'
else
  project=${CLAUDE_PROJECT_DIR:-.}
  invoke=/lean-and-mean
fi
md="$project/AGENTS.md"
block="$(dirname "$0")/../skills/lean-and-mean/operating-mode.md"
if ! grep -qx '## Operating Mode' "$md" 2>/dev/null; then
  # 3.x Claude project: block lives in CLAUDE.md and already loads; migrate it.
  [ -z "${PLUGIN_ROOT:-}" ] && grep -qx '## Operating Mode' "$project/CLAUDE.md" 2>/dev/null &&
    printf 'lean-and-mean: %s needs the full pass — CLAUDE.md holds the block, not the @AGENTS.md stub; Run the lean-and-mean skill (%s) before the user task, then re-read AGENTS.md: it replaces the copy loaded at session start. Then continue with the task.\n' "$md" "$invoke" && exit 0
  cat "$block"; echo
  printf 'Not in %s yet — run %s to write it there. This notice stops once it is.\n' "$md" "$invoke"
  exit 0
fi
why=""
[ "$(awk '/^## /{p=($0=="## Operating Mode")} p' "$md")" = "$(cat "$block")" ] || why="$why Operating Mode block is out of date;"
n=$(($(wc -l < "$md"))); [ "$n" -gt 250 ] && why="$why $n lines, over the 250 cap;"
grep -qxF '<!-- lean-and-mean: review -->' "$md" && why="$why /endsession flagged a review;"
[ -n "${PLUGIN_ROOT:-}" ] || [ "$(cat "$project/CLAUDE.md" 2>/dev/null)" = '@AGENTS.md' ] || why="$why CLAUDE.md is not the @AGENTS.md stub;"
[ -n "$why" ] && printf 'lean-and-mean: %s needs the full pass —%s Run the lean-and-mean skill (%s) before the user task, then re-read AGENTS.md: it replaces the copy loaded at session start. Then continue with the task.\n' "$md" "$why" "$invoke"
# Claude only: suggest the extras status line until ~/.claude/statusline.sh has its version line.
sl="$(cd "$(dirname "$0")/.." && pwd)/extras/statusline.sh"
[ -n "${PLUGIN_ROOT:-}" ] || [ ! -f "$sl" ] || grep -qxF "$(sed -n 2p "$sl")" "$HOME/.claude/statusline.sh" 2>/dev/null ||
  printf 'lean-and-mean: ~/.claude/statusline.sh is missing or not the current extras version. Tell the user once, in one line, to run /lean-and-mean:statusline.\n'
exit 0
