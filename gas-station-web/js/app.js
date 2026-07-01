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
const adminButton = document.getElementById("adminButton");
const adminDialog = document.getElementById("adminDialog");
const adminTableList = document.getElementById("adminTableList");
const adminFormEmpty = document.getElementById("adminFormEmpty");
const adminForm = document.getElementById("adminForm");
const adminFormTitle = document.getElementById("adminFormTitle");
const adminFields = document.getElementById("adminFields");
const adminUpdateButton = document.getElementById("adminUpdateButton");
const adminDeleteButton = document.getElementById("adminDeleteButton");
const adminStatus = document.getElementById("adminStatus");

const adminState = {
  tables: [],
  currentTable: null,
  primaryKey: [],
};

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

const ADMIN_COLUMN_LABELS = {
  station_code: "주유소 코드",
  station_name: "주유소명",
  address: "주소",
  brand: "브랜드",
  self_yn: "셀프 여부",
  latitude: "위도",
  longitude: "경도",
  username: "사용자명",
  email: "이메일",
  password_hash: "비밀번호 해시",
  price_date: "가격 기준일",
  premium_gasoline_price: "고급휘발유 가격",
  gasoline_price: "휘발유 가격",
  diesel_price: "경유 가격",
  indoor_kerosene_price: "실내등유 가격",
  user_id: "사용자 ID",
  rating: "평점",
  content: "내용",
  created_at: "생성일시",
  id: "ID",
};

function adminFieldLabel(columnName) {
  return ADMIN_COLUMN_LABELS[columnName] || columnName;
}

function adminInputType(dataType) {
  const numericTypes = ["int", "tinyint", "smallint", "mediumint", "bigint", "decimal", "float", "double"];
  if (numericTypes.includes(dataType)) {
    return dataType === "decimal" || dataType === "float" || dataType === "double" ? "number" : "number";
  }
  if (dataType === "date") return "date";
  if (dataType === "datetime" || dataType === "timestamp") return "datetime-local";
  if (dataType === "text") return "textarea";
  return "text";
}

async function openAdminDialog() {
  adminDialog.showModal();
  if (adminState.tables.length > 0) {
    return;
  }

  adminTableList.innerHTML = `<p class="admin-hint">테이블 목록을 불러오는 중...</p>`;
  try {
    const payload = await fetchJson("api/admin_tables.php");
    adminState.tables = payload.data || [];
    renderAdminTableList();
  } catch (error) {
    adminTableList.innerHTML = `<p class="admin-hint error">테이블 목록을 불러오지 못했습니다: ${escapeHtml(error.message)}</p>`;
  }
}

function renderAdminTableList() {
  adminTableList.innerHTML = "";
  adminState.tables.forEach((table) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-table-button";
    button.textContent = table;
    button.classList.toggle("active", table === adminState.currentTable);
    button.addEventListener("click", () => selectAdminTable(table));
    adminTableList.appendChild(button);
  });
}

async function selectAdminTable(table) {
  adminState.currentTable = table;
  renderAdminTableList();
  setAdminStatus("");
  adminFormEmpty.textContent = "테이블 정보를 불러오는 중...";
  adminFormEmpty.classList.remove("hidden");
  adminForm.classList.add("hidden");

  try {
    const payload = await fetchJson(`api/admin_table_schema.php?table=${encodeURIComponent(table)}`);
    renderAdminForm(table, payload.data.columns, payload.data.primary_key);
  } catch (error) {
    adminFormEmpty.textContent = `테이블 정보를 불러오지 못했습니다: ${error.message}`;
  }
}

function renderAdminForm(table, columns, primaryKey) {
  adminState.primaryKey = primaryKey;
  adminFormTitle.textContent = `${table} 테이블`;
  adminFields.innerHTML = "";

  columns.forEach((column) => {
    const name = column.COLUMN_NAME;
    const isAutoIncrement = column.EXTRA === "auto_increment";
    const isPrimaryKey = primaryKey.includes(name);
    const inputType = adminInputType(column.DATA_TYPE);

    const wrapper = document.createElement("label");
    wrapper.className = "field admin-field";

    const labelText = `${adminFieldLabel(name)}${isPrimaryKey ? " (식별자)" : ""}`;
    const span = document.createElement("span");
    span.textContent = labelText;
    wrapper.appendChild(span);

    let input;
    if (inputType === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = inputType;
      if (inputType === "number" && column.DATA_TYPE !== "int" && column.DATA_TYPE !== "tinyint") {
        input.step = "any";
      }
    }

    input.name = name;
    input.dataset.columnName = name;
    input.dataset.primaryKey = isPrimaryKey ? "true" : "false";

    if (isAutoIncrement) {
      input.placeholder = "자동 생성됨 (입력 불필요)";
      input.disabled = true;
    } else if (name === "created_at") {
      input.placeholder = "비워두면 현재 시각으로 저장됩니다";
    } else if (name === "password_hash") {
      input.placeholder = "해시된 비밀번호 값을 입력하세요";
    }

    wrapper.appendChild(input);
    adminFields.appendChild(wrapper);
  });

  adminFormEmpty.classList.add("hidden");
  adminForm.classList.remove("hidden");
}

function collectAdminFieldValues() {
  const values = {};
  adminFields.querySelectorAll("[data-column-name]").forEach((input) => {
    if (!input.disabled) {
      values[input.dataset.columnName] = input.value;
    }
  });
  return values;
}

function collectAdminPrimaryKeyValues() {
  const keys = {};
  let missing = false;
  adminFields.querySelectorAll('[data-primary-key="true"]').forEach((input) => {
    const value = input.value.trim();
    if (value === "") {
      missing = true;
    }
    keys[input.dataset.columnName] = value;
  });
  return { keys, missing };
}

function setAdminStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("error", isError);
}

async function submitAdminRegister() {
  if (!adminState.currentTable) return;
  setAdminStatus("등록 중입니다...");

  try {
    const data = collectAdminFieldValues();
    const payload = await fetchJson("api/admin_insert.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: adminState.currentTable, data }),
    });
    setAdminStatus(payload.message || "등록되었습니다.");
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

async function submitAdminDelete() {
  if (!adminState.currentTable) return;

  const { keys, missing } = collectAdminPrimaryKeyValues();
  if (missing || adminState.primaryKey.length === 0) {
    setAdminStatus("삭제하려면 식별자(기본키) 값을 모두 입력하세요.", true);
    return;
  }

  const confirmed = window.confirm(`${adminState.currentTable} 테이블에서 해당 항목을 삭제하시겠습니까?`);
  if (!confirmed) return;

  setAdminStatus("삭제 중입니다...");
  try {
    const payload = await fetchJson("api/admin_delete.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: adminState.currentTable, keys }),
    });
    setAdminStatus(payload.message || "삭제되었습니다.");
  } catch (error) {
    setAdminStatus(error.message, true);
  }
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

adminButton.addEventListener("click", () => openAdminDialog());
document.getElementById("closeAdminDialog").addEventListener("click", () => adminDialog.close());

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAdminRegister();
});

adminDeleteButton.addEventListener("click", () => submitAdminDelete());

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
