const state = {
  stations: [],
  selectedCode: null,
  map: null,
  markers: [],
};

const fuelLabels = {
  premium: "고급휘발유",
  gasoline: "휘발유",
  diesel: "경유",
  kerosene: "실내등유",
};

const views = document.querySelectorAll(".workspace[data-view]");
const navButtons = document.querySelectorAll("[data-view-link]");
const resultList = document.getElementById("resultList");
const statusLine = document.getElementById("statusLine");
const resultTitle = document.getElementById("resultTitle");
const resultEyebrow = document.getElementById("resultEyebrow");
const mapCanvas = document.getElementById("mapCanvas");
const mapState = document.getElementById("mapState");
const detailDialog = document.getElementById("detailDialog");
const detailBody = document.getElementById("detailBody");

function setView(name) {
  const targetView = name === "map" ? "search" : name;
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === targetView));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.viewLink === name));
  if (name === "map") {
    window.setTimeout(() => document.getElementById("mapView").scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
}

function formatPrice(value) {
  const number = Number(value || 0);
  return number > 0 ? `${number.toLocaleString("ko-KR")}원` : "정보 없음";
}

function buildParams(form) {
  const formData = new FormData(form);
  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (value !== "" && key !== "self_only") {
      params.set(key, value);
    }
  }

  const selfInput = form.querySelector('input[name="self_only"]');
  if (selfInput?.checked) {
    params.set("self_only", "true");
  }

  if (!params.get("fuel")) {
    params.set("fuel", "gasoline");
  }

  return params;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({
    success: false,
    error_code: "INVALID_RESPONSE",
    message: "서버 응답을 해석할 수 없습니다.",
  }));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || "요청 처리 중 오류가 발생했습니다.");
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("error", isError);
}

function renderResults(stations) {
  resultList.innerHTML = "";

  stations.forEach((station, index) => {
    const card = document.createElement("article");
    card.className = "station-card";
    card.dataset.stationCode = station.station_code;

    card.innerHTML = `
      <div class="station-main">
        <div>
          <h3 class="station-name">${escapeHtml(station.name)}</h3>
          <div class="station-meta">${escapeHtml(station.region || "-")} · ${escapeHtml(station.brand || "-")}</div>
        </div>
        <div class="price">${formatPrice(station.price)}</div>
      </div>
      <div class="station-address">${escapeHtml(station.address || "")}</div>
      <div class="badge-row">
        <span class="badge">${fuelLabels[station.fuel] || station.fuel}</span>
        <span class="badge">${escapeHtml(station.is_self || "일반")}</span>
        <span class="badge">#${index + 1}</span>
      </div>
      <button class="ghost-button" type="button" data-detail-code="${escapeHtml(station.station_code)}">상세 보기</button>
    `;

    card.addEventListener("click", (event) => {
      if (event.target.matches("[data-detail-code]")) {
        return;
      }
      selectStation(station.station_code);
    });

    card.querySelector("[data-detail-code]").addEventListener("click", () => showDetail(station.station_code));
    resultList.appendChild(card);
  });
}

function selectStation(stationCode) {
  state.selectedCode = stationCode;
  document.querySelectorAll(".station-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.stationCode === stationCode);
  });
}

async function runSearch(params, endpoint = "api/search.php") {
  setView("search");
  setStatus("검색 중입니다.");
  resultTitle.textContent = "검색 결과 확인 중";
  resultEyebrow.textContent = "Cloud DB 조회";

  try {
    const payload = await fetchJson(`${endpoint}?${params.toString()}`);
    state.stations = payload.data || [];
    renderResults(state.stations);
    renderMap(state.stations);
    resultEyebrow.textContent = `${payload.count}개 결과`;
    resultTitle.textContent = `${fuelLabels[params.get("fuel")] || params.get("fuel")} 가격 검색`;
    setStatus("가격이 있는 최신 데이터 기준으로 정렬했습니다.");
    if (state.stations.length > 0) {
      selectStation(state.stations[0].station_code);
    }
  } catch (error) {
    state.stations = [];
    resultList.innerHTML = "";
    renderMap([]);
    resultEyebrow.textContent = error.payload?.error_code || "ERROR";
    resultTitle.textContent = "검색 실패";
    setStatus(error.message, true);
  }
}

function renderMap(stations) {
  clearStaticMarkers();

  if (window.NAVER_MAPS_ENABLED && window.naver?.maps) {
    try {
      renderNaverMap(stations);
    } catch (error) {
      console.warn("Naver Maps render failed:", error);
      window.NAVER_MAPS_LOAD_FAILED = true;
      state.map = null;
      state.markers = [];
      renderMap(stations);
    }
    return;
  }

  if (window.NAVER_MAPS_LOAD_FAILED) {
    mapState.textContent = "지도 SDK 오류";
  } else {
    mapState.textContent = window.NAVER_MAPS_ENABLED ? "SDK 로딩 중" : "키 미설정";
  }

  if (stations.length === 0) {
    mapCanvas.innerHTML = `
      <div class="map-placeholder">
        <span class="pin-visual"></span>
        <strong>Naver Maps 연동 대기</strong>
        <span>API Key를 설정하면 검색 결과 좌표로 마커가 표시됩니다.</span>
      </div>
    `;
    return;
  }

  mapCanvas.innerHTML = "";
  const valid = stations.filter(hasValidCoordinates).slice(0, 20);
  if (valid.length === 0) {
    mapCanvas.innerHTML = `
      <div class="map-placeholder">
        <span class="pin-visual"></span>
        <strong>좌표 데이터 없음</strong>
        <span>latitude, longitude가 있는 데이터만 지도에 표시됩니다.</span>
      </div>
    `;
    return;
  }

  const latitudes = valid.map((station) => Number(station.latitude));
  const longitudes = valid.map((station) => Number(station.longitude));
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  valid.forEach((station, index) => {
    const latRange = maxLat - minLat || 0.01;
    const lngRange = maxLng - minLng || 0.01;
    const x = 10 + ((Number(station.longitude) - minLng) / lngRange) * 80;
    const y = 90 - ((Number(station.latitude) - minLat) / latRange) * 80;
    const marker = document.createElement("button");
    marker.className = "static-marker";
    marker.type = "button";
    marker.style.left = `${x}%`;
    marker.style.top = `${y}%`;
    marker.textContent = String(index + 1);
    marker.title = `${station.name} ${formatPrice(station.price)}`;
    marker.addEventListener("click", () => selectStation(station.station_code));
    mapCanvas.appendChild(marker);
  });
}

function renderNaverMap(stations) {
  const valid = stations.filter(hasValidCoordinates);
  mapState.textContent = "Naver Maps";

  if (!state.map) {
    mapCanvas.innerHTML = "";
    state.map = new naver.maps.Map("mapCanvas", {
      center: new naver.maps.LatLng(37.5665, 126.978),
      zoom: 11,
    });
  }

  state.markers.forEach((marker) => marker.setMap(null));
  state.markers = [];

  if (valid.length === 0) {
    return;
  }

  const bounds = new naver.maps.LatLngBounds();
  valid.slice(0, 50).forEach((station) => {
    const position = new naver.maps.LatLng(Number(station.latitude), Number(station.longitude));
    bounds.extend(position);
    const marker = new naver.maps.Marker({
      position,
      map: state.map,
      title: station.name,
    });
    const infoWindow = new naver.maps.InfoWindow({
      content: `<div style="padding:10px 12px;font-size:13px;font-weight:700;">${escapeHtml(station.name)}<br><span style="color:#6d3df4;">${formatPrice(station.price)}</span></div>`,
    });
    naver.maps.Event.addListener(marker, "click", () => {
      selectStation(station.station_code);
      infoWindow.open(state.map, marker);
    });
    state.markers.push(marker);
  });
  state.map.fitBounds(bounds);
}

function hasValidCoordinates(station) {
  const lat = Number(station.latitude);
  const lng = Number(station.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function clearStaticMarkers() {
  if (state.markers.length > 0 && window.naver?.maps) {
    state.markers.forEach((marker) => marker.setMap(null));
    state.markers = [];
  }
}

async function showDetail(stationCode) {
  try {
    const payload = await fetchJson(`api/station_detail.php?station_code=${encodeURIComponent(stationCode)}`);
    const station = payload.data;
    detailBody.innerHTML = `
      <h3>${escapeHtml(station.name)}</h3>
      <div class="station-meta">${escapeHtml(station.region || "-")} · ${escapeHtml(station.brand || "-")} · ${escapeHtml(station.is_self || "-")}</div>
      <div class="station-address">${escapeHtml(station.address || "")}</div>
      <div class="price-grid">
        ${priceCell("휘발유", station.prices.gasoline)}
        ${priceCell("경유", station.prices.diesel)}
        ${priceCell("고급휘발유", station.prices.premium)}
        ${priceCell("실내등유", station.prices.kerosene)}
      </div>
    `;
    detailDialog.showModal();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function priceCell(label, value) {
  return `<div class="price-cell"><span>${label}</span><strong>${formatPrice(value)}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const params = buildParams(event.currentTarget);
  document.getElementById("filterRegion").value = params.get("region") || "";
  document.getElementById("filterFuel").value = params.get("fuel") || "gasoline";
  document.getElementById("filterSelfOnly").checked = params.get("self_only") === "true";
  runSearch(params);
});

document.getElementById("filterForm").addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch(buildParams(event.currentTarget));
});

document.getElementById("cheapestButton").addEventListener("click", () => {
  const form = document.getElementById("filterForm");
  const params = buildParams(form);
  params.set("limit", "5");
  runSearch(params, "api/cheapest.php");
});

document.querySelectorAll("[data-preset-region]").forEach((button) => {
  button.addEventListener("click", () => {
    const params = new URLSearchParams();
    params.set("region", button.dataset.presetRegion);
    params.set("fuel", button.dataset.presetFuel);
    params.set("limit", "10");
    if (button.dataset.presetSelf === "true") {
      params.set("self_only", "true");
    }
    runSearch(params);
  });
});

navButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    setView(button.dataset.viewLink);
  });
});

document.getElementById("closeDialog").addEventListener("click", () => detailDialog.close());

document.getElementById("voiceButton").addEventListener("click", async () => {
  const fileInput = document.getElementById("audioFile");
  const formData = new FormData();
  if (fileInput.files[0]) {
    formData.set("audio_file", fileInput.files[0]);
  } else {
    formData.set("file", new Blob(["demo"], { type: "audio/wav" }), "demo.wav");
  }

  try {
    const payload = await fetchJson("api/csr_recognize.php", {
      method: "POST",
      body: formData,
    });
    document.getElementById("transcriptBox").textContent = payload.text;
  } catch (error) {
    document.getElementById("transcriptBox").textContent = error.message;
  }
});

document.getElementById("parseDemoButton").addEventListener("click", async () => {
  const query = document.getElementById("transcriptBox").textContent.trim();
  try {
    const payload = await fetchJson("api/parse_query.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const params = new URLSearchParams(payload.data);
    runSearch(params);
  } catch (error) {
    setStatus(error.message, true);
  }
});

setView("search");
runSearch(new URLSearchParams({ region: "서울", fuel: "gasoline", limit: "5" }));
