import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class SandboxRunner:
    DEFAULT_IMAGE = "php:8.2-cli-alpine"

    @staticmethod
    def is_container_available(timeout_sec: float = 3.0) -> Tuple[bool, Optional[str]]:
        """
        Verifies that Docker CLI and daemon are reachable for disposable container isolation.
        Never falls back to host execution.
        """
        if not shutil.which("docker"):
            return False, "Docker CLI is not installed on this host."
        try:
            res = subprocess.run(
                ["docker", "info", "--format", "{{.ServerVersion}}"],
                capture_output=True,
                text=True,
                timeout=timeout_sec,
            )
            if res.returncode != 0:
                err = (res.stderr or res.stdout or "Docker daemon unreachable").strip()
                return False, f"Docker daemon unavailable: {err}"
            return True, None
        except subprocess.TimeoutExpired:
            return False, "Docker daemon check timed out (Docker Desktop may not be running)."
        except Exception as exc:
            return False, f"Docker availability check failed: {exc}"

    @classmethod
    def run_in_container(
        cls,
        workspace_dir: Path,
        command: List[str],
        image: str = DEFAULT_IMAGE,
        timeout_sec: int = 30,
    ) -> Dict[str, Any]:
        """
        Executes a command inside a disposable, network-disabled, resource-limited Docker container.
        If container isolation is unavailable, execution is disabled rather than running on the host.
        """
        available, reason = cls.is_container_available()
        if not available:
            return {
                "executed": False,
                "status": "SANDBOX_UNAVAILABLE",
                "command": " ".join(command),
                "exit_code": None,
                "stdout": "",
                "stderr": "",
                "reason": reason,
            }

        docker_cmd = [
            "docker", "run", "--rm",
            "--network", "none",
            "--memory", "256m",
            "--cpus", "1",
            "--pids-limit", "64",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges",
            "-v", f"{str(workspace_dir.resolve())}:/workspace:rw",
            "-w", "/workspace",
            image,
            *command,
        ]

        try:
            res = subprocess.run(
                docker_cmd,
                capture_output=True,
                text=True,
                timeout=timeout_sec,
            )
            return {
                "executed": True,
                "status": "PASSED" if res.returncode == 0 else "FAILED",
                "command": " ".join(command),
                "exit_code": res.returncode,
                "stdout": res.stdout,
                "stderr": res.stderr,
                "reason": None,
            }
        except subprocess.TimeoutExpired:
            return {
                "executed": True,
                "status": "TIMEOUT",
                "command": " ".join(command),
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Container execution exceeded {timeout_sec}s timeout.",
                "reason": "TIMEOUT",
            }
        except Exception as exc:
            return {
                "executed": False,
                "status": "SANDBOX_ERROR",
                "command": " ".join(command),
                "exit_code": None,
                "stdout": "",
                "stderr": str(exc),
                "reason": str(exc),
            }
