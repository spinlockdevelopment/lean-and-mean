#!/bin/sh
# lean-and-mean — SessionStart hook. Silent in the common case. Block missing:
# print it plus a nudge. Block stale, over the 250-line cap, or review flag set
# by /endsession: tell the model to run the full pass on this fresh context.
md="${CLAUDE_PROJECT_DIR:-.}/CLAUDE.md"
block="$(dirname "$0")/../skills/lean-and-mean/operating-mode.md"
if ! grep -qx '## Operating Mode' "$md" 2>/dev/null; then
  cat "$block"; echo
  echo "Not in CLAUDE.md yet — run /lean-and-mean to write it there. This notice stops once it is."
  exit 0
fi
why=""
[ "$(awk '/^## /{p=($0=="## Operating Mode")} p' "$md")" = "$(cat "$block")" ] || why="$why Operating Mode block is out of date;"
n=$(($(wc -l < "$md"))); [ "$n" -gt 250 ] && why="$why $n lines, over the 250 cap;"
grep -qxF '<!-- lean-and-mean: review -->' "$md" && why="$why /endsession flagged a review;"
[ -n "$why" ] && echo "lean-and-mean: CLAUDE.md needs the full pass —$why Run the lean-and-mean skill's /lean-and-mean pass before the user's first task, then continue with it."
exit 0
