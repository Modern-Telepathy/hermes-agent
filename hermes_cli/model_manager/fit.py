"""Will this model run on THIS machine, and how fast?

The registry ships measured-ish metadata; this module turns it into a per-machine verdict
against the same hardware budget the local runtime uses (``hardware.probe_budget``). The
verdict vocabulary matches the rest of Hermes' local-model copy: runs on the GPU, spills
into system RAM, or does not fit — never a bare boolean.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from hermes_cli.model_manager.registry import ModelRecord

_GIB = 1 << 30
# Pre-download pricing: the bytes a GGUF costs above its tensors (header, alignment) and
# the runtime's own footprint. Deliberately round — the verdict bands are coarse.
_WEIGHT_OVERHEAD = 1.05
_RUNTIME_OVERHEAD_BYTES = 1 << 30
# The window a first launch actually gets. Pricing a model at its full advertised context
# would mark every long-context model unaffordable.
_PLANNING_CONTEXT = 32768
_SPILL_SPEED_FACTOR = 0.35
# Reference rates come from a ~24 GB card; a much smaller card decodes slower even when the
# model fits, and a bigger one faster. Bounded so the number never reads as more than a band.
_VRAM_SPEED_FLOOR = 0.55
_VRAM_SPEED_CEILING = 1.35


@dataclass(frozen=True)
class MachineFit:
    level: str                  # native | spills | too_big | external
    required_bytes: int
    available_bytes: int
    context_tokens: int
    estimated_tok_per_sec: float | None
    label: str
    detail: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "level": self.level, "required_bytes": self.required_bytes,
            "available_bytes": self.available_bytes, "context_tokens": self.context_tokens,
            "estimated_tok_per_sec": self.estimated_tok_per_sec,
            "label": self.label, "detail": self.detail,
        }


def planning_context(record: ModelRecord) -> int:
    """The window to price: the advertised context, capped at what a first launch grants."""
    if record.context_tokens <= 0:
        return 0
    return min(record.context_tokens, _PLANNING_CONTEXT)


def required_bytes(record: ModelRecord) -> int:
    """Weights + projection + KV cache at the planning window + runtime overhead."""
    weights = int(record.size_bytes * _WEIGHT_OVERHEAD)
    kv = record.kv_kib_per_token * 1024 * planning_context(record)
    return weights + kv + _RUNTIME_OVERHEAD_BYTES


def _speed_estimate(record: ModelRecord, budget: Any, level: str) -> float | None:
    if record.ref_tok_per_sec <= 0 or level == "too_big":
        return None
    rate = record.ref_tok_per_sec
    if level == "spills":
        rate *= _SPILL_SPEED_FACTOR
    reference_vram = 24 * _GIB
    if budget.total_device_bytes:
        scale = budget.usable_vram_bytes / reference_vram
        rate *= max(_VRAM_SPEED_FLOOR, min(_VRAM_SPEED_CEILING, scale))
    return round(rate, 1)


def _human_gb(n: int) -> str:
    return f"{n / _GIB:.1f} GB"


def assess(record: ModelRecord, budget: Any) -> MachineFit:
    """Price ``record`` against ``budget`` (an ``estimator.HardwareBudget``)."""
    required = required_bytes(record)
    ctx = planning_context(record)

    if record.runtime != "llamacpp":
        return MachineFit(
            level="external", required_bytes=required, available_bytes=budget.usable_vram_bytes,
            context_tokens=ctx, estimated_tok_per_sec=None,
            label="Runs outside llama.cpp",
            detail=record.install_hint or "Served by its own runtime or a provider, not the managed engine.",
        )

    gpu = budget.usable_vram_bytes
    combined = gpu + max(0, budget.ram_available_bytes)
    if required <= gpu:
        level, label = "native", "Runs on your GPU"
        detail = f"Fits fully in {_human_gb(gpu)} of usable GPU memory at a {ctx // 1024}K window."
    elif required <= combined:
        level, label = "spills", "Uses system RAM"
        detail = (f"Needs {_human_gb(required)} — more than GPU memory, so part runs on the CPU "
                  f"and generation is slower.")
    else:
        level, label = "too_big", "Too big for this machine"
        detail = f"Needs about {_human_gb(required)}; this machine has {_human_gb(combined)} to give."

    return MachineFit(
        level=level, required_bytes=required, available_bytes=gpu, context_tokens=ctx,
        estimated_tok_per_sec=_speed_estimate(record, budget, level), label=label, detail=detail,
    )
