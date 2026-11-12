"""The Model Manager: one registry of every model worth running, priced for this machine."""

from __future__ import annotations

from hermes_cli.model_manager.fit import MachineFit, assess, planning_context, required_bytes
from hermes_cli.model_manager.registry import (
    ARCHITECTURES,
    DOMAINS,
    SORT_FIELDS,
    TYPES,
    ModelRecord,
    by_id,
    filter_records,
    load_registry,
    normalized_key,
    records,
    sort_records,
)
from hermes_cli.model_manager.serving import running_models

__all__ = [
    "ARCHITECTURES", "DOMAINS", "SORT_FIELDS", "TYPES", "MachineFit", "ModelRecord",
    "assess", "by_id", "filter_records", "load_registry", "normalized_key",
    "planning_context", "records", "required_bytes", "running_models", "sort_records",
]
