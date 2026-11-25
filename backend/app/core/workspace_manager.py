import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Optional
from backend.app.config import WORKSPACES_DIR, UPLOADS_DIR

class WorkspaceManager:
    @staticmethod
    def get_upload_extracted_dir(upload_id: str) -> Path:
        return UPLOADS_DIR / upload_id / "extracted"

    @staticmethod
    def get_project_workspace_dir(project_id: str) -> Path:
        return WORKSPACES_DIR / project_id

    @classmethod
    def setup_project_workspace(cls, project_id: str, upload_id: str) -> Path:
        source_dir = cls.get_upload_extracted_dir(upload_id)
        if not source_dir.exists():
            raise FileNotFoundError(f"Source directory for upload {upload_id} not found.")

        workspace_dir = cls.get_project_workspace_dir(project_id)
        if workspace_dir.exists():
            shutil.rmtree(workspace_dir, ignore_errors=True)
        
        # If source_dir contains a single root folder, find the real content root
        entries = list(source_dir.iterdir())
        actual_source = source_dir
        if len(entries) == 1 and entries[0].is_dir():
            actual_source = entries[0]

        shutil.copytree(actual_source, workspace_dir)

        # Initialize isolated git tracking
        subprocess.run(["git", "init", "-b", "main"], cwd=workspace_dir, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Necromancer Agent"], cwd=workspace_dir, check=True)
        subprocess.run(["git", "config", "user.email", "agent@necromancer.local"], cwd=workspace_dir, check=True)
        subprocess.run(["git", "add", "."], cwd=workspace_dir, check=True)
        subprocess.run(["git", "commit", "-m", "Baseline: unrevived legacy state"], cwd=workspace_dir, check=True)

        return workspace_dir

    @classmethod
    def get_head_commit(cls, project_id: str) -> str:
        workspace_dir = cls.get_project_workspace_dir(project_id)
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=workspace_dir,
            capture_output=True,
            text=True,
            check=True
        )
        return res.stdout.strip()

    @classmethod
    def apply_patch_in_workspace(cls, project_id: str, patch_content: str) -> bool:
        workspace_dir = cls.get_project_workspace_dir(project_id)
        patch_file = workspace_dir / ".temp_patch.diff"
        patch_file.write_text(patch_content, encoding="utf-8")
        try:
            # Check patch first
            check_res = subprocess.run(
                ["git", "apply", "--check", str(patch_file)],
                cwd=workspace_dir,
                capture_output=True,
                text=True
            )
            if check_res.returncode != 0:
                return False

            apply_res = subprocess.run(
                ["git", "apply", str(patch_file)],
                cwd=workspace_dir,
                capture_output=True,
                text=True
            )
            if apply_res.returncode != 0:
                return False

            subprocess.run(["git", "add", "."], cwd=workspace_dir, check=True)
            subprocess.run(["git", "commit", "-m", "Applied Necromancer revival patch"], cwd=workspace_dir, check=True)
            return True
        finally:
            if patch_file.exists():
                patch_file.unlink()

    @classmethod
    def rollback_to_commit(cls, project_id: str, commit_sha: str) -> bool:
        workspace_dir = cls.get_project_workspace_dir(project_id)
        res = subprocess.run(
            ["git", "reset", "--hard", commit_sha],
            cwd=workspace_dir,
            capture_output=True,
            text=True
        )
        return res.returncode == 0
