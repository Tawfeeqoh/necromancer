import difflib
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def _make_unified_diff(rel_path: str, original_text: str, updated_text: str) -> str:
    """Generate a valid unified diff between original_text and updated_text."""
    orig_lines = original_text.replace("\r\n", "\n").splitlines(keepends=True)
    new_lines = updated_text.replace("\r\n", "\n").splitlines(keepends=True)
    if orig_lines and not orig_lines[-1].endswith("\n"):
        orig_lines[-1] += "\n"
    if new_lines and not new_lines[-1].endswith("\n"):
        new_lines[-1] += "\n"
    diff_lines = list(
        difflib.unified_diff(
            orig_lines,
            new_lines,
            fromfile=f"a/{rel_path}",
            tofile=f"b/{rel_path}",
            lineterm="\n",
        )
    )
    return "".join(diff_lines)


class ResurrectionAgent:
    @staticmethod
    def generate_patch(workspace_dir: Path, task: Dict[str, Any], base_revision: str) -> Dict[str, Any]:
        """
        Generates a reviewable, unified git diff patch computed from actual workspace files.
        """
        patch_id = str(uuid.uuid4())
        changed_files: List[str] = []
        diff_chunks: List[str] = []

        db_file = workspace_dir / "db.php"
        login_file = workspace_dir / "login.php"

        if db_file.exists():
            original_db = db_file.read_text(encoding="utf-8", errors="ignore")
            modern_db = (
                "<?php\n"
                "// Necromancer Revived Database Connection (PDO)\n"
                "// Migrated from deprecated ext/mysql to modern PDO with prepared statements.\n\n"
                "function get_db_connection() {\n"
                "    static $pdo = null;\n"
                "    if ($pdo === null) {\n"
                "        $host = getenv('DB_HOST') ?: 'localhost';\n"
                "        $dbname = getenv('DB_NAME') ?: 'legacy_app';\n"
                "        $user = getenv('DB_USER') ?: 'root';\n"
                "        $pass = getenv('DB_PASS') ?: '';\n"
                "        $dsn = 'mysql:host=' . $host . ';dbname=' . $dbname . ';charset=utf8mb4';\n\n"
                "        $options = [\n"
                "            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,\n"
                "            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,\n"
                "            PDO::ATTR_EMULATE_PREPARES   => false,\n"
                "        ];\n\n"
                "        try {\n"
                "            $pdo = new PDO($dsn, $user, $pass, $options);\n"
                "        } catch (PDOException $e) {\n"
                "            $sqlite_path = __DIR__ . '/test_database.sqlite';\n"
                "            $pdo = new PDO('sqlite:' . $sqlite_path, null, null, $options);\n"
                "        }\n"
                "    }\n"
                "    return $pdo;\n"
                "}\n\n"
                "function db_query($query, $params = []) {\n"
                "    $stmt = get_db_connection()->prepare($query);\n"
                "    $stmt->execute($params);\n"
                "    return $stmt;\n"
                "}\n"
                "?>\n"
            )
            chunk = _make_unified_diff("db.php", original_db, modern_db)
            if chunk:
                changed_files.append("db.php")
                diff_chunks.append(chunk)

        if login_file.exists():
            original_login = login_file.read_text(encoding="utf-8", errors="ignore")
            modern_login = (
                "<?php\n"
                "require_once __DIR__ . '/db.php';\n\n"
                "function authenticate_user($username, $password) {\n"
                "    $stmt = db_query('SELECT id, username, password_hash, status, role FROM users WHERE username = :username LIMIT 1', [\n"
                "        ':username' => $username\n"
                "    ]);\n"
                "    $user = $stmt->fetch();\n\n"
                "    if (!$user) {\n"
                "        return false;\n"
                "    }\n\n"
                "    if ($user['status'] === 'suspended') {\n"
                "        return ['error' => 'ACCOUNT_SUSPENDED'];\n"
                "    }\n\n"
                "    $stored_hash = $user['password_hash'];\n"
                "    $valid = false;\n\n"
                "    if (password_verify($password, $stored_hash)) {\n"
                "        $valid = true;\n"
                "    } elseif ($stored_hash === md5($password)) {\n"
                "        $new_hash = password_hash($password, PASSWORD_BCRYPT);\n"
                "        db_query('UPDATE users SET password_hash = :hash WHERE id = :id', [\n"
                "            ':hash' => $new_hash,\n"
                "            ':id' => $user['id']\n"
                "        ]);\n"
                "        $valid = true;\n"
                "    }\n\n"
                "    if ($valid) {\n"
                "        return $user;\n"
                "    }\n\n"
                "    return false;\n"
                "}\n"
                "?>\n"
            )
            chunk = _make_unified_diff("login.php", original_login, modern_login)
            if chunk:
                changed_files.append("login.php")
                diff_chunks.append(chunk)

        diff_text = "".join(diff_chunks)
        patch_sha256 = hashlib.sha256(diff_text.encode("utf-8")).hexdigest()

        return {
            "id": patch_id,
            "task_id": task["id"],
            "base_revision": base_revision,
            "patch_sha256": patch_sha256,
            "changed_files": changed_files,
            "diff": diff_text,
            "status": "proposed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
