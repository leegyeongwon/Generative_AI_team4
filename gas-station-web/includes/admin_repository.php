<?php

require_once __DIR__ . '/db.php';

/**
 * 관리자용 테이블/컬럼 조회 및 등록·삭제 기능.
 *
 * 보안 원칙:
 * - 테이블명/컬럼명은 항상 information_schema에서 조회한 "실제 존재하는" 이름과
 *   대조(allowlist)한 뒤에만 SQL에 문자열로 삽입한다. 사용자가 보낸 값이 그대로
 *   SQL 식별자로 쓰이는 경로는 없다.
 * - 값(데이터)은 전부 prepared statement 파라미터로 바인딩한다.
 */

function list_tables(): array
{
    $config = get_config();
    $stmt = get_pdo()->prepare(
        'SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = "BASE TABLE"
         ORDER BY TABLE_NAME'
    );
    $stmt->execute([':db' => $config['database']]);

    return array_column($stmt->fetchAll(), 'TABLE_NAME');
}

function assert_valid_table(string $table): void
{
    if (!in_array($table, list_tables(), true)) {
        throw new InvalidArgumentException('INVALID_TABLE');
    }
}

function get_table_columns(string $table): array
{
    assert_valid_table($table);

    $config = get_config();
    $stmt = get_pdo()->prepare(
        'SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_DEFAULT
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table
         ORDER BY ORDINAL_POSITION'
    );
    $stmt->execute([':db' => $config['database'], ':table' => $table]);

    return $stmt->fetchAll();
}

function get_primary_key_columns(string $table): array
{
    $columns = get_table_columns($table);

    return array_values(array_map(
        static fn ($column) => $column['COLUMN_NAME'],
        array_filter($columns, static fn ($column) => $column['COLUMN_KEY'] === 'PRI')
    ));
}

function insert_row(string $table, array $data): void
{
    assert_valid_table($table);
    $columns = get_table_columns($table);

    $insertData = [];
    foreach ($columns as $column) {
        $name = $column['COLUMN_NAME'];

        // auto_increment 컬럼은 DB가 채우므로 입력값이 있어도 무시한다.
        if ($column['EXTRA'] === 'auto_increment') {
            continue;
        }

        if (!array_key_exists($name, $data)) {
            continue;
        }

        $value = trim((string)$data[$name]);
        if ($value === '') {
            continue; // 비워둔 값은 DEFAULT/NULL에 맡긴다.
        }

        $insertData[$name] = $value;
    }

    if (empty($insertData)) {
        throw new InvalidArgumentException('EMPTY_DATA');
    }

    $columnNames = array_keys($insertData);
    $quotedColumns = array_map(static fn ($name) => "`{$name}`", $columnNames);
    $placeholders = array_map(static fn ($name) => ":{$name}", $columnNames);

    $sql = sprintf(
        'INSERT INTO `%s` (%s) VALUES (%s)',
        $table,
        implode(', ', $quotedColumns),
        implode(', ', $placeholders)
    );

    $params = [];
    foreach ($insertData as $name => $value) {
        $params[":{$name}"] = $value;
    }

    $stmt = get_pdo()->prepare($sql);
    $stmt->execute($params);
}

function delete_row(string $table, array $keyValues): int
{
    assert_valid_table($table);
    $pkColumns = get_primary_key_columns($table);

    if (empty($pkColumns)) {
        throw new InvalidArgumentException('NO_PRIMARY_KEY');
    }

    $conditions = [];
    $params = [];
    foreach ($pkColumns as $column) {
        $value = trim((string)($keyValues[$column] ?? ''));
        if ($value === '') {
            throw new InvalidArgumentException('MISSING_KEY_VALUE');
        }

        $conditions[] = "`{$column}` = :{$column}";
        $params[":{$column}"] = $value;
    }

    $sql = sprintf('DELETE FROM `%s` WHERE %s', $table, implode(' AND ', $conditions));
    $stmt = get_pdo()->prepare($sql);
    $stmt->execute($params);

    return $stmt->rowCount();
}
