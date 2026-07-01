<?php

require_once __DIR__ . '/../includes/db.php';

require_method('GET');

$config = get_config();

json_response([
    'success' => true,
    'data' => [
        'naver_maps_client_id' => $config['naver_maps_client_id'],
        'enabled' => trim($config['naver_maps_client_id']) !== '',
    ],
]);
