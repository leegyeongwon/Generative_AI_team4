<?php
// Copy this file on the server and replace values with the Cloud DB settings.
// Do not commit real passwords or API keys in a public repository.
return [
    'host' => getenv('DB_HOST') ?: 'db-47ue49.vpc-cdb.ntruss.com',
    'port' => getenv('DB_PORT') ?: '3306',
    'database' => getenv('DB_NAME') ?: 'gas_station',
    'username' => getenv('DB_USER') ?: 'gas_admin',
    'password' => getenv('DB_PASSWORD') ?: 'team4team4!',
    'charset' => 'utf8mb4',
    'naver_maps_client_id' => getenv('NAVER_MAPS_CLIENT_ID') ?: '',
];
