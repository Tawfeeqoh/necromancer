<?php
// Necromancer Baseline Regression Test Suite
// Ground truth verification for revival pipeline

$failures = 0;
$total_tests = 0;

function assert_test($description, $condition) {
    global $failures, $total_tests;
    $total_tests++;
    if ($condition) {
        echo "[PASS] " . $description . "\n";
    } else {
        echo "[FAIL] " . $description . "\n";
        $failures++;
    }
}

echo "=== Necromancer Test Runner ===\n";

// 1. Setup SQLite test fixture matching schema.sql
$sqlite_db = __DIR__ . '/test_database.sqlite';
$pdo = new PDO("sqlite:" . $sqlite_db);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        failed_attempts INTEGER DEFAULT 0,
        role TEXT DEFAULT 'customer'
    );
    DELETE FROM users;
    INSERT INTO users (id, username, password_hash, email, status, role)
    VALUES (1, 'admin', '482c811da5d5b4bc6d497ffa98491e38', 'admin@legacybilling.com', 'active', 'admin');
    
    INSERT INTO users (id, username, password_hash, email, status, failed_attempts, role)
    VALUES (2, 'john_doe', '5ebe2294ecd0e0f08eab7690d2a6ee69', 'john@example.com', 'suspended', 3, 'customer');
");

// 2. Load db.php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/login.php';

// Test 1: Verify database connection object or PDO exists
if (function_exists('get_db_connection')) {
    $conn = get_db_connection();
    assert_test("Modern PDO connection initialized", $conn instanceof PDO);
} else {
    assert_test("Legacy DB query function exists", function_exists('query'));
}

// Test 2: Active User Authentication
if (function_exists('authenticate_user')) {
    $admin = authenticate_user('admin', 'password123');
    assert_test("Valid user authentication succeeds", is_array($admin) && $admin['username'] === 'admin');
    
    // Test 3: Account Suspension Lockout Policy
    $john = authenticate_user('john_doe', 'secretpass');
    assert_test("Suspended user account is locked / denied access", (is_array($john) && isset($john['error']) && $john['error'] === 'ACCOUNT_SUSPENDED') || $john === false);
} else {
    echo "[INFO] Running in unmodernized legacy state; modernized authentication functions not yet applied.\n";
}

echo "=== Test Summary: Total={$total_tests}, Failures={$failures} ===\n";
exit($failures > 0 ? 1 : 0);
?>