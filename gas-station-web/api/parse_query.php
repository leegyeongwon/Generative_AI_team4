<?php

require_once __DIR__ . '/../includes/db.php';

require_method('POST');

$body = read_json_body();
$query = trim($body['query'] ?? '');

if ($query === '') {
    json_response([
        'success' => false,
        'error_code' => 'VALIDATION_ERROR',
        'message' => 'query는 필수입니다.',
    ], 400);
}

$fuel = 'gasoline';
if (str_contains($query, '경유')) {
    $fuel = 'diesel';
} elseif (str_contains($query, '고급')) {
    $fuel = 'premium';
} elseif (str_contains($query, '등유')) {
    $fuel = 'kerosene';
}

$region = null;
foreach (['서울 강남구', '서울', '경기 성남시', '경기', '인천', '부산', '대구'] as $candidate) {
    if (str_contains($query, $candidate)) {
        $region = $candidate;
        break;
    }
}

json_response([
    'success' => true,
    'data' => [
        'region' => $region,
        'fuel' => $fuel,
        'sort' => 'price_asc',
        'self_only' => str_contains($query, '셀프'),
        'brand' => null,
        'limit' => 10,
    ],
    'message' => 'LiteLLM 연동 예정',
]);
