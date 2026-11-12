"""Curated model registry behind the Model Manager.

The registry is data, not logic: ``registry.json`` carries one row per model with the
metadata a person needs to choose (size, memory, context, licence, benchmarks, capability
tags) plus per-domain scores. This module loads it, names the filter vocabularies, and
implements the filtering/sorting the API and the UI share.

Scores are curated reference figures from public leaderboards and model cards. They grade
the full-precision model, never the Q4 build a machine downloads — the payload says so.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

_DATA_FILE = Path(__file__).with_name("registry.json")

# Filter vocabulary. Order is presentation order in the dashboard: broad domains first,
# specialised modalities last, so the chips read as a curated list rather than a dump.
DOMAINS: tuple[dict[str, str], ...] = (
    {"id": "general", "label": "General chat", "description": "Everyday assistant work: questions, summaries, drafts."},
    {"id": "coding", "label": "Coding", "description": "Writing, refactoring and explaining code across files."},
    {"id": "reasoning", "label": "Reasoning", "description": "Multi-step problems, planning and careful analysis."},
    {"id": "math", "label": "Math", "description": "Arithmetic, proofs and competition-style problems."},
    {"id": "vision", "label": "Vision", "description": "Images, screenshots, charts and scanned documents."},
    {"id": "agents", "label": "Agents & tools", "description": "Reliable tool calling and long automation chains."},
    {"id": "long_context", "label": "Long context", "description": "Whole repositories and document archives in one window."},
    {"id": "multilingual", "label": "Multilingual", "description": "Translation and non-English fluency."},
    {"id": "writing", "label": "Writing", "description": "Prose quality, tone and editing."},
    {"id": "efficiency", "label": "Speed & size", "description": "Quality per gigabyte and per second."},
    {"id": "retrieval", "label": "Retrieval", "description": "Embeddings and search quality for local RAG."},
    {"id": "speech", "label": "Speech", "description": "Transcription and translation of audio."},
    {"id": "image_gen", "label": "Image generation", "description": "Text-to-image and editing."},
)

TYPES: tuple[dict[str, str], ...] = (
    {"id": "chat", "label": "Chat"},
    {"id": "reasoning", "label": "Reasoning"},
    {"id": "coding", "label": "Coding"},
    {"id": "vision", "label": "Vision"},
    {"id": "embedding", "label": "Embedding"},
    {"id": "speech", "label": "Speech"},
    {"id": "image", "label": "Image"},
)

ARCHITECTURES: tuple[dict[str, str], ...] = (
    {"id": "dense", "label": "Dense"},
    {"id": "moe", "label": "Mixture of experts"},
    {"id": "hybrid", "label": "Hybrid attention"},
    {"id": "diffusion", "label": "Diffusion"},
)

# Sortable fields: the wire name the dashboard sends -> the record attribute it sorts on.
SORT_FIELDS: dict[str, str] = {
    "quality": "quality",
    "size": "size_bytes",
    "params": "params_b",
    "active_params": "active_params_b",
    "context": "context_tokens",
    "speed": "ref_tok_per_sec",
    "released": "released",
    "name": "name",
}

_DOMAIN_IDS = frozenset(d["id"] for d in DOMAINS)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalized_key(value: str) -> str:
    """``Qwen3.8-Coder-32B`` and ``qwen3.8-embed`` collapse to a comparable key."""
    return _NON_ALNUM.sub("", value.lower())


@dataclass(frozen=True)
class ModelRecord:
    id: str
    name: str
    family: str
    publisher: str
    type: str
    architecture: str
    params_b: float
    active_params_b: float
    context_tokens: int
    max_output_tokens: int
    license: str
    released: str
    quant: str
    size_bytes: int
    kv_kib_per_token: int
    ref_tok_per_sec: float
    quality: int
    benchmarks: dict[str, float | None] = field(default_factory=dict)
    domains: dict[str, int] = field(default_factory=dict)
    capabilities: tuple[str, ...] = ()
    runtime: str = "llamacpp"
    repo: str | None = None
    install_hint: str = ""
    notes: str = ""

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> ModelRecord:
        domains = {k: int(v) for k, v in (row.get("domains") or {}).items()
                   if k in _DOMAIN_IDS and v is not None}
        return cls(
            id=str(row["id"]),
            name=str(row["name"]),
            family=str(row.get("family") or row["name"]),
            publisher=str(row.get("publisher") or ""),
            type=str(row.get("type") or "chat"),
            architecture=str(row.get("architecture") or "dense"),
            params_b=float(row.get("params_b") or 0.0),
            active_params_b=float(row.get("active_params_b") or row.get("params_b") or 0.0),
            context_tokens=int(row.get("context_tokens") or 0),
            max_output_tokens=int(row.get("max_output_tokens") or 0),
            license=str(row.get("license") or ""),
            released=str(row.get("released") or ""),
            quant=str(row.get("quant") or ""),
            size_bytes=int(row.get("size_bytes") or 0),
            kv_kib_per_token=int(row.get("kv_kib_per_token") or 0),
            ref_tok_per_sec=float(row.get("ref_tok_per_sec") or 0.0),
            quality=int(row.get("quality") or 0),
            benchmarks={k: (None if v is None else float(v)) for k, v in (row.get("benchmarks") or {}).items()},
            domains=domains,
            capabilities=tuple(str(c) for c in (row.get("capabilities") or ())),
            runtime=str(row.get("runtime") or "llamacpp"),
            repo=(str(row["repo"]) if row.get("repo") else None),
            install_hint=str(row.get("install_hint") or ""),
            notes=str(row.get("notes") or ""),
        )

    @property
    def domain_scores(self) -> list[dict[str, Any]]:
        """Every domain this model was graded on, strongest first — what the radar shows."""
        return [{"id": domain, "label": _label_for(domain), "score": score}
                for domain, score in sorted(self.domains.items(), key=lambda kv: kv[1], reverse=True)]

    @property
    def downloadable(self) -> bool:
        """Only GGUF text models can be pulled and served by the managed llama.cpp runtime."""
        return self.runtime == "llamacpp" and bool(self.repo)

    @property
    def best_domain(self) -> str | None:
        return max(self.domains, key=lambda d: self.domains[d]) if self.domains else None

    def matches_staged(self, staged_stems: Iterable[str]) -> bool:
        """True when a model on disk is this registry entry (any quant, split or single).

        Staged files are named by their GGUF stem, which carries the family, size and quant
        (``Qwen3.8-Coder-32B-UD-Q4_K_M``); the registry id carries family and size only.
        """
        key = normalized_key(self.id)
        return any(normalized_key(stem).startswith(key) for stem in staged_stems)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id, "name": self.name, "family": self.family,
            "publisher": self.publisher, "type": self.type, "architecture": self.architecture,
            "params_b": self.params_b, "active_params_b": self.active_params_b,
            "context_tokens": self.context_tokens, "max_output_tokens": self.max_output_tokens,
            "license": self.license, "released": self.released, "quant": self.quant,
            "size_bytes": self.size_bytes, "kv_kib_per_token": self.kv_kib_per_token,
            "ref_tok_per_sec": self.ref_tok_per_sec, "quality": self.quality,
            "benchmarks": dict(self.benchmarks), "domains": dict(self.domains),
            "capabilities": list(self.capabilities), "runtime": self.runtime,
            "repo": self.repo, "install_hint": self.install_hint, "notes": self.notes,
            "downloadable": self.downloadable, "best_domain": self.best_domain,
        }


def _label_for(domain_id: str) -> str:
    return next((d["label"] for d in DOMAINS if d["id"] == domain_id), domain_id)


@lru_cache(maxsize=1)
def load_registry() -> tuple[tuple[ModelRecord, ...], dict[str, Any]]:
    """(records, meta) from the packaged JSON. Cached: the file ships with the release."""
    # utf-8-sig: the shipped file is written BOM-less, but an editor on Windows may BOM it.
    raw = json.loads(_DATA_FILE.read_text(encoding="utf-8-sig"))
    records = tuple(ModelRecord.from_dict(row) for row in raw.get("models") or ())
    meta = {
        "schema_version": raw.get("schema_version", 1),
        "reference_hardware": raw.get("reference_hardware", ""),
        "notes": raw.get("notes", ""),
        "domains": [dict(d) for d in DOMAINS],
        "types": [dict(t) for t in TYPES],
        "architectures": [dict(a) for a in ARCHITECTURES],
    }
    return records, meta


def records() -> tuple[ModelRecord, ...]:
    return load_registry()[0]


def by_id() -> dict[str, ModelRecord]:
    return {record.id: record for record in records()}


def filter_records(
    rows: Iterable[ModelRecord],
    *,
    query: str = "",
    types: Iterable[str] = (),
    domains: Iterable[str] = (),
    licenses: Iterable[str] = (),
    architectures: Iterable[str] = (),
    max_size_bytes: int | None = None,
    min_context: int | None = None,
    capabilities: Iterable[str] = (),
) -> list[ModelRecord]:
    """Apply every filter the UI offers. An empty filter list means "no restriction"."""
    wanted_types = {t for t in types if t}
    wanted_domains = {d for d in domains if d}
    wanted_licenses = {l.lower() for l in licenses if l}
    wanted_arch = {a for a in architectures if a}
    wanted_caps = {c for c in capabilities if c}
    needle = normalized_key(query)

    out = []
    for row in rows:
        if wanted_types and row.type not in wanted_types:
            continue
        if wanted_arch and row.architecture not in wanted_arch:
            continue
        if wanted_licenses and row.license.lower() not in wanted_licenses:
            continue
        if wanted_domains and not wanted_domains.issubset(row.domains):
            continue
        if wanted_caps and not wanted_caps.issubset(set(row.capabilities)):
            continue
        if max_size_bytes is not None and row.size_bytes > max_size_bytes:
            continue
        if min_context is not None and row.context_tokens < min_context:
            continue
        if needle and needle not in normalized_key(
            f"{row.id} {row.name} {row.family} {row.publisher} {' '.join(row.capabilities)}"
        ):
            continue
        out.append(row)
    return out


def sort_records(
    rows: Iterable[ModelRecord], *, sort: str = "quality", descending: bool = True
) -> list[ModelRecord]:
    attr = SORT_FIELDS.get(sort, "quality")
    return sorted(rows, key=lambda row: getattr(row, attr), reverse=descending)
