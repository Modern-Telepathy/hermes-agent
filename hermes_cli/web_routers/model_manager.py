"""Model Manager dashboard routes — one registry, priced for this machine, with downloads.

The registry is curated data (``hermes_cli/model_manager``); this router joins it with the
live hardware budget, the models already on disk, and whatever is serving right now. Every
row answers the questions a person actually has: will it run here, how fast, how big is the
download, what is it best at. Long downloads follow the repo's job pattern:
start-POST -> {job_id} -> GET poll with byte progress.
"""

from __future__ import annotations

import logging
import os
import platform
import re
import threading
import time
import urllib.parse
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from hermes_cli import config as config_mod
from hermes_cli.local_runtime import bootstrap, hardware, hf_browse
from hermes_cli.local_runtime.gguf import split_parts
from hermes_cli.model_manager import fit as fit_mod
from hermes_cli.model_manager import registry as registry_mod
from hermes_cli.model_manager import serving as serving_mod
from agent.memory_provider import spawn_context_thread
from pm.downloader import Download, DownloadPaused, Source

logger = logging.getLogger(__name__)

router = APIRouter()

_JOBS: dict[str, dict[str, Any]] = {}
_JOBS_LOCK = threading.Lock()
_RUNNING: dict[str, dict[str, Any]] = {}
_GIB = 1 << 30
_SPLIT_PART_RE = re.compile(r"-\d{5}-of-\d{5}", re.IGNORECASE)
# Preference order when a repo ships several 4-bit builds: the quality class the managed
# engine targets everywhere else in Hermes.
_QUANT_PREFERENCE = ("Q4_K_M", "Q4_K_XL", "Q4_K_S", "Q4_0")


class DownloadBody(BaseModel):
    model_id: str


class JobIdBody(BaseModel):
    job_id: str


def _human_gb(n: float | None) -> str:
    return f"{(n or 0) / _GIB:.1f} GB"


def _quiet(fn, default):
    try:
        return fn()
    except Exception as exc:  # garnish must never 500 the page
        logger.debug("model-manager garnish failed: %s", exc, exc_info=True)
        return default


# ── machine facts ────────────────────────────────────────────
def _cpu_label() -> str:
    """A human CPU name from the cheapest reliable source per platform, or ""."""
    try:
        if platform.system() == "Darwin":
            import subprocess

            out = subprocess.run(["/usr/sbin/sysctl", "-n", "machdep.cpu.brand_string"],
                                 capture_output=True, text=True, timeout=3, check=False).stdout
            return out.strip()
        if platform.system() == "Linux":
            for line in Path("/proc/cpuinfo").read_text(encoding="utf-8").splitlines():
                if line.lower().startswith("model name"):
                    return line.split(":", 1)[-1].strip()
        if platform.system() == "Windows":
            return os.environ.get("PROCESSOR_IDENTIFIER", "").strip()
    except (OSError, ValueError):
        return ""
    return ""


def _gpu_facts() -> dict[str, Any]:
    query = _quiet(lambda: hardware._cached_nvidia_gpu_query(), None)
    if not query:
        return {}
    return {
        "gpu_name": query["gpu_name"],
        "gpu_util_percent": query["gpu_util_percent"],
        "vram_used_bytes": query["used_bytes"],
    }


def machine_facts() -> dict[str, Any]:
    """Everything that decides what can run here, as plain facts for the header cards."""
    budget = hardware.probe_budget(planning=True)
    ram_total, ram_available = hardware._ram_bytes()
    section = _quiet(lambda: (config_mod.load_config_readonly() or {}).get("local_runtime") or {}, {})
    facts = {
        "platform": platform.system(),
        "arch": platform.machine(),
        "cpu": _cpu_label(),
        "cpu_cores": os.cpu_count() or 0,
        "vram_total_bytes": budget.total_device_bytes,
        "vram_usable_bytes": budget.usable_vram_bytes,
        "ram_total_bytes": ram_total,
        "ram_available_bytes": ram_available,
        "unified_memory": bool(budget.uma),
        "engine_installed": bool(section.get("enabled")),
        "models_dir": str(bootstrap.models_dir()),
        "gpu_name": None,
        "gpu_util_percent": None,
        "vram_used_bytes": None,
    }
    facts.update(_gpu_facts())
    return facts


# ── registry rows ────────────────────────────────────────────
def _staged_index() -> list[dict[str, Any]]:
    """Every servable model on disk: id + the bytes all of its split parts occupy."""
    rows = []
    for gguf in _quiet(bootstrap.staged_models, []):
        parts = split_parts(gguf) or [gguf]
        rows.append({
            "model_id": _SPLIT_PART_RE.sub("", gguf.stem),
            "stem": gguf.stem,
            "path": str(gguf),
            "size_bytes": sum(_quiet(lambda p=p: p.stat().st_size, 0) for p in parts),
        })
    return rows


def _installed_for(record: registry_mod.ModelRecord, staged: list[dict[str, Any]]) -> dict[str, Any]:
    key = registry_mod.normalized_key(record.id)
    hits = [row for row in staged if registry_mod.normalized_key(row["stem"]).startswith(key)]
    return {
        "installed": bool(hits),
        "installed_model_ids": [row["model_id"] for row in hits],
        "installed_bytes": sum(row["size_bytes"] for row in hits),
    }


def _registry_payload(budget) -> list[dict[str, Any]]:
    staged = _staged_index()
    rows = []
    for record in registry_mod.records():
        row = record.to_dict()
        row["fit"] = fit_mod.assess(record, budget).to_dict()
        row.update(_installed_for(record, staged))
        rows.append(row)
    return rows


def _split_param(value: str) -> list[str]:
    return [part.strip() for part in (value or "").split(",") if part.strip()]


@router.get("/api/model-manager/overview")
def model_manager_overview():
    """Machine, engine, serving state and registry shape — the page's first paint."""
    facts = machine_facts()
    budget = hardware.probe_budget(planning=True)
    rows = registry_mod.records()
    return {
        "hardware": facts,
        "serving": serving_mod.running_models(),
        "installed": _staged_index(),
        "counts": {
            "total": len(rows),
            "downloadable": sum(1 for row in rows if row.downloadable),
            "fits_native": sum(1 for row in rows if fit_mod.assess(row, budget).level == "native"),
        },
        "meta": registry_mod.load_registry()[1],
    }


@router.get("/api/model-manager/registry")
def model_manager_registry(
    q: str = "", types: str = "", domains: str = "", licenses: str = "",
    architectures: str = "", capabilities: str = "", max_size_gb: float | None = None,
    min_context: int | None = None, sort: str = "quality", desc: bool = True,
    limit: int | None = None,
):
    """Every model with its fit for this machine. Filtering is offered here for API callers;
    the dashboard applies the same rules client-side so charts and tables filter in one frame."""
    budget = hardware.probe_budget(planning=True)
    selected = registry_mod.filter_records(
        registry_mod.records(),
        query=q,
        types=_split_param(types),
        domains=_split_param(domains),
        licenses=_split_param(licenses),
        architectures=_split_param(architectures),
        capabilities=_split_param(capabilities),
        max_size_bytes=int(max_size_gb * _GIB) if max_size_gb else None,
        min_context=min_context,
    )
    ordered = registry_mod.sort_records(selected, sort=sort, descending=desc)
    if limit:
        ordered = ordered[:limit]
    staged = _staged_index()
    models = []
    for record in ordered:
        row = record.to_dict()
        row["fit"] = fit_mod.assess(record, budget).to_dict()
        row.update(_installed_for(record, staged))
        models.append(row)
    return {
        "models": models,
        "total": len(registry_mod.records()),
        "matched": len(ordered),
        "hardware": machine_facts(),
        "meta": registry_mod.load_registry()[1],
    }


# ── downloads ────────────────────────────────────────────────
def _pick_quant(groups: list[hf_browse.HFFileGroup]) -> hf_browse.HFFileGroup | None:
    if not groups:
        return None
    for wanted in _QUANT_PREFERENCE:
        for group in groups:
            if group.label.upper() == wanted:
                return group
    four_bit = [g for g in groups if g.label.upper().startswith(("Q4", "IQ4", "MXFP4"))]
    return (four_bit or groups)[0]


def _job(kind: str, target: str, model_id: str | None) -> dict[str, Any]:
    job = {
        "job_id": uuid.uuid4().hex[:12], "kind": kind, "target": target, "model_id": model_id,
        "status": "running", "phase": "resolving", "detail": "Finding the right build",
        "total_bytes": None, "done_bytes": 0, "started_at": time.time(), "error": None,
    }
    with _JOBS_LOCK:
        _JOBS[job["job_id"]] = job
    return job


def _job_view(job: dict[str, Any]) -> dict[str, Any]:
    out = dict(job)
    running = _RUNNING.get(job["job_id"], {})
    out["can_pause"] = bool(running.get("pause") is not None and out["status"] == "running")
    out["can_resume"] = out["status"] == "paused"
    elapsed = max(1e-6, time.time() - out["started_at"])
    if out["status"] == "running" and out["done_bytes"]:
        out["bytes_per_sec"] = out["done_bytes"] / elapsed
        if out["total_bytes"]:
            remaining = max(0, out["total_bytes"] - out["done_bytes"])
            out["eta_seconds"] = int(remaining / out["bytes_per_sec"]) if out["bytes_per_sec"] else None
    if out["total_bytes"]:
        out["percent"] = min(100, round(out["done_bytes"] / out["total_bytes"] * 100))
    return out


def _step(job: dict[str, Any], phase: str, detail: str) -> None:
    with _JOBS_LOCK:
        job["phase"] = phase
        job["detail"] = detail


def _run_download(job: dict[str, Any], plan: list[tuple[str, Path]]) -> None:
    running = _RUNNING.get(job["job_id"], {})

    def tick(done: int, total: int, _ranges: dict) -> None:
        with _JOBS_LOCK:
            job["done_bytes"] = done
            job["total_bytes"] = total or job.get("total_bytes")

    Download([Source(url, dest) for url, dest in plan],
             pause_event=running.get("pause")).run(progress=tick)


def _spawn(job: dict[str, Any], body) -> None:
    with _JOBS_LOCK:
        _RUNNING[job["job_id"]] = {"pause": threading.Event()}

    def _worker() -> None:
        status = "done"
        try:
            body()
            _step(job, "done", f"{job['target']} ready")
        except DownloadPaused:
            status = "paused"
        except Exception as exc:
            logger.warning("model-manager download failed", exc_info=True)
            status = "error"
            job["error"] = str(exc)
        finally:
            with _JOBS_LOCK:
                job["status"] = status
                if status != "paused":
                    _RUNNING.pop(job["job_id"], None)

    # spawn_context_thread: a bare Thread would lose the caller's profile scope.
    spawn_context_thread(_worker, name=f"mm-download-{job['job_id']}").start()


@router.post("/api/model-manager/download")
def model_manager_download(body: DownloadBody):
    """Resolve this model's best 4-bit GGUF in its Hugging Face repo and download it.

    Resolution happens up front so a repo with no servable GGUF fails the POST with a
    readable reason instead of a job that dies mid-flight.
    """
    record = registry_mod.by_id().get(body.model_id)
    if record is None:
        raise HTTPException(status_code=404, detail="unknown model")
    if not record.downloadable:
        raise HTTPException(status_code=409, detail=(
            record.install_hint or f"{record.name} runs outside the managed llama.cpp engine"))
    try:
        group = _pick_quant(hf_browse.repo_files(record.repo))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not list {record.repo}: {exc}") from exc
    if group is None:
        raise HTTPException(status_code=409, detail=f"{record.repo} has no servable GGUF files")

    models_dir = bootstrap.models_dir()
    plan = [(f"https://huggingface.co/{record.repo}/resolve/main/{urllib.parse.quote(path)}",
             models_dir / path.rsplit("/", 1)[-1]) for path in group.paths]
    if all(dest.is_file() for _, dest in plan):
        return {"job_id": None, "already_downloaded": True, "model_id": record.id}

    job = _job("model-download", f"{record.name} ({group.label})", record.id)
    with _JOBS_LOCK:
        job["total_bytes"] = group.total_bytes or None
        job["phase"] = "downloading"
        job["detail"] = f"Downloading {record.name} ({group.label})"

    def run() -> None:
        models_dir.mkdir(parents=True, exist_ok=True)
        _run_download(job, plan)
        _quiet(bootstrap.refresh_local_runtime, None)

    _spawn(job, run)
    return {"job_id": job["job_id"], "model_id": record.id, "quant": group.label,
            "total_bytes": group.total_bytes}


@router.get("/api/model-manager/jobs/{job_id}")
def model_manager_job(job_id: str):
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="job not found")
        return _job_view(job)


@router.post("/api/model-manager/jobs/pause")
def model_manager_job_pause(body: JobIdBody):
    running = _RUNNING.get(body.job_id)
    if body.job_id not in _JOBS or running is None:
        raise HTTPException(status_code=404, detail="unknown job")
    running["pause"].set()
    return {"ok": True, "paused": True}


@router.post("/api/model-manager/jobs/resume")
def model_manager_job_resume(body: JobIdBody):
    """Resume is a fresh job: the downloader reuses every completed file and durable range."""
    with _JOBS_LOCK:
        previous = _JOBS.get(body.job_id)
    if previous is None or previous.get("model_id") is None:
        raise HTTPException(status_code=404, detail="unknown job")
    return model_manager_download(DownloadBody(model_id=str(previous["model_id"])))


@router.delete("/api/model-manager/models/{model_id}")
def model_manager_delete(model_id: str):
    """Remove every file of this model, split parts included, then let the runtime re-scan."""
    record = registry_mod.by_id().get(model_id)
    if record is None:
        raise HTTPException(status_code=404, detail="unknown model")
    key = registry_mod.normalized_key(record.id)
    targets: list[Path] = []
    for gguf in _quiet(bootstrap.staged_models, []):
        if registry_mod.normalized_key(gguf.stem).startswith(key):
            targets.extend(split_parts(gguf) or [gguf])
    if not targets:
        raise HTTPException(status_code=404, detail=f"{record.name} is not on disk")
    for path in targets:
        path.unlink(missing_ok=True)
    _quiet(bootstrap.refresh_local_runtime, None)
    return {"ok": True, "removed_files": len(targets),
            "freed_bytes": sum(_quiet(lambda p=p: p.stat().st_size, 0) for p in targets)}
