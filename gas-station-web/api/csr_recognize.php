<?php

require_once __DIR__ . '/../includes/db.php';

require_method('POST');

$file = $_FILES['audio_file'] ?? $_FILES['file'] ?? null;

if ($file === null) {
    json_response([
        'success' => false,
        'error_code' => 'VALIDATION_ERROR',
        'message' => 'audio_file 또는 file 필드가 필요합니다.',
    ], 400);
}

json_response([
    'success' => true,
    'text' => '서울 강남구에서 휘발유 제일 싼 주유소 찾아줘',
    'message' => 'CSR 연동 예정',
]);
