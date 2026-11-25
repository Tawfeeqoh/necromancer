import uuid
from pathlib import Path
from unittest.mock import patch as mock_patch
from fastapi.testclient import TestClient

from backend.app.agents.resurrector import _make_unified_diff
from backend.app.core.orchestrator import Orchestrator
from backend.app.core.workspace_manager import WorkspaceManager
from backend.app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert "sandbox_available" in body


def _create_and_start_sample_project():
    create_res = client.post("/api/v1/projects", json={
        "name": "Legacy Customer Portal",
        "description": "Inherited 2013 billing and auth system",
    })
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    zip_path = Path("sample_legacy_app.zip").resolve()
    with open(zip_path, "rb") as f:
        upload_res = client.post(
            f"/api/v1/projects/{project_id}/uploads",
            files={"file": ("sample_legacy_app.zip", f, "application/zip")},
        )
    assert upload_res.status_code == 202
    upload_id = upload_res.json()["id"]

    wf_res = client.post(f"/api/v1/projects/{project_id}/workflows", json={
        "upload_id": upload_id,
        "goals": ["understand", "diagnose", "repair"],
    })
    assert wf_res.status_code == 202
    workflow_id = wf_res.json()["id"]
    return project_id, workflow_id


def test_full_revival_flow_with_container_sandbox():
    project_id, workflow_id = _create_and_start_sample_project()

    ws_res = client.get(f"/api/v1/projects/{project_id}/workspace")
    assert ws_res.status_code == 200
    ws_data = ws_res.json()
    assert ws_data["anatomy"] is not None
    assert ws_data["intent"] is not None
    assert ws_data["diagnosis"] is not None
    assert len(ws_data["tasks"]) > 0
    assert len(ws_data["patches"]) == 1
    assert ws_data["patches"][0]["status"] == "proposed"
    assert "--- a/db.php" in ws_data["patches"][0]["diff"]

    first_task = ws_data["tasks"][0]

    with mock_patch("backend.app.core.sandbox.SandboxRunner.run_in_container", return_value={
        "executed": True,
        "status": "PASSED",
        "command": "php test_runner.php",
        "exit_code": 0,
        "stdout": "=== Necromancer Test Runner ===\n[PASS] Modern PDO connection initialized\n",
        "stderr": "",
        "reason": None,
    }):
        decision_res = client.post(f"/api/v1/tasks/{first_task['id']}/decision", json={
            "decision": "approved",
            "reason": "Authorized isolated migration to modern PDO.",
        })

    assert decision_res.status_code == 200
    decision_data = decision_res.json()
    assert decision_data["status"] == "completed"
    assert decision_data["guardian"]["status"] == "passed"
    assert decision_data["patch"]["result_revision"] != decision_data["patch"]["base_revision"]

    # Verify deterministic dossier across two consecutive calls
    d1 = client.get(f"/api/v1/projects/{project_id}/dossier").json()
    d2 = client.get(f"/api/v1/projects/{project_id}/dossier").json()
    assert len(d1["dossier_sha256"]) == 64
    assert d1["dossier_sha256"] == d2["dossier_sha256"]
    assert d1["revived_sha256"] == d2["revived_sha256"]
    assert d1["guardian_status"] == "passed"

    # Verify downloadable JSON & Markdown dossiers
    dl_json = client.get(f"/api/v1/projects/{project_id}/dossier/download?format=json")
    assert dl_json.status_code == 200
    assert "attachment;" in dl_json.headers.get("content-disposition", "")

    dl_md = client.get(f"/api/v1/projects/{project_id}/dossier/download?format=markdown")
    assert dl_md.status_code == 200
    assert "# Necromancer Revival Dossier" in dl_md.text


def test_guardian_blocks_regression_and_restores_baseline():
    project_id, workflow_id = _create_and_start_sample_project()
    ws_data = client.get(f"/api/v1/projects/{project_id}/workspace").json()
    first_task = ws_data["tasks"][0]
    workspace_dir = WorkspaceManager.get_project_workspace_dir(project_id)
    base_sha = WorkspaceManager.get_head_commit(project_id)
    orig_login = (workspace_dir / "login.php").read_text(encoding="utf-8")

    # Build a deliberately regressive patch that removes 'suspended' check
    regressive_login = (
        "<?php\n"
        "require_once __DIR__ . '/db.php';\n"
        "function authenticate_user($username, $password) {\n"
        "    return ['username' => $username];\n"
        "}\n"
        "?>\n"
    )
    regressive_patch = {
        "id": str(uuid.uuid4()),
        "task_id": first_task["id"],
        "base_revision": base_sha,
        "patch_sha256": "deadbeef",
        "changed_files": ["login.php"],
        "diff": _make_unified_diff("login.php", orig_login, regressive_login),
        "status": "proposed",
        "created_at": "2026-11-25T00:00:00Z",
    }

    with mock_patch("backend.app.core.sandbox.SandboxRunner.run_in_container", return_value={
        "executed": True,
        "status": "FAILED",
        "command": "php test_runner.php",
        "exit_code": 1,
        "stdout": "[FAIL] Suspended user account is locked\n",
        "stderr": "",
        "reason": None,
    }):
        res = Orchestrator.execute_approved_repair(first_task, custom_patch=regressive_patch)

    assert res["status"] == "blocked"
    assert res["guardian"]["status"] == "blocked"
    assert WorkspaceManager.get_head_commit(project_id) == base_sha
    assert (workspace_dir / "login.php").read_text(encoding="utf-8") == orig_login
