# Specification: Legacy Project Revival Workflow — Design

## 1. System Components
- **API Server (`backend/app/main.py`):** FastAPI application managing uploads, workflows, task decisions, dossier downloads, and rollback.
- **Database Layer (`backend/app/database.py`):** SQLite database in WAL mode with tables for `projects`, `uploads`, `workflows`, `findings`, `tasks`, `patches`, `test_runs`, `guardian_reviews`, and `dossiers`.
- **Workspace Manager (`backend/app/core/workspace_manager.py`):** Isolated directory lifecycle management with Git versioning, LF line normalization, atomic patching, and `git clean -fd` rollback.
- **Sandbox Runner (`backend/app/core/sandbox.py`):** Docker CLI wrapper enforcing `--network none`, `--read-only`, and resource constraints.
- **Orchestrator (`backend/app/core/orchestrator.py`):** State machine coordinating agent transitions and deterministic dossier calculation.

## 2. Data Flow
1. User uploads ZIP -> `POST /projects/{id}/uploads` -> `validate_and_extract_archive` -> `setup_project_workspace` (Git baseline).
2. User starts workflow -> `POST /projects/{id}/workflows` -> Orchestrator executes:
   - Archaeologist -> `anatomy_json`
   - Historian -> `intent_json`
   - Diagnostician -> `findings` table
   - Planner -> `tasks` table
   - Resurrection -> `patches` table (`difflib.unified_diff`)
3. User reviews diff in UI -> `POST /tasks/{id}/decision` -> `execute_approved_repair`:
   - `validate_patch_in_workspace` (`git apply --check`)
   - `apply_patch_in_workspace` (`git apply` + `git commit`)
   - Guardian checks (containerized sandbox lint + tests)
   - If tests fail: `rollback_to_commit` (`git reset --hard` + `git clean -fd`)
   - If tests pass: `build_and_persist_dossier` -> Project status `REVIVED`.
