import uuid
from pathlib import Path
from backend.app.agents.resurrector import ResurrectionAgent
from backend.app.core.archive_validator import validate_and_extract_archive
from backend.app.core.workspace_manager import WorkspaceManager


def _setup_workspace(tmp_path: Path):
    project_id = f"test-patch-{uuid.uuid4()}"
    upload_id = f"test-upload-{uuid.uuid4()}"
    extract_dir = WorkspaceManager.get_upload_extracted_dir(upload_id)
    zip_path = Path("sample_legacy_app.zip").resolve()
    validate_and_extract_archive(zip_path, extract_dir)
    workspace_dir = WorkspaceManager.setup_project_workspace(project_id, upload_id)
    return project_id, workspace_dir


def test_real_diff_generation_and_git_apply():
    project_id, workspace_dir = _setup_workspace(Path("."))
    base_sha = WorkspaceManager.get_head_commit(project_id)

    patch = ResurrectionAgent.generate_patch(workspace_dir, {"id": "t1"}, base_sha)
    assert "--- a/db.php" in patch["diff"]
    assert "+++ b/db.php" in patch["diff"]
    assert "--- a/login.php" in patch["diff"]
    assert "+++ b/login.php" in patch["diff"]

    applied, result_sha, err = WorkspaceManager.apply_patch_in_workspace(project_id, patch["diff"])
    assert applied is True, f"git apply failed: {err}"
    assert result_sha is not None and result_sha != base_sha
    assert "PDO" in (workspace_dir / "db.php").read_text(encoding="utf-8")


def test_corrupt_patch_rejected_leaves_workspace_unchanged():
    project_id, workspace_dir = _setup_workspace(Path("."))
    base_sha = WorkspaceManager.get_head_commit(project_id)
    orig_db = (workspace_dir / "db.php").read_text(encoding="utf-8")

    bad_diff = (
        "--- a/db.php\n"
        "+++ b/db.php\n"
        "@@ -1,3 +1,3 @@\n"
        "-// THIS LINE DOES NOT EXIST IN THE WORKSPACE\n"
        "+// CORRUPT REPLACEMENT\n"
    )

    applied, result_sha, err = WorkspaceManager.apply_patch_in_workspace(project_id, bad_diff)
    assert applied is False
    assert result_sha is None
    assert err is not None
    assert WorkspaceManager.get_head_commit(project_id) == base_sha
    assert (workspace_dir / "db.php").read_text(encoding="utf-8") == orig_db
