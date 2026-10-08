---
name: statusline
description: Install the lean-and-mean status line into ~/.claude. User-invoked only.
disable-model-invocation: true
license: MIT
---

# Status line

Claude Code only. Plugins cannot set `statusLine`, so this copies it in.

1. `command -v jq` fails → tell the user the script needs `jq` and stop.
2. Copy `../../extras/statusline.sh` (relative to this skill's base
   directory) to `~/.claude/statusline.sh`; `chmod +x` it.
3. In `~/.claude/settings.json` (create `{}` if absent), set
   `"statusLine": {"type": "command", "command": "~/.claude/statusline.sh"}`.
   Keep every other key. A different `statusLine` already set → ask before
   replacing it.
4. Report one line: installed, shows on the next prompt.
