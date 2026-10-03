#!/usr/bin/env bash
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
five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

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

# Prompt-cache expiry: "exp. [██████░░░░] 22m". Needs refreshInterval to tick while idle.
expires=$(echo "$input" | jq -r '.prompt_cache.expires_at // empty')
ttl=$(echo "$input" | jq -r '.prompt_cache.ttl // "1h"')
if [ -n "$ctx_seg" ] && [ -n "$expires" ]; then
  [ "$ttl" = "5m" ] && ttl_s=300 || ttl_s=3600
  left=$(( expires - $(date +%s) ))
  [ "$left" -lt 0 ] && left=0
  [ "$left" -gt "$ttl_s" ] && left=$ttl_s
  cells=$(( (left * 10 + ttl_s - 1) / ttl_s ))
  bar=""; i=0
  while [ "$i" -lt 10 ]; do
    [ "$i" -lt "$cells" ] && bar="${bar}█" || bar="${bar}░"
    i=$((i + 1))
  done
  if [ "$left" -eq 0 ]; then when="cold"; else when="$(( (left + 59) / 60 ))m"; fi
  exp_color="$DIM"; [ "$left" -le 600 ] && exp_color="$YELLOW"
  ctx_seg="${ctx_seg} ${exp_color}exp. [${bar}] ${when}${RESET}"
fi

usage_seg=""
if [ -n "$five_pct" ]; then
  usage_seg="5h $(pct_color "$five_pct")$(printf '%.0f' "$five_pct")%${RESET}"
  if [ -n "$five_reset" ]; then
    now=$(date +%s)
    diff=$(( five_reset - now ))
    [ "$diff" -lt 0 ] && diff=0
    h=$(( diff / 3600 ))
    m=$(( (diff % 3600) / 60 ))
    usage_seg="${usage_seg} ${DIM}· resets in ${h}h${m}m${RESET}"
  fi
fi

# Build result string with dim " | " separators, only for non-empty parts
parts=()
[ -n "$dir_seg" ]    && parts+=("$dir_seg")
[ -n "$branch_seg" ] && parts+=("$branch_seg")
[ -n "$model_seg" ]  && parts+=("$model_seg")
[ -n "$ctx_seg" ]    && parts+=("$ctx_seg")
[ -n "$usage_seg" ]  && parts+=("$usage_seg")

result=""
for part in "${parts[@]}"; do
  if [ -z "$result" ]; then
    result="$part"
  else
    result="${result} ${DIM}|${RESET} ${part}"
  fi
done

printf '%s' "$result"
