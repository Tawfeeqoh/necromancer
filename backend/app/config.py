import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
WORKSPACES_DIR = STORAGE_DIR / "workspaces"
REPORTS_DIR = STORAGE_DIR / "reports"
DATABASE_PATH = BASE_DIR / "necromancer.db"

# Safety boundaries
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_FILES_COUNT = 5000
MAX_UNCOMPRESSED_SIZE_BYTES = 200 * 1024 * 1024  # 200 MB

# Ensure directories exist
for directory in [UPLOADS_DIR, WORKSPACES_DIR, REPORTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
