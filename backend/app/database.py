import sqlite3
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from backend.app.config import DATABASE_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DATABASE_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'CREATED',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        validation_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        status TEXT NOT NULL,
        current_stage TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error_code TEXT,
        error_message TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        status TEXT NOT NULL,
        input_artifact_id TEXT,
        output_artifact_id TEXT,
        model_provider TEXT,
        model_name TEXT,
        prompt_version TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error_message TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        evidence_status TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        recommendation TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS revival_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        phase TEXT NOT NULL,
        priority TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        status TEXT NOT NULL,
        affected_files_json TEXT NOT NULL,
        validation_plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT,
        patch_id TEXT,
        decision TEXT NOT NULL,
        decision_by TEXT,
        reason TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES revival_tasks(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS patches (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        base_revision TEXT NOT NULL,
        result_revision TEXT,
        patch_storage_key TEXT NOT NULL,
        patch_sha256 TEXT NOT NULL,
        changed_files_json TEXT NOT NULL,
        diff_text TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        applied_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES revival_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dossiers (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        original_sha256 TEXT NOT NULL,
        revived_sha256 TEXT NOT NULL,
        dossier_sha256 TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        patch_id TEXT,
        status TEXT NOT NULL,
        command TEXT NOT NULL,
        exit_code INTEGER,
        stdout_storage_key TEXT,
        stderr_storage_key TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (patch_id) REFERENCES patches(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS guardian_reviews (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        patch_id TEXT,
        status TEXT NOT NULL,
        findings_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (patch_id) REFERENCES patches(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        workflow_id TEXT,
        actor_type TEXT NOT NULL,
        actor_id TEXT,
        event_type TEXT NOT NULL,
        event_data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_uploads_project_id ON uploads(project_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_project_status ON workflows(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_workflow ON agent_runs(workflow_id, agent_name);
    CREATE INDEX IF NOT EXISTS idx_findings_project_severity ON findings(project_id, severity);
    CREATE INDEX IF NOT EXISTS idx_revival_tasks_workflow ON revival_tasks(workflow_id, status);
    CREATE INDEX IF NOT EXISTS idx_patches_project_status ON patches(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_test_runs_patch_id ON test_runs(patch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_project ON audit_events(project_id, created_at);
    """)

    # Safe incremental column migrations for existing SQLite databases
    def _ensure_column(table: str, col: str, col_type: str):
        existing = {r["name"] for r in cursor.execute(f"PRAGMA table_info({table})").fetchall()}
        if col not in existing:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")

    _ensure_column("patches", "result_revision", "TEXT")
    _ensure_column("patches", "diff_text", "TEXT")
    _ensure_column("workflows", "anatomy_json", "TEXT")
    _ensure_column("workflows", "intent_json", "TEXT")
    _ensure_column("workflows", "diagnosis_json", "TEXT")
    _ensure_column("workflows", "goals_json", "TEXT")

    conn.commit()
    conn.close()

def log_audit_event(
    project_id: str,
    event_type: str,
    event_data: Dict[str, Any],
    actor_type: str = "system",
    actor_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
):
    conn = get_connection()
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO audit_events (id, project_id, workflow_id, actor_type, actor_id, event_type, event_data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (event_id, project_id, workflow_id, actor_type, actor_id, event_type, json.dumps(event_data), now)
    )
    conn.commit()
    conn.close()
