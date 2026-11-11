"""Exercise the compiled hook bridge and installer against temporary state."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
from uuid import uuid4

from importlib import import_module

setup = import_module("setup-hooks")

with tempfile.TemporaryDirectory() as temp:
    directory = Path(temp)
    env = dict(os.environ, CODEX_COMPANION_STATE=temp)
    chat, other = uuid4(), uuid4()

    def send(event, session=chat, **fields):
        payload = dict(hook_event_name=event, session_id=str(session), cwd="/tmp/Project",
                       turn_id="turn", model="test-model", prompt="private text", **fields)
        result = subprocess.run([setup.BINARY, "--hook"], input=json.dumps(payload),
                                text=True, capture_output=True, check=True, env=env)
        assert result.stdout.strip() == "{}" and not result.stderr, result.stderr

    def state(session=chat):
        return json.loads((directory / (str(session).upper() + ".json")).read_text())

    transcript = directory / "transcript.jsonl"
    timestamp = "2026-11-09T12:00:00.000Z"
    tasks = [
        {"step": "Check session panel", "status": "completed"},
        {"step": "Verify live updates", "status": "in_progress"},
        {"step": "Review result", "status": "pending"},
    ]
    events = [
        {"type": "plan_update", "plan": [{"step": "Old plan", "status": "pending"}]},
        {"type": "plan_update", "plan": tasks},
        {"type": "token_count",
         "info": {"last_token_usage": {"total_tokens": 1300}, "model_context_window": 10000},
         "rate_limits": {
             "limit_id": "codex",
             "primary": {"window_minutes": 300, "used_percent": 80},
             "secondary": {"window_minutes": 10080, "used_percent": 23.5, "resets_at": 1794500000},
         }},
    ]
    transcript.write_text("".join(
        json.dumps({"timestamp": timestamp, "payload": payload}) + "\n" for payload in events
    ) + '{"partial":')
    send("UserPromptSubmit", transcript_path=str(transcript))
    assert state()["weekly"]["window"]["used_percent"] == 23.5
    assert state()["context"] == 0.13 and state()["tasks"] == tasks
    assert state()["cwd"] == "/tmp/Project"
    assert state()["transcriptPath"] == str(transcript)
    send("PreModelRequest")
    first = state()
    assert first["requesting"] and "private text" not in json.dumps(first)
    send("PostModelRequest", status="completed",
         token_usage={"input_tokens": 4096, "cached_input_tokens": 2048, "cache_write_input_tokens": 1024})
    complete = state()
    assert complete["lastRequest"] == first["requestStarted"]
    assert complete["cacheWritten"] == 1024
    assert complete["cached"] == 2048 and not complete["requesting"]
    send("PreModelRequest")
    send("PostModelRequest", status="failed")
    assert state()["lastRequest"] == complete["lastRequest"]
    send("PreModelRequest", agent_id="subagent")
    assert not state()["requesting"]
    send("UserPromptSubmit", session=other)
    assert "lastRequest" not in state(other)
    send("Interrupt")
    assert "turn" not in state()
    send("PostCompact")
    assert "lastRequest" not in state() and "cached" not in state()
    assert "cacheWritten" not in state() and "weekly" in state()

    config_path = directory / "hooks.json"
    original = {"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "true"}]}]}}
    config_path.write_text(json.dumps(original))
    setup.configure(config_path, remove=False)
    setup.configure(config_path, remove=False)
    installed = json.loads(config_path.read_text())
    assert len(installed["hooks"]["Stop"]) == 2
    assert all(event in installed["hooks"] for event in setup.EVENTS)
    setup.configure(config_path, remove=True)
    assert json.loads(config_path.read_text()) == original

print("Hook bridge and installer checks passed.")
