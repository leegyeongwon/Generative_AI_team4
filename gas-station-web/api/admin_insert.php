<?php

require_once __DIR__ . '/../includes/admin_repository.php';

require_method('POST');

$body = read_json_body();
$table = trim($body['table'] ?? '');
$data = $body['data'] ?? [];

if ($table === '' || !is_array($data)) {
    json_response([
        'success' => false,
        'error_code' => 'VALIDATION_ERROR',
        'message' => 'table과 data는 필수입니다.',
    ], 400);
}

try {
    insert_row($table, $data);
    json_response([
        'success' => true,
        'message' => '등록되었습니다.',
    ]);
} catch (InvalidArgumentException $error) {
    $code = $error->getMessage();
    $message = match ($code) {
        'INVALID_TABLE' => '존재하지 않는 테이블입니다.',
        'EMPTY_DATA' => '입력된 값이 없습니다.',
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
        'message' => '등록 중 오류가 발생했습니다. 값의 형식이나 중복 여부를 확인하세요.',
    ], 500);
}
