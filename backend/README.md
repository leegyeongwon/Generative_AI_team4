# 주유소 가격 검색 백엔드 API

FastAPI와 MySQL을 사용해 정규화된 주유소 가격 비교 DB를 조회하는 API 서버입니다.

## 프로젝트 구조

```text
backend/
├── app.py
├── database.py
├── crud.py
├── schemas.py
├── requirements.txt
├── .env.example
├── schema.sql
├── create_tables.sql
├── import_project_data.py
├── import_csv.py
├── API_명세서.md
├── API_SPEC.md
├── 테스트_curl_목록.txt
├── TEST_CURLS.txt
├── 시연_가이드.md
├── DEMO_GUIDE.md
├── data/
│   ├── stations.csv
│   ├── station_price_history.csv
│   ├── users.csv
│   ├── favorites.csv
│   └── reviews.csv
├── routers/
│   ├── stations.py
│   ├── maps.py
│   ├── csr.py
│   └── llm.py
└── README.md
```

## DB 테이블

현재 API는 아래 정규화 스키마를 기준으로 동작합니다.

- `users`
- `stations`
- `station_price_history`
- `favorites`
- `reviews`

DDL은 `schema.sql`에 있습니다.

주의: 제공된 DDL에 맞춰 등유 가격 컬럼명은 `indoor_kerosene_price`를 사용합니다.

제출/공유용 파일:

- `API_명세서.md`: API 목록, 요청/응답, 오류 응답 정리
- `create_tables.sql`: Cloud DB에 테이블을 생성하는 SQL
- `import_csv.py`: CSV 적재 실행 파일
- `테스트_curl_목록.txt`: 발표 시연용 curl 명령어 모음
- `시연_가이드.md`: 사용자 질문 케이스별 API 호출/응답 설명
- Linux 서버에서 한글 파일명이 불편하면 `API_SPEC.md`, `TEST_CURLS.txt`, `DEMO_GUIDE.md`를 사용합니다.

## API 명세 유지 여부

현재 API 명세는 그대로 유지합니다.

- 검색: `GET /api/stations/search`
- 상세: `GET /api/stations/{station_code}`
- 최저가: `GET /api/stations/cheapest`
- 지도: `GET /api/maps/stations`
- CSR placeholder: `POST /api/csr/recognize`
- LiteLLM placeholder: `POST /api/llm/parse-query`
- 상태 확인: `GET /api/health`

DB는 기존 단일 테이블이 아니라 `stations`와 `station_price_history`를 조인하지만, API 응답 형식은 명세와 호환되게 유지했습니다.

## 실행 방법

### 1. 패키지 설치

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에서 MySQL 접속 정보를 수정합니다.

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gas_station
CORS_ORIGINS=*
```

### 3. 서버 실행

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

API 문서:

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

## 프로젝트 CSV를 MySQL에 적재하기

아래 5개 CSV를 정규화 스키마에 적재합니다.

- `stations.csv`
- `station_price_history.csv`
- `users.csv`
- `favorites.csv`
- `reviews.csv`

기본 CSV 폴더:

```text
backend/data
```

따라서 팀원은 별도 로컬 절대경로를 수정하지 않고 `python import_csv.py --reset`만 실행하면 됩니다.

주요 CSV 매핑:

| CSV 컬럼 | DB 컬럼 |
| --- | --- |
| `stations.csv` `번호` | `stations.station_code` |
| `stations.csv` `상호` | `stations.station_name` |
| `stations.csv` `주소` | `stations.address` |
| `stations.csv` `상표` | `stations.brand` |
| `stations.csv` `셀프여부` | `stations.self_yn` |
| `stations.csv` `X좌표` | `stations.longitude` |
| `stations.csv` `Y좌표` | `stations.latitude` |
| `station_price_history.csv` `기간` | `station_price_history.price_date` |
| `station_price_history.csv` `고급휘발유` | `station_price_history.premium_gasoline_price` |
| `station_price_history.csv` `휘발유` | `station_price_history.gasoline_price` |
| `station_price_history.csv` `경유` | `station_price_history.diesel_price` |
| `station_price_history.csv` `실내등유` | `station_price_history.indoor_kerosene_price` |

### 1. 로컬 `.env` 확인

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gas_station
```

### 2. CSV 구조 확인

DB에 넣기 전에 CSV 헤더와 행 수를 확인합니다.

```bash
cd backend
source .venv/bin/activate
python import_csv.py --dry-run
```

정상 예:

```text
stations.csv rows=2572 ...
station_price_history.csv rows=2572 ...
users.csv rows=2 ...
favorites.csv rows=2 ...
reviews.csv rows=2 ...
```

### 3. 로컬 DB 초기화 후 적재

```bash
python import_csv.py --reset
```

기존 테이블은 유지하고 데이터만 비운 뒤 다시 넣으려면:

```bash
python import_csv.py --truncate
```

정상 실행 예:

```text
database=gas_station
users=2
stations=2572
station_price_history=2572
favorites=2
reviews=2
```

### 4. MySQL에서 적재 확인

```bash
mysql -h 127.0.0.1 -u root gas_station
```

```sql
SELECT COUNT(*) FROM stations;
SELECT COUNT(*) FROM station_price_history;

SELECT s.station_code, s.station_name, s.address, h.gasoline_price
FROM stations s
JOIN station_price_history h ON s.station_code = h.station_code
WHERE s.address LIKE '%서울%' AND h.gasoline_price > 0
ORDER BY h.gasoline_price ASC
LIMIT 10;
```

## 유종 파라미터

`fuel` 값은 다음 중 하나만 사용할 수 있습니다.

| fuel | DB 컬럼 |
| --- | --- |
| `premium` | `premium_gasoline_price` |
| `gasoline` | `gasoline_price` |
| `diesel` | `diesel_price` |
| `kerosene` | `indoor_kerosene_price` |

잘못된 유종이 전달되면 `INVALID_FUEL` 오류가 반환됩니다.

## 발표 시연용 curl 명령어

아래 예시는 서버가 `http://localhost:8000`에서 실행 중이라고 가정합니다.

### 1. 서버와 DB 연결 상태 확인

```bash
curl -s "http://localhost:8000/api/health" | python -m json.tool
```

예상 응답:

```json
{
  "success": true,
  "server": "running",
  "database": "connected"
}
```

### 2. 서울 휘발유 최저가 검색

```bash
curl -G "http://localhost:8000/api/stations/search" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "sort=price_asc" \
  --data-urlencode "limit=10" | python -m json.tool
```

### 3. 서울 셀프 주유소만 검색

```bash
curl -G "http://localhost:8000/api/stations/search" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "self_only=true" \
  --data-urlencode "limit=10" | python -m json.tool
```

### 4. 경기 경유 최저가 주유소 조회

```bash
curl -G "http://localhost:8000/api/stations/cheapest" \
  --data-urlencode "region=경기" \
  --data-urlencode "fuel=diesel" \
  --data-urlencode "limit=5" | python -m json.tool
```

### 5. 경기 수원시 특정 브랜드 휘발유 검색

```bash
curl -G "http://localhost:8000/api/stations/search" \
  --data-urlencode "region=경기" \
  --data-urlencode "brand=SK에너지" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "limit=10" | python -m json.tool
```

### 6. 서울 지역 지도 표시용 주유소 데이터 조회

```bash
curl -G "http://localhost:8000/api/maps/stations" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "limit=50" | python -m json.tool
```

### 7. 경기 지역 지도 표시용 경유 데이터 조회

```bash
curl -G "http://localhost:8000/api/maps/stations" \
  --data-urlencode "region=경기" \
  --data-urlencode "fuel=diesel" \
  --data-urlencode "limit=50" | python -m json.tool
```

### 8. 특정 주유소 상세 조회

아래 `A0006683`은 CSV에 존재하는 `station_code`입니다.

```bash
curl -s "http://localhost:8000/api/stations/A0006683" | python -m json.tool
```

### 9. 잘못된 유종 오류 테스트

```bash
curl -s "http://localhost:8000/api/stations/search?region=%EC%84%9C%EC%9A%B8&fuel=lpg" | python -m json.tool
```

예상 응답:

```json
{
  "success": false,
  "error_code": "INVALID_FUEL"
}
```

### 10. CSR 음성 인식 placeholder 테스트

`sample.wav`는 테스트할 임의의 음성 파일 경로로 바꿔서 실행합니다.

```bash
curl -s -X POST "http://localhost:8000/api/csr/recognize" \
  -F "file=@sample.wav" | python -m json.tool
```

### 11. LiteLLM 질의 파싱 placeholder 테스트

```bash
curl -s -X POST "http://localhost:8000/api/llm/parse-query" \
  -H "Content-Type: application/json" \
  -d '{"query":"서울 강남구에서 휘발유 제일 싼 셀프 주유소 찾아줘"}' | python -m json.tool
```

## 오류 응답

| error_code | 의미 |
| --- | --- |
| `INVALID_FUEL` | 지원하지 않는 유종 |
| `NO_RESULT` | 검색 결과 없음 |
| `DB_ERROR` | DB 연결 또는 쿼리 오류 |

## Naver Cloud 서버 배포/검증 가이드

구성:

```text
임시 바스천: root@211.188.54.91
private webserver: root@10.100.3.7
Cloud DB endpoint: db-47ue49.vpc-cdb.ntruss.com:3306
DB user: gas_admin
```

DB 비밀번호는 코드나 README에 저장하지 말고 webserver의 `.env`에만 입력합니다.

주의:

```text
mysql -h 10.100.3.6 -P 3306 -u gas_admin -p
```

위 명령은 현재 webserver에서 `ERROR 2003 (HY000) ... (113)`로 실패했습니다.
따라서 Cloud DB 접속은 Naver Cloud 콘솔/접속 화면에 표시된 endpoint 도메인
`db-47ue49.vpc-cdb.ntruss.com`을 기준으로 합니다.

### 1. 로컬에서 webserver 접속 확인

```bash
ssh -J root@211.188.54.91 root@10.100.3.7
```

### 2. webserver에서 Cloud DB 접속 확인

webserver에 접속한 뒤:

```bash
mysql -h db-47ue49.vpc-cdb.ntruss.com -P 3306 -u gas_admin -p
```

MySQL 프롬프트에서:

```sql
SHOW DATABASES;
USE gas_station;
SHOW TABLES;
```

### 3. backend 폴더 업로드

로컬 Mac에서 실행:

```bash
scp -o ProxyJump=root@211.188.54.91 -r backend root@10.100.3.7:/root/backend
```

`backend/data` 안에 CSV 5개가 포함되어 있으므로 CSV를 별도로 업로드하지 않아도 됩니다.

zip 파일로 전달할 경우 `backend_submission.zip`을 webserver에 올린 뒤 `/root/backend`로 압축을 풉니다.

### 4. webserver에서 Python 환경 준비

```bash
ssh -J root@211.188.54.91 root@10.100.3.7
cd /root/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 5. webserver `.env` 설정

```bash
cd /root/backend
cp .env.example .env
nano .env
```

예시:

```env
DB_HOST=db-47ue49.vpc-cdb.ntruss.com
DB_PORT=3306
DB_USER=gas_admin
DB_PASSWORD=<Cloud DB password>
DB_NAME=gas_station
DB_CONNECT_TIMEOUT=5
DB_READ_TIMEOUT=10
DB_WRITE_TIMEOUT=10
CORS_ORIGINS=*
```

### 6. Cloud DB 스키마 생성 및 CSV 적재

CSV는 `/root/backend/data`에 포함되어 있습니다.

```bash
cd /root/backend
source .venv/bin/activate
python import_csv.py --dry-run
python import_csv.py --truncate
```

적재 확인:

```bash
mysql -h db-47ue49.vpc-cdb.ntruss.com -P 3306 -u gas_admin -p gas_station
```

```sql
SELECT COUNT(*) FROM stations;
SELECT COUNT(*) FROM station_price_history;

SELECT s.station_code, s.station_name, s.address, h.gasoline_price
FROM stations s
JOIN station_price_history h ON s.station_code = h.station_code
WHERE s.address LIKE '%서울%' AND h.gasoline_price > 0
ORDER BY h.gasoline_price ASC
LIMIT 5;
```

### 7. webserver에서 API 실행

```bash
cd /root/backend
source .venv/bin/activate
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

webserver 내부에서 확인:

```bash
curl -s "http://127.0.0.1:8000/api/health" | python -m json.tool
```

검색 테스트:

```bash
curl -G "http://127.0.0.1:8000/api/stations/search" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "limit=5" | python -m json.tool
```

지도 데이터 테스트:

```bash
curl -G "http://127.0.0.1:8000/api/maps/stations" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "limit=5" | python -m json.tool
```

## 보안 메모

- 사용자 입력값은 모두 parameterized query로 전달합니다.
- 가격 컬럼명은 `fuel` allowlist 매핑으로만 선택합니다.
- 검색 API는 선택한 유종 가격이 0보다 큰 데이터만 반환합니다.
