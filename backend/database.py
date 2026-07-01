import os
from contextlib import contextmanager

import pymysql
from dotenv import load_dotenv
from pymysql.cursors import DictCursor


load_dotenv()


def _get_int_env(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, default))
    except ValueError:
        return default


DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": _get_int_env("DB_PORT", 3306),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "gas_station"),
    "charset": "utf8mb4",
    "cursorclass": DictCursor,
    "autocommit": True,
    "connect_timeout": _get_int_env("DB_CONNECT_TIMEOUT", 5),
    "read_timeout": _get_int_env("DB_READ_TIMEOUT", 10),
    "write_timeout": _get_int_env("DB_WRITE_TIMEOUT", 10),
}


def get_connection():
    return pymysql.connect(**DB_CONFIG)


@contextmanager
def db_cursor():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            yield cursor
    finally:
        connection.close()


def check_database_connection() -> bool:
    try:
        with db_cursor() as cursor:
            cursor.execute("SELECT 1")
            return cursor.fetchone() is not None
    except Exception:
        return False
