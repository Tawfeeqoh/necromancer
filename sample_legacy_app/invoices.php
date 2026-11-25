<?php
require_once __DIR__ . '/db.php';

function get_user_invoices($user_id) {
    // Legacy SQL query without prepared statements
    $sql = "SELECT id, amount, status, due_date FROM invoices WHERE user_id = " . intval($user_id);
    return query($sql);
}
?>