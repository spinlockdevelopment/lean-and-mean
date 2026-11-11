#!/usr/bin/env python3
"""Add or remove this companion's Codex command hooks."""

import argparse
import json
import os
from pathlib import Path
import shlex
import tempfile

EVENTS = (
    "UserPromptSubmit", "PreModelRequest", "PostModelRequest", "Stop",
    "Interrupt", "PostCompact", "SessionEnd",
)
BINARY = Path(__file__).resolve().parent / ".build/Codex Companion.app/Contents/MacOS/CodexCompanion"


def configure(path, remove):
    if not remove and not BINARY.is_file():
        raise SystemExit("Run build.sh first.")

    config = json.loads(path.read_text()) if path.exists() else {}
    original = json.dumps(config)
    hooks = config.setdefault("hooks", {})
    command = shlex.quote(str(BINARY)) + " --hook"
    handler = {"type": "command", "command": command, "timeout": 2}
    group = {"hooks": [handler]}

    for event in EVENTS:
        groups = hooks.get(event, [])
        if remove:
            remaining = [entry for entry in groups if entry != group]
            if remaining:
                hooks[event] = remaining
            elif event in hooks and groups:
                del hooks[event]
        elif group not in groups:
            hooks[event] = [*groups, group]

    if remove and not hooks and "hooks" not in json.loads(original):
        del config["hooks"]
    if json.dumps(config) == original:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as output:
        temporary = Path(output.name)
        try:
            json.dump(config, output, indent=2)
            output.write("\n")
            output.close()
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--remove", action="store_true")
    args = parser.parse_args()
    home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex")
    configure((home / "hooks.json").resolve(), args.remove)
