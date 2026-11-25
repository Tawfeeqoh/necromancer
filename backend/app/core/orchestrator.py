import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.agents.archaeologist import ArchaeologistAgent
from backend.app.agents.diagnostician import DiagnosticianAgent
from backend.app.agents.guardian import GuardianAgent
from backend.app.agents.historian import HistorianAgent
from backend.app.agents.planner import RevivalPlannerAgent
from backend.app.agents.resurrector import ResurrectionAgent
from backend.app.core.archive_validator import validate_and_extract_archive
from backend.app.core.workspace_manager import WorkspaceManager
from backend.app.database import get_connection, log_audit_event


class Orchestrator:
    VOLATILE_FILES = {"test_database.sqlite", ".DS_Store", "Thumbs.db"}

    @staticmethod
    def start_workflow(project_id: str, upload_id: str, goals: List[str]) -> str:
        workflow_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        conn = get_connection()
        conn.execute(
            """
            INSERT INTO workflows (id, project_id, status, current_stage, goals_json, started_at)
            VALUES (?, ?, 'RUNNING', 'VALIDATING_ARCHIVE', ?, ?)
            """,
            (workflow_id, project_id, json.dumps(goals), now),
        )
        conn.commit()
        conn.close()

        log_audit_event(
            project_id=project_id,
            workflow_id=workflow_id,
            event_type="WORKFLOW_STARTED",
            event_data={"upload_id": upload_id, "goals": goals},
        )

        Orchestrator.run_intake_and_analysis(project_id, workflow_id, upload_id)
        return workflow_id

    @staticmethod
    def update_stage(
        workflow_id: str,
        stage: str,
        status: str = "RUNNING",
        error_message: Optional[str] = None,
    ):
        conn = get_connection()
        conn.execute(
            """
            UPDATE workflows
            SET current_stage = ?, status = ?, error_message = ?
            WHERE id = ?
            """,
            (stage, status, error_message, workflow_id),
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
            validate_and_extract_archive(archive_path, extracted_dir)

            Orchestrator.update_stage(workflow_id, "EXTRACTING")
            entries = list(extracted_dir.iterdir())
            content_root = entries[0] if (len(entries) == 1 and entries[0].is_dir()) else extracted_dir

            # 2. Archaeology Stage
            Orchestrator.update_stage(workflow_id, "ARCHAEOLOGY")
            anatomy = ArchaeologistAgent.inspect(content_root)

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
                        f.get("recommendation"), now,
                    ),
                )
            conn.execute(
                "UPDATE workflows SET anatomy_json = ? WHERE id = ?",
                (json.dumps(anatomy), workflow_id),
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
                        f.get("recommendation"), now,
                    ),
                )
            conn.execute(
                "UPDATE workflows SET intent_json = ? WHERE id = ?",
                (json.dumps(intent), workflow_id),
            )
            conn.commit()
            conn.close()

            # 4. Diagnosis Stage
            Orchestrator.update_stage(workflow_id, "DIAGNOSIS")
            diagnosis = DiagnosticianAgent.diagnose(anatomy, intent)
            conn = get_connection()
            conn.execute(
                "UPDATE workflows SET diagnosis_json = ? WHERE id = ?",
                (json.dumps(diagnosis), workflow_id),
            )
            conn.commit()
            conn.close()

            # 5. Planning Stage
            Orchestrator.update_stage(workflow_id, "PLANNING")
            plan = RevivalPlannerAgent.plan(diagnosis)

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
                        now, now,
                    ),
                )
            conn.commit()
            conn.close()

            # 6. Set up isolated Git workspace and pre-generate candidate patch for Task #1
            WorkspaceManager.setup_project_workspace(project_id, upload_id)
            workspace_dir = WorkspaceManager.get_project_workspace_dir(project_id)
            base_revision = WorkspaceManager.get_head_commit(project_id)

            if plan.get("tasks"):
                first_task = plan["tasks"][0]
                candidate_patch = ResurrectionAgent.generate_patch(workspace_dir, first_task, base_revision)
                conn = get_connection()
                conn.execute(
                    """
                    INSERT INTO patches (id, project_id, task_id, base_revision, patch_storage_key, patch_sha256, changed_files_json, diff_text, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)
                    """,
                    (
                        candidate_patch["id"], project_id, first_task["id"],
                        candidate_patch["base_revision"], "inline",
                        candidate_patch["patch_sha256"], json.dumps(candidate_patch["changed_files"]),
                        candidate_patch["diff"], now,
                    ),
                )
                conn.commit()
                conn.close()

            Orchestrator.update_stage(workflow_id, "AWAITING_APPROVAL", status="WAITING_APPROVAL")
            log_audit_event(
                project_id=project_id,
                workflow_id=workflow_id,
                event_type="STAGE_COMPLETED",
                event_data={"stage": "PLANNING", "next_stage": "AWAITING_APPROVAL"},
            )

        except Exception as e:
            Orchestrator.update_stage(workflow_id, "FAILED", status="FAILED", error_message=str(e))
            log_audit_event(
                project_id=project_id,
                workflow_id=workflow_id,
                event_type="WORKFLOW_ERROR",
                event_data={"error": str(e)},
            )

    @staticmethod
    def process_task_approval(
        task_id: str,
        decision: str,
        reason: Optional[str],
        decision_by: str = "Human Maintainer",
    ) -> Dict[str, Any]:
        conn = get_connection()
        task_row = conn.execute("SELECT * FROM revival_tasks WHERE id = ?", (task_id,)).fetchone()
        if not task_row:
            conn.close()
            raise ValueError("Task not found.")

        project_id = task_row["project_id"]
        now = datetime.now(timezone.utc).isoformat()

        approval_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO approvals (id, project_id, task_id, decision, decision_by, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (approval_id, project_id, task_id, decision, decision_by, reason, now),
        )

        if decision == "approved":
            conn.execute("UPDATE revival_tasks SET status = 'approved', updated_at = ? WHERE id = ?", (now, task_id))
            conn.commit()
            conn.close()
            return Orchestrator.execute_approved_repair(task_row)
        else:
            conn.execute("UPDATE revival_tasks SET status = 'rejected', updated_at = ? WHERE id = ?", (now, task_id))
            conn.commit()
            conn.close()
            return {"status": "rejected", "task_id": task_id}

    @staticmethod
    def execute_approved_repair(task_row: Any, custom_patch: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        project_id = task_row["project_id"]
        workflow_id = task_row["workflow_id"]
        workspace_dir = WorkspaceManager.get_project_workspace_dir(project_id)
        base_revision = WorkspaceManager.get_head_commit(project_id)

        Orchestrator.update_stage(workflow_id, "PATCHING", status="RUNNING")
        task_dict = dict(task_row)

        # Reuse proposed patch if available unless custom_patch is supplied
        conn = get_connection()
        now = datetime.now(timezone.utc).isoformat()
        patch: Dict[str, Any]
        if custom_patch is not None:
            patch = custom_patch
            conn.execute(
                """
                INSERT OR REPLACE INTO patches (id, project_id, task_id, base_revision, patch_storage_key, patch_sha256, changed_files_json, diff_text, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)
                """,
                (
                    patch["id"], project_id, task_dict["id"],
                    patch["base_revision"], "inline",
                    patch["patch_sha256"], json.dumps(patch["changed_files"]),
                    patch["diff"], now,
                ),
            )
            conn.commit()
        else:
            existing_patch = conn.execute(
                "SELECT * FROM patches WHERE task_id = ? AND status = 'proposed' ORDER BY created_at DESC LIMIT 1",
                (task_dict["id"],),
            ).fetchone()
            if existing_patch and existing_patch["diff_text"]:
                patch = {
                    "id": existing_patch["id"],
                    "task_id": existing_patch["task_id"],
                    "base_revision": existing_patch["base_revision"],
                    "patch_sha256": existing_patch["patch_sha256"],
                    "changed_files": json.loads(existing_patch["changed_files_json"]),
                    "diff": existing_patch["diff_text"],
                    "status": existing_patch["status"],
                    "created_at": existing_patch["created_at"],
                }
            else:
                patch = ResurrectionAgent.generate_patch(workspace_dir, task_dict, base_revision)
                conn.execute(
                    """
                    INSERT INTO patches (id, project_id, task_id, base_revision, patch_storage_key, patch_sha256, changed_files_json, diff_text, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)
                    """,
                    (
                        patch["id"], project_id, task_dict["id"],
                        patch["base_revision"], "inline",
                        patch["patch_sha256"], json.dumps(patch["changed_files"]),
                        patch["diff"], now,
                    ),
                )
                conn.commit()

        # Apply patch atomically with git apply --check; NEVER overwrite files directly
        applied, result_revision, apply_err = WorkspaceManager.apply_patch_in_workspace(
            project_id, patch["diff"]
        )

        if not applied:
            conn.execute(
                "UPDATE patches SET status = 'failed' WHERE id = ?",
                (patch["id"],),
            )
            conn.execute(
                "UPDATE workflows SET current_stage = 'FAILED', status = 'FAILED', error_message = ? WHERE id = ?",
                (f"Patch application failed: {apply_err}", workflow_id),
            )
            conn.commit()
            conn.close()
            log_audit_event(
                project_id=project_id,
                workflow_id=workflow_id,
                event_type="PATCH_FAILED",
                event_data={"patch_id": patch["id"], "error": apply_err},
            )
            return {
                "patch": {**patch, "status": "failed", "result_revision": None},
                "guardian": None,
                "status": "patch_failed",
                "error": apply_err,
            }

        conn.execute(
            "UPDATE patches SET status = 'applied', result_revision = ?, applied_at = ? WHERE id = ?",
            (result_revision, now, patch["id"]),
        )
        conn.execute(
            "UPDATE workflows SET current_stage = 'GUARDIAN_REVIEW', status = 'RUNNING' WHERE id = ?",
            (workflow_id,),
        )
        conn.commit()

        # Run Guardian evaluation
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
                now,
            ),
        )

        test_run_id = str(uuid.uuid4())
        test_info = guardian_result["test_run"]
        conn.execute(
            """
            INSERT INTO test_runs (id, project_id, patch_id, status, command, exit_code, stdout_storage_key, started_at, completed_at)
            VALUES (?, ?, ?, ?, 'php test_runner.php', ?, ?, ?, ?)
            """,
            (
                test_run_id, project_id, patch["id"],
                test_info["status"],
                test_info["exit_code"],
                test_info["output"],
                now, now,
            ),
        )

        final_status: str
        if guardian_result["status"] == "passed":
            final_status = "completed"
            conn.execute(
                "UPDATE workflows SET current_stage = 'COMPLETED', status = 'COMPLETED', completed_at = ? WHERE id = ?",
                (now, workflow_id),
            )
            conn.execute("UPDATE projects SET status = 'REVIVED', updated_at = ? WHERE id = ?", (now, project_id))
            conn.execute("UPDATE revival_tasks SET status = 'completed', updated_at = ? WHERE id = ?", (now, task_dict["id"]))
        elif guardian_result["status"] == "needs_review":
            final_status = "needs_review"
            conn.execute(
                "UPDATE workflows SET current_stage = 'GUARDIAN_REVIEW', status = 'NEEDS_REVIEW', error_message = ? WHERE id = ?",
                ("Container sandbox unavailable; runtime tests disabled on host.", workflow_id),
            )
            conn.execute("UPDATE projects SET status = 'NEEDS_REVIEW', updated_at = ? WHERE id = ?", (now, project_id))
        else:
            final_status = "blocked"
            WorkspaceManager.rollback_to_commit(project_id, base_revision)
            conn.execute("UPDATE patches SET status = 'rolled_back' WHERE id = ?", (patch["id"],))
            conn.execute(
                "UPDATE workflows SET current_stage = 'BLOCKED', status = 'BLOCKED', error_message = ? WHERE id = ?",
                ("Guardian blocked patch and rolled back workspace.", workflow_id),
            )
            conn.execute("UPDATE projects SET status = 'BLOCKED', updated_at = ? WHERE id = ?", (now, project_id))

        conn.commit()
        conn.close()

        log_audit_event(
            project_id=project_id,
            workflow_id=workflow_id,
            event_type="GUARDIAN_EVALUATED",
            event_data={
                "patch_id": patch["id"],
                "base_revision": base_revision,
                "result_revision": result_revision,
                "guardian_status": guardian_result["status"],
            },
        )

        return {
            "patch": {**patch, "result_revision": result_revision, "status": "rolled_back" if final_status == "blocked" else "applied"},
            "guardian": guardian_result,
            "status": final_status,
        }

    @classmethod
    def compute_workspace_source_sha256(cls, project_id: str) -> str:
        """
        Deterministically hashes source files in the project workspace,
        excluding .git metadata and volatile test artifacts.
        """
        workspace_dir = WorkspaceManager.get_project_workspace_dir(project_id)
        hasher = hashlib.sha256()
        if not workspace_dir.exists():
            return hasher.hexdigest()

        rel_paths: List[Path] = []
        for root, dirs, files in os.walk(workspace_dir):
            dirs[:] = sorted(d for d in dirs if d != ".git")
            for f in sorted(files):
                if f in cls.VOLATILE_FILES or f.endswith(".sqlite") or f.endswith(".log"):
                    continue
                fp = Path(root) / f
                rel_paths.append(fp)

        for fp in sorted(rel_paths, key=lambda p: str(p.relative_to(workspace_dir)).replace("\\", "/")):
            rel = str(fp.relative_to(workspace_dir)).replace("\\", "/")
            hasher.update(rel.encode("utf-8"))
            hasher.update(b"\x00")
            hasher.update(fp.read_bytes().replace(b"\r\n", b"\n"))
            hasher.update(b"\x00")

        return hasher.hexdigest()

    @classmethod
    def build_and_persist_dossier(cls, project_id: str) -> Dict[str, Any]:
        conn = get_connection()
        upload = conn.execute("SELECT * FROM uploads WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone()
        workflow = conn.execute("SELECT * FROM workflows WHERE project_id = ? ORDER BY started_at DESC LIMIT 1", (project_id,)).fetchone()
        guardian = conn.execute("SELECT * FROM guardian_reviews WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,)).fetchone()
        test_run = conn.execute("SELECT * FROM test_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1", (project_id,)).fetchone()
        findings = conn.execute("SELECT severity, count(*) as count FROM findings WHERE project_id = ? GROUP BY severity", (project_id,)).fetchall()
        tasks = conn.execute("SELECT status, count(*) as count FROM revival_tasks WHERE project_id = ? GROUP BY status", (project_id,)).fetchall()

        if not upload or not workflow:
            conn.close()
            raise ValueError("Revival records not found for project.")

        orig_sha = upload["sha256"]
        revived_sha = cls.compute_workspace_source_sha256(project_id)

        findings_summary = {r["severity"]: r["count"] for r in findings}
        tasks_summary = {r["status"]: r["count"] for r in tasks}
        test_results = {
            "status": test_run["status"] if test_run else "NOT_RUN",
            "exit_code": test_run["exit_code"] if test_run else None,
            "output": test_run["stdout_storage_key"] if test_run else None,
        }
        guardian_status = guardian["status"] if guardian else "PENDING"

        # Deterministic canonical payload (excludes volatile timestamp)
        canonical_payload = {
            "project_id": project_id,
            "workflow_id": workflow["id"],
            "original_sha256": orig_sha,
            "revived_sha256": revived_sha,
            "findings_summary": findings_summary,
            "tasks_summary": tasks_summary,
            "test_results": test_results,
            "guardian_status": guardian_status,
        }
        canonical_json = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":"))
        dossier_sha = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

        # Check if an identical dossier hash is already persisted
        existing = conn.execute(
            "SELECT * FROM dossiers WHERE project_id = ? AND dossier_sha256 = ? ORDER BY created_at DESC LIMIT 1",
            (project_id, dossier_sha),
        ).fetchone()

        if existing:
            created_at = existing["created_at"]
        else:
            created_at = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO dossiers (id, project_id, workflow_id, original_sha256, revived_sha256, dossier_sha256, payload_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), project_id, workflow["id"], orig_sha, revived_sha, dossier_sha, canonical_json, created_at),
            )
            conn.commit()

        conn.close()

        summary_text = (
            f"Cryptographic Revival Dossier for project {project_id}. "
            f"Original SHA-256: {orig_sha[:12]}..., "
            f"Revived SHA-256: {revived_sha[:12]}... Guardian Status: {guardian_status}."
        )

        return {
            **canonical_payload,
            "dossier_sha256": dossier_sha,
            "summary": summary_text,
            "created_at": created_at,
        }
