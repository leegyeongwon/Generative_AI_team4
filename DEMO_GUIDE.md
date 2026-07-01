import argparse
import csv
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import pymysql
from dotenv import load_dotenv


load_dotenv()

DATA_DIR = Path(__file__).resolve().parent / "data"

TABLE_ORDER = [
    "station_price_history",
    "reviews",
    "favorites",
    "stations",
    "users",
]


def env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, default))
    except ValueError:
        return default


def db_name() -> str:
    return os.getenv("DB_NAME", "gas_station")


def connect(database: Optional[str] = None):
    config = {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": env_int("DB_PORT", 3306),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
        "connect_timeout": env_int("DB_CONNECT_TIMEOUT", 5),
        "read_timeout": env_int("DB_READ_TIMEOUT", 10),
        "write_timeout": env_int("DB_WRITE_TIMEOUT", 10),
    }
    if database:
        config["database"] = database
    return pymysql.connect(**config)


def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


def required(row: Dict[str, str], key: str) -> str:
    value = (row.get(key) or "").strip()
    if not value:
        raise ValueError(f"필수 값 누락: {key}, row={row}")
    return value


def nullable(row: Dict[str, str], key: str) -> Optional[str]:
    value = (row.get(key) or "").strip()
    return value or None


def to_int(value: Optional[str]) -> Optional[int]:
    value = (value or "").replace(",", "").strip()
    if not value or value == "-":
        return None
    return int(value)


def to_decimal(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


def to_date(value: str) -> str:
    value = value.strip()
    return datetime.strptime(value, "%Y%m%d").date().isoformat()


def execute_sql_file(sql_path: Path) -> None:
    sql = sql_path.read_text(encoding="utf-8")
    statements = [statement.strip() for statement in sql.split(";") if statement.strip()]
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
        connection.commit()


def ensure_database() -> None:
    try:
        with connect(db_name()) as connection:
            connection.ping()
        return
    except pymysql.MySQLError:
        pass

    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name()}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        connection.commit()


def ensure_tables() -> None:
    ddl = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
    statements = [
        statement.strip()
        for statement in ddl.split(";")
        if statement.strip() and not statement.strip().upper().startswith("DROP TABLE")
    ]
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
        connection.commit()


def truncate_tables() -> None:
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            for table in TABLE_ORDER:
                cursor.execute(f"TRUNCATE TABLE {table}")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        connection.commit()


def import_users(data_dir: Path) -> Tuple[int, Dict[str, int]]:
    rows = read_csv(data_dir / "users.csv")
    users = [
        {
            "username": required(row, "아이디"),
            "email": required(row, "이메일"),
            # Demo seed data only. Replace with a real password hash before auth is used.
            "password_hash": required(row, "비밀번호"),
        }
        for row in rows
    ]
    sql = """
        INSERT INTO users (username, email, password_hash)
        VALUES (%(username)s, %(email)s, %(password_hash)s)
        ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            password_hash = VALUES(password_hash)
    """
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(sql, users)
            cursor.execute("SELECT id, username FROM users")
            user_ids = {row["username"]: row["id"] for row in cursor.fetchall()}
        connection.commit()
    return len(users), user_ids


def import_stations(data_dir: Path) -> int:
    rows = read_csv(data_dir / "stations.csv")
    stations = [
        {
            "station_code": required(row, "번호"),
            "station_name": required(row, "상호"),
            "address": required(row, "주소"),
            "brand": nullable(row, "상표"),
            "self_yn": nullable(row, "셀프여부"),
            "longitude": to_decimal(row.get("X좌표")),
            "latitude": to_decimal(row.get("Y좌표")),
        }
        for row in rows
    ]
    sql = """
        INSERT INTO stations (
            station_code, station_name, address, brand, self_yn, latitude, longitude
        ) VALUES (
            %(station_code)s, %(station_name)s, %(address)s, %(brand)s,
            %(self_yn)s, %(latitude)s, %(longitude)s
        )
        ON DUPLICATE KEY UPDATE
            station_name = VALUES(station_name),
            address = VALUES(address),
            brand = VALUES(brand),
            self_yn = VALUES(self_yn),
            latitude = VALUES(latitude),
            longitude = VALUES(longitude)
    """
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(sql, stations)
        connection.commit()
    return len(stations)


def import_price_history(data_dir: Path) -> int:
    rows = read_csv(data_dir / "station_price_history.csv")
    prices = [
        {
            "station_code": required(row, "번호"),
            "price_date": to_date(required(row, "기간")),
            "premium_gasoline_price": to_int(row.get("고급휘발유")),
            "gasoline_price": to_int(row.get("휘발유")),
            "diesel_price": to_int(row.get("경유")),
            "indoor_kerosene_price": to_int(row.get("실내등유")),
        }
        for row in rows
    ]
    sql = """
        INSERT INTO station_price_history (
            station_code, price_date, premium_gasoline_price, gasoline_price,
            diesel_price, indoor_kerosene_price
        ) VALUES (
            %(station_code)s, %(price_date)s, %(premium_gasoline_price)s,
            %(gasoline_price)s, %(diesel_price)s, %(indoor_kerosene_price)s
        )
        ON DUPLICATE KEY UPDATE
            premium_gasoline_price = VALUES(premium_gasoline_price),
            gasoline_price = VALUES(gasoline_price),
            diesel_price = VALUES(diesel_price),
            indoor_kerosene_price = VALUES(indoor_kerosene_price)
    """
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(sql, prices)
        connection.commit()
    return len(prices)


def import_favorites(data_dir: Path, user_ids: Dict[str, int]) -> int:
    rows = read_csv(data_dir / "favorites.csv")
    favorites = [
        {
            "user_id": user_ids[required(row, "유저아이디")],
            "station_code": required(row, "주유소 번호"),
        }
        for row in rows
    ]
    sql = """
        INSERT IGNORE INTO favorites (user_id, station_code)
        VALUES (%(user_id)s, %(station_code)s)
    """
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(sql, favorites)
        connection.commit()
    return len(favorites)


def import_reviews(data_dir: Path, user_ids: Dict[str, int]) -> int:
    rows = read_csv(data_dir / "reviews.csv")
    reviews = [
        {
            "user_id": user_ids[required(row, "유저아이디")],
            "station_code": required(row, "주유소번호"),
            "rating": to_int(row.get("점수")),
            "content": required(row, "내용"),
        }
        for row in rows
    ]
    sql = """
        INSERT INTO reviews (user_id, station_code, rating, content)
        VALUES (%(user_id)s, %(station_code)s, %(rating)s, %(content)s)
    """
    with connect(db_name()) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(sql, reviews)
        connection.commit()
    return len(reviews)


def inspect_csvs(data_dir: Path) -> None:
    for filename in [
        "stations.csv",
        "station_price_history.csv",
        "users.csv",
        "favorites.csv",
        "reviews.csv",
    ]:
        rows = read_csv(data_dir / filename)
        print(f"{filename} rows={len(rows)} columns={','.join(rows[0].keys()) if rows else ''}")


def main() -> None:
    parser = argparse.ArgumentParser(description="프로젝트 CSV 5개를 normalized MySQL 스키마에 적재합니다.")
    parser.add_argument("--data-dir", default=str(DATA_DIR), help="CSV 파일들이 있는 폴더")
    parser.add_argument("--reset", action="store_true", help="schema.sql 기준으로 테이블을 drop/create")
    parser.add_argument("--truncate", action="store_true", help="기존 테이블 데이터를 비우고 다시 적재")
    parser.add_argument("--dry-run", action="store_true", help="CSV 헤더와 row 수만 확인")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).expanduser()
    if args.dry_run:
        inspect_csvs(data_dir)
        return

    if args.reset:
        execute_sql_file(Path(__file__).with_name("schema.sql"))
    else:
        ensure_database()
        ensure_tables()

    if args.truncate:
        truncate_tables()

    users_count, user_ids = import_users(data_dir)
    stations_count = import_stations(data_dir)
    prices_count = import_price_history(data_dir)
    favorites_count = import_favorites(data_dir, user_ids)
    reviews_count = import_reviews(data_dir, user_ids)

    print(f"database={db_name()}")
    print(f"users={users_count}")
    print(f"stations={stations_count}")
    print(f"station_price_history={prices_count}")
    print(f"favorites={favorites_count}")
    print(f"reviews={reviews_count}")


if __name__ == "__main__":
    main()
