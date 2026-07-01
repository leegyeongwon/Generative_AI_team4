<?php
// Default config. Real passwords and API keys should be provided with
// environment variables or config/local.config.php on the server.
$config = [
    'host' => getenv('DB_HOST') ?: 'db-47ue49.vpc-cdb.ntruss.com',
    'port' => getenv('DB_PORT') ?: '3306',
    'database' => getenv('DB_NAME') ?: 'gas_station',
    'username' => getenv('DB_USER') ?: 'gas_admin',
    'password' => getenv('DB_PASSWORD') ?: 'change_me',
    'charset' => 'utf8mb4',
    'naver_maps_client_id' => getenv('NAVER_MAPS_CLIENT_ID') ?: '',
];

$localConfigPath = __DIR__ . '/local.config.php';
if (file_exists($localConfigPath)) {
    $localConfig = require $localConfigPath;
    if (is_array($localConfig)) {
        $config = array_replace($config, $localConfig);
    }
}

return $config;
