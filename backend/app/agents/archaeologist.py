import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

class ArchaeologistAgent:
    @staticmethod
    def inspect(source_dir: Path) -> Dict[str, Any]:
        """
        Deterministically inspects an uncompressed legacy codebase and generates
        a Codebase Anatomy Report and structured findings.
        """
        source_dir = source_dir.resolve()
        if not source_dir.exists():
            raise FileNotFoundError(f"Source directory {source_dir} does not exist.")

        # Inventory
        all_files: List[Path] = []
        for root, dirs, files in os.walk(source_dir):
            # Skip VCS or IDE folders
            dirs[:] = [d for d in dirs if d not in {".git", ".svn", "node_modules", "vendor"}]
            for f in files:
                all_files.append(Path(root) / f)

        extension_counts: Dict[str, int] = {}
        total_size = 0
        for f in all_files:
            ext = f.suffix.lower() or "no_ext"
            extension_counts[ext] = extension_counts.get(ext, 0) + 1
            total_size += f.stat().st_size

        # Stack Detection
        detected_languages = []
        detected_frameworks = []
        entry_points = []
        dependencies = {}
        sql_schemas = []
        findings: List[Dict[str, Any]] = []

        # PHP / Composer
        composer_json = source_dir / "composer.json"
        if composer_json.exists():
            detected_languages.append("PHP")
            try:
                comp_data = json.loads(composer_json.read_text(encoding="utf-8", errors="ignore"))
                reqs = comp_data.get("require", {})
                dependencies["composer"] = reqs
                
                # Check PHP constraint
                php_ver = reqs.get("php", "Unknown")
                findings.append({
                    "title": f"Target Runtime Constraint: PHP {php_ver}",
                    "severity": "info",
                    "evidence_status": "verified",
                    "description": f"composer.json explicitly requires PHP runtime {php_ver}.",
                    "evidence": {
                        "source_type": "file",
                        "source_ref": "composer.json",
                        "excerpt_or_observation": f'"php": "{php_ver}"'
                    },
                    "recommendation": "Modernize runtime support to modern PHP 8.x with strict type checking."
                })

                # Check framework hints
                for dep, ver in reqs.items():
                    if "laravel" in dep.lower():
                        detected_frameworks.append(f"Laravel ({ver})")
                    elif "symfony" in dep.lower():
                        detected_frameworks.append(f"Symfony ({ver})")
                    elif "slim" in dep.lower():
                        detected_frameworks.append(f"Slim ({ver})")
            except Exception as e:
                findings.append({
                    "title": "Corrupt or unparseable composer.json",
                    "severity": "medium",
                    "evidence_status": "verified",
                    "description": str(e),
                    "evidence": {"source_type": "file", "source_ref": "composer.json"}
                })
        elif extension_counts.get(".php", 0) > 0:
            detected_languages.append("PHP (Vanilla / Legacy)")

        # JavaScript / Node
        package_json = source_dir / "package.json"
        if package_json.exists():
            detected_languages.append("JavaScript")
            try:
                pkg_data = json.loads(package_json.read_text(encoding="utf-8", errors="ignore"))
                dependencies["npm"] = pkg_data.get("dependencies", {})
            except Exception:
                pass

        # Identify Entry Points
        potential_entry_points = [
            "index.php", "public/index.php", "server.php", "app.php",
            "api.php", "login.php", "admin.php", "artisan", "main.py", "app.py"
        ]
        for ep in potential_entry_points:
            ep_path = source_dir / ep
            if ep_path.exists():
                entry_points.append(ep)

        # Code & Vulnerability Scanning across files
        for f in all_files:
            rel_path = str(f.relative_to(source_dir)).replace("\\", "/")
            if f.suffix.lower() == ".php":
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    lines = content.splitlines()

                    # Deprecated mysql_* extension detection (removed in PHP 7.0)
                    for idx, line in enumerate(lines, 1):
                        if re.search(r"\bmysql_(connect|query|select_db|fetch_array|fetch_assoc|error)\b", line):
                            findings.append({
                                "title": f"Deprecated mysql_* Extension in {rel_path}",
                                "severity": "critical",
                                "evidence_status": "verified",
                                "description": (
                                    "The ancient ext/mysql extension was deprecated in PHP 5.5 and completely "
                                    "removed in PHP 7.0. Scripts using it will fatal-error on modern PHP runtimes."
                                ),
                                "evidence": {
                                    "source_type": "file",
                                    "source_ref": f"{rel_path}:{idx}",
                                    "excerpt_or_observation": line.strip()
                                },
                                "recommendation": "Migrate to PDO with prepared statements and parameter binding."
                            })
                            break  # One finding per file is sufficient

                    # Insecure password hashing (MD5 / SHA1)
                    for idx, line in enumerate(lines, 1):
                        if re.search(r"\b(md5|sha1)\s*\(\s*\$(password|pwd|pass)", line, re.IGNORECASE):
                            findings.append({
                                "title": f"Insecure Legacy Password Hashing in {rel_path}",
                                "severity": "critical",
                                "evidence_status": "verified",
                                "description": (
                                    "Passwords are being hashed using obsolete MD5/SHA1 without modern salting/stretching, "
                                    "vulnerable to rainbow-table and brute-force attacks."
                                ),
                                "evidence": {
                                    "source_type": "file",
                                    "source_ref": f"{rel_path}:{idx}",
                                    "excerpt_or_observation": line.strip()
                                },
                                "recommendation": "Upgrade to PHP password_hash() using BCRYPT or Argon2id."
                            })
                            break

                    # SQL Injection via string concatenation
                    for idx, line in enumerate(lines, 1):
                        if re.search(r"\bSELECT\b.*\bFROM\b.*\$.*(WHERE|\=)", line, re.IGNORECASE) or \
                           re.search(r"query\s*\(\s*[\"'].*(\$_GET|\$_POST|\$id|\$user).*[\"']\s*\)", line, re.IGNORECASE):
                            findings.append({
                                "title": f"Direct SQL Injection Vulnerability in {rel_path}",
                                "severity": "critical",
                                "evidence_status": "verified",
                                "description": "Raw unescaped variables are concatenated directly into SQL queries.",
                                "evidence": {
                                    "source_type": "file",
                                    "source_ref": f"{rel_path}:{idx}",
                                    "excerpt_or_observation": line.strip()
                                },
                                "recommendation": "Replace query concatenation with PDO prepared parameter bindings."
                            })
                            break

                except Exception:
                    pass

            # Detect SQL schema files
            elif f.suffix.lower() == ".sql":
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    table_matches = re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?", content, re.IGNORECASE)
                    sql_schemas.append({
                        "file": rel_path,
                        "tables": table_matches
                    })
                    findings.append({
                        "title": f"Database Schema Definition: {rel_path}",
                        "severity": "info",
                        "evidence_status": "verified",
                        "description": f"Identified SQL schema definition containing tables: {', '.join(table_matches) if table_matches else 'none found'}",
                        "evidence": {
                            "source_type": "file",
                            "source_ref": rel_path,
                            "excerpt_or_observation": f"Found {len(table_matches)} table definitions"
                        },
                        "recommendation": "Inspect schema constraints and foreign keys for data integrity."
                    })
                except Exception:
                    pass

        # Codebase Anatomy structure
        anatomy = {
            "status": "completed",
            "summary": f"Identified {len(detected_languages)} language(s), {len(all_files)} files, {len(entry_points)} entry points, and {len(findings)} findings.",
            "project_metrics": {
                "total_files": len(all_files),
                "total_bytes": total_size,
                "file_types": extension_counts,
                "languages": detected_languages,
                "frameworks": detected_frameworks,
                "entry_points": entry_points,
                "database_schemas": sql_schemas,
                "dependencies": dependencies
            },
            "findings": findings,
            "evidence": [
                {
                    "source_type": "filesystem",
                    "source_ref": str(source_dir),
                    "excerpt_or_observation": f"Scanned {len(all_files)} total files across {len(extension_counts)} formats.",
                    "evidence_status": "verified"
                }
            ],
            "assumptions": [],
            "unknowns": [
                "Production database state and actual live user volume are unknown."
            ],
            "risks": [
                "Legacy runtime incompatibilities will prevent direct execution on modern PHP 8.x engines.",
                "Identified critical SQL injection and password hashing flaws expose data."
            ],
            "recommended_next_action": "Pass Codebase Anatomy Report to Historian Agent to reconstruct product business rules.",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        return anatomy
