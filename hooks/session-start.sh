#!/bin/sh
# lean-and-mean — SessionStart hook. Silent when CLAUDE.md already carries the
# Operating Mode block; otherwise prints the block into context plus a nudge
# to write it into CLAUDE.md. One extra line if CLAUDE.md is over the cap.
md="${CLAUDE_PROJECT_DIR:-.}/CLAUDE.md"
block="$(dirname "$0")/../skills/lean-and-mean/operating-mode.md"

if grep -qF 'Lean and mean. Active every response.' "$md" 2>/dev/null; then
  n=$(($(wc -l < "$md")))
  [ "$n" -gt 250 ] && echo "CLAUDE.md is $n lines, over the 250 cap — run /lean-and-mean to split it."
  exit 0
fi

cat "$block"
echo
echo "Not in CLAUDE.md yet — run /lean-and-mean to write it there. This notice stops once it is."
