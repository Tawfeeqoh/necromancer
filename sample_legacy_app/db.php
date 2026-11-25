<?php
// Legacy MySQL Database Connector (Deprecated PHP 5.x)
// WARNING: mysql_* functions were removed in PHP 7.0+
$db_host = "localhost";
$db_user = "root";
$db_pass = "";
$db_name = "billing_system";

if (function_exists('mysql_connect')) {
    $conn = mysql_connect($db_host, $db_user, $db_pass);
    if (!$conn) {
        die("Could not connect: " . mysql_error());
    }
    mysql_select_db($db_name, $conn);
} else {
    // If running under modern PHP without extension, stub for test execution
    $conn = null;
}

function query($sql) {
    global $conn;
    if (function_exists('mysql_query')) {
        return mysql_query($sql, $conn);
    }
    return false;
}
?>