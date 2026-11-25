import uuid
from pathlib import Path
from unittest.mock import patch as mock_patch

from backend.app.agents.guardian import GuardianAgent
from backend.app.agents.resurrector import _make_unified_diff
from backend.app.core.archive_validator import validate_and_extract_archive
from backend.app.core.sandbox import SandboxRunner
from backend.app.core.workspace_manager import WorkspaceManager


def test_sandbox_disables_execution_when_docker_unavailable():
    with mock_patch("backend.app.core.sandbox.SandboxRunner.is_container_available", return_value=(False, "Docker daemon not running")):
        res = SandboxRunner.run_in_container(Path("."), ["php", "-v"])
        assert res["executed"] is False
        assert res["status"] == "SANDBOX_UNAVAILABLE"
        assert res["exit_code"] is None


def test_sandbox_uses_strict_container_isolation_flags():
    captured_cmd = []

    def fake_run(cmd, capture_output=True, text=True, timeout=30):
        captured_cmd.append(cmd)
        class FakeProc:
            returncode = 0
            stdout = "OK"
            stderr = ""
        return FakeProc()

    with mock_patch("backend.app.core.sandbox.SandboxRunner.is_container_available", return_value=(True, None)), \
         mock_patch("backend.app.core.sandbox.subprocess.run", side_effect=fake_run):
        res = SandboxRunner.run_in_container(Path("sample_legacy_app"), ["php", "test_runner.php"])
        assert res["executed"] is True
        assert res["status"] == "PASSED"
        cmd = captured_cmd[0]
        assert "--network" in cmd and "none" in cmd
        assert "--memory" in cmd and "256m" in cmd
        assert "--cap-drop" in cmd and "ALL" in cmd
        assert "no-new-privileges" in cmd


def test_guardian_blocks_regressive_patch_and_rollback_cleans_untracked():
    project_id = f"test-guard-{uuid.uuid4()}"
    upload_id = f"test-up-{uuid.uuid4()}"
    extract_dir = WorkspaceManager.get_upload_extracted_dir(upload_id)
    validate_and_extract_archive(Path("sample_legacy_app.zip").resolve(), extract_dir)
    workspace_dir = WorkspaceManager.setup_project_workspace(project_id, upload_id)
    base_sha = WorkspaceManager.get_head_commit(project_id)
    orig_login = (workspace_dir / "login.php").read_text(encoding="utf-8")

    # Regressive patch: removes 'suspended' check and introduces shell_exec()
    regressive_login = (
        "<?php\n"
        "function authenticate_user($username, $password) {\n"
        "    shell_exec('echo ' . $username);\n"
        "    return ['username' => $username];\n"
        "}\n"
        "?>\n"
    )
    diff = _make_unified_diff("login.php", orig_login, regressive_login)
    applied, result_sha, err = WorkspaceManager.apply_patch_in_workspace(project_id, diff)
    assert applied is True, err

    # Simulate an untracked test artifact created in workspace
    untracked_file = workspace_dir / "test_database.sqlite"
    untracked_file.write_text("dummy", encoding="utf-8")
    assert untracked_file.exists()

    # Mock container sandbox as available and returning test failure (exit code 1)
    with mock_patch("backend.app.core.sandbox.SandboxRunner.run_in_container", return_value={
        "executed": True,
        "status": "FAILED",
        "command": "php test_runner.php",
        "exit_code": 1,
        "stdout": "[FAIL] Suspended user account is locked\n",
        "stderr": "",
        "reason": None,
    }):
        verdict = GuardianAgent.evaluate(
            workspace_dir,
            {"changed_files": ["login.php"]},
            ["Suspended users must be denied login."],
        )

    assert verdict["status"] == "blocked"
    assert any("Regression detected" in f["message"] or "Restricted execution primitive" in f["message"] for f in verdict["findings"])

    # Rollback must restore tracked files AND remove untracked files
    assert WorkspaceManager.rollback_to_commit(project_id, base_sha) is True
    assert WorkspaceManager.get_head_commit(project_id) == base_sha
    assert (workspace_dir / "login.php").read_text(encoding="utf-8") == orig_login
    assert not untracked_file.exists()
