"""Office suite dashboard backend: the workspace filesystem the ported apps edit.

Covers the contract the browser adapter relies on: compare-and-swap writes, version tokens,
root-relative paths that cannot escape the suite folder, and a tree that hides the kit's
bookkeeping (``.trash``, ``.versions``, temp files).
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

PLUGIN_API = (
    Path(__file__).resolve().parents[2]
    / "plugins"
    / "office-suite"
    / "dashboard"
    / "plugin_api.py"
)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("office_suite_plugin_api", PLUGIN_API)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "get_hermes_home", lambda: tmp_path)
    app = FastAPI()
    app.include_router(module.router, prefix="/api/plugins/office-suite")
    with TestClient(app) as test_client:
        yield test_client, tmp_path


def test_root_is_the_contract_workspace_and_is_created(client):
    test_client, home = client
    where = test_client.get("/api/plugins/office-suite/where").json()
    root = home / "workspace" / "project" / "suite"
    assert where["root"] == str(root)
    assert root.is_dir()


def test_write_read_roundtrip_keeps_a_version_token(client):
    test_client, _ = client
    written = test_client.post(
        "/api/plugins/office-suite/write",
        params={"path": "docs/plan.md", "expected": "-"},
        content=b"# Plan\n",
    )
    assert written.status_code == 200
    stat = written.json()["stat"]
    assert stat["type"] == "file" and stat["size"] == 7

    read = test_client.get("/api/plugins/office-suite/file", params={"path": "docs/plan.md"})
    assert read.status_code == 200
    assert read.content == b"# Plan\n"
    assert read.headers["x-suite-version"] == stat["version"]

    again = test_client.get("/api/plugins/office-suite/stat", params={"path": "docs/plan.md"}).json()
    assert again["stat"]["version"] == stat["version"]


def test_write_refuses_a_stale_version_and_reports_current(client):
    test_client, _ = client
    first = test_client.post(
        "/api/plugins/office-suite/write",
        params={"path": "notes/a.md", "expected": "-"},
        content=b"one",
    ).json()["stat"]
    test_client.post(
        "/api/plugins/office-suite/write",
        params={"path": "notes/a.md", "expected": first["version"]},
        content=b"two",
    )
    stale = test_client.post(
        "/api/plugins/office-suite/write",
        params={"path": "notes/a.md", "expected": first["version"]},
        content=b"three",
    )
    assert stale.status_code == 409
    detail = stale.json()["detail"]
    assert detail["code"] == "ECONFLICT"
    assert detail["current"]["version"] != first["version"]
    read = test_client.get("/api/plugins/office-suite/file", params={"path": "notes/a.md"})
    assert read.content == b"two"


def test_paths_cannot_escape_the_suite_folder(client):
    test_client, _ = client
    for path in ("../outside.md", "/etc/passwd", "docs/../../outside.md"):
        response = test_client.get("/api/plugins/office-suite/stat", params={"path": path})
        assert response.status_code == 400, path


def test_tree_hides_the_kits_bookkeeping(client):
    test_client, _ = client
    for path, body in (
        ("docs/a.md", b"a"),
        (".trash/2026-01-01/docs/old.md", b"old"),
        (".versions/docs/a.md/1.md", b"v1"),
        ("docs/.a.md.tmp-abcd1234", b"tmp"),
    ):
        response = test_client.post(
            "/api/plugins/office-suite/write",
            params={"path": path, "expected": "*"},
            content=body,
        )
        assert response.status_code == 200, path

    entries = test_client.get("/api/plugins/office-suite/tree").json()["entries"]
    paths = {entry["path"] for entry in entries}
    assert "docs/a.md" in paths
    assert not {p for p in paths if p.startswith((".trash", ".versions"))}
    assert not any(".tmp-" in path for path in paths)


def test_move_and_remove(client):
    test_client, _ = client
    test_client.post(
        "/api/plugins/office-suite/write",
        params={"path": "slides/deck.md", "expected": "-"},
        content=b"# Deck",
    )
    test_client.post(
        "/api/plugins/office-suite/mkdir", params={"path": "slides/archive"}
    )
    moved = test_client.post(
        "/api/plugins/office-suite/move",
        params={"from": "slides/deck.md", "to": "slides/archive/deck.md"},
    )
    assert moved.status_code == 200
    assert test_client.get(
        "/api/plugins/office-suite/stat", params={"path": "slides/archive/deck.md"}
    ).json()["stat"]["type"] == "file"

    blocked = test_client.post(
        "/api/plugins/office-suite/move",
        params={"from": "slides/archive/deck.md", "to": "slides/archive/deck.md"},
    )
    assert blocked.status_code == 409

    removed = test_client.post(
        "/api/plugins/office-suite/remove",
        params={"path": "slides/archive/deck.md"},
    )
    assert removed.status_code == 200
    assert test_client.get(
        "/api/plugins/office-suite/stat", params={"path": "slides/archive/deck.md"}
    ).json()["stat"] is None
