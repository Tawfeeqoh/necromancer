<?php
require_once __DIR__ . '/db.php';

// Vulnerable legacy login handler
// 1. Direct concatenation SQL injection
// 2. MD5 password hashing
// 3. Fails to check user suspension status
function login_user($username, $password) {
    $hashed_pass = md5($password);
    
    // Insecure query
    $sql = "SELECT * FROM users WHERE username = '$username' AND password_hash = '$hashed_pass'";
    $res = query($sql);
    
    if ($res && function_exists('mysql_fetch_assoc')) {
        $row = mysql_fetch_assoc($res);
        return $row;
    }
    
    return false;
}
?>