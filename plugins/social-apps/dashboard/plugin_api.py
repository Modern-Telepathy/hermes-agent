"""Social apps backend, mounted at ``/api/plugins/social-apps/``.

Hangout and Meet speak the OpenHands *Agent Server* API through
``host.agentServer.request({path, method, body})``. The dashboard has no Agent Server, so the
browser shim answers the read calls from the dashboard's own REST API and this module answers the
two that need a process: sending a message (a real Hermes turn) and starting a bash command
(Meet's meeting server).

Sending runs ``hermes --resume <session> -z <text>`` — the documented one-shot path — so the reply is
a genuine agent turn in that same session, not a chat UI imitation. It is synchronous and bounded:
the app's own "sending" state covers the wait.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# A real turn includes model latency plus tools; the app shows its sending state meanwhile.
TURN_TIMEOUT_SECONDS = 240


class SendBody(BaseModel):
    session_id: str = Field(min_length=1)
    text: str = Field(min_length=1)


class BashBody(BaseModel):
    command: str = Field(min_length=1)
    cwd: Optional[str] = None


def _cli_argv(*args: str) -> list[str]:
    """The Hermes CLI, preferring the installed console script over the module entry point."""
    executable = shutil.which("hermes")
    if executable:
        return [executable, *args]
    return [sys.executable, "-m", "hermes_cli.main", *args]



@router.post("/send")
def send_message(body: SendBody) -> dict[str, Any]:
    """Run one turn in ``session_id`` and return the reply text."""
    try:
        completed = subprocess.run(
            _cli_argv("--resume", body.session_id, "-z", body.text),
            capture_output=True,
            text=True,
            timeout=TURN_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="the agent turn exceeded its time budget")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"could not start the Hermes CLI: {exc}")

    reply = (completed.stdout or "").strip()
    if completed.returncode != 0 and not reply:
        detail = (completed.stderr or "").strip()[-400:] or f"exit {completed.returncode}"
        first = detail.splitlines()[0]
        # A session keeps the model it was launched on and resume cannot override it, so a
        # retired model surfaces here as the provider rejecting the request.
        if "invalid_params" in detail or "no longer answers" in detail:
            raise HTTPException(
                status_code=409,
                detail=(
                    first
                    + " — resume this session in the dashboard chat and switch its model first."
                ),
            )
        raise HTTPException(status_code=502, detail=detail)
    return {"session_id": body.session_id, "reply": reply, "exit_code": completed.returncode}


@router.post("/bash")
def start_bash_command(body: BashBody) -> dict[str, Any]:
    """Start a command the app asked the host to run (Meet's meeting server).

    Canvas apps use this the way OpenHands does — to launch a server that outlives the call — so the
    command is spawned detached and the call returns at once. Waiting on it would hand the app a
    timeout and kill the very process it asked to start.
    """
    log_path = Path(tempfile.gettempdir()) / f"hermes-social-bash-{uuid4().hex}.log"
    try:
        with log_path.open("wb") as sink:
            process = subprocess.Popen(
                ["/bin/sh", "-lc", body.command],
                cwd=body.cwd or None,
                stdin=subprocess.DEVNULL,
                stdout=sink,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"status": "running", "output": "", "pid": process.pid, "log": str(log_path)}
