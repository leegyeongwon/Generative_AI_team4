from fastapi import APIRouter

from schemas import QueryParseRequest


router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.post("/parse-query")
def parse_query(payload: QueryParseRequest):
    # Placeholder: 실제 LiteLLM 연동 시 payload.query를 모델에 전달해 조건을 추출합니다.
    _ = payload.query
    return {
        "success": True,
        "data": {
            "region": "서울 강남구",
            "fuel": "gasoline",
            "sort": "price_asc",
            "self_only": True,
            "brand": None,
            "limit": 10,
        },
        "message": "LiteLLM 연동 예정",
    }
