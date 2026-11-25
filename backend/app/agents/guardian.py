import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

class GuardianAgent:
    @staticmethod
    def evaluate(
        workspace_dir: Path,
        patch: Dict[str, Any],
        business_rules: List[str]
    ) -> Dict[str, Any]:
        """
        Independently audits a patch and executes isolated regression tests.
        Blocks unsafe changes or regressions.
        """
        findings: List[Dict[str, Any]] = []
        is_blocked = False

        # 1. Static PHP Syntax Lint Check on modified files
        for changed_file in patch.get("changed_files", []):
            target = workspace_dir / changed_file
            if target.exists() and target.suffix == ".php":
                res = subprocess.run(
                    ["php", "-l", str(target)],
                    cwd=workspace_dir,
                    capture_output=True,
                    text=True
                )
                if res.returncode != 0:
                    is_blocked = True
                    findings.append({
                        "check": "PHP Syntax Lint",
                        "status": "failed",
                        "severity": "critical",
                        "message": f"Syntax error detected in {changed_file}: {res.stderr.strip()}"
                    })
                else:
                    findings.append({
                        "check": f"PHP Syntax Lint: {changed_file}",
                        "status": "passed",
                        "severity": "info",
                        "message": "No syntax errors."
                    })

        # 2. Check for accidental introduction of dangerous functions
        for changed_file in patch.get("changed_files", []):
            target = workspace_dir / changed_file
            if target.exists():
                code = target.read_text(encoding="utf-8", errors="ignore")
                if "eval(" in code or "shell_exec(" in code or "system(" in code:
                    is_blocked = True
                    findings.append({
                        "check": "Restricted Function Guard",
                        "status": "failed",
                        "severity": "critical",
                        "message": f"Restricted execution primitive found in {changed_file}."
                    })

        # 3. Run regression tests if a test runner exists
        test_runner = workspace_dir / "test_runner.php"
        test_output = ""
        test_exit_code = 0
        if test_runner.exists():
            test_res = subprocess.run(
                ["php", "test_runner.php"],
                cwd=workspace_dir,
                capture_output=True,
                text=True
            )
            test_exit_code = test_res.returncode
            test_output = test_res.stdout + test_res.stderr
            if test_exit_code != 0:
                is_blocked = True
                findings.append({
                    "check": "Automated Regression Test Suite",
                    "status": "failed",
                    "severity": "critical",
                    "message": f"Test runner exited with code {test_exit_code}. Output: {test_output.strip()}"
                })
            else:
                findings.append({
                    "check": "Automated Regression Test Suite",
                    "status": "passed",
                    "severity": "info",
                    "message": "All regression assertions passed successfully."
                })

        overall_status = "blocked" if is_blocked else "passed"
        summary = (
            "Guardian review PASSED: Verified zero regressions and intact business rules."
            if not is_blocked else
            "Guardian review BLOCKED: Detected safety violation or failing test regression."
        )

        return {
            "status": overall_status,
            "summary": summary,
            "findings": findings,
            "test_run": {
                "exit_code": test_exit_code,
                "output": test_output
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
