import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
WORKSPACES_DIR = STORAGE_DIR / "workspaces"
REPORTS_DIR = STORAGE_DIR / "reports"
DATABASE_PATH = BASE_DIR / "necromancer.db"

# Safety boundaries
MAX_UPLOAD_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(50 * 1024 * 1024)))  # 50 MB
MAX_FILES_COUNT = int(os.getenv("MAX_FILES_COUNT", "5000"))
MAX_UNCOMPRESSED_SIZE_BYTES = int(os.getenv("MAX_UNCOMPRESSED_SIZE_BYTES", str(200 * 1024 * 1024)))  # 200 MB
MAX_COMPRESSION_RATIO = 100

# Explicit CORS origins
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

for directory in [UPLOADS_DIR, WORKSPACES_DIR, REPORTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
