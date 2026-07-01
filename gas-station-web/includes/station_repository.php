<?php

require_once __DIR__ . '/db.php';

const FUEL_COLUMNS = [
    'premium' => 'ph.premium_gasoline_price',
    'gasoline' => 'ph.gasoline_price',
    'diesel' => 'ph.diesel_price',
    'kerosene' => 'ph.indoor_kerosene_price',
];

function normalize_limit($limit, int $default = 20): int
{
    $value = filter_var($limit, FILTER_VALIDATE_INT);
    if ($value === false || $value < 1) {
        return $default;
    }

    return min($value, 100);
}

function get_fuel_column(string $fuel): string
{
    if (!array_key_exists($fuel, FUEL_COLUMNS)) {
        throw new InvalidArgumentException('INVALID_FUEL');
    }

    return FUEL_COLUMNS[$fuel];
}

function search_stations(array $filters, bool $requireCoordinates = false): array
{
    $fuel = $filters['fuel'] ?? '';
    $priceColumn = get_fuel_column($fuel);
    $sort = ($filters['sort'] ?? 'price_asc') === 'price_desc' ? 'DESC' : 'ASC';
    $limit = normalize_limit($filters['limit'] ?? null, 20);

    // 수정: 컬럼명은 allowlist에서만 선택하고 사용자 입력은 prepared statement로 바인딩한다.
    $sql = "
        SELECT
            s.station_code,
            s.station_name AS name,
            SUBSTRING_INDEX(s.address, ' ', 2) AS region,
            s.address,
            s.brand,
            s.self_yn AS is_self,
            :fuel AS fuel,
            {$priceColumn} AS price,
            s.latitude,
            s.longitude
        FROM stations s
        JOIN (
            SELECT station_code, MAX(price_date) AS latest_price_date
            FROM station_price_history
            GROUP BY station_code
        ) latest
            ON latest.station_code = s.station_code
        JOIN station_price_history ph
            ON ph.station_code = latest.station_code
            AND ph.price_date = latest.latest_price_date
        WHERE {$priceColumn} > 0
    ";

    $params = [':fuel' => $fuel];

    if (!empty($filters['region'])) {
        $sql .= ' AND s.address LIKE :region';
        $params[':region'] = '%' . trim($filters['region']) . '%';
    }

    if (!empty($filters['brand'])) {
        $sql .= ' AND s.brand LIKE :brand';
        $params[':brand'] = '%' . trim($filters['brand']) . '%';
    }

    if (!empty($filters['self_only']) && filter_var($filters['self_only'], FILTER_VALIDATE_BOOLEAN)) {
        $sql .= ' AND s.self_yn LIKE :self_only';
        $params[':self_only'] = '%셀프%';
    }

    if ($requireCoordinates) {
        $sql .= ' AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL';
    }

    $sql .= " ORDER BY {$priceColumn} {$sort} LIMIT {$limit}";

    $stmt = get_pdo()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['price'] = (int)$row['price'];
        $row['latitude'] = $row['latitude'] === null ? null : (float)$row['latitude'];
        $row['longitude'] = $row['longitude'] === null ? null : (float)$row['longitude'];
    }

    return $rows;
}

function get_station_detail(string $stationCode): ?array
{
    $sql = "
        SELECT
            s.station_code,
            SUBSTRING_INDEX(s.address, ' ', 2) AS region,
            s.station_name AS name,
            s.address,
            s.brand,
            s.self_yn AS is_self,
            ph.premium_gasoline_price,
            ph.gasoline_price,
            ph.diesel_price,
            ph.indoor_kerosene_price,
            s.latitude,
            s.longitude
        FROM stations s
        LEFT JOIN (
            SELECT station_code, MAX(price_date) AS latest_price_date
            FROM station_price_history
            GROUP BY station_code
        ) latest
            ON latest.station_code = s.station_code
        LEFT JOIN station_price_history ph
            ON ph.station_code = latest.station_code
            AND ph.price_date = latest.latest_price_date
        WHERE s.station_code = :station_code
        LIMIT 1
    ";

    $stmt = get_pdo()->prepare($sql);
    $stmt->execute([':station_code' => $stationCode]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    return [
        'station_code' => $row['station_code'],
        'region' => $row['region'],
        'name' => $row['name'],
        'address' => $row['address'],
        'brand' => $row['brand'],
        'is_self' => $row['is_self'],
        'prices' => [
            'premium' => (int)($row['premium_gasoline_price'] ?? 0),
            'gasoline' => (int)($row['gasoline_price'] ?? 0),
            'diesel' => (int)($row['diesel_price'] ?? 0),
            'kerosene' => (int)($row['indoor_kerosene_price'] ?? 0),
        ],
        'latitude' => $row['latitude'] === null ? null : (float)$row['latitude'],
        'longitude' => $row['longitude'] === null ? null : (float)$row['longitude'],
    ];
}

function handle_repository_error(Throwable $error): void
{
    if ($error instanceof InvalidArgumentException && $error->getMessage() === 'INVALID_FUEL') {
        json_response([
            'success' => false,
            'error_code' => 'INVALID_FUEL',
            'message' => '지원하지 않는 유종입니다.',
        ], 400);
    }

    json_response([
        'success' => false,
        'error_code' => 'DB_ERROR',
        'message' => '데이터베이스 연결 또는 조회 중 오류가 발생했습니다.',
    ], 500);
}
