from typing import Optional

from fastapi import APIRouter, Query

from crud import DatabaseError, InvalidFuelError, get_station_by_code, search_stations
router = APIRouter(prefix="/api/stations", tags=["stations"])


ERROR_MESSAGES = {
    "INVALID_FUEL": "지원하지 않는 유종입니다.",
    "NO_RESULT": "검색 결과가 없습니다.",
    "DB_ERROR": "데이터베이스 연결 중 오류가 발생했습니다.",
}


def _error_response(error_code: str, status: int = 200):
    _ = status
    return {
        "success": False,
        "error_code": error_code,
        "message": ERROR_MESSAGES.get(error_code, "요청 처리 중 오류가 발생했습니다."),
    }


def _handle_station_list(data):
    if not data:
        return {
            "success": False,
            "error_code": "NO_RESULT",
            "message": ERROR_MESSAGES["NO_RESULT"],
            "count": 0,
            "data": [],
        }
    return {"success": True, "count": len(data), "data": data}


@router.get("/search")
def search(
    fuel: str,
    region: Optional[str] = None,
    brand: Optional[str] = None,
    self_only: bool = False,
    sort: str = Query("price_asc", pattern="^(price_asc|price_desc)$"),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        data = search_stations(
            fuel=fuel,
            region=region,
            brand=brand,
            self_only=self_only,
            sort=sort,
            limit=limit,
        )
        return _handle_station_list(data)
    except InvalidFuelError:
        return _error_response("INVALID_FUEL")
    except DatabaseError:
        return _error_response("DB_ERROR")


@router.get("/cheapest")
def cheapest(
    fuel: str,
    region: Optional[str] = None,
    limit: int = Query(5, ge=1, le=100),
):
    try:
        data = search_stations(fuel=fuel, region=region, sort="price_asc", limit=limit)
        return _handle_station_list(data)
    except InvalidFuelError:
        return _error_response("INVALID_FUEL")
    except DatabaseError:
        return _error_response("DB_ERROR")


@router.get("/{station_code}")
def detail(station_code: str):
    try:
        data = get_station_by_code(station_code)
        if not data:
            return {
                "success": False,
                "error_code": "NO_RESULT",
                "message": ERROR_MESSAGES["NO_RESULT"],
                "data": None,
            }
        return {"success": True, "data": data}
    except DatabaseError:
        return _error_response("DB_ERROR")
