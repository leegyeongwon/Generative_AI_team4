<?php

require_once __DIR__ . '/../includes/station_repository.php';

require_method('GET');

try {
    $filters = $_GET;
    $filters['sort'] = 'price_asc';
    $filters['limit'] = $filters['limit'] ?? 5;
    $rows = search_stations($filters);

    if (count($rows) === 0) {
        json_response([
            'success' => false,
            'error_code' => 'NO_RESULT',
            'message' => '검색 결과가 없습니다.',
            'data' => [],
        ], 404);
    }

    json_response([
        'success' => true,
        'count' => count($rows),
        'data' => $rows,
    ]);
} catch (Throwable $error) {
    handle_repository_error($error);
}
