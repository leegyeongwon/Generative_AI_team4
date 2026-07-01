<?php

require_once __DIR__ . '/../includes/db.php';

require_method('GET');

try {
    get_pdo()->query('SELECT 1');
    json_response([
        'success' => true,
        'server' => 'running',
        'database' => 'connected',
    ]);
} catch (Throwable $error) {
    json_response([
        'success' => false,
        'server' => 'running',
        'database' => 'disconnected',
        'error_code' => 'DB_ERROR',
    ], 500);
}
