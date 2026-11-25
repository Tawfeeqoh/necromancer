import hashlib
import os
import zipfile
from pathlib import Path
from typing import Dict, List, Tuple
from backend.app.config import (
    MAX_FILES_COUNT,
    MAX_UNCOMPRESSED_SIZE_BYTES,
    MAX_UPLOAD_SIZE_BYTES,
)

class ArchiveValidationError(Exception):
    pass

def compute_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def validate_and_extract_archive(
    archive_path: Path,
    target_extract_dir: Path
) -> Tuple[str, int, List[str]]:
    """
    Validates ZIP file safety and extracts it.
    Returns (sha256_hash, file_count, list_of_relative_file_paths).
    """
    if not archive_path.exists():
        raise ArchiveValidationError("Archive file not found.")

    file_size = archive_path.stat().st_size
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise ArchiveValidationError(
            f"Archive exceeds maximum size limit of {MAX_UPLOAD_SIZE_BYTES} bytes."
        )

    sha256_hash = compute_sha256(archive_path)

    if not zipfile.is_zipfile(archive_path):
        raise ArchiveValidationError("Uploaded file is not a valid ZIP archive.")

    target_extract_dir.mkdir(parents=True, exist_ok=True)
    target_abs = target_extract_dir.resolve()

    extracted_files: List[str] = []
    total_uncompressed_size = 0

    with zipfile.ZipFile(archive_path, "r") as zf:
        infolist = zf.infolist()

        if len(infolist) > MAX_FILES_COUNT:
            raise ArchiveValidationError(
                f"Archive contains {len(infolist)} entries, exceeding the limit of {MAX_FILES_COUNT}."
            )

        for info in infolist:
            total_uncompressed_size += info.file_size
            if total_uncompressed_size > MAX_UNCOMPRESSED_SIZE_BYTES:
                raise ArchiveValidationError(
                    f"Uncompressed size exceeds maximum safety limit of {MAX_UNCOMPRESSED_SIZE_BYTES} bytes."
                )

            # Path traversal prevention
            filename = info.filename
            # Normalize path
            if filename.startswith("/") or filename.startswith("\\") or ".." in filename.replace("\\", "/").split("/"):
                raise ArchiveValidationError(f"Malicious path traversal detected: {filename}")

            dest_path = (target_extract_dir / filename).resolve()
            if not str(dest_path).startswith(str(target_abs)):
                raise ArchiveValidationError(f"Path traversal detected escaping target: {filename}")

        # Extract safely
        for info in infolist:
            # Skip root directory wrappers if any, or extract as is
            dest_path = (target_extract_dir / info.filename).resolve()
            if info.is_dir():
                dest_path.mkdir(parents=True, exist_ok=True)
            else:
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(dest_path, "wb") as dst:
                    while chunk := src.read(65536):
                        dst.write(chunk)
                rel_path = str(dest_path.relative_to(target_abs)).replace("\\", "/")
                extracted_files.append(rel_path)

    return sha256_hash, len(extracted_files), extracted_files
