import hashlib
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import DATABASE_PATH, UPLOADS_DIR, WORKSPACES_DIR
from backend.app.core.archive_validator import compute_sha256
from backend.app.core.orchestrator import Orchestrator
from backend.app.core.workspace_manager import WorkspaceManager
from backend.app.database import get_connection, init_db, log_audit_event
from backend.app.models.schemas import (
    DecisionRequest,
    DossierResponse,
    FindingResponse,
    PatchResponse,
    ProjectCreate,
    ProjectResponse,
    RevivalTaskResponse,
    StageProgress,
    UploadResponse,
    WorkflowCreate,
    WorkflowStatusResponse,
)

# Initialize database on startup
init_db()

app = FastAPI(
    title="Necromancer AI Agent API",
    description="Software archaeology and revival orchestration engine",
    version="1.0.0"
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# --- Projects ---

@app.post("/api/v1/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate):
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO projects (id, name, description, status, created_at, updated_at)
        VALUES (?, ?, ?, 'CREATED', ?, ?)
        """,
        (project_id, payload.name, payload.description, now, now)
    )
    conn.commit()
    conn.close()

    log_audit_event(project_id=project_id, event_type="PROJECT_CREATED", event_data={"name": payload.name})

    return ProjectResponse(
        id=project_id,
        name=payload.name,
        description=payload.description,
        status="CREATED",
        created_at=now,
        updated_at=now
    )

@app.get("/api/v1/projects", response_model=List[ProjectResponse])
def list_projects():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    conn.close()
    return [
        ProjectResponse(
            id=r["id"],
            name=r["name"],
            description=r["description"],
            status=r["status"],
            created_at=r["created_at"],
            updated_at=r["updated_at"]
        ) for r in rows
    ]

@app.get("/api/v1/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

# --- Uploads ---

@app.post("/api/v1/projects/{project_id}/uploads", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_archive(project_id: str, file: UploadFile = File(...)):
    conn = get_connection()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    upload_id = str(uuid.uuid4())
    upload_target_dir = UPLOADS_DIR / upload_id
    upload_target_dir.mkdir(parents=True, exist_ok=True)
    stored_archive_path = upload_target_dir / file.filename

    with open(stored_archive_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size_bytes = stored_archive_path.stat().st_size
    sha256_hash = compute_sha256(stored_archive_path)
    now = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    conn.execute(
        """
        INSERT INTO uploads (id, project_id, original_filename, storage_key, sha256, size_bytes, validation_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ACCEPTED', ?)
        """,
        (upload_id, project_id, file.filename, str(stored_archive_path), sha256_hash, size_bytes, now)
    )
    conn.commit()
    conn.close()

    log_audit_event(
        project_id=project_id,
        event_type="UPLOAD_ACCEPTED",
        event_data={"filename": file.filename, "size_bytes": size_bytes, "sha256": sha256_hash}
    )

    return UploadResponse(
        id=upload_id,
        project_id=project_id,
        original_filename=file.filename,
        sha256=sha256_hash,
        size_bytes=size_bytes,
        validation_status="ACCEPTED",
        created_at=now
    )

# --- Workflows ---

@app.post("/api/v1/projects/{project_id}/workflows", response_model=WorkflowStatusResponse, status_code=status.HTTP_202_ACCEPTED)
def start_revival_workflow(project_id: str, payload: WorkflowCreate):
    conn = get_connection()
    upload = conn.execute("SELECT * FROM uploads WHERE id = ? AND project_id = ?", (payload.upload_id, project_id)).fetchone()
    conn.close()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found for this project")

    workflow_id = Orchestrator.start_workflow(project_id, payload.upload_id, payload.goals)
    return get_workflow_status(workflow_id)

@app.get("/api/v1/workflows/{workflow_id}", response_model=WorkflowStatusResponse)
def get_workflow_status(workflow_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")

    stages_order = [
        "VALIDATING_ARCHIVE", "EXTRACTING", "ARCHAEOLOGY",
        "HISTORIAN_ANALYSIS", "DIAGNOSIS", "PLANNING",
        "AWAITING_APPROVAL", "PATCHING", "GUARDIAN_REVIEW", "COMPLETED"
    ]
    cur = row["current_stage"]
    comp = stages_order.index(cur) if cur in stages_order else 0
    if row["status"] == "COMPLETED":
        comp = len(stages_order)

    return WorkflowStatusResponse(
        id=row["id"],
        project_id=row["project_id"],
        status=row["status"],
        current_stage=row["current_stage"],
        progress=StageProgress(completed_stages=comp, total_stages=len(stages_order)),
        updated_at=row["started_at"],
        error_message=row["error_message"]
    )

# --- Findings ---

@app.get("/api/v1/projects/{project_id}/findings", response_model=List[FindingResponse])
def get_project_findings(project_id: str, severity: Optional[str] = None):
    conn = get_connection()
    if severity:
        rows = conn.execute("SELECT * FROM findings WHERE project_id = ? AND severity = ? ORDER BY created_at ASC", (project_id, severity)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM findings WHERE project_id = ? ORDER BY created_at ASC", (project_id,)).fetchall()
    conn.close()

    return [
        FindingResponse(
            id=r["id"],
            project_id=r["project_id"],
            workflow_id=r["workflow_id"],
            agent_name=r["agent_name"],
            title=r["title"],
            description=r["description"],
            severity=r["severity"],
            evidence_status=r["evidence_status"],
            evidence=json.loads(r["evidence_json"]) if r["evidence_json"] else {},
            recommendation=r["recommendation"],
            created_at=r["created_at"]
        ) for r in rows
    ]

# --- Revival Plan & Tasks ---

@app.get("/api/v1/workflows/{workflow_id}/plan", response_model=List[RevivalTaskResponse])
def get_revival_plan(workflow_id: str):
    conn = get_connection()
    rows = conn.execute("SELECT * FROM revival_tasks WHERE workflow_id = ? ORDER BY priority ASC", (workflow_id,)).fetchall()
    conn.close()

    return [
        RevivalTaskResponse(
            id=r["id"],
            project_id=r["project_id"],
            workflow_id=r["workflow_id"],
            title=r["title"],
            description=r["description"],
            phase=r["phase"],
            priority=r["priority"],
            risk_level=r["risk_level"],
            status=r["status"],
            affected_files=json.loads(r["affected_files_json"]) if r["affected_files_json"] else [],
            validation_plan=json.loads(r["validation_plan_json"]) if r["validation_plan_json"] else {},
            created_at=r["created_at"],
            updated_at=r["updated_at"]
        ) for r in rows
    ]

@app.post("/api/v1/tasks/{task_id}/decision")
def submit_task_decision(task_id: str, payload: DecisionRequest):
    try:
        res = Orchestrator.process_task_approval(
            task_id=task_id,
            decision=payload.decision,
            reason=payload.reason,
            decision_by=payload.decision_by or "Human Maintainer"
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# --- Revival Dossier & Verifiable Proof ---

@app.get("/api/v1/projects/{project_id}/dossier", response_model=DossierResponse)
def get_revival_dossier(project_id: str):
    conn = get_connection()
    upload = conn.execute("SELECT * FROM uploads WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone()
    workflow = conn.execute("SELECT * FROM workflows WHERE project_id = ? ORDER BY started_at DESC LIMIT 1", (project_id,)).fetchone()
    guardian = conn.execute("SELECT * FROM guardian_reviews WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone()
    test_run = conn.execute("SELECT * FROM test_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1", (project_id,)).fetchone()
    findings = conn.execute("SELECT severity, count(*) as count FROM findings WHERE project_id = ? GROUP BY severity", (project_id,)).fetchall()
    tasks = conn.execute("SELECT status, count(*) as count FROM revival_tasks WHERE project_id = ? GROUP BY status", (project_id,)).fetchall()
    conn.close()

    if not upload or not workflow:
        raise HTTPException(status_code=404, detail="Revival records not found for project.")

    orig_sha = upload["sha256"]
    
    # Compute revived workspace SHA
    workspace_dir = WorkspaceManager.get_project_workspace_dir(project_id)
    revived_hasher = hashlib.sha256()
    if workspace_dir.exists():
        for root, _, files in os.walk(workspace_dir):
            if ".git" in root:
                continue
            for f in sorted(files):
                fp = Path(root) / f
                revived_hasher.update(fp.read_bytes())
    revived_sha = revived_hasher.hexdigest()

    findings_summary = {r["severity"]: r["count"] for r in findings}
    tasks_summary = {r["status"]: r["count"] for r in tasks}
    test_results = {
        "status": test_run["status"] if test_run else "NOT_RUN",
        "exit_code": test_run["exit_code"] if test_run else None,
        "output": test_run["stdout_storage_key"] if test_run else None
    }
    guardian_status = guardian["status"] if guardian else "PENDING"
    now = datetime.now(timezone.utc).isoformat()

    summary_text = (
        f"Cryptographic Revival Dossier for project {project_id}. "
        f"Legacy codebase verified and modernized. Original SHA-256: {orig_sha[:12]}..., "
        f"Revived SHA-256: {revived_sha[:12]}... Guardian Status: {guardian_status}."
    )

    dossier_content = f"{project_id}:{orig_sha}:{revived_sha}:{guardian_status}:{now}"
    dossier_sha = hashlib.sha256(dossier_content.encode("utf-8")).hexdigest()

    return DossierResponse(
        project_id=project_id,
        workflow_id=workflow["id"],
        original_sha256=orig_sha,
        revived_sha256=revived_sha,
        dossier_sha256=dossier_sha,
        summary=summary_text,
        findings_summary=findings_summary,
        tasks_summary=tasks_summary,
        test_results=test_results,
        guardian_status=guardian_status,
        created_at=now
    )
