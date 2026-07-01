import argparse
import csv
import os
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import pymysql
from dotenv import load_dotenv


load_dotenv()


DEFAULT_CSV_PATH = str(Path(__file__).resolve().parent / "data" / "현재_판매가격(주유소).csv")


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS gas_stations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    station_code VARCHAR(30) NOT NULL,
    region VARCHAR(100) NULL,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NULL,
    brand VARCHAR(100) NULL,
    is_self VARCHAR(30) NULL,
    premium_gasoline_price INT NOT NULL DEFAULT 0,
    gasoline_price INT NOT NULL DEFAULT 0,
    diesel_price INT NOT NULL DEFAULT 0,
    kerosene_price INT NOT NULL DEFAULT 0,
    latitude DECIMAL(11, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_gas_stations_station_code (station_code),
    KEY idx_gas_stations_region (region),
    KEY idx_gas_stations_brand (brand),
    KEY idx_gas_stations_gasoline_price (gasoline_price),
    KEY idx_gas_stations_diesel_price (diesel_price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


UPSERT_SQL = """
INSERT INTO gas_stations (
    station_code,
    region,
    name,
    address,
    brand,
    is_self,
    premium_gasoline_price,
    gasoline_price,
    diesel_price,
    kerosene_price,
    latitude,
    longitude
) VALUES (
    %(station_code)s,
    %(region)s,
    %(name)s,
    %(address)s,
    %(brand)s,
    %(is_self)s,
    %(premium_gasoline_price)s,
    %(gasoline_price)s,
    %(diesel_price)s,
    %(kerosene_price)s,
    %(latitude)s,
    %(longitude)s
)
ON DUPLICATE KEY UPDATE
    region = VALUES(region),
    name = VALUES(name),
    address = VALUES(address),
    brand = VALUES(brand),
    is_self = VALUES(is_self),
    premium_gasoline_price = VALUES(premium_gasoline_price),
    gasoline_price = VALUES(gasoline_price),
    diesel_price = VALUES(diesel_price),
    kerosene_price = VALUES(kerosene_price),
    latitude = VALUES(latitude),
    longitude = VALUES(longitude),
    updated_at = CURRENT_TIMESTAMP
"""


def get_env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, default))
    except ValueError:
        return default


def connect_mysql(database: str = None):
    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": get_env_int("DB_PORT", 3306),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }
    if database:
        config["database"] = database
    return pymysql.connect(**config)


def to_int(value: str) -> int:
    value = (value or "").replace(",", "").strip()
    if not value or value == "-":
        return 0
    return int(value)


def normalize_row(row: Dict[str, str]) -> Dict[str, object]:
    return {
        "station_code": row["고유번호"].strip(),
        "region": row.get("지역", "").strip() or None,
        "name": row.get("상호", "").strip(),
        "address": row.get("주소", "").strip() or None,
        "brand": row.get("상표", "").strip() or None,
        "is_self": row.get("셀프여부", "").strip() or None,
        "premium_gasoline_price": to_int(row.get("고급휘발유", "")),
        "gasoline_price": to_int(row.get("휘발유", "")),
        "diesel_price": to_int(row.get("경유", "")),
        "kerosene_price": to_int(row.get("실내등유", "")),
        # 현재 CSV에는 좌표 컬럼이 없으므로 지도 API용 좌표는 나중에 보강합니다.
        "latitude": None,
        "longitude": None,
    }


def iter_rows(csv_path: Path, encoding: str) -> Iterable[Dict[str, object]]:
    with csv_path.open("r", encoding=encoding, newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        required_columns = {
            "고유번호",
            "지역",
            "상호",
            "주소",
            "상표",
            "셀프여부",
            "고급휘발유",
            "휘발유",
            "경유",
            "실내등유",
        }
        missing = required_columns - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV 필수 컬럼 누락: {', '.join(sorted(missing))}")

        for row in reader:
            if not row.get("고유번호") or not row.get("상호"):
                continue
            yield normalize_row(row)


def chunked(rows: Iterable[Dict[str, object]], size: int) -> Iterable[List[Dict[str, object]]]:
    chunk: List[Dict[str, object]] = []
    for row in rows:
        chunk.append(row)
        if len(chunk) >= size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def prepare_database(db_name: str) -> None:
    with connect_mysql() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        connection.commit()

    with connect_mysql(db_name) as connection:
        with connection.cursor() as cursor:
            cursor.execute(CREATE_TABLE_SQL)
        connection.commit()


def import_csv(csv_path: Path, encoding: str, batch_size: int) -> Tuple[int, Dict[str, object]]:
    db_name = os.getenv("DB_NAME", "gas_price_db")
    prepare_database(db_name)

    total = 0
    first_row = None
    with connect_mysql(db_name) as connection:
        with connection.cursor() as cursor:
            for rows in chunked(iter_rows(csv_path, encoding), batch_size):
                if first_row is None and rows:
                    first_row = rows[0]
                cursor.executemany(UPSERT_SQL, rows)
                total += len(rows)
        connection.commit()

    return total, first_row or {}


def inspect_csv(csv_path: Path, encoding: str) -> Tuple[int, Dict[str, object]]:
    total = 0
    first_row = None
    for row in iter_rows(csv_path, encoding):
        if first_row is None:
            first_row = row
        total += 1
    return total, first_row or {}


def main():
    parser = argparse.ArgumentParser(description="주유소 가격 CSV를 MySQL gas_stations 테이블에 적재합니다.")
    parser.add_argument("--csv", default=DEFAULT_CSV_PATH, help="CSV 파일 경로")
    parser.add_argument("--encoding", default="cp949", help="CSV 인코딩. 기본값: cp949")
    parser.add_argument("--batch-size", type=int, default=1000, help="executemany 배치 크기")
    parser.add_argument("--dry-run", action="store_true", help="DB 적재 없이 CSV 파싱과 컬럼 매핑만 확인")
    args = parser.parse_args()

    csv_path = Path(args.csv).expanduser()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV 파일을 찾을 수 없습니다: {csv_path}")

    if args.dry_run:
        total, first_row = inspect_csv(csv_path, args.encoding)
        print(f"valid_csv_rows={total}")
    else:
        total, first_row = import_csv(csv_path, args.encoding, args.batch_size)
        print(f"imported_rows={total}")
        print(f"database={os.getenv('DB_NAME', 'gas_price_db')}")
        print("table=gas_stations")

    if first_row:
        print(f"first_station_code={first_row['station_code']}")
        print(f"first_station_name={first_row['name']}")


if __name__ == "__main__":
    main()
