from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    created_at: str
    updated_at: str

class UploadResponse(BaseModel):
    id: str
    project_id: str
    original_filename: str
    sha256: str
    size_bytes: int
    validation_status: str
    created_at: str

class WorkflowCreate(BaseModel):
    upload_id: str
    goals: List[str] = Field(default_factory=lambda: ["understand", "diagnose", "repair"])

class StageProgress(BaseModel):
    completed_stages: int
    total_stages: int

class WorkflowStatusResponse(BaseModel):
    id: str
    project_id: str
    status: str
    current_stage: str
    progress: StageProgress
    updated_at: str
    error_message: Optional[str] = None

class FindingResponse(BaseModel):
    id: str
    project_id: str
    workflow_id: str
    agent_name: str
    title: str
    description: str
    severity: str  # critical, high, medium, low, info
    evidence_status: str  # verified, inferred, unknown
    evidence: Any
    recommendation: Optional[str] = None
    created_at: str

class RevivalTaskResponse(BaseModel):
    id: str
    project_id: str
    workflow_id: str
    title: str
    description: str
    phase: str
    priority: str
    risk_level: str
    status: str
    affected_files: List[str]
    validation_plan: Dict[str, Any]
    created_at: str
    updated_at: str

class DecisionRequest(BaseModel):
    decision: str  # approved, rejected
    reason: Optional[str] = None
    decision_by: Optional[str] = "Human Maintainer"

class PatchResponse(BaseModel):
    id: str
    project_id: str
    task_id: str
    base_revision: str
    patch_sha256: str
    changed_files: List[str]
    diff: str
    status: str
    created_at: str
    applied_at: Optional[str] = None

class TestRunResponse(BaseModel):
    id: str
    project_id: str
    patch_id: Optional[str]
    status: str
    command: str
    exit_code: Optional[int]
    stdout: Optional[str]
    stderr: Optional[str]
    started_at: str
    completed_at: Optional[str]

class GuardianReviewResponse(BaseModel):
    id: str
    project_id: str
    patch_id: Optional[str]
    status: str  # passed, blocked, needs_review
    findings: List[Dict[str, Any]]
    created_at: str

class DossierResponse(BaseModel):
    project_id: str
    workflow_id: str
    original_sha256: str
    revived_sha256: str
    dossier_sha256: str
    summary: str
    findings_summary: Dict[str, int]
    tasks_summary: Dict[str, int]
    test_results: Dict[str, Any]
    guardian_status: str
    created_at: str
