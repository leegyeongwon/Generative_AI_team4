from typing import Any, Dict, List, Optional, Tuple

import pymysql

from database import db_cursor


class InvalidFuelError(ValueError):
    pass


class DatabaseError(RuntimeError):
    pass


FUEL_COLUMNS = {
    "premium": "ph.premium_gasoline_price",
    "gasoline": "ph.gasoline_price",
    "diesel": "ph.diesel_price",
    # The provided DDL uses the typo "kerosene"; the import/schema script keeps it.
    "kerosene": "ph.indoor_kerosene_price",
}


def get_fuel_column(fuel: str) -> str:
    try:
        return FUEL_COLUMNS[fuel]
    except KeyError as exc:
        raise InvalidFuelError("INVALID_FUEL") from exc


def _build_search_query(
    *,
    fuel: str,
    region: Optional[str] = None,
    brand: Optional[str] = None,
    self_only: bool = False,
    sort: str = "price_asc",
    limit: int = 20,
    require_coordinates: bool = False,
) -> Tuple[str, List[Any]]:
    price_column = get_fuel_column(fuel)

    # Column names are selected from a fixed allowlist; user values stay parameterized.
    sql = f"""
        SELECT
            s.station_code,
            s.station_name AS name,
            SUBSTRING_INDEX(s.address, ' ', 2) AS region,
            s.address,
            s.brand,
            s.self_yn AS is_self,
            %s AS fuel,
            {price_column} AS price,
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
        WHERE {price_column} > 0
    """
    params: List[Any] = [fuel]

    if region:
        sql += " AND s.address LIKE %s"
        params.append(f"%{region}%")

    if brand:
        sql += " AND s.brand LIKE %s"
        params.append(f"%{brand}%")

    if self_only:
        sql += " AND s.self_yn LIKE %s"
        params.append("%셀프%")

    if require_coordinates:
        sql += " AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL"

    if sort == "price_desc":
        sql += f" ORDER BY {price_column} DESC"
    else:
        sql += f" ORDER BY {price_column} ASC"

    sql += " LIMIT %s"
    params.append(max(1, min(limit, 100)))
    return sql, params


def search_stations(
    *,
    fuel: str,
    region: Optional[str] = None,
    brand: Optional[str] = None,
    self_only: bool = False,
    sort: str = "price_asc",
    limit: int = 20,
    require_coordinates: bool = False,
) -> List[Dict[str, Any]]:
    sql, params = _build_search_query(
        fuel=fuel,
        region=region,
        brand=brand,
        self_only=self_only,
        sort=sort,
        limit=limit,
        require_coordinates=require_coordinates,
    )

    try:
        with db_cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()
    except InvalidFuelError:
        raise
    except pymysql.MySQLError as exc:
        raise DatabaseError("DB_ERROR") from exc


def get_station_by_code(station_code: str) -> Optional[Dict[str, Any]]:
    sql = """
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
        WHERE s.station_code = %s
        LIMIT 1
    """

    try:
        with db_cursor() as cursor:
            cursor.execute(sql, (station_code,))
            row = cursor.fetchone()
    except pymysql.MySQLError as exc:
        raise DatabaseError("DB_ERROR") from exc

    if not row:
        return None

    return {
        "station_code": row["station_code"],
        "region": row["region"],
        "name": row["name"],
        "address": row["address"],
        "brand": row["brand"],
        "is_self": row["is_self"],
        "prices": {
            "premium": row.get("premium_gasoline_price") or 0,
            "gasoline": row.get("gasoline_price") or 0,
            "diesel": row.get("diesel_price") or 0,
            "kerosene": row.get("indoor_kerosene_price") or 0,
        },
        "latitude": row["latitude"],
        "longitude": row["longitude"],
    }
