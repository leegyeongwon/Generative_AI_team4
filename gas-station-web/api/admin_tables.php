<?php

require_once __DIR__ . '/../includes/admin_repository.php';

require_method('GET');

try {
    json_response([
        'success' => true,
        'data' => list_tables(),
    ]);
} catch (Throwable $error) {
    json_response([
        'success' => false,
        'error_code' => 'DB_ERROR',
        'message' => '테이블 목록을 불러오지 못했습니다.',
    ], 500);
}
