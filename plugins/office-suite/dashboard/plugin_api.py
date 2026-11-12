"""Office suite backend, mounted at ``/api/plugins/office-suite/``.

Docs, Sheets, Slides, Notes, Calendar+Tasks and DocTransit are Canvas Extensions: each is a
self-contained browser module that edits plain files in one workspace folder. Agent Canvas gives
them the OpenHands Agent Server; Hermes has no Agent Server, so this module *is* their workspace:
``<hermes home>/workspace/project/suite`` over the adapter contract in
``packages/suite-kit/src/fs`` (stat, list, read, compare-and-swap write, mkdir, move, remove).

Nothing here interprets a document. The apps and the agent read and write the same files, and the
folder layout is the suite's own ``CONTRACT.md``:

    suite/
      .suite.json                     root marker + settings
      docs/     **/*.md               Docs
      sheets/   **/*.csv|*.sheet.json Sheets
      notes/    **/*.md               Notes
      slides/   **/*.md               Slides
      calendar/ **/*.md               Calendar events
      tasks/    **/*.md               Tasks
      assets/   any                   shared binaries (suite://assets/...)

Canvas reaches this filesystem through ``POST /api/bash/execute_bash_command`` plus the Agent
Server's file endpoints. Re-implementing POSIX shell was the wrong port, so the browser shim
installs a filesystem adapter over these REST routes instead
(``plugins/office-suite/dashboard/dist/host.js``).
"""
from __future__ import annotations

import os
import re
import shutil
import stat as stat_module
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from hermes_constants import get_hermes_home

router = APIRouter()

MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_TREE_ENTRIES = 20_000
# Written by the kit's write path and ignored by its pollers; never list them as documents.
_TEMP_NAME = re.compile(r"(^|/)\.[^/]*\.tmp-[a-z0-9]+$")
_INTERNAL_DIRS = {".trash", ".versions", ".git"}


def suite_root() -> Path:
    """The suite folder, matched to the contract's default so agents find it by convention."""
    return get_hermes_home() / "workspace" / "project" / "suite"


def _relpath(raw: str) -> str:
    """Validate a root-relative POSIX path (the contract's section 2.3 rules)."""
    if not isinstance(raw, str):
        raise HTTPException(status_code=400, detail="path must be a string")
    if raw.startswith("/") or raw.startswith("\\"):
        raise HTTPException(status_code=400, detail="path must be relative to the suite folder")
    if any(ch in raw for ch in ("\0", "\n", "\r", "\t")):
        raise HTTPException(status_code=400, detail="path contains a control character")
    parts = [part for part in raw.split("/") if part not in ("", ".")]
    if any(part == ".." for part in parts):
        raise HTTPException(status_code=400, detail="path may not contain '..' segments")
    return "/".join(parts)


def _abs(rel: str) -> Path:
    root = suite_root().resolve()
    target = (root / rel).resolve() if rel else root
    if target != root and not target.is_relative_to(root):
        raise HTTPException(status_code=400, detail="path escapes the suite folder")
    return target


def _version(st: os.stat_result) -> str:
    """Opaque token the client compares for equality only; changes with mtime or size."""
    return f"{st.st_mtime_ns}:{st.st_size}"


def _stat(rel: str, path: Path) -> dict[str, Any]:
    st = path.stat()
    is_dir = stat_module.S_ISDIR(st.st_mode)
    return {
        "path": rel,
        "type": "dir" if is_dir else "file",
        "size": 0 if is_dir else st.st_size,
        "mtimeMs": st.st_mtime_ns // 1_000_000,
        "version": _version(st),
    }


def _conflict(rel: str, current: Optional[dict[str, Any]]) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={"code": "ECONFLICT", "path": rel, "current": current},
    )


@router.get("/where")
def where() -> dict[str, Any]:
    """Resolve the suite folder (and create it) before the first poll."""
    root = suite_root()
    root.mkdir(parents=True, exist_ok=True)
    return {"root": str(root), "home": str(get_hermes_home())}


@router.get("/stat")
def stat_path(path: str = Query(...)) -> dict[str, Any]:
    rel = _relpath(path)
    target = _abs(rel)
    if not target.exists() or not rel:
        return {"stat": None}
    return {"stat": _stat(rel, target)}


@router.get("/tree")
def tree(
    dir: str = "",
    depth: int = Query(0, ge=0, le=32),
    include_internal: bool = False,
) -> dict[str, Any]:
    """Files and folders under ``dir``; one walk, ``depth=1`` for a single level.

    Internal bookkeeping (``.trash``, ``.versions``, ``.git``) and the kit's temp files are
    filtered here because the pollers would otherwise report them as documents.
    """
    rel = _relpath(dir)
    base = _abs(rel)
    if not base.is_dir():
        raise HTTPException(status_code=404, detail=f"no such directory: {dir}")
    root = suite_root().resolve()
    entries: list[dict[str, Any]] = []
    for current, dirnames, filenames in os.walk(base):
        current_path = Path(current)
        level = len(current_path.relative_to(base).parts)
        if depth and level >= depth:
            dirnames[:] = []
        dirnames[:] = [
            name for name in dirnames
            if include_internal or name not in _INTERNAL_DIRS
        ]
        for name in [*dirnames, *filenames]:
            full = current_path / name
            try:
                resolved = full.resolve()
                resolved.relative_to(root)
            except (OSError, ValueError):
                continue  # symlink out of the suite: not ours to serve
            child_rel = resolved.relative_to(root).as_posix()
            if _TEMP_NAME.search(child_rel):
                continue
            try:
                entries.append(_stat(child_rel, full))
            except OSError:
                continue
            if len(entries) >= MAX_TREE_ENTRIES:
                return {"root": str(root), "entries": entries, "truncated": True}
    return {"root": str(root), "entries": entries}


@router.get("/file")
def read_file(path: str = Query(...)) -> FileResponse:
    rel = _relpath(path)
    target = _abs(rel)
    if not rel or not target.is_file():
        raise HTTPException(status_code=404, detail=f"no such file: {path}")
    st = target.stat()
    return FileResponse(
        target,
        media_type="application/octet-stream",
        headers={
            "cache-control": "no-store",
            "x-suite-version": _version(st),
            "x-suite-mtime": str(st.st_mtime_ns // 1_000_000),
        },
    )


@router.post("/write")
async def write_file(request: Request, path: str = Query(...), expected: str = "*") -> dict[str, Any]:
    """Write bytes with the kit's compare-and-swap rule.

    ``expected`` is ``"*"`` (no check), ``"-"`` (must not exist) or a version token. The file is
    replaced by an atomic rename from a sibling temp file, so a poller never reads a half write.
    """
    rel = _relpath(path)
    if not rel:
        raise HTTPException(status_code=400, detail="cannot write the suite root")
    target = _abs(rel)
    if target.is_dir():
        raise HTTPException(status_code=400, detail=f"{rel} is a directory")
    payload = await request.body()
    if len(payload) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"write exceeds {MAX_FILE_BYTES} bytes")
    current = _stat(rel, target) if target.exists() else None
    allowed = (
        expected == "*"
        or (expected == "-" and current is None)
        or (current is not None and expected == current["version"])
    )
    if not allowed:
        raise _conflict(rel, current)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.parent / f".{target.name}.tmp-{uuid.uuid4().hex[:8]}"
    try:
        tmp.write_bytes(payload)
        os.replace(tmp, target)
    finally:
        tmp.unlink(missing_ok=True)
    return {"stat": _stat(rel, target)}


@router.post("/mkdir")
def make_dir(path: str = Query(...)) -> dict[str, Any]:
    rel = _relpath(path)
    target = _abs(rel)
    target.mkdir(parents=True, exist_ok=True)
    return {"ok": True, "root": str(suite_root())}


@router.post("/move")
def move_path(from_: str = Query(..., alias="from"), to: str = Query(...), overwrite: bool = False) -> dict[str, Any]:
    source_rel = _relpath(from_)
    target_rel = _relpath(to)
    if not source_rel or not target_rel:
        raise HTTPException(status_code=400, detail="cannot move the suite root")
    source = _abs(source_rel)
    target = _abs(target_rel)
    if not source.exists():
        raise HTTPException(status_code=404, detail=f"no such file: {from_}")
    if target.exists():
        if not overwrite:
            raise HTTPException(status_code=409, detail={"code": "EEXIST", "path": target_rel})
        # A directory rename can only land on a missing or empty target; clear files first.
        if target.is_dir() and not target.is_symlink():
            if any(target.iterdir()):
                raise HTTPException(status_code=409, detail={"code": "EEXIST", "path": target_rel})
            target.rmdir()
        else:
            target.unlink()
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(target))
    return {"ok": True}


@router.post("/remove")
def remove_path(path: str = Query(...), recursive: bool = False) -> dict[str, Any]:
    rel = _relpath(path)
    if not rel:
        raise HTTPException(status_code=400, detail="refusing to remove the suite root")
    target = _abs(rel)
    if not target.exists() and not target.is_symlink():
        raise HTTPException(status_code=404, detail=f"no such file: {path}")
    if target.is_dir() and not target.is_symlink():
        if recursive:
            shutil.rmtree(target)
        else:
            target.rmdir()
    else:
        target.unlink()
    return {"ok": True}
