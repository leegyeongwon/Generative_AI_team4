from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


FuelType = Literal["premium", "gasoline", "diesel", "kerosene"]


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    count: Optional[int] = None
    message: Optional[str] = None
    error_code: Optional[str] = None


class StationSearchItem(BaseModel):
    station_code: str
    name: str
    region: Optional[str] = None
    address: Optional[str] = None
    brand: Optional[str] = None
    is_self: Optional[str] = None
    fuel: FuelType
    price: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class StationDetail(BaseModel):
    station_code: str
    region: Optional[str] = None
    name: str
    address: Optional[str] = None
    brand: Optional[str] = None
    is_self: Optional[str] = None
    prices: Dict[str, int]
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class StationSearchResponse(BaseModel):
    success: bool
    count: int
    data: List[StationSearchItem]


class QueryParseRequest(BaseModel):
    query: str = Field(..., min_length=1)


class QueryParseData(BaseModel):
    region: Optional[str] = None
    fuel: FuelType
    sort: str
    self_only: bool
    brand: Optional[str] = None
    limit: int
