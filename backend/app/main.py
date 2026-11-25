import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse

from backend.app.config import CORS_ORIGINS, MAX_UPLOAD_SIZE_BYTES, UPLOADS_DIR
from backend.app.core.archive_validator import compute_sha256
from backend.app.core.orchestrator import Orchestrator
from backend.app.core.sandbox import SandboxRunner
from backend.app.core.workspace_manager import WorkspaceManager
from backend.app.database import get_connection, init_db, log_audit_event
from backend.app.models.schemas import (
    DecisionRequest,
    DossierResponse,
    FindingResponse,
    ProjectCreate,
    ProjectResponse,
    RevivalTaskResponse,
    StageProgress,
    UploadResponse,
    WorkflowCreate,
    WorkflowStatusResponse,
)

init_db()

app = FastAPI(
    title="Necromancer AI Agent API",
    description="Software archaeology and revival orchestration engine",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/api/v1/health")
def health_check():
    sandbox_ok, sandbox_reason = SandboxRunner.is_container_available(timeout_sec=1.5)
    return {
        "status": "healthy",
        "sandbox_available": sandbox_ok,
        "sandbox_note": sandbox_reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


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
        (project_id, payload.name, payload.description, now, now),
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
        updated_at=now,
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
            updated_at=r["updated_at"],
        )
        for r in rows
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
        updated_at=row["updated_at"],
    )


# --- Uploads (Streaming size enforcement) ---

@app.post("/api/v1/projects/{project_id}/uploads", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_archive(project_id: str, file: UploadFile = File(...)):
    conn = get_connection()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    safe_filename = Path(file.filename or "upload.zip").name
    if not safe_filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip archives are accepted.")

    upload_id = str(uuid.uuid4())
    upload_target_dir = UPLOADS_DIR / upload_id
    upload_target_dir.mkdir(parents=True, exist_ok=True)
    stored_archive_path = upload_target_dir / safe_filename

    total_written = 0
    try:
        with open(stored_archive_path, "wb") as buffer:
            while chunk := await file.read(65536):
                total_written += len(chunk)
                if total_written > MAX_UPLOAD_SIZE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Upload exceeds maximum allowed size of {MAX_UPLOAD_SIZE_BYTES} bytes.",
                    )
                buffer.write(chunk)
    except HTTPException:
        if stored_archive_path.exists():
            stored_archive_path.unlink()
        raise

    sha256_hash = compute_sha256(stored_archive_path)
    now = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    conn.execute(
        """
        INSERT INTO uploads (id, project_id, original_filename, storage_key, sha256, size_bytes, validation_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ACCEPTED', ?)
        """,
        (upload_id, project_id, safe_filename, str(stored_archive_path), sha256_hash, total_written, now),
    )
    conn.commit()
    conn.close()

    log_audit_event(
        project_id=project_id,
        event_type="UPLOAD_ACCEPTED",
        event_data={"filename": safe_filename, "size_bytes": total_written, "sha256": sha256_hash},
    )

    return UploadResponse(
        id=upload_id,
        project_id=project_id,
        original_filename=safe_filename,
        sha256=sha256_hash,
        size_bytes=total_written,
        validation_status="ACCEPTED",
        created_at=now,
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
        "AWAITING_APPROVAL", "PATCHING", "GUARDIAN_REVIEW", "COMPLETED",
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
        error_message=row["error_message"],
    )


@app.get("/api/v1/projects/{project_id}/workspace")
def get_project_workspace(project_id: str) -> Dict[str, Any]:
    """Returns full live workspace state: latest workflow, anatomy, intent, diagnosis, tasks, patches, tests, guardian."""
    conn = get_connection()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")

    upload = conn.execute("SELECT * FROM uploads WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone()
    wf = conn.execute("SELECT * FROM workflows WHERE project_id = ? ORDER BY started_at DESC LIMIT 1", (project_id,)).fetchone()

    tasks: List[Dict[str, Any]] = []
    patches: List[Dict[str, Any]] = []
    test_runs: List[Dict[str, Any]] = []
    guardian_reviews: List[Dict[str, Any]] = []

    if wf:
        task_rows = conn.execute("SELECT * FROM revival_tasks WHERE workflow_id = ? ORDER BY priority ASC", (wf["id"],)).fetchall()
        tasks = [
            {
                "id": r["id"],
                "project_id": r["project_id"],
                "workflow_id": r["workflow_id"],
                "title": r["title"],
                "description": r["description"],
                "phase": r["phase"],
                "priority": r["priority"],
                "risk_level": r["risk_level"],
                "status": r["status"],
                "affected_files": json.loads(r["affected_files_json"]) if r["affected_files_json"] else [],
                "validation_plan": json.loads(r["validation_plan_json"]) if r["validation_plan_json"] else {},
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in task_rows
        ]

    patch_rows = conn.execute("SELECT * FROM patches WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
    patches = [
        {
            "id": r["id"],
            "task_id": r["task_id"],
            "base_revision": r["base_revision"],
            "result_revision": r["result_revision"],
            "patch_sha256": r["patch_sha256"],
            "changed_files": json.loads(r["changed_files_json"]) if r["changed_files_json"] else [],
            "diff": r["diff_text"] or "",
            "status": r["status"],
            "created_at": r["created_at"],
            "applied_at": r["applied_at"],
        }
        for r in patch_rows
    ]

    test_rows = conn.execute("SELECT * FROM test_runs WHERE project_id = ? ORDER BY started_at DESC", (project_id,)).fetchall()
    test_runs = [
        {
            "id": r["id"],
            "patch_id": r["patch_id"],
            "status": r["status"],
            "command": r["command"],
            "exit_code": r["exit_code"],
            "output": r["stdout_storage_key"],
            "started_at": r["started_at"],
            "completed_at": r["completed_at"],
        }
        for r in test_rows
    ]

    guardian_rows = conn.execute("SELECT * FROM guardian_reviews WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
    guardian_reviews = [
        {
            "id": r["id"],
            "patch_id": r["patch_id"],
            "status": r["status"],
            "findings": json.loads(r["findings_json"]) if r["findings_json"] else [],
            "created_at": r["created_at"],
        }
        for r in guardian_rows
    ]

    conn.close()

    return {
        "project": dict(project),
        "upload": dict(upload) if upload else None,
        "workflow": {
            "id": wf["id"],
            "status": wf["status"],
            "current_stage": wf["current_stage"],
            "goals": json.loads(wf["goals_json"]) if wf["goals_json"] else [],
            "started_at": wf["started_at"],
            "completed_at": wf["completed_at"],
            "error_message": wf["error_message"],
        } if wf else None,
        "anatomy": json.loads(wf["anatomy_json"]) if (wf and wf["anatomy_json"]) else None,
        "intent": json.loads(wf["intent_json"]) if (wf and wf["intent_json"]) else None,
        "diagnosis": json.loads(wf["diagnosis_json"]) if (wf and wf["diagnosis_json"]) else None,
        "tasks": tasks,
        "patches": patches,
        "test_runs": test_runs,
        "guardian_reviews": guardian_reviews,
    }


# --- Findings ---

@app.get("/api/v1/projects/{project_id}/findings", response_model=List[FindingResponse])
def get_project_findings(project_id: str, severity: Optional[str] = None):
    conn = get_connection()
    if severity:
        rows = conn.execute(
            "SELECT * FROM findings WHERE project_id = ? AND severity = ? ORDER BY created_at ASC",
            (project_id, severity),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM findings WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,),
        ).fetchall()
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
            created_at=r["created_at"],
        )
        for r in rows
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
            updated_at=r["updated_at"],
        )
        for r in rows
    ]


@app.post("/api/v1/tasks/{task_id}/decision")
def submit_task_decision(task_id: str, payload: DecisionRequest):
    if payload.decision not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'.")
    try:
        res = Orchestrator.process_task_approval(
            task_id=task_id,
            decision=payload.decision,
            reason=payload.reason,
            decision_by=payload.decision_by or "Human Maintainer",
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/v1/projects/{project_id}/rollback")
def rollback_project(project_id: str):
    conn = get_connection()
    patch = conn.execute(
        "SELECT * FROM patches WHERE project_id = ? AND status = 'applied' ORDER BY applied_at DESC LIMIT 1",
        (project_id,),
    ).fetchone()
    if not patch:
        conn.close()
        raise HTTPException(status_code=404, detail="No applied patch found to roll back.")

    ok = WorkspaceManager.rollback_to_commit(project_id, patch["base_revision"])
    if not ok:
        conn.close()
        raise HTTPException(status_code=500, detail="Git rollback failed.")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute("UPDATE patches SET status = 'rolled_back' WHERE id = ?", (patch["id"],))
    conn.execute("UPDATE projects SET status = 'ROLLED_BACK', updated_at = ? WHERE id = ?", (now, project_id))
    conn.commit()
    conn.close()

    log_audit_event(
        project_id=project_id,
        event_type="MANUAL_ROLLBACK",
        event_data={"patch_id": patch["id"], "restored_commit": patch["base_revision"]},
    )
    return {"status": "rolled_back", "restored_commit": patch["base_revision"]}


# --- Revival Dossier & Verifiable Proof ---

@app.get("/api/v1/projects/{project_id}/dossier", response_model=DossierResponse)
def get_revival_dossier(project_id: str):
    try:
        dossier = Orchestrator.build_and_persist_dossier(project_id)
        return DossierResponse(**dossier)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/v1/projects/{project_id}/dossier/download")
def download_revival_dossier(
    project_id: str,
    format: str = Query("json", pattern="^(json|markdown)$"),
):
    try:
        dossier = Orchestrator.build_and_persist_dossier(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if format == "json":
        return JSONResponse(
            content=dossier,
            headers={"Content-Disposition": f'attachment; filename="necromancer_dossier_{project_id[:8]}.json"'},
        )

    md = (
        f"# Necromancer Revival Dossier\n\n"
        f"- **Project ID:** `{dossier['project_id']}`\n"
        f"- **Workflow ID:** `{dossier['workflow_id']}`\n"
        f"- **Created At:** `{dossier['created_at']}`\n"
        f"- **Guardian Verdict:** `{dossier['guardian_status']}`\n\n"
        f"## Cryptographic Integrity Hashes (SHA-256)\n"
        f"- **Original Archive:** `{dossier['original_sha256']}`\n"
        f"- **Revived Workspace:** `{dossier['revived_sha256']}`\n"
        f"- **Dossier Root Seal:** `{dossier['dossier_sha256']}`\n\n"
        f"## Summary\n{dossier['summary']}\n\n"
        f"## Findings Breakdown\n```json\n{json.dumps(dossier['findings_summary'], indent=2)}\n```\n\n"
        f"## Test Results\n```json\n{json.dumps(dossier['test_results'], indent=2)}\n```\n"
    )
    return PlainTextResponse(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="necromancer_dossier_{project_id[:8]}.md"'},
    )
