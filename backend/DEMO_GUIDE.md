# 주유소 가격 검색 API 시연 가이드

이 문서는 팀원이 API 호출 코드를 이해하고, 발표에서 사용자가 어떤 식으로 질문했을 때 어떤 API가 호출되는지 설명하기 위한 가이드입니다.

## 1. 시연 기본 주소

로컬 테스트:

```text
http://localhost:8000
```

webserver 배포 후 내부 테스트:

```text
http://127.0.0.1:8000
```

공인 IP 또는 도메인 연결 후:

```text
http://<PUBLIC_IP_OR_DOMAIN>
```

아래 예시는 `BASE_URL=http://localhost:8000` 기준입니다.

## 2. 시연 순서

1. 서버 상태 확인
2. DB에 주유소/가격 데이터가 적재되어 있음을 확인
3. 일반 검색 API 호출
4. 최저가 API 호출
5. 지도 API 호출
6. 상세 조회 API 호출
7. 잘못된 유종 입력 오류 처리 확인
8. CSR/LiteLLM placeholder 흐름 설명

## 3. 발표용 핵심 curl

### 서버/DB 상태 확인

```bash
curl -s "$BASE_URL/api/health" | python -m json.tool
```

정상 응답:

```json
{
  "success": true,
  "server": "running",
  "database": "connected"
}
```

### 사용자가 "서울에서 휘발유 제일 싼 주유소 찾아줘"라고 물어본 경우

호출 API:

```bash
curl -G "$BASE_URL/api/stations/search" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "sort=price_asc" \
  --data-urlencode "limit=5" | python -m json.tool
```

설명:

- `region=서울`: 주소에 서울이 포함된 주유소 검색
- `fuel=gasoline`: 휘발유 가격 기준
- `sort=price_asc`: 낮은 가격순 정렬
- `limit=5`: 상위 5개만 반환

### 사용자가 "서울 셀프 주유소만 보여줘"라고 물어본 경우

```bash
curl -G "$BASE_URL/api/stations/search" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "self_only=true" \
  --data-urlencode "limit=5" | python -m json.tool
```

설명:

- `self_only=true`가 들어가면 `self_yn`에 `셀프`가 포함된 주유소만 조회합니다.

### 사용자가 "경기에서 경유 제일 싼 곳 알려줘"라고 물어본 경우

```bash
curl -G "$BASE_URL/api/stations/cheapest" \
  --data-urlencode "region=경기" \
  --data-urlencode "fuel=diesel" \
  --data-urlencode "limit=5" | python -m json.tool
```

설명:

- `/api/stations/cheapest`는 내부적으로 낮은 가격순 검색과 동일하게 동작합니다.

### 사용자가 "지도에 서울 주유소 표시해줘"라고 물어본 경우

```bash
curl -G "$BASE_URL/api/maps/stations" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "limit=10" | python -m json.tool
```

설명:

- `latitude`, `longitude`가 있는 주유소만 반환합니다.
- 프론트엔드는 이 응답의 좌표로 Naver Maps 마커를 찍으면 됩니다.

### 사용자가 특정 주유소를 클릭한 경우

```bash
curl -s "$BASE_URL/api/stations/A0001132" | python -m json.tool
```

설명:

- 상세 응답에는 주유소 기본 정보와 유종별 가격이 함께 들어 있습니다.

### 사용자가 지원하지 않는 유종을 입력한 경우

```bash
curl -G "$BASE_URL/api/stations/search" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=lpg" | python -m json.tool
```

예상 응답:

```json
{
  "success": false,
  "error_code": "INVALID_FUEL",
  "message": "지원하지 않는 유종입니다."
}
```

## 4. CSR/LiteLLM 흐름 설명

현재 CSR과 LiteLLM은 placeholder입니다. 발표에서는 다음 흐름으로 설명합니다.

```text
음성 파일 업로드
→ /api/csr/recognize
→ 텍스트 변환 결과
→ /api/llm/parse-query
→ region/fuel/self_only/limit 조건 추출
→ /api/stations/search 호출
→ 검색 결과 표시
```

CSR placeholder 테스트:

```bash
curl -s -X POST "$BASE_URL/api/csr/recognize" \
  -F "audio_file=@README.md" | python -m json.tool
```

LiteLLM placeholder 테스트:

```bash
curl -s -X POST "$BASE_URL/api/llm/parse-query" \
  -H "Content-Type: application/json" \
  -d '{"query":"서울 강남구에서 휘발유 제일 싼 셀프 주유소 찾아줘"}' | python -m json.tool
```

## 5. 프론트엔드 호출 코드 예시

### JavaScript fetch

```javascript
const params = new URLSearchParams({
  region: "서울",
  fuel: "gasoline",
  sort: "price_asc",
  limit: "5",
});

const response = await fetch(`${BASE_URL}/api/stations/search?${params}`);
const result = await response.json();
console.log(result);
```

### Python requests

```python
import requests

BASE_URL = "http://localhost:8000"

response = requests.get(
    f"{BASE_URL}/api/stations/search",
    params={
        "region": "서울",
        "fuel": "gasoline",
        "sort": "price_asc",
        "limit": 5,
    },
)
print(response.json())
```

## 6. 발표 멘트 예시

```text
이 API는 사용자가 입력한 지역, 유종, 브랜드, 셀프 여부를 query parameter로 받아
MySQL의 stations 테이블과 station_price_history 테이블을 조인해서 최신 가격 기준으로 조회합니다.
fuel 값은 allowlist로만 DB 컬럼에 매핑해서 SQL Injection 위험을 줄였고,
사용자 입력값은 parameterized query로 처리했습니다.
지도 API는 위도/경도가 있는 데이터만 반환하므로 Naver Maps 마커 표시와 바로 연결할 수 있습니다.
```
