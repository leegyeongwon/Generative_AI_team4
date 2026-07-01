<?php

require_once __DIR__ . '/../includes/admin_repository.php';

require_method('GET');

$table = trim($_GET['table'] ?? '');

if ($table === '') {
    json_response([
        'success' => false,
        'error_code' => 'VALIDATION_ERROR',
        'message' => 'table은 필수입니다.',
    ], 400);
}

try {
    $columns = get_table_columns($table);
    $primaryKey = get_primary_key_columns($table);

    json_response([
        'success' => true,
        'data' => [
            'table' => $table,
            'columns' => $columns,
            'primary_key' => $primaryKey,
        ],
    ]);
} catch (InvalidArgumentException $error) {
    json_response([
        'success' => false,
        'error_code' => 'INVALID_TABLE',
        'message' => '존재하지 않는 테이블입니다.',
    ], 400);
} catch (Throwable $error) {
    json_response([
        'success' => false,
        'error_code' => 'DB_ERROR',
        'message' => '스키마 조회 중 오류가 발생했습니다.',
    ], 500);
}
