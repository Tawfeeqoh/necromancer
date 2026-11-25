import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from backend.app.core.sandbox import SandboxRunner


class GuardianAgent:
    DANGEROUS_PRIMITIVES = ("eval(", "shell_exec(", "system(", "passthru(", "proc_open(")

    @classmethod
    def evaluate(
        cls,
        workspace_dir: Path,
        patch: Dict[str, Any],
        business_rules: List[str],
    ) -> Dict[str, Any]:
        """
        Independently audits a patch using static safety/business-rule checks
        and isolated container test execution. Never executes untrusted code on the host.
        """
        findings: List[Dict[str, Any]] = []
        is_blocked = False
        sandbox_unavailable = False

        changed_files = patch.get("changed_files", [])

        # 1. Static safety and business-rule preservation checks (read-only)
        for changed_file in changed_files:
            target = workspace_dir / changed_file
            if not target.exists():
                continue
            code = target.read_text(encoding="utf-8", errors="ignore")

            for prim in cls.DANGEROUS_PRIMITIVES:
                if prim in code:
                    is_blocked = True
                    findings.append({
                        "check": f"Restricted Function Guard ({changed_file})",
                        "status": "failed",
                        "severity": "critical",
                        "message": f"Restricted execution primitive '{prim}' found in {changed_file}.",
                    })

            if re.search(r"\bmysql_(connect|query|select_db|fetch_array|fetch_assoc)\b", code):
                is_blocked = True
                findings.append({
                    "check": f"Deprecated Extension Guard ({changed_file})",
                    "status": "failed",
                    "severity": "high",
                    "message": f"Deprecated mysql_* function remains in {changed_file}.",
                })

            if changed_file == "login.php":
                # Verify account suspension business rule is preserved
                if "suspended" not in code.lower():
                    is_blocked = True
                    findings.append({
                        "check": "Business Rule Preservation (login.php)",
                        "status": "failed",
                        "severity": "critical",
                        "message": (
                            "Regression detected: login.php no longer enforces the 'suspended' account "
                            "lockout business rule."
                        ),
                    })
                else:
                    findings.append({
                        "check": "Business Rule Preservation (login.php)",
                        "status": "passed",
                        "severity": "info",
                        "message": "Account suspension check preserved in login.php.",
                    })

        # 2. Isolated Container Syntax Lint
        for changed_file in changed_files:
            target = workspace_dir / changed_file
            if target.exists() and target.suffix.lower() == ".php":
                lint_res = SandboxRunner.run_in_container(workspace_dir, ["php", "-l", changed_file])
                if not lint_res["executed"]:
                    sandbox_unavailable = True
                    findings.append({
                        "check": f"Container PHP Lint ({changed_file})",
                        "status": "skipped",
                        "severity": "high",
                        "message": f"Execution disabled: {lint_res['reason']}",
                    })
                elif lint_res["exit_code"] != 0:
                    is_blocked = True
                    findings.append({
                        "check": f"Container PHP Lint ({changed_file})",
                        "status": "failed",
                        "severity": "critical",
                        "message": f"Syntax error in {changed_file}: {lint_res['stderr'].strip()}",
                    })
                else:
                    findings.append({
                        "check": f"Container PHP Lint ({changed_file})",
                        "status": "passed",
                        "severity": "info",
                        "message": "No syntax errors.",
                    })

        # 3. Isolated Container Regression Test Execution
        test_runner = workspace_dir / "test_runner.php"
        test_status = "NOT_RUN"
        test_exit_code = None
        test_output = ""

        if test_runner.exists():
            test_res = SandboxRunner.run_in_container(workspace_dir, ["php", "test_runner.php"])
            if not test_res["executed"]:
                sandbox_unavailable = True
                test_status = "DISABLED_NO_SANDBOX"
                test_output = f"Execution disabled on host: {test_res['reason']}"
                findings.append({
                    "check": "Automated Regression Test Suite (Container)",
                    "status": "skipped",
                    "severity": "high",
                    "message": test_output,
                })
            else:
                test_exit_code = test_res["exit_code"]
                test_output = (test_res["stdout"] or "") + (test_res["stderr"] or "")
                if test_exit_code != 0:
                    is_blocked = True
                    test_status = "FAILED"
                    findings.append({
                        "check": "Automated Regression Test Suite (Container)",
                        "status": "failed",
                        "severity": "critical",
                        "message": f"Test runner exited with code {test_exit_code}.",
                    })
                else:
                    test_status = "PASSED"
                    findings.append({
                        "check": "Automated Regression Test Suite (Container)",
                        "status": "passed",
                        "severity": "info",
                        "message": "All regression assertions passed in isolated container.",
                    })

        if is_blocked:
            overall_status = "blocked"
            summary = "Guardian review BLOCKED: Detected safety violation, business-rule regression, or failing test."
        elif sandbox_unavailable:
            overall_status = "needs_review"
            summary = (
                "Guardian static checks passed, but container sandbox is unavailable; "
                "runtime tests were disabled rather than executed on the host."
            )
        else:
            overall_status = "passed"
            summary = "Guardian review PASSED: Verified zero regressions in isolated container."

        return {
            "status": overall_status,
            "summary": summary,
            "findings": findings,
            "test_run": {
                "status": test_status,
                "exit_code": test_exit_code,
                "output": test_output,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
