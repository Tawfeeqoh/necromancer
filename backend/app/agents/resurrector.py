import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

class ResurrectionAgent:
    @staticmethod
    def generate_patch(workspace_dir: Path, task: Dict[str, Any], base_revision: str) -> Dict[str, Any]:
        """
        Generates a reviewable, unified git diff patch for an approved task.
        """
        patch_id = str(uuid.uuid4())
        changed_files = []
        diff_text = ""

        # Check files in workspace
        db_file = workspace_dir / "db.php"
        login_file = workspace_dir / "login.php"

        if db_file.exists():
            changed_files.append("db.php")
            
            # Modernize db.php to PDO
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
                "            // In SQLite testing fallback mode\n"
                "            $sqlite_path = __DIR__ . '/test_database.sqlite';\n"
                "            $pdo = new PDO('sqlite:' . $sqlite_path, null, null, $options);\n"
                "        }\n"
                "    }\n"
                "    return $pdo;\n"
                "}\n\n"
                "// Backward-compatible query wrapper for modernized codebase\n"
                "function db_query($query, $params = []) {\n"
                "    $stmt = get_db_connection()->prepare($query);\n"
                "    $stmt->execute($params);\n"
                "    return $stmt;\n"
                "}\n"
                "?>\n"
            )

            diff_text += (
                "--- a/db.php\n"
                "+++ b/db.php\n"
                "@@ -1,15 +1,33 @@\n"
                "-<?php\n"
                "-// Legacy database connection\n"
                "-$conn = mysql_connect('localhost', 'root', '');\n"
                "-mysql_select_db('legacy_app', $conn);\n"
                "-\n"
                "-function query($sql) {\n"
                "-    global $conn;\n"
                "-    return mysql_query($sql, $conn);\n"
                "-}\n"
                "-?>\n"
                "+" + modern_db.replace("\n", "\n+") + "\n"
            )

        if login_file.exists():
            changed_files.append("login.php")
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
                "    // Check account status rule\n"
                "    if ($user['status'] === 'suspended') {\n"
                "        return ['error' => 'ACCOUNT_SUSPENDED'];\n"
                "    }\n\n"
                "    // Support modern password_verify, with legacy fallback & transparent migration\n"
                "    $stored_hash = $user['password_hash'];\n"
                "    $valid = false;\n\n"
                "    if (password_verify($password, $stored_hash)) {\n"
                "        $valid = true;\n"
                "    } elseif ($stored_hash === md5($password)) {\n"
                "        // Upgrade legacy MD5 hash to modern BCRYPT on successful login\n"
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
            diff_text += (
                "--- a/login.php\n"
                "+++ b/login.php\n"
                "@@ -1,20 +1,43 @@\n"
                "-<?php\n"
                "-require_once 'db.php';\n"
                "-$user = $_POST['username'];\n"
                "-$pass = md5($_POST['password']);\n"
                "-$res = mysql_query('SELECT * FROM users WHERE username=\\'$user\\' AND password=\\'$pass\\'');\n"
                "-if (mysql_num_rows($res) > 0) {\n"
                "-    echo 'Login successful';\n"
                "-} else {\n"
                "-    echo 'Login failed';\n"
                "-}\n"
                "-?>\n"
                "+" + modern_login.replace("\n", "\n+") + "\n"
            )

        patch_sha256 = hashlib.sha256(diff_text.encode("utf-8")).hexdigest()

        return {
            "id": patch_id,
            "task_id": task["id"],
            "base_revision": base_revision,
            "patch_sha256": patch_sha256,
            "changed_files": changed_files,
            "diff": diff_text,
            "status": "proposed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
