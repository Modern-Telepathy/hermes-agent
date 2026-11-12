"""Local services backend, mounted at ``/api/plugins/social-services/``.

Each social app talks to a local service and reports the outage in its own words. This module is the
one place that knows what those services are, whether they are up, and how to install and start them.
It probes the port the app dials, spawns the documented command detached (an install or a server
outlives the request that asked for it, the way Meet's meeting server does), records the pid, and
tails the log the command writes.

Only a process this module started is stopped: a service launched some other way — Meet's own Start
it, a daemon in a terminal — is reported as running and left alone, because a pid we did not record
is not a process we can identify.
"""
from __future__ import annotations

import os
import shutil
import signal
import socket
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# A closed port refuses instantly; a dropped packet would otherwise stall the panel's poll.
PROBE_TIMEOUT_SECONDS = 0.35
# The panel shows the last lines a command wrote, not a log viewer.
LOG_TAIL_BYTES = 4_000

# npm's global prefix is not writable everywhere: a Homebrew/no-prefix npm resolves it to
# /usr/local, which needs root, and a login shell does not always put the real prefix on PATH. Both
# commands pin $HOME/.local, so install and start agree and neither needs elevation.
_BITSOCIAL_INSTALL = 'npm install -g --prefix "$HOME/.local" @bitsocial/bitsocial-cli'
# Its native sqlite module is built for Node 20-25, and a shell whose default is newer loads it with
# a NODE_MODULE_VERSION mismatch, so an nvm-era Node wins over the default when one is installed.
_BITSOCIAL_START = (
    'export PATH="$HOME/.local/bin:$PATH"; '
    'for d in "$HOME"/.nvm/versions/node/v2[0-5]*/bin; do [ -x "$d/node" ] && export PATH="$d:$PATH" && break; done; '
    "bitsocial daemon"
)
# Byte for byte the command Meet's own Start it runs, so both paths install and run the same server.
_LIVEKIT_START = "command -v livekit-server >/dev/null || brew install livekit; livekit-server --dev"

SERVICES: tuple[dict[str, Any], ...] = (
    {
        "id": "bitkin",
        "app": "Bitkin™",
        "route": "/bitkin",
        "service": "Bitsocial node",
        "endpoint": {"host": "127.0.0.1", "port": 9138},
        "requirement": "Bitkin reads communities over the Bitsocial daemon's RPC socket. The daemon needs Node 20-25: its native sqlite module will not load under a newer Node without a rebuild.",
        "probe_binary": "bitsocial",
        "install": _BITSOCIAL_INSTALL,
        "start": _BITSOCIAL_START,
        "docs": "https://docs.bitsocial.net/developer-tools/cli",
    },
    {
        "id": "meet",
        "app": "MeetRightHere™",
        "route": "/meet",
        "service": "LiveKit media server",
        "endpoint": {"host": "127.0.0.1", "port": 7880},
        "requirement": "Calls run through a LiveKit server on this machine; the app's own Start it runs this same command.",
        "probe_binary": "livekit-server",
        "install": "brew install livekit",
        "start": _LIVEKIT_START,
        "docs": "https://docs.livekit.io/home/self-hosting/local/",
    },
    {
        "id": "mesh",
        "app": "MESH™",
        "route": "/mesh",
        "service": "MESH node",
        "endpoint": {"host": "127.0.0.1", "port": 12000},
        "requirement": "A MESH node (Python, FastAPI) answering /.well-known/mesh-node. The app also accepts any node URL you can share, so a remote node works instead.",
        "probe_binary": "",
        "install": "",
        "start": "",
        "docs": "",
    },
    {
        "id": "holons",
        "app": "Holons™",
        "route": "/holons",
        "service": "holons-api",
        "endpoint": {"host": "127.0.0.1", "port": 3000},
        "requirement": "Holons signs in against a holons-api server; the app's Settings take its base URL.",
        "probe_binary": "",
        "install": "",
        "start": "",
        "docs": "",
    },
    {
        "id": "murmur",
        "app": "Murmur™",
        "route": "/murmur",
        "service": "libp2p peers",
        "endpoint": None,
        "requirement": "No local server: rooms live on libp2p, so Murmur needs a relay or a neighbour before anyone else can be reached.",
        "probe_binary": "",
        "install": "",
        "start": "",
        "docs": "",
    },
)

# Service id -> the one process this page started, so Stop only ever kills its own.
_PROCS: dict[str, dict[str, Any]] = {}


class RunBody(BaseModel):
    step: str = Field(pattern="^(install|start|command)$")
    command: Optional[str] = None


def _service(service_id: str) -> dict[str, Any]:
    for item in SERVICES:
        if item["id"] == service_id:
            return item
    raise HTTPException(status_code=404, detail=f"unknown service {service_id}")


def _port_open(endpoint: Optional[dict[str, Any]]) -> bool:
    if not endpoint:
        return False
    try:
        with socket.create_connection((endpoint["host"], endpoint["port"]), timeout=PROBE_TIMEOUT_SECONDS):
            return True
    except OSError:
        return False


def _live_process(service_id: str) -> Optional[subprocess.Popen]:
    """The process this page started for a service, or None once it has exited.

    Liveness is the Popen handle rather than the pid: ``poll()`` reaps a finished child, so a
    completed install is not a zombie that still answers a pid probe and blocks the next Start.
    """
    record = _PROCS.get(service_id)
    if not record:
        return None
    proc = record.get("proc")
    if proc is None:
        return None
    if proc.poll() is not None:
        # Exited (or crashed): keep the record, because the log it wrote is what explains why.
        record["proc"] = None
        return None
    return proc


def _stop_process(pid: int) -> None:
    """SIGTERM the command's whole session, so npm and the daemon it spawned both go."""
    if os.name == "nt":
        # Windows has no process groups here; taskkill /T takes the children with the parent.
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, check=False, timeout=10)
        return
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)  # windows-footgun: ok — POSIX branch, groups exist here
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _installed(binary: str) -> bool:
    """Whether the binary is on PATH or in the ~/.local prefix the install command writes to."""
    if not binary:
        return False
    return bool(shutil.which(binary)) or (Path.home() / ".local" / "bin" / binary).exists()


def _tail(path: Optional[str]) -> str:
    if not path:
        return ""
    try:
        with open(path, "rb") as handle:
            handle.seek(0, os.SEEK_END)
            handle.seek(max(0, handle.tell() - LOG_TAIL_BYTES))
            return handle.read().decode("utf-8", "replace")
    except OSError:
        return ""


def _status(item: dict[str, Any]) -> dict[str, Any]:
    proc = _live_process(item["id"])
    record = _PROCS.get(item["id"]) or {}
    binary = item["probe_binary"]
    return {
        **item,
        "running": _port_open(item["endpoint"]),
        "installed": _installed(binary) if binary else None,
        "pid": proc.pid if proc else None,
        # The last run's log outlives the process: a crash is exactly when it is needed.
        "log_tail": _tail(record.get("log")),
    }


@router.get("/services")
def list_services() -> dict[str, Any]:
    """Every service the social apps need, with its live state."""
    return {"services": [_status(item) for item in SERVICES]}


@router.post("/services/{service_id}/run")
def run_service(service_id: str, body: RunBody) -> dict[str, Any]:
    """Run one documented step — install or start — or a command the panel supplies."""
    item = _service(service_id)
    command = (body.command or "").strip() if body.step == "command" else item[body.step]
    if not command:
        raise HTTPException(status_code=400, detail=f"{item['service']} has no {body.step} command; type one to run")
    if _live_process(service_id):
        raise HTTPException(status_code=409, detail=f"{item['service']} already has a command running from here; stop it first")

    log_path = Path(tempfile.gettempdir()) / f"hermes-social-service-{service_id}-{uuid4().hex}.log"
    try:
        with log_path.open("wb") as sink:
            process = subprocess.Popen(
                ["/bin/sh", "-lc", command],
                stdin=subprocess.DEVNULL,
                stdout=sink,
                stderr=subprocess.STDOUT,
                # Detached on purpose: an install or a daemon must outlive the request that started it.
                start_new_session=True,  # detached-spawn: ok — the service outlives the request
            )
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    _PROCS[service_id] = {"proc": process, "log": str(log_path), "step": body.step}
    return {"status": "running", "step": body.step, "pid": process.pid, "log": str(log_path)}


@router.post("/services/{service_id}/stop")
def stop_service(service_id: str) -> dict[str, Any]:
    """Stop the process this page started; a service started elsewhere is left alone."""
    item = _service(service_id)
    proc = _live_process(service_id)
    if proc is None:
        raise HTTPException(
            status_code=409,
            detail=f"nothing started here to stop; if {item['service']} is running, it was launched elsewhere",
        )
    _stop_process(proc.pid)
    _PROCS.pop(service_id, None)
    return {"status": "stopped"}
