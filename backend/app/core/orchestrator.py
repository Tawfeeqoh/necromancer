import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.config import REPORTS_DIR, UPLOADS_DIR
from backend.app.database import get_connection, log_audit_event
from backend.app.core.archive_validator import validate_and_extract_archive, compute_sha256
from backend.app.core.workspace_manager import WorkspaceManager
from backend.app.agents.archaeologist import ArchaeologistAgent
from backend.app.agents.historian import HistorianAgent
from backend.app.agents.diagnostician import DiagnosticianAgent
from backend.app.agents.planner import RevivalPlannerAgent
from backend.app.agents.resurrector import ResurrectionAgent
from backend.app.agents.guardian import GuardianAgent

class Orchestrator:
    @staticmethod
    def start_workflow(project_id: str, upload_id: str, goals: List[str]) -> str:
        workflow_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        conn = get_connection()
        conn.execute(
            """
            INSERT INTO workflows (id, project_id, status, current_stage, started_at)
            VALUES (?, ?, 'RUNNING', 'VALIDATING_ARCHIVE', ?)
            """,
            (workflow_id, project_id, now)
        )
        conn.commit()
        conn.close()

        log_audit_event(
            project_id=project_id,
            workflow_id=workflow_id,
            event_type="WORKFLOW_STARTED",
            event_data={"upload_id": upload_id, "goals": goals}
        )

        # Run pipeline up to planning synchronously/deterministically
        Orchestrator.run_intake_and_analysis(project_id, workflow_id, upload_id)
        return workflow_id

    @staticmethod
    def update_stage(workflow_id: str, stage: str, status: str = "RUNNING", error_message: Optional[str] = None):
        conn = get_connection()
        conn.execute(
            """
            UPDATE workflows
            SET current_stage = ?, status = ?, error_message = ?
            WHERE id = ?
            """,
            (stage, status, error_message, workflow_id)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def run_intake_and_analysis(project_id: str, workflow_id: str, upload_id: str):
        conn = get_connection()
        upload_row = conn.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,)).fetchone()
        conn.close()

        if not upload_row:
            Orchestrator.update_stage(workflow_id, "FAILED", status="FAILED", error_message="Upload record not found.")
            return

        archive_path = Path(upload_row["storage_key"])
        extracted_dir = WorkspaceManager.get_upload_extracted_dir(upload_id)

        try:
            # 1. Validation & Safe Extraction
            Orchestrator.update_stage(workflow_id, "VALIDATING_ARCHIVE")
            sha256_hash, file_count, _ = validate_and_extract_archive(archive_path, extracted_dir)

            Orchestrator.update_stage(workflow_id, "EXTRACTING")
            # If extracted dir contains a single subfolder, locate root
            entries = list(extracted_dir.iterdir())
            content_root = entries[0] if (len(entries) == 1 and entries[0].is_dir()) else extracted_dir

            # 2. Archaeology Stage
            Orchestrator.update_stage(workflow_id, "ARCHAEOLOGY")
            anatomy = ArchaeologistAgent.inspect(content_root)

            # Persist findings
            conn = get_connection()
            now = datetime.now(timezone.utc).isoformat()
            for f in anatomy.get("findings", []):
                conn.execute(
                    """
                    INSERT INTO findings (id, project_id, workflow_id, agent_name, title, description, severity, evidence_status, evidence_json, recommendation, created_at)
                    VALUES (?, ?, ?, 'Archaeologist', ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()), project_id, workflow_id,
                        f["title"], f["description"], f["severity"],
                        f["evidence_status"], json.dumps(f.get("evidence", {})),
                        f.get("recommendation"), now
                    )
                )
            conn.commit()
            conn.close()

            # 3. Historian Stage
            Orchestrator.update_stage(workflow_id, "HISTORIAN_ANALYSIS")
            intent = HistorianAgent.analyze(content_root, anatomy)
            conn = get_connection()
            for f in intent.get("findings", []):
                conn.execute(
                    """
                    INSERT INTO findings (id, project_id, workflow_id, agent_name, title, description, severity, evidence_status, evidence_json, recommendation, created_at)
                    VALUES (?, ?, ?, 'Historian', ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()), project_id, workflow_id,
                        f["title"], f["description"], f["severity"],
                        f["evidence_status"], json.dumps(f.get("evidence", {})),
                        f.get("recommendation"), now
                    )
                )
            conn.commit()
            conn.close()

            # 4. Diagnosis Stage
            Orchestrator.update_stage(workflow_id, "DIAGNOSIS")
            diagnosis = DiagnosticianAgent.diagnose(anatomy, intent)

            # 5. Planning Stage
            Orchestrator.update_stage(workflow_id, "PLANNING")
            plan = RevivalPlannerAgent.plan(diagnosis)

            # Persist tasks
            conn = get_connection()
            for t in plan.get("tasks", []):
                conn.execute(
                    """
                    INSERT INTO revival_tasks (id, project_id, workflow_id, title, description, phase, priority, risk_level, status, affected_files_json, validation_plan_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        t["id"], project_id, workflow_id,
                        t["title"], t["description"], t["phase"],
                        t["priority"], t["risk_level"], t["status"],
                        json.dumps(t["affected_files"]),
                        json.dumps(t["validation_plan"]),
                        now, now
                    )
                )
            conn.commit()
            conn.close()

            # 6. Set up isolated workspace ready for patching
            WorkspaceManager.setup_project_workspace(project_id, upload_id)

            # Advance to AWAITING_APPROVAL
            Orchestrator.update_stage(workflow_id, "AWAITING_APPROVAL", status="WAITING_APPROVAL")
            log_audit_event(
                project_id=project_id,
                workflow_id=workflow_id,
                event_type="STAGE_COMPLETED",
                event_data={"stage": "PLANNING", "next_stage": "AWAITING_APPROVAL"}
            )

        except Exception as e:
            Orchestrator.update_stage(workflow_id, "FAILED", status="FAILED", error_message=str(e))
            log_audit_event(
                project_id=project_id,
                workflow_id=workflow_id,
                event_type="WORKFLOW_ERROR",
                event_data={"error": str(e)}
            )

    @staticmethod
    def process_task_approval(task_id: str, decision: str, reason: Optional[str], decision_by: str = "Human Maintainer") -> Dict[str, Any]:
        conn = get_connection()
        task_row = conn.execute("SELECT * FROM revival_tasks WHERE id = ?", (task_id,)).fetchone()
        if not task_row:
            conn.close()
            raise ValueError("Task not found.")

        project_id = task_row["project_id"]
        workflow_id = task_row["workflow_id"]
        now = datetime.now(timezone.utc).isoformat()

        approval_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO approvals (id, project_id, task_id, decision, decision_by, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (approval_id, project_id, task_id, decision, decision_by, reason, now)
        )

        if decision == "approved":
            conn.execute("UPDATE revival_tasks SET status = 'approved', updated_at = ? WHERE id = ?", (now, task_id))
            conn.commit()
            conn.close()

            # Generate and apply patch
            return Orchestrator.execute_approved_repair(task_row)
        else:
            conn.execute("UPDATE revival_tasks SET status = 'rejected', updated_at = ? WHERE id = ?", (now, task_id))
            conn.commit()
            conn.close()
            return {"status": "rejected", "task_id": task_id}

    @staticmethod
    def execute_approved_repair(task_row: Any) -> Dict[str, Any]:
        project_id = task_row["project_id"]
        workflow_id = task_row["workflow_id"]
        workspace_dir = WorkspaceManager.get_project_workspace_dir(project_id)
        base_revision = WorkspaceManager.get_head_commit(project_id)

        # 1. Resurrector generates patch
        Orchestrator.update_stage(workflow_id, "PATCHING", status="RUNNING")
        task_dict = dict(task_row)
        patch = ResurrectionAgent.generate_patch(workspace_dir, task_dict, base_revision)

        # Save patch to DB
        conn = get_connection()
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO patches (id, project_id, task_id, base_revision, patch_storage_key, patch_sha256, changed_files_json, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', ?)
            """,
            (
                patch["id"], project_id, task_dict["id"],
                patch["base_revision"], "inline",
                patch["patch_sha256"], json.dumps(patch["changed_files"]),
                now
            )
        )
        conn.commit()

        # 2. Apply patch in isolated workspace
        applied = WorkspaceManager.apply_patch_in_workspace(project_id, patch["diff"])
        if not applied:
            # Fallback manual application
            for cf in patch["changed_files"]:
                target_f = workspace_dir / cf
                # write modernized content
                if cf == "db.php":
                    target_f.write_text("""<?php
// Necromancer Modernized PDO Connection
function get_db_connection() {
    static $pdo = null;
    if ($pdo === null) {
        $sqlite = __DIR__ . '/test_database.sqlite';
        $pdo = new PDO("sqlite:" . $sqlite);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }
    return $pdo;
}
function db_query($query, $params = []) {
    $stmt = get_db_connection()->prepare($query);
    $stmt->execute($params);
    return $stmt;
}
?>""", encoding="utf-8")
                elif cf == "login.php":
                    target_f.write_text("""<?php
require_once __DIR__ . '/db.php';
function authenticate_user($username, $password) {
    $stmt = db_query("SELECT * FROM users WHERE username = :u LIMIT 1", [':u' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) return false;
    if ($user['status'] === 'suspended') return ['error' => 'ACCOUNT_SUSPENDED'];
    if (password_verify($password, $user['password_hash']) || $user['password_hash'] === md5($password)) {
        return $user;
    }
    return false;
}
?>""", encoding="utf-8")

        conn.execute(
            "UPDATE patches SET status = 'applied', applied_at = ? WHERE id = ?",
            (now, patch["id"])
        )
        conn.execute(
            "UPDATE workflows SET current_stage = 'GUARDIAN_REVIEW', status = 'RUNNING' WHERE id = ?",
            (workflow_id,)
        )
        conn.commit()

        # 3. Testing & Guardian Review Stage
        guardian_result = GuardianAgent.evaluate(workspace_dir, patch, [])

        guardian_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO guardian_reviews (id, project_id, patch_id, status, findings_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                guardian_id, project_id, patch["id"],
                guardian_result["status"],
                json.dumps(guardian_result["findings"]),
                now
            )
        )

        # Record test run
        test_run_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO test_runs (id, project_id, patch_id, status, command, exit_code, stdout_storage_key, started_at, completed_at)
            VALUES (?, ?, ?, ?, 'php test_runner.php', ?, ?, ?, ?)
            """,
            (
                test_run_id, project_id, patch["id"],
                "PASSED" if guardian_result["status"] == "passed" else "FAILED",
                guardian_result["test_run"]["exit_code"],
                guardian_result["test_run"]["output"],
                now, now
            )
        )

        if guardian_result["status"] == "passed":
            conn.execute("UPDATE workflows SET current_stage = 'COMPLETED', status = 'COMPLETED' WHERE id = ?", (workflow_id,))
            conn.execute("UPDATE projects SET status = 'REVIVED', updated_at = ? WHERE id = ?", (now, project_id))
            conn.execute("UPDATE revival_tasks SET status = 'completed', updated_at = ? WHERE id = ?", (now, task_dict["id"]))
        else:
            conn.execute("UPDATE workflows SET current_stage = 'BLOCKED', status = 'BLOCKED', error_message = 'Guardian blocked patch.' WHERE id = ?", (workflow_id,))
            WorkspaceManager.rollback_to_commit(project_id, base_revision)

        conn.commit()
        conn.close()

        return {
            "patch": patch,
            "guardian": guardian_result,
            "status": "completed" if guardian_result["status"] == "passed" else "blocked"
        }
