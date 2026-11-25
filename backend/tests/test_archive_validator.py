import pytest
from pathlib import Path
from backend.app.core.archive_validator import validate_and_extract_archive, compute_sha256, ArchiveValidationError

def test_validate_and_extract_sample_app(tmp_path):
    zip_path = Path("sample_legacy_app.zip").resolve()
    assert zip_path.exists(), "sample_legacy_app.zip must exist"

    extract_dir = tmp_path / "extracted"
    sha, count, files = validate_and_extract_archive(zip_path, extract_dir)

    assert len(sha) == 64
    assert count > 0
    assert any("db.php" in f for f in files)
    assert any("login.php" in f for f in files)
    assert any("schema.sql" in f for f in files)

def test_reject_nonexistent_file(tmp_path):
    with pytest.raises(ArchiveValidationError):
        validate_and_extract_archive(tmp_path / "ghost.zip", tmp_path / "out")
