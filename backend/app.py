import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import check_database_connection
from routers import csr, llm, maps, stations


app = FastAPI(
    title="Gas Station Price Search API",
    description="MySQL에 적재된 주유소 가격 데이터를 조회하는 FastAPI 백엔드",
    version="1.0.0",
)


def _get_cors_origins():
    origins = os.getenv("CORS_ORIGINS", "*")
    if origins == "*":
        return ["*"]
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    db_connected = check_database_connection()
    return {
        "success": db_connected,
        "server": "running",
        "database": "connected" if db_connected else "disconnected",
    }


app.include_router(stations.router)
app.include_router(maps.router)
app.include_router(csr.router)
app.include_router(llm.router)
