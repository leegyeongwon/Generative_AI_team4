# Fuel Finder PHP Web

Apache + PHP(PDO) + MySQL 기반 주유소 가격 검색 웹사이트입니다. 별도로 운영하던 FastAPI `backend`는 기능이 이 폴더와 완전히 중복되어 제거했고, 현재는 이 폴더가 유일한 서비스입니다. DB 초기 데이터 적재용 스크립트는 `../scripts/db-seed`에 있습니다.

## 폴더 구조

```text
gas-station-web/
├── index.php
├── config/db.config.php
├── includes/db.php
├── includes/station_repository.php
├── api/
│   ├── health.php
│   ├── search.php
│   ├── cheapest.php
│   ├── station_detail.php
│   ├── map_stations.php
│   ├── csr_recognize.php
│   ├── parse_query.php
│   └── maps_config.php
├── css/style.css
├── js/app.js
└── sql/schema.sql
```

## DB 설정

`config/db.config.php`에서 서버 환경에 맞게 설정합니다. 실제 비밀번호와 API Key는 코드 저장소에 공개하지 않습니다.

```php
return [
    'host' => getenv('DB_HOST') ?: 'db-47ue49.vpc-cdb.ntruss.com',
    'port' => getenv('DB_PORT') ?: '3306',
    'database' => getenv('DB_NAME') ?: 'gas_station',
    'username' => getenv('DB_USER') ?: 'gas_admin',
    'password' => getenv('DB_PASSWORD') ?: 'change_me',
    'naver_maps_client_id' => getenv('NAVER_MAPS_CLIENT_ID') ?: '',
];
```

## 서버 배치 예시

```bash
scp -r gas-station-web root@10.100.3.7:/var/www/html/fuel-finder
```

Apache에서 `/var/www/html/fuel-finder/index.php`로 접속되게 설정합니다. PHP MySQL 확장이 없으면 설치합니다.

```bash
apt update
apt install -y apache2 php php-mysql
systemctl restart apache2
```

## 테스트 curl

서버 내부에서 먼저 확인합니다.

```bash
curl -s "http://127.0.0.1/fuel-finder/api/health.php"
```

서울 휘발유 검색:

```bash
curl -G "http://127.0.0.1/fuel-finder/api/search.php" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "limit=5"
```

경기 경유 최저가:

```bash
curl -G "http://127.0.0.1/fuel-finder/api/cheapest.php" \
  --data-urlencode "region=경기" \
  --data-urlencode "fuel=diesel" \
  --data-urlencode "limit=5"
```

지도 표시용 데이터:

```bash
curl -G "http://127.0.0.1/fuel-finder/api/map_stations.php" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=gasoline" \
  --data-urlencode "limit=10"
```

잘못된 유종 오류:

```bash
curl -G "http://127.0.0.1/fuel-finder/api/search.php" \
  --data-urlencode "region=서울" \
  --data-urlencode "fuel=lpg"
```

CSR placeholder:

```bash
curl -s -X POST "http://127.0.0.1/fuel-finder/api/csr_recognize.php" \
  -F "file=@demo.wav"
```

LiteLLM placeholder:

```bash
curl -s -X POST "http://127.0.0.1/fuel-finder/api/parse_query.php" \
  -H "Content-Type: application/json" \
  -d '{"query":"서울 강남구에서 휘발유 제일 싼 셀프 주유소 찾아줘"}'
```

## 시연 케이스

1. 웹사이트 접속
   - Apache 공인 IP 또는 도메인으로 접속
   - 메인 화면에서 기본 서울 휘발유 결과가 표시되는지 확인

2. 지역 검색
   - 지역 `서울`, 유종 `휘발유`, 개수 `5`
   - 가격 낮은 순 결과 표시

3. 최저가 검색
   - 지역 `경기`, 유종 `경유`
   - `최저가 5곳` 버튼 클릭

4. 상세 조회
   - 결과 카드의 `상세 보기` 클릭
   - 휘발유, 경유, 고급휘발유, 실내등유 가격 확인

5. 지도 표시
   - Naver Maps Key가 없으면 placeholder 좌표 마커 표시
   - `NAVER_MAPS_CLIENT_ID`를 설정하면 실제 지도 SDK가 로드됨

6. 음성/자연어 검색
   - 음성 검색 메뉴에서 마이크 클릭
   - placeholder 문장이 표시됨
   - 자연어 검색 클릭 시 `/api/parse_query.php` 결과를 검색 조건으로 사용

## 오류 처리

| 조건 | HTTP | error_code |
| --- | --- | --- |
| 잘못된 유종 | 400 | INVALID_FUEL |
| 필수값 누락 | 400 | VALIDATION_ERROR |
| 검색 결과 없음 | 404 | NO_RESULT |
| DB 연결/쿼리 실패 | 500 | DB_ERROR |
| 잘못된 HTTP Method | 405 | METHOD_NOT_ALLOWED |
