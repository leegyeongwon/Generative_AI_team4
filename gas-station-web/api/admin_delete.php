<?php

require_once __DIR__ . '/../includes/admin_repository.php';

require_method('POST');

$body = read_json_body();
$table = trim($body['table'] ?? '');
$keys = $body['keys'] ?? [];

if ($table === '' || !is_array($keys)) {
    json_response([
        'success' => false,
        'error_code' => 'VALIDATION_ERROR',
        'message' => 'table과 keys는 필수입니다.',
    ], 400);
}

try {
    $affected = delete_row($table, $keys);

    if ($affected === 0) {
        json_response([
            'success' => false,
            'error_code' => 'NO_RESULT',
            'message' => '삭제할 데이터를 찾을 수 없습니다.',
        ], 404);
    }

    json_response([
        'success' => true,
        'message' => '삭제되었습니다.',
        'affected' => $affected,
    ]);
} catch (InvalidArgumentException $error) {
    $code = $error->getMessage();
    $message = match ($code) {
        'INVALID_TABLE' => '존재하지 않는 테이블입니다.',
        'NO_PRIMARY_KEY' => '기본키가 없는 테이블은 이 화면에서 삭제할 수 없습니다.',
        'MISSING_KEY_VALUE' => '식별자(기본키) 값을 모두 입력하세요.',
        default => '요청이 올바르지 않습니다.',
    };
    json_response([
        'success' => false,
        'error_code' => $code,
        'message' => $message,
    ], 400);
} catch (Throwable $error) {
    json_response([
        'success' => false,
        'error_code' => 'DB_ERROR',
        'message' => '삭제 중 오류가 발생했습니다.',
    ], 500);
}
