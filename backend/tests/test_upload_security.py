import io
import zipfile
import pytest
from fastapi.testclient import TestClient

from backend.app.core.archive_validator import ArchiveValidationError, validate_and_extract_archive
from backend.app.main import app

client = TestClient(app)


def test_reject_zip_symlink(tmp_path):
    zip_path = tmp_path / "symlink.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        info = zipfile.ZipInfo("evil_link")
        # Unix symlink mode 0120777
        info.external_attr = (0o120777 << 16)
        zf.writestr(info, "/etc/passwd")

    with pytest.raises(ArchiveValidationError, match="Symlink"):
        validate_and_extract_archive(zip_path, tmp_path / "out")


def test_reject_path_traversal(tmp_path):
    zip_path = tmp_path / "traversal.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("../../outside.txt", "pwned")

    with pytest.raises(ArchiveValidationError, match="traversal"):
        validate_and_extract_archive(zip_path, tmp_path / "out")


def test_reject_oversized_upload_streaming(monkeypatch):
    monkeypatch.setattr("backend.app.main.MAX_UPLOAD_SIZE_BYTES", 100)
    proj = client.post("/api/v1/projects", json={"name": "Size Limit Test"}).json()

    oversized_bytes = b"PK\x03\x04" + b"A" * 500
    res = client.post(
        f"/api/v1/projects/{proj['id']}/uploads",
        files={"file": ("big.zip", io.BytesIO(oversized_bytes), "application/zip")},
    )
    assert res.status_code == 413


def test_cors_rejects_untrusted_origin():
    res = client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.headers.get("access-control-allow-origin") != "https://evil.example.com"
