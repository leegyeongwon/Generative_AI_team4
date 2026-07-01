# Fuel Finder PHP Web

Apache + PHP(PDO) + MySQL 기반 주유소 가격 검색 웹사이트입니다. 기존 FastAPI `backend`는 유지하고, 이 폴더는 평가 기준의 Apache/PHP-MySQL 연동을 보여주기 위한 웹 루트입니다.

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

`config/db.config.php`는 기본값만 둡니다. 실제 비밀번호와 API Key는 코드 저장소에 공개하지 않고 환경변수 또는 `config/local.config.php`로 주입합니다.

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

서버에서 파일로 관리하려면:

```bash
cd /var/www/html/fuel-finder
cp config/local.config.example.php config/local.config.php
nano config/local.config.php
```

`config/local.config.php` 예시:

```php
<?php
return [
    'password' => '실제_DB_비밀번호',
    'naver_maps_client_id' => 'Naver_Maps_Client_ID',
];
```

## Naver Maps 연동

`naver_maps_client_id`가 비어 있으면 지도 영역은 placeholder/fallback으로 동작합니다. 값을 설정하면 검색 결과의 `latitude`, `longitude` 기준으로 실제 Naver 지도 마커가 표시됩니다.

환경변수 방식:

```bash
export NAVER_MAPS_CLIENT_ID="발급받은_Maps_Client_ID"
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
   - 홈 탭에서 지역/유종 빠른 검색 화면이 표시되는지 확인

2. 지역 검색
   - 홈 탭에서 `서울 휘발유`, `경기 경유`, `서울 셀프` 버튼 클릭
   - 가격 검색 탭으로 이동하면서 지역/유종/셀프 조건이 자동 입력되는지 확인
   - 가격 낮은 순 결과 표시 확인

3. 최저가 검색
   - 지역 `경기`, 유종 `경유`
   - `최저가 5곳` 버튼 클릭

4. 상세 조회
   - 결과 카드의 `상세 보기` 클릭
   - 휘발유, 경유, 고급휘발유, 실내등유 가격 확인

5. 지도 표시
   - `지도 보기` 탭 클릭 시 가격 검색 화면 오른쪽 지도 패널로 이동
   - `NAVER_MAPS_CLIENT_ID`를 설정하면 실제 지도 SDK가 로드되고 좌표 기준 마커가 표시됨
   - 지도 오류가 발생해도 검색 결과는 유지되고 임시 좌표 마커로 전환됨

6. 음성/자연어 검색
   - `음성 검색` 탭에서 오디오 파일 선택 후 `마이크` 버튼 클릭
   - `/api/csr_recognize.php` placeholder 문장이 음성 검색 박스에 반영됨
   - `/api/parse_query.php` 결과를 검색 조건으로 사용해 가격 검색 탭으로 이동

## 오류 처리

| 조건 | HTTP | error_code |
| --- | --- | --- |
| 잘못된 유종 | 400 | INVALID_FUEL |
| 필수값 누락 | 400 | VALIDATION_ERROR |
| 검색 결과 없음 | 404 | NO_RESULT |
| DB 연결/쿼리 실패 | 500 | DB_ERROR |
| 잘못된 HTTP Method | 405 | METHOD_NOT_ALLOWED |
