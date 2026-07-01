<?php

require_once __DIR__ . '/../includes/station_repository.php';

require_method('GET');

$stationCode = trim($_GET['station_code'] ?? '');

if ($stationCode === '') {
    json_response([
        'success' => false,
        'error_code' => 'VALIDATION_ERROR',
        'message' => 'station_code는 필수입니다.',
    ], 400);
}

try {
    $station = get_station_detail($stationCode);

    if ($station === null) {
        json_response([
            'success' => false,
            'error_code' => 'NO_RESULT',
            'message' => '주유소를 찾을 수 없습니다.',
        ], 404);
    }

    json_response([
        'success' => true,
        'data' => $station,
    ]);
} catch (Throwable $error) {
    handle_repository_error($error);
}
