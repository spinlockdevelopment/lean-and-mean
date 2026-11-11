# Codex Companion

A macOS menu bar app and floating Session Status panel for existing Codex chats.
It shows the latest observed chat by default. Pick a chat from the menu to keep
watching it while other chats run. The panel follows Codex’s Light, Dark, or
System appearance setting.

## Run

Clone the repository and build with Xcode Command Line Tools and Python 3.
If you already have a checkout, start in its `extras/codex-companion` directory.

```sh
git clone https://github.com/spinlockdevelopment/lean-and-mean.git
cd lean-and-mean/extras/codex-companion
sh build.sh
python3 setup-hooks.py
open ".build/Codex Companion.app"
```

In the desktop app, open **Settings → Hooks** and trust the entries whose
command points to this build. The Codex CLI exposes the same review under
`/hooks`. Restart Codex or
start a new chat if the current chat does not pick up the configuration. Send
a prompt, then choose **Show floating panel** from the **Codex** menu bar item.

The hook setup uses `$CODEX_HOME/hooks.json` when set and
`~/.codex/hooks.json` otherwise. It preserves existing hook groups. Run
`python3 setup-hooks.py --remove` before moving or removing this checkout.
Quitting the app leaves the hooks recording activity for when you reopen it.

## Reading the Session panel

- The header shows the root folder name with the Git branch and worktree on the
  second line when available.
- **Context** shows the latest reported token count as a share of the model's
  context window. **BUSY** appears while a model request is in flight.
- **Cache idle** measures time since the start of the last successful request.
  The estimate window defaults to 30 minutes and can be set to 10 or 60 minutes
  from the menu. It is a display threshold. Actual reuse depends on the model,
  prefix, and routing. Compaction clears the prior observation.
- **Weekly limit** shows the latest reported seven-day Codex usage percentage
  and reset time from local transcript usage metadata.
- **Cache size** shows the input tokens the selected chat reused on its last
  successful request. The panel also shows cache writes when Codex reports them.
  A later request can reuse a different prefix.

**Tasks** shows completed, in-progress, and pending steps from the latest
structured plan Codex records for the chat. **Next** lists each entry in the
project's `## Next` section in `AGENTS.md`. Hover over a truncated row to read
the full entry.
**End Session** queues `$endsession` for the displayed Codex chat using the
local Codex CLI.

The bridge stores the latest observation for each chat in
`~/Library/Application Support/Codex Companion/Activity`. The panel lists
activity observed in the last day. Stored data includes a chat ID, project
folder name, model, turn state, timestamps, available input token counts, and weekly usage metadata.
The bridge does not save prompt text or responses.

Run `python3 check.py` after building to exercise the bridge and hook setup in
temporary directories.
