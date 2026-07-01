from typing import Optional

from fastapi import APIRouter, Query

from crud import DatabaseError, InvalidFuelError, search_stations
router = APIRouter(prefix="/api/maps", tags=["maps"])


ERROR_MESSAGES = {
    "INVALID_FUEL": "지원하지 않는 유종입니다.",
    "NO_RESULT": "검색 결과가 없습니다.",
    "DB_ERROR": "데이터베이스 연결 중 오류가 발생했습니다.",
}


@router.get("/stations")
def map_stations(
    fuel: str,
    region: Optional[str] = None,
    brand: Optional[str] = None,
    self_only: bool = False,
    sort: str = Query("price_asc", pattern="^(price_asc|price_desc)$"),
    limit: int = Query(50, ge=1, le=100),
):
    try:
        data = search_stations(
            fuel=fuel,
            region=region,
            brand=brand,
            self_only=self_only,
            sort=sort,
            limit=limit,
            require_coordinates=True,
        )
    except InvalidFuelError:
        return {
            "success": False,
            "error_code": "INVALID_FUEL",
            "message": ERROR_MESSAGES["INVALID_FUEL"],
        }
    except DatabaseError:
        return {
            "success": False,
            "error_code": "DB_ERROR",
            "message": ERROR_MESSAGES["DB_ERROR"],
        }

    if not data:
        return {
            "success": False,
            "error_code": "NO_RESULT",
            "message": ERROR_MESSAGES["NO_RESULT"],
            "count": 0,
            "data": [],
        }
    return {"success": True, "count": len(data), "data": data}
