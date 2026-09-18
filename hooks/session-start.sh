#!/bin/sh
# lean-and-mean — SessionStart hook. Silent in the common case. Block missing:
# print it plus a nudge. Block stale, over the 250-line cap, or review flag set
# by /endsession: tell the model to run the full pass on this fresh context.
# Codex sets PLUGIN_ROOT (and the Claude compatibility alias); Claude only
# sets CLAUDE_PLUGIN_ROOT. Codex runs hooks in the session working directory.
if [ -n "${PLUGIN_ROOT:-}" ]; then
  project=$(git rev-parse --show-toplevel 2>/dev/null) || project=$PWD
  file=AGENTS.md
  # Codex gives a nonempty override precedence over AGENTS.md at this level.
  [ ! -s "$project/AGENTS.override.md" ] || file=AGENTS.override.md
  invoke='$lean-and-mean'
else
  project=${CLAUDE_PROJECT_DIR:-.}
  file=CLAUDE.md
  invoke=/lean-and-mean
fi
md="$project/$file"
block="$(dirname "$0")/../skills/lean-and-mean/operating-mode.md"
if ! grep -qx '## Operating Mode' "$md" 2>/dev/null; then
  cat "$block"; echo
  printf 'Not in %s yet — run %s to write it there. This notice stops once it is.\n' "$md" "$invoke"
  exit 0
fi
why=""
[ "$(awk '/^## /{p=($0=="## Operating Mode")} p' "$md")" = "$(cat "$block")" ] || why="$why Operating Mode block is out of date;"
n=$(($(wc -l < "$md"))); [ "$n" -gt 250 ] && why="$why $n lines, over the 250 cap;"
grep -qxF '<!-- lean-and-mean: review -->' "$md" && why="$why /endsession flagged a review;"
[ -n "$why" ] && printf 'lean-and-mean: %s needs the full pass —%s Run the lean-and-mean skill (%s) before the user task, then continue with it.\n' "$md" "$why" "$invoke"
exit 0
