# 주유소 가격 검색 및 AI 음성 검색 서비스 API 명세서

## 1. 기본 정보

| 항목 | 내용 |
| --- | --- |
| 프로젝트명 | 주유소 가격 검색 및 AI 음성 검색 서비스 |
| API 목적 | MySQL에 적재된 주유소 가격 데이터를 조회하고 Maps/CSR/LiteLLM 기능과 연결 |
| 응답 형식 | JSON |
| 백엔드 | Python FastAPI |
| DB | MySQL |

## 2. API 목록

| API ID | Method | URL | 기능 |
| --- | --- | --- | --- |
| API-01 | GET | `/api/stations/search` | 주유소 조건 검색 |
| API-02 | GET | `/api/stations/{station_code}` | 주유소 상세 조회 |
| API-03 | GET | `/api/stations/cheapest` | 최저가 주유소 조회 |
| API-04 | GET | `/api/maps/stations` | 지도 표시용 주유소 데이터 조회 |
| API-05 | POST | `/api/csr/recognize` | 음성 파일을 텍스트로 변환 |
| API-06 | POST | `/api/llm/parse-query` | 자연어 문장을 검색 조건으로 변환 |
| API-07 | GET | `/api/health` | 서버 상태 확인 |

## 3. 공통 유종 값

| fuel 값 | 의미 | DB 컬럼 |
| --- | --- | --- |
| `premium` | 고급휘발유 | `station_price_history.premium_gasoline_price` |
| `gasoline` | 휘발유 | `station_price_history.gasoline_price` |
| `diesel` | 경유 | `station_price_history.diesel_price` |
| `kerosene` | 실내등유 | `station_price_history.indoor_kerosene_price` |

## 4. 상세 API

### API-01. 주유소 조건 검색

`GET /api/stations/search`

| 이름 | 타입 | 필수 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| region | string | X | 주소 기반 지역명 검색 | `서울` |
| fuel | string | O | 유종 | `gasoline` |
| brand | string | X | 상표 | `SK에너지` |
| self_only | boolean | X | 셀프 주유소만 조회 | `true` |
| sort | string | X | `price_asc`, `price_desc` | `price_asc` |
| limit | int | X | 조회 개수, 최대 100 | `10` |

응답 예시:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "station_code": "A0001132",
      "name": "주유소명",
      "region": "서울 금천구",
      "address": "서울 금천구 독산로 147",
      "brand": "HD현대오일뱅크",
      "is_self": "셀프",
      "fuel": "gasoline",
      "price": 1833,
      "latitude": 37.4605037,
      "longitude": 126.9044463
    }
  ]
}
```

### API-02. 주유소 상세 조회

`GET /api/stations/{station_code}`

응답 예시:

```json
{
  "success": true,
  "data": {
    "station_code": "A0001132",
    "region": "서울 금천구",
    "name": "주유소명",
    "address": "서울 금천구 독산로 147",
    "brand": "HD현대오일뱅크",
    "is_self": "셀프",
    "prices": {
      "premium": 0,
      "gasoline": 1833,
      "diesel": 1833,
      "kerosene": 0
    },
    "latitude": 37.4605037,
    "longitude": 126.9044463
  }
}
```

### API-03. 최저가 주유소 조회

`GET /api/stations/cheapest`

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| region | string | X | 주소 기반 지역명 검색 |
| fuel | string | O | 유종 |
| limit | int | X | 조회 개수 |

### API-04. 지도 표시용 주유소 데이터 조회

`GET /api/maps/stations`

검색 API와 비슷하게 동작하며, `latitude`, `longitude`가 `NULL`이 아닌 데이터만 반환합니다.

### API-05. CSR 음성 인식

`POST /api/csr/recognize`

`multipart/form-data`로 `audio_file` 필드를 업로드합니다. 기존 테스트 편의를 위해 `file` 필드도 호환 지원합니다.

응답 예시:

```json
{
  "success": true,
  "text": "서울 강남구에서 휘발유 제일 싼 주유소 찾아줘",
  "message": "CSR 연동 예정"
}
```

### API-06. LiteLLM 자연어 검색 조건 변환

`POST /api/llm/parse-query`

요청:

```json
{
  "query": "서울 강남구에서 휘발유 제일 싼 셀프 주유소 찾아줘"
}
```

응답:

```json
{
  "success": true,
  "data": {
    "region": "서울 강남구",
    "fuel": "gasoline",
    "sort": "price_asc",
    "self_only": true,
    "brand": null,
    "limit": 10
  },
  "message": "LiteLLM 연동 예정"
}
```

### API-07. 서버 상태 확인

`GET /api/health`

```json
{
  "success": true,
  "server": "running",
  "database": "connected"
}
```

## 5. 공통 오류 응답

```json
{
  "success": false,
  "error_code": "NO_RESULT",
  "message": "검색 결과가 없습니다."
}
```

```json
{
  "success": false,
  "error_code": "INVALID_FUEL",
  "message": "지원하지 않는 유종입니다."
}
```

```json
{
  "success": false,
  "error_code": "DB_ERROR",
  "message": "데이터베이스 연결 중 오류가 발생했습니다."
}
```
