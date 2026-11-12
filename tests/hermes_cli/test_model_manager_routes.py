"""Contract tests for the Model Manager: registry integrity, per-machine fit, dashboard routes.

The registry is shipped data, so the integrity test is the one that keeps a hand-edited
entry from reaching the UI half-formed. Route tests drive the real FastAPI router with a
fixed budget — no GPU, no network, no downloads.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from hermes_cli.local_runtime.estimator import HardwareBudget


def _budget() -> HardwareBudget:
    gib = 1 << 30
    return HardwareBudget(
        usable_vram_bytes=24 * gib,
        total_device_bytes=24 * gib,
        ram_available_bytes=32 * gib,
        gpu_name="RTX 4090",
    )


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".hermes"))
    from hermes_cli import web_server
    from hermes_cli.web_routers import model_manager as mm

    monkeypatch.setattr(mm.hardware, "probe_budget", lambda **_kwargs: _budget())
    monkeypatch.setattr(mm.hardware, "_ram_bytes", lambda: (64 << 30, 48 << 30))
    # Live discovery would probe local daemons with real sockets; a fixed answer keeps the
    # contract test about the payload, not this machine.
    monkeypatch.setattr(mm.serving_mod, "running_models", lambda **_: [])
    test_client = TestClient(web_server.app)
    test_client.headers[web_server._SESSION_HEADER_NAME] = web_server._SESSION_TOKEN
    return test_client


# ── registry data ────────────────────────────────────────────
def test_registry_entries_are_complete():
    from hermes_cli.model_manager import registry

    rows, meta = registry.load_registry()
    assert len(rows) >= 30, "the registry is meant to cover every domain worth running"
    assert len({row.id for row in rows}) == len(rows), "ids must be unique"
    assert {d["id"] for d in meta["domains"]} >= {"coding", "reasoning", "vision", "retrieval"}

    for row in rows:
        assert row.name and row.publisher and row.type and row.license, row.id
        assert row.size_bytes > 0 and row.params_b > 0, row.id
        assert row.context_tokens >= 0, row.id
        assert row.domains, f"{row.id} has no domain scores"
        assert all(0 <= score <= 100 for score in row.domains.values()), row.id
        assert 0 <= row.quality <= 100, row.id
        # A model is downloadable exactly when the managed engine can serve it.
        assert row.downloadable == (row.runtime == "llamacpp" and bool(row.repo)), row.id
        if row.runtime != "llamacpp":
            assert row.install_hint, f"{row.id} must say how it runs instead"


def test_registry_covers_every_domain_with_a_leader():
    from hermes_cli.model_manager import registry

    rows, meta = registry.load_registry()
    for domain in meta["domains"]:
        graded = [row for row in rows if domain["id"] in row.domains]
        assert graded, f"no model is graded for {domain['id']}"


# ── fit ──────────────────────────────────────────────────────
def test_fit_bands_follow_available_memory():
    from hermes_cli.model_manager import by_id, fit

    budget = _budget()
    small = by_id()["qwen3.8-4b"]
    huge = by_id()["deepseek-v4-685b"]
    external = by_id()["bge-m3"]

    assert fit.assess(small, budget).level == "native"
    assert fit.assess(huge, budget).level == "too_big"
    assert fit.assess(external, budget).level == "external"

    # Never claim a speed for something that cannot run here.
    assert fit.assess(huge, budget).estimated_tok_per_sec is None
    assert fit.assess(small, budget).estimated_tok_per_sec > 0


def test_fit_prices_weights_kv_and_overhead():
    from hermes_cli.model_manager import by_id, fit

    row = by_id()["qwen3.8-27b"]
    required = fit.required_bytes(row)
    assert required > row.size_bytes, "the KV cache and runtime must be priced on top of weights"
    assert fit.planning_context(row) == 32768, "a first launch is priced at the planning window"

    tiny = HardwareBudget(usable_vram_bytes=1 << 30, total_device_bytes=1 << 30,
                          ram_available_bytes=1 << 30)
    assert fit.assess(row, tiny).level == "too_big"


# ── routes ───────────────────────────────────────────────────
def test_model_manager_routes_require_auth(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path / ".hermes"))
    from hermes_cli import web_server

    unauth = TestClient(web_server.app)
    assert unauth.get("/api/model-manager/overview").status_code == 401
    assert unauth.get("/api/model-manager/registry").status_code == 401


def test_overview_shape(client):
    data = client.get("/api/model-manager/overview").json()
    assert data["counts"]["total"] >= 30
    assert data["counts"]["fits_native"] > 0
    assert isinstance(data["hardware"]["vram_usable_bytes"], int)
    assert data["meta"]["domains"], "the filter vocabulary ships with the payload"
    assert data["serving"] == []


def test_registry_rows_carry_fit_and_install_state(client):
    data = client.get("/api/model-manager/registry").json()
    row = next(r for r in data["models"] if r["id"] == "qwen3.8-27b")
    assert row["fit"]["level"] == "native"
    assert row["installed"] is False
    assert row["downloadable"] is True
    assert row["domains"]["coding"] > 0


def test_registry_filters_and_sorts(client):
    speech = client.get("/api/model-manager/registry?types=speech").json()
    assert speech["matched"] >= 1
    assert all(model["type"] == "speech" for model in speech["models"])

    coding = client.get("/api/model-manager/registry?domains=coding&sort=quality").json()
    qualities = [model["quality"] for model in coding["models"]]
    assert qualities == sorted(qualities, reverse=True)
    assert all("coding" in model["domains"] for model in coding["models"])

    tiny = client.get("/api/model-manager/registry?max_size_gb=6").json()
    assert all(model["size_bytes"] <= 6 * (1 << 30) for model in tiny["models"])


def test_download_rejects_unknown_and_external_models(client):
    assert client.post("/api/model-manager/download", json={"model_id": "nope"}).status_code == 404
    external = client.post("/api/model-manager/download", json={"model_id": "qwen3.8-embed-8b"})
    assert external.status_code == 409
    assert "ollama" in external.json()["detail"]


def test_delete_rejects_unknown_and_absent_models(client):
    assert client.delete("/api/model-manager/models/nope").status_code == 404
    assert client.delete("/api/model-manager/models/qwen3.8-27b").status_code == 404


def test_models_on_disk_are_detected_and_removable(client, monkeypatch):
    """A staged GGUF makes its registry row say On disk, and Remove deletes the file."""
    from hermes_cli.local_runtime import bootstrap
    from hermes_cli.web_routers import model_manager as mm

    monkeypatch.setattr(mm.bootstrap, "refresh_local_runtime", lambda: True)
    models_dir = bootstrap.models_dir()
    models_dir.mkdir(parents=True, exist_ok=True)
    target = models_dir / "Qwen3.8-27B-UD-Q4_K_M.gguf"
    target.write_bytes(b"GGUF" + b"\x00" * 32)

    data = client.get("/api/model-manager/registry").json()
    row = next(model for model in data["models"] if model["id"] == "qwen3.8-27b")
    assert row["installed"] is True
    assert row["installed_model_ids"] == ["Qwen3.8-27B-UD-Q4_K_M"]

    removed = client.delete("/api/model-manager/models/qwen3.8-27b")
    assert removed.status_code == 200
    assert removed.json()["removed_files"] == 1
    assert not target.exists()


def test_download_picks_the_best_q4_build(client, monkeypatch):
    """Resolution is server-side: the POST names the quant it will fetch before any bytes move."""
    from hermes_cli.local_runtime.hf_browse import HFFileGroup
    from hermes_cli.web_routers import model_manager as mm

    groups = [
        HFFileGroup(label="Q8_0", paths=("example-Q8_0.gguf",), total_bytes=10),
        HFFileGroup(label="Q4_K_M", paths=("example-00001-of-00002.gguf", "example-00002-of-00002.gguf"),
                    total_bytes=42),
    ]
    monkeypatch.setattr(mm.hf_browse, "repo_files", lambda repo: groups)
    monkeypatch.setattr(mm, "_run_download", lambda job, plan: None)
    monkeypatch.setattr(mm.bootstrap, "refresh_local_runtime", lambda: True)

    started = client.post("/api/model-manager/download", json={"model_id": "qwen3.8-coder-7b"})
    assert started.status_code == 200
    body = started.json()
    assert body["quant"] == "Q4_K_M"
    assert body["total_bytes"] == 42
    assert body["job_id"]

    job = client.get(f"/api/model-manager/jobs/{body['job_id']}")
    assert job.status_code == 200
    assert job.json()["model_id"] == "qwen3.8-coder-7b"
