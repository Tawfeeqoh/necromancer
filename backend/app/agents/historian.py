import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

class HistorianAgent:
    @staticmethod
    def analyze(source_dir: Path, anatomy_report: Dict[str, Any]) -> Dict[str, Any]:
        """
        Reconstructs likely product intent, user personas, and core business rules
        based on available code, documentation, comments, and schemas.
        """
        source_dir = source_dir.resolve()
        findings: List[Dict[str, Any]] = []
        inferred_rules: List[str] = []
        product_intent = "Legacy web application"

        # Check README / Docs
        readme_candidates = ["README.md", "README.txt", "readme.md", "INSTALL.md", "docs/README.md"]
        readme_text = ""
        for rc in readme_candidates:
            rp = source_dir / rc
            if rp.exists():
                try:
                    readme_text = rp.read_text(encoding="utf-8", errors="ignore")
                    findings.append({
                        "title": f"Documentation Discovered: {rc}",
                        "severity": "info",
                        "evidence_status": "verified",
                        "description": f"Found existing documentation file ({len(readme_text.splitlines())} lines).",
                        "evidence": {
                            "source_type": "file",
                            "source_ref": rc,
                            "excerpt_or_observation": readme_text.splitlines()[0] if readme_text.splitlines() else "Empty"
                        },
                        "recommendation": "Preserve and incorporate original documentation into revived dossier."
                    })
                    break
                except Exception:
                    pass

        # Inspect database tables for business intent
        tables = []
        for schema in anatomy_report.get("project_metrics", {}).get("database_schemas", []):
            tables.extend(schema.get("tables", []))

        table_set = {t.lower() for t in tables}
        if {"users", "invoices", "payments"}.issubset(table_set) or {"invoices", "orders"}.intersection(table_set):
            product_intent = "Billing and Customer Account Management System"
            inferred_rules.append("Enforces invoice tracking, subscription lifecycle, and customer billing accounts.")
            findings.append({
                "title": "Core Business Intent: Billing & Payment Processing",
                "severity": "info",
                "evidence_status": "inferred",
                "description": (
                    "Schema contains user, invoice, and payment tables indicating an accounts and "
                    "invoicing engine whose historical financial data integrity must be preserved."
                ),
                "evidence": {
                    "source_type": "schema",
                    "source_ref": "database_schemas",
                    "excerpt_or_observation": f"Tables: {', '.join(tables)}"
                },
                "recommendation": "Ensure zero data loss and idempotent transactional migrations during revival."
            })
        elif "users" in table_set:
            product_intent = "User Authentication and Management Portal"

        # Search code for business logic & suspension/deactivation rules
        suspension_found = False
        auth_rule_found = False
        for root, _, files in os.walk(source_dir):
            for file_name in files:
                if file_name.endswith(".php"):
                    fp = Path(root) / file_name
                    rel_path = str(fp.relative_to(source_dir)).replace("\\", "/")
                    try:
                        code = fp.read_text(encoding="utf-8", errors="ignore")
                        if not suspension_found and re.search(r"\b(status\s*=\s*['\"]suspended['\"]|failed_attempts|login_attempts|deactivate)\b", code, re.IGNORECASE):
                            suspension_found = True
                            inferred_rules.append("User Account Lockout / Suspension on repeated login or payment failures.")
                            findings.append({
                                "title": "Business Rule: Account Suspension / Lockout Logic",
                                "severity": "medium",
                                "evidence_status": "verified",
                                "description": (
                                    f"Detected account suspension logic in {rel_path}. Users are locked or suspended "
                                    "upon threshold violations."
                                ),
                                "evidence": {
                                    "source_type": "file",
                                    "source_ref": rel_path,
                                    "excerpt_or_observation": "Found suspension/status state transition in code"
                                },
                                "recommendation": "Preserve suspension state machine and audit log all status transitions."
                            })

                        if not auth_rule_found and re.search(r"\b(role|is_admin|permission|access_level)\b", code, re.IGNORECASE):
                            auth_rule_found = True
                            inferred_rules.append("Role-Based Access Control distinguishing standard users from administrative operators.")
                            findings.append({
                                "title": "Business Rule: Role-Based Authorization",
                                "severity": "info",
                                "evidence_status": "verified",
                                "description": f"Role / privilege authorization checks detected in {rel_path}.",
                                "evidence": {
                                    "source_type": "file",
                                    "source_ref": rel_path,
                                    "excerpt_or_observation": "Role / privilege conditionals detected in source"
                                },
                                "recommendation": "Enforce strict session validation and RBAC guards on all modernized routes."
                            })
                    except Exception:
                        pass

        return {
            "status": "completed",
            "summary": f"Reconstructed primary intent as '{product_intent}' with {len(inferred_rules)} core business rules.",
            "product_intent": product_intent,
            "business_rules": inferred_rules,
            "findings": findings,
            "evidence": [
                {
                    "source_type": "codebase_inspection",
                    "source_ref": "php_source_files",
                    "excerpt_or_observation": f"Inspected schemas and logic across {len(tables)} tables and PHP controllers.",
                    "evidence_status": "verified"
                }
            ],
            "assumptions": [
                "Assumes database records follow the table naming conventions identified in SQL schemas."
            ],
            "unknowns": [
                "Unpublished business documentation or external third-party API dependencies (e.g. payment gateway webhooks)."
            ],
            "risks": [
                "Modernizing authentication must not invalidate or lock out existing legacy user password records."
            ],
            "recommended_next_action": "Pass intent and anatomy to Diagnostician Agent to synthesize revival health diagnosis.",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
