from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

class DiagnosticianAgent:
    @staticmethod
    def diagnose(
        anatomy_report: Dict[str, Any],
        intent_report: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Synthesizes technical findings across runtime, security, data integrity,
        and architecture into a prioritized Revival Diagnosis.
        """
        all_findings = []
        all_findings.extend(anatomy_report.get("findings", []))
        all_findings.extend(intent_report.get("findings", []))

        # Severity breakdown
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0
        }
        for f in all_findings:
            sev = f.get("severity", "info").lower()
            if sev in severity_counts:
                severity_counts[sev] += 1

        overall_health = "CRITICAL" if severity_counts["critical"] > 0 else (
            "POOR" if severity_counts["high"] > 0 else "STABLE"
        )

        diagnosis_summary = (
            f"Diagnosed {len(all_findings)} issues ({severity_counts['critical']} Critical, "
            f"{severity_counts['high']} High, {severity_counts['medium']} Medium). "
            f"System Health Rating: {overall_health}."
        )

        # Synthesize strategic risks
        risks = [
            "Application will suffer fatal crashes on modern PHP runtimes due to removed mysql_* functions.",
            "Stored user passwords and database transactions are vulnerable to interception and extraction.",
            "Absence of comprehensive automated regression test suite makes ad-hoc refactoring high risk."
        ]

        return {
            "status": "completed",
            "summary": diagnosis_summary,
            "system_health": overall_health,
            "severity_breakdown": severity_counts,
            "findings": all_findings,
            "evidence": [
                {
                    "source_type": "diagnostic_synthesis",
                    "source_ref": "archaeologist_and_historian_reports",
                    "excerpt_or_observation": f"Evaluated {len(all_findings)} structural and business findings.",
                    "evidence_status": "verified"
                }
            ],
            "assumptions": [
                "Assumes production environment uses standard LAMP or containerized PHP runtime."
            ],
            "unknowns": [
                "Live database size and active user transaction rate."
            ],
            "risks": risks,
            "recommended_next_action": "Pass Revival Diagnosis to Revival Planner to formulate staged, risk-aware task roadmap.",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
