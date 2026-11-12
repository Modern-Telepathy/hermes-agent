"""What is running RIGHT NOW, across every local server this machine might have.

The Model Manager's registry answers "what could I run"; this module answers "what is
already serving", which is a different question with several possible sources: the managed
llama.cpp router, an Ollama daemon, LM Studio, and the configured default model. Every probe
is short-timeout and failure-tolerant — a machine with none of them running is the normal
case, not an error.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.request
from typing import Any, Callable

logger = logging.getLogger(__name__)

_TIMEOUT_S = 1.5
_CACHE_TTL_S = 5.0
_cache: tuple[float, list[dict[str, Any]]] | None = None

_OLLAMA_DEFAULT = "http://127.0.0.1:11434"
_LMSTUDIO_DEFAULT = "http://127.0.0.1:1234"


def _get_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": "hermes-model-manager"})
    with urllib.request.urlopen(request, timeout=_TIMEOUT_S) as response:
        return json.loads(response.read().decode("utf-8", "replace"))


def _row(model_id: str, provider: str, *, status: str = "ready", base_url: str = "",
         context_tokens: int | None = None, size_bytes: int | None = None) -> dict[str, Any]:
    return {
        "id": model_id, "provider": provider, "status": status,
        "base_url": base_url or None, "context_tokens": context_tokens, "size_bytes": size_bytes,
    }


def _managed_llamacpp() -> list[dict[str, Any]]:
    """Resident models in the managed llama.cpp router (or an external llama-server)."""
    from hermes_cli.local_runtime.endpoint import resolve_llamacpp_endpoint

    endpoint = resolve_llamacpp_endpoint(wait_for_boot_s=0.0)
    if not endpoint:
        return []
    base = str(endpoint.get("base_url") or "").rstrip("/")
    if not base:
        return []
    payload = _get_json(f"{base}/v1/models")
    out = []
    for model in payload.get("data") or []:
        model_id = str(model.get("id") or "")
        if not model_id:
            continue
        out.append(_row(model_id, "llama.cpp", status=str(model.get("status") or "ready"), base_url=base))
    return out


def _ollama() -> list[dict[str, Any]]:
    from hermes_cli.models_local import _get_ollama_base_url

    base = (_get_ollama_base_url() or _OLLAMA_DEFAULT).rstrip("/")
    payload = _get_json(f"{base}/api/tags")
    out = []
    for model in payload.get("models") or []:
        model_id = str(model.get("name") or model.get("model") or "")
        if not model_id:
            continue
        out.append(_row(model_id, "ollama", base_url=base, size_bytes=model.get("size")))
    return out


def _lmstudio() -> list[dict[str, Any]]:
    payload = _get_json(f"{_LMSTUDIO_DEFAULT}/v1/models")
    return [_row(str(m.get("id")), "lmstudio", base_url=_LMSTUDIO_DEFAULT)
            for m in payload.get("data") or [] if m.get("id")]


def _configured_default() -> list[dict[str, Any]]:
    """The main model Hermes is configured to use — often a cloud model, which is still "running"."""
    from hermes_cli import config as config_mod

    section = (config_mod.load_config_readonly() or {}).get("model") or {}
    provider = str(section.get("provider") or "").strip()
    model_id = str(section.get("default") or section.get("name") or "").strip()
    if not model_id:
        return []
    return [_row(model_id, provider or "configured", status="active")]


_PROBES: tuple[tuple[str, Callable[[], list[dict[str, Any]]]], ...] = (
    ("llama.cpp", _managed_llamacpp),
    ("ollama", _ollama),
    ("lmstudio", _lmstudio),
    ("configured", _configured_default),
)


def running_models(*, refresh: bool = False) -> list[dict[str, Any]]:
    """Every model this machine is serving or configured to use. Cached for one poll window."""
    global _cache
    now = time.monotonic()
    if not refresh and _cache is not None and now - _cache[0] < _CACHE_TTL_S:
        return _cache[1]

    found: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for name, probe in _PROBES:
        try:
            rows = probe()
        except Exception:  # absent daemon, refused connection, odd payload — all normal
            logger.debug("model-manager probe %s unavailable", name, exc_info=True)
            continue
        for row in rows:
            key = (row["provider"], row["id"])
            if key in seen:
                continue
            seen.add(key)
            found.append(row)

    _cache = (now, found)
    return found
