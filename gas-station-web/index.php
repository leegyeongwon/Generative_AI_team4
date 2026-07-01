<?php
$config = require __DIR__ . '/config/db.config.php';
$hasMapKey = trim($config['naver_maps_client_id']) !== '';
$cssVersion = filemtime(__DIR__ . '/css/style.css');
$jsVersion = filemtime(__DIR__ . '/js/app.js');
?>
<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Fuel Finder</title>
    <link rel="stylesheet" href="css/style.css?v=<?= $cssVersion ?>">
    <?php if ($hasMapKey): ?>
        <script
            src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<?= htmlspecialchars($config['naver_maps_client_id'], ENT_QUOTES) ?>"
            onerror="window.NAVER_MAPS_LOAD_FAILED = true"
        ></script>
    <?php endif; ?>
</head>
<body>
    <header class="topbar">
        <a class="brand" href="#home" data-view-link="home" aria-label="Fuel Finder 홈">
            <span class="brand-mark">F</span>
            <span>Fuel Finder</span>
        </a>
        <nav class="nav" aria-label="주요 메뉴">
            <button class="nav-button active" type="button" data-view-link="home">홈</button>
            <button class="nav-button" type="button" data-view-link="search">가격 검색</button>
            <button class="nav-button" type="button" data-view-link="map">지도 보기</button>
            <button class="nav-button" type="button" data-view-link="voice">음성 검색</button>
        </nav>
    </header>

    <main class="app-shell">
        <section class="workspace" id="homeView" data-view="home">
            <div class="conversation">
                <div class="assistant-bubble">
                    <strong>어느 지역의 저렴한 주유소를 찾고 계신가요?</strong>
                    <span>지역과 유종을 입력하면 Cloud DB 가격 데이터 기준으로 낮은 가격순 결과를 보여드립니다.</span>
                </div>
                <div class="quick-row">
                    <button type="button" class="quick-chip" data-preset-region="서울" data-preset-fuel="gasoline">서울 휘발유</button>
                    <button type="button" class="quick-chip" data-preset-region="경기" data-preset-fuel="diesel">경기 경유</button>
                    <button type="button" class="quick-chip" data-preset-region="서울" data-preset-fuel="gasoline" data-preset-self="true">서울 셀프</button>
                </div>
            </div>

            <form class="search-dock" id="searchForm">
                <label class="field">
                    <span>지역</span>
                    <input type="search" id="regionInput" name="region" placeholder="예: 서울, 서울 강남구, 경기 성남시">
                </label>
                <label class="field compact">
                    <span>유종</span>
                    <select id="fuelSelect" name="fuel" required>
                        <option value="gasoline">휘발유</option>
                        <option value="diesel">경유</option>
                        <option value="premium">고급휘발유</option>
                        <option value="kerosene">실내등유</option>
                    </select>
                </label>
                <label class="toggle">
                    <input type="checkbox" id="selfOnlyInput" name="self_only">
                    <span>셀프만</span>
                </label>
                <button class="primary-button" type="submit">검색</button>
            </form>
        </section>

        <section class="workspace two-column active" id="searchView" data-view="search">
            <aside class="control-panel">
                <div class="section-heading">
                    <p>조건 검색</p>
                    <h1>주유소 가격 검색</h1>
                </div>
                <form id="filterForm" class="filter-form">
                    <label class="field">
                        <span>지역</span>
                        <input type="search" id="filterRegion" name="region" placeholder="서울 또는 경기">
                    </label>
                    <label class="field">
                        <span>유종</span>
                        <select id="filterFuel" name="fuel" required>
                            <option value="gasoline">휘발유</option>
                            <option value="diesel">경유</option>
                            <option value="premium">고급휘발유</option>
                            <option value="kerosene">실내등유</option>
                        </select>
                    </label>
                    <label class="field">
                        <span>브랜드</span>
                        <input type="search" id="filterBrand" name="brand" placeholder="SK에너지, GS칼텍스">
                    </label>
                    <div class="segmented" role="group" aria-label="정렬">
                        <input type="radio" id="sortAsc" name="sort" value="price_asc" checked>
                        <label for="sortAsc">낮은 가격</label>
                        <input type="radio" id="sortDesc" name="sort" value="price_desc">
                        <label for="sortDesc">높은 가격</label>
                    </div>
                    <div class="inline-options">
                        <label class="toggle">
                            <input type="checkbox" id="filterSelfOnly" name="self_only">
                            <span>셀프 주유소</span>
                        </label>
                        <label class="field mini">
                            <span>개수</span>
                            <input type="number" id="filterLimit" name="limit" value="10" min="1" max="100">
                        </label>
                    </div>
                    <button class="primary-button full" type="submit">검색 실행</button>
                </form>
            </aside>

            <section class="results-panel">
                <div class="result-header">
                    <div>
                        <p id="resultEyebrow">Cloud DB 연결 대기</p>
                        <h2 id="resultTitle">검색 조건을 입력하세요</h2>
                    </div>
                    <button class="ghost-button" id="cheapestButton" type="button">최저가 5곳</button>
                </div>
                <div class="status-line" id="statusLine">서울 또는 경기 기준으로 시연하면 결과 확인이 쉽습니다.</div>
                <div class="result-list" id="resultList"></div>
            </section>

            <section class="map-panel" id="mapView" data-view="map">
                <div class="map-toolbar">
                    <div>
                        <p>지도 보기</p>
                        <h2>주유소 위치</h2>
                    </div>
                    <span class="map-state" id="mapState">지도 준비</span>
                </div>
                <div class="map-canvas" id="mapCanvas">
                    <div class="map-placeholder">
                        <span class="pin-visual"></span>
                        <strong>Naver Maps 연동 대기</strong>
                        <span>API Key를 설정하면 검색 결과 좌표로 마커가 표시됩니다.</span>
                    </div>
                </div>
            </section>
        </section>

        <section class="workspace" id="voiceView" data-view="voice">
            <div class="voice-panel">
                <div class="section-heading">
                    <p>CSR + LiteLLM</p>
                    <h1>음성 검색 흐름</h1>
                </div>
                <div class="voice-actions">
                    <input type="file" id="audioFile" accept="audio/*">
                    <button class="voice-button" id="voiceButton" type="button" aria-label="음성 인식 실행">마이크</button>
                    <button class="primary-button" id="parseDemoButton" type="button">자연어 검색</button>
                </div>
                <div class="transcript" id="transcriptBox">서울 강남구에서 휘발유 제일 싼 셀프 주유소 찾아줘</div>
            </div>
        </section>
    </main>

    <dialog class="detail-dialog" id="detailDialog">
        <div class="dialog-body" id="detailBody"></div>
        <button class="ghost-button close-dialog" id="closeDialog" type="button">닫기</button>
    </dialog>

    <script>
        window.NAVER_MAPS_ENABLED = <?= $hasMapKey ? 'true' : 'false' ?>;
        window.NAVER_MAPS_LOAD_FAILED = false;
    </script>
    <script src="js/app.js?v=<?= $jsVersion ?>"></script>
</body>
</html>
