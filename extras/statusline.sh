#!/usr/bin/env bash
# lean-and-mean statusline 3
# Status line: dir | branch | (model) | ctx % | 5h usage | 7d usage (each when the plan reports it). Needs jq. Install:
#   cp statusline.sh ~/.claude/statusline.sh && chmod +x ~/.claude/statusline.sh
#   ~/.claude/settings.json: "statusLine": {"type": "command", "command": "~/.claude/statusline.sh"}
input=$(cat)

# Colors (real ESC bytes, not literal backslashes, so plain %s printf works)
CYAN_BOLD=$'\033[1;96m'; MAGENTA=$'\033[95m'; DIM=$'\033[2m'; RESET=$'\033[0m'
GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'

# Threshold color for a percentage: <50 green, 50-79 yellow, >=80 red
pct_color() {
  local p; p=$(printf '%.0f' "$1")
  if [ "$p" -ge 80 ]; then printf '%s' "$RED"
  elif [ "$p" -ge 50 ]; then printf '%s' "$YELLOW"
  else printf '%s' "$GREEN"
  fi
}

root_dir=$(echo "$input" | jq -r '.workspace.project_dir // .cwd // empty')
dir=$(basename "$root_dir" 2>/dev/null)
model_raw=$(echo "$input" | jq -r '.model.display_name // empty')
dir_seg=""
[ -n "$dir" ] && dir_seg="${CYAN_BOLD}${dir}${RESET}"

# Git branch, no locks; fall back to short SHA on detached HEAD; omit outside a repo
branch=""
if [ -n "$root_dir" ]; then
  branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$root_dir" symbolic-ref --short HEAD 2>/dev/null)
  [ -z "$branch" ] && branch=$(GIT_OPTIONAL_LOCKS=0 git -C "$root_dir" rev-parse --short HEAD 2>/dev/null)
fi
branch_seg=""
[ -n "$branch" ] && branch_seg="${MAGENTA}${branch}${RESET}"

# Strip a trailing [1M] or (1M) tag, case-insensitive, then trim
model=$(echo "$model_raw" | sed -E 's/[[:space:]]*[[(]1[Mm][])][[:space:]]*$//')
model_seg=""
[ -n "$model" ] && model_seg="${DIM}(${model})${RESET}"

ctx_seg=""
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
if [ -n "$used" ]; then
  ctx_seg="ctx $(pct_color "$used")$(printf '%.0f' "$used")%${RESET}"
fi

# One rate-limit window: "5h 18% · resets in 2h10m"; empty when the plan does not report it.
limit_seg() {
  local pct reset diff d h m left seg
  pct=$(echo "$input" | jq -r ".rate_limits.$2.used_percentage // empty")
  [ -z "$pct" ] && return
  seg="$1 $(pct_color "$pct")$(printf '%.0f' "$pct")%${RESET}"
  reset=$(echo "$input" | jq -r ".rate_limits.$2.resets_at // empty")
  if [ -n "$reset" ]; then
    diff=$(( reset - $(date +%s) ))
    [ "$diff" -lt 0 ] && diff=0
    d=$(( diff / 86400 )); h=$(( (diff % 86400) / 3600 )); m=$(( (diff % 3600) / 60 ))
    left="${h}h${m}m"
    [ "$d" -gt 0 ] && left="${d}d${h}h"
    seg="${seg} ${DIM}· resets in ${left}${RESET}"
  fi
  printf '%s' "$seg"
}
five_seg=$(limit_seg 5h five_hour)
week_seg=$(limit_seg 7d seven_day)

# Build result string with dim " | " separators, only for non-empty parts
parts=()
[ -n "$dir_seg" ]    && parts+=("$dir_seg")
[ -n "$branch_seg" ] && parts+=("$branch_seg")
[ -n "$model_seg" ]  && parts+=("$model_seg")
[ -n "$ctx_seg" ]    && parts+=("$ctx_seg")
[ -n "$five_seg" ]   && parts+=("$five_seg")
[ -n "$week_seg" ]   && parts+=("$week_seg")

result=""
for part in "${parts[@]}"; do
  if [ -z "$result" ]; then
    result="$part"
  else
    result="${result} ${DIM}|${RESET} ${part}"
  fi
done

printf '%s' "$result"
