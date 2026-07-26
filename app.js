const HOME_PANEL_ID = "homePanel";
const APP_VERSION = "3.5.0";


const COLLECTOR_META_PREFIX = "\n\n[[MOVIEVAULT-COLLECTOR-V1:";
const COLLECTOR_META_SUFFIX = "]]";
const CUSTOM_COVER_STORAGE_PREFIX = "movievault.custom-cover.";
let activeItemFilters = new Set();
let activeMediaFilters = new Set();

function createUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (character) {
    const random = Math.random() * 16 | 0;
    const value = character === "x" ? random : (random & 3 | 8);
    return value.toString(16);
  });
}

function parseCollectorNotes(rawNotes) {
  const text = String(rawNotes || "");
  const start = text.lastIndexOf(COLLECTOR_META_PREFIX);
  if (start < 0 || !text.endsWith(COLLECTOR_META_SUFFIX)) return { notes: text, meta: {} };
  const encoded = text.slice(start + COLLECTOR_META_PREFIX.length, -COLLECTOR_META_SUFFIX.length);
  try {
    return { notes: text.slice(0, start), meta: JSON.parse(decodeURIComponent(escape(atob(encoded)))) || {} };
  } catch (error) {
    console.warn("Nie udało się odczytać danych kolekcjonerskich:", error);
    return { notes: text, meta: {} };
  }
}

function normalizeMediaType(value) {
  const normalized = normalizeFormat(value);
  if (normalized.includes("vhs")) return "VHS";
  if (normalized.includes("4k") || normalized.includes("uhd")) return "UHD Blu-ray";
  if (normalized.includes("bluray") || normalized.includes("blu")) return "Blu-ray";
  return "DVD";
}

function stableLegacyUuid(movie) {
  const source = [normalizeBarcode(movie?.barcode), movie?.title, movie?.year, movie?.addedAt || movie?.dateAdded || movie?.date].join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return "legacy-" + (hash >>> 0).toString(16).padStart(8, "0");
}

function hydrateCollectorMovie(rawMovie) {
  const movie = Object.assign({}, rawMovie || {});
  const parsed = parseCollectorNotes(movie.notes);
  const meta = parsed.meta || {};
  movie.notes = parsed.notes;
  movie.uuid = String(movie.uuid || meta.uuid || "").trim() || stableLegacyUuid(movie);
  movie.itemType = movie.itemType || meta.itemType || "Film";
  movie.mediaType = movie.mediaType || meta.mediaType || normalizeMediaType(movie.format);
  movie.format = movie.mediaType;
  movie.seasonCount = movie.seasonCount || meta.seasonCount || "";
  movie.editionType = movie.editionType || meta.editionType || (/steelbook/i.test(rawMovie?.format || "") ? "Steelbook" : /box/i.test(rawMovie?.format || "") ? "Box" : "Standard");
  movie.condition = movie.condition || meta.condition || "Bardzo dobry";
  movie.location = movie.location || meta.location || movie.shelf || "";
  movie.shelf = movie.location;
  movie.ownershipStatus = movie.ownershipStatus || meta.ownershipStatus || "Posiadam";
  movie.customCoverUrl = movie.customCoverUrl || meta.customCoverUrl || "";
  movie.catalogBarcode = normalizeBarcode(movie.catalogBarcode || meta.catalogBarcode || movie.barcode);
  return movie;
}

function hydrateCollection(movies) {
  return (Array.isArray(movies) ? movies : []).map(hydrateCollectorMovie);
}

function prepareMovieForApi(movie) {
  const copy = Object.assign({}, movie);
  copy.uuid = String(copy.uuid || "").trim() || createUuid();
  copy.itemType = copy.itemType || "Film";
  copy.mediaType = copy.mediaType || normalizeMediaType(copy.format);
  copy.format = copy.mediaType;
  copy.seasonCount = copy.itemType === "Serial" ? String(copy.seasonCount || "").trim() : "";
  copy.editionType = copy.editionType || "Standard";
  copy.condition = copy.condition || "Bardzo dobry";
  copy.location = copy.location || copy.shelf || "";
  copy.shelf = copy.location;
  copy.ownershipStatus = copy.ownershipStatus || "Posiadam";
  copy.customCoverUrl = copy.customCoverUrl || "";
  copy.catalogBarcode = normalizeBarcode(copy.catalogBarcode || copy.barcode);
  copy.barcode = copy.catalogBarcode || normalizeBarcode(copy.barcode) || generateInternalBarcode();
  copy.notes = String(copy.notes || "").trim();
  delete copy.customCoverData;
  return copy;
}

function movieKey(movie) { return String(movie?.uuid || normalizeBarcode(movie?.barcode)); }
function findCollectorMovie(key) {
  return collectionCache.find(function (movie) { return movieKey(movie) === String(key) || normalizeBarcode(movie.barcode) === normalizeBarcode(key); });
}
function effectivePoster(movie) {
  const local = movie?.uuid ? localStorage.getItem(CUSTOM_COVER_STORAGE_PREFIX + movie.uuid) : "";
  return local || movie?.customCoverUrl || moviePoster(movie || {});
}
function isOwned(movie) { return String(movie?.ownershipStatus || "Posiadam").toLowerCase() !== "wishlist"; }

function safeElement(id) {
  return document.getElementById(id);
}

function showHome() {
  [
    "homePanel",
    "scannerPanel",
    "resultPanel",
    "collectionPanel",
    "wishlistPanel",
    "searchPanel",
    "settingsPanel",
    "addPanel"
  ].forEach(function (id) {
    const node = safeElement(id);
    if (node) node.classList.toggle("hidden", id !== HOME_PANEL_ID);
  });
  setActiveNavigation("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadHomeDashboard();
}

function setActiveNavigation(section) {
  document.querySelectorAll(".nav-link, .mobile-nav button").forEach(function (button) {
    button.classList.remove("active");
  });
  const selectors = {
    home: "[data-home]",
    collection: "#collectionButton, [data-mobile-collection]",
    wishlist: "#wishlistButton, [data-mobile-wishlist]",
    add: "#addButton, [data-mobile-add]",
    scan: "[data-mobile-scan]",
    settings: "#settingsButton, [data-mobile-settings]"
  };
  if (selectors[section]) {
    document.querySelectorAll(selectors[section]).forEach(function (button) {
      button.classList.add("active");
    });
  }
}

function openAddFromHome() {
  prepareAdd("");
  setActiveNavigation("add");
}

function openScannerFromHome() {
  startScanner();
  setActiveNavigation("scan");
}

function openSearchFromHome() {
  showOnly("searchPanel");
  setActiveNavigation("search");
  safeElement("searchQuery")?.focus();
}

function openCollectionWithFormat(format) {
  showOnly("collectionPanel");
  setActiveNavigation("collection");
  const filter = safeElement("collectionFilter");
  if (filter) filter.value = format || "";
  loadCollection();
}

function openWishlist() {
  showOnly("wishlistPanel");
  setActiveNavigation("wishlist");
  renderWishlist();
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadHomeDashboard();
}

function openSettings() {
  showOnly("settingsPanel");
  setActiveNavigation("settings");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function readBackupFile(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      try { resolve(JSON.parse(String(reader.result || ""))); }
      catch (error) { reject(new Error("Wybrany plik nie zawiera poprawnego JSON.")); }
    };
    reader.onerror = function () { reject(new Error("Nie udało się odczytać pliku.")); };
    reader.readAsText(file, "utf-8");
  });
}

function normalizeBackupMovie(movie) {
  const copy = Object.assign({}, movie || {});
  copy._backupHadUuid = Boolean(String(copy.uuid || "").trim());
  copy.barcode = normalizeBarcode(copy.barcode) || generateInternalBarcode();
  ["genres", "cast"].forEach(function (key) {
    if (Array.isArray(copy[key])) copy[key] = copy[key];
    else if (copy[key]) copy[key] = String(copy[key]).split(/[,|]/).map(function (item) { return item.trim(); }).filter(Boolean);
    else copy[key] = [];
  });
  return hydrateCollectorMovie(copy);
}

async function importCollectionBackup(file) {
  const button = safeElement("importBackupButton");
  const status = safeElement("importBackupStatus");
  const originalText = button ? button.textContent : "";

  try {
    if (!file) return;
    if (button) { button.disabled = true; button.textContent = "Importowanie…"; }
    if (status) status.textContent = "Sprawdzam plik kopii zapasowej…";

    const backup = await readBackupFile(file);
    if (!backup || backup.application !== "MovieVault" || !Array.isArray(backup.movies)) {
      throw new Error("To nie jest prawidłowa kopia zapasowa MovieVault.");
    }

    const currentResponse = await apiRequest("collection", { sort: "newest" });
    const currentMovies = hydrateCollection(currentResponse.movies);
    const existingUuids = new Set(currentMovies.map(function (movie) { return String(movie.uuid || "").trim(); }).filter(Boolean));
    const legacyBarcodeMatches = new Map();
    currentMovies.forEach(function (movie) {
      const barcode = normalizeBarcode(movie.catalogBarcode || movie.barcode);
      if (!barcode) return;
      if (!legacyBarcodeMatches.has(barcode)) legacyBarcodeMatches.set(barcode, []);
      legacyBarcodeMatches.get(barcode).push(movie);
    });
    const imported = [];

    for (let index = 0; index < backup.movies.length; index += 1) {
      const movie = normalizeBackupMovie(backup.movies[index]);
      if (!String(movie.title || "").trim()) continue;
      let uuid = String(movie.uuid || "").trim() || createUuid();
      if (!movie._backupHadUuid) {
        const barcode = normalizeBarcode(movie.catalogBarcode || movie.barcode);
        const matches = barcode ? (legacyBarcodeMatches.get(barcode) || []) : [];
        if (matches.length === 1) uuid = matches[0].uuid;
      }
      delete movie._backupHadUuid;
      movie.uuid = uuid;
      const exists = existingUuids.has(uuid);
      const parameters = Object.assign({}, movie, { uuid: uuid });
      if (status) status.textContent = "Importuję pozycję " + (index + 1) + " z " + backup.movies.length + ": " + (movie.title || "Bez tytułu");
      await apiRequest(exists ? "update" : "add", prepareMovieForApi(parameters));
      existingUuids.add(uuid);
      if (movie.customCoverData && movie.uuid) localStorage.setItem(CUSTOM_COVER_STORAGE_PREFIX + movie.uuid, movie.customCoverData);
      imported.push(movie);
    }

    const refreshed = await apiRequest("collection", { sort: "newest" });
    collectionCache = Array.isArray(refreshed.movies) ? hydrateCollection(refreshed.movies) : hydrateCollection(imported);
    persistCollectionCache();
    renderHomeDashboard();
    renderStatsFromCollection();
    if (safeElement("collectionPanel") && !safeElement("collectionPanel").classList.contains("hidden")) renderCollection();
    if (status) status.textContent = "Gotowe. Zaimportowano " + imported.length + " pozycji. Dane w Arkuszu Google zostały zaktualizowane.";
  } catch (error) {
    console.error("Import kopii:", error);
    if (status) status.textContent = "Błąd: " + error.message;
    alert("Nie udało się zaimportować kopii zapasowej: " + error.message);
  } finally {
    if (button) { button.disabled = false; button.textContent = originalText; }
    const input = safeElement("backupFileInput");
    if (input) input.value = "";
  }
}

async function clearApplicationCache() {
  const button = safeElement("clearCacheButton");
  const status = safeElement("clearCacheStatus");
  const originalText = button ? button.textContent : "";
  try {
    if (button) { button.disabled = true; button.textContent = "Czyszczenie…"; }
    localStorage.clear();
    sessionStorage.clear();
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(function (key) { return caches.delete(key); }));
    }
    collectionCache = [];
    collectionCacheReady = false;
    collectionCacheSavedAt = 0;
    renderHomeDashboard();
    renderStatsFromCollection();
    if (status) status.textContent = "Cache wyczyszczony. Pobieram ponownie dane z Arkusza Google…";
    await loadHomeDashboard(true);
    if (status) status.textContent = "Cache i lokalna pamięć zostały wyczyszczone, a kolekcja ponownie pobrana z Arkusza Google. Dane w Arkuszu nie zostały zmienione.";
  } catch (error) {
    console.error("Czyszczenie cache:", error);
    if (status) status.textContent = "Nie udało się wyczyścić całego cache: " + error.message;
  } finally {
    if (button) { button.disabled = false; button.textContent = originalText; }
  }
}

function normalizeFormat(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function moviePoster(movie) {
  return movie.poster || movie.posterUrl || movie.image || "";
}

function movieGenres(movie) {
  if (Array.isArray(movie.genres)) return movie.genres;
  return String(movie.genres || movie.genre || "")
    .split(/[,|]/)
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

function getMovieRating(movie) {
  const value = Number(movie.rating || movie.voteAverage || movie.tmdbRating || 0);
  return Number.isFinite(value) ? value : 0;
}

function getAddedTimestamp(movie) {
  const raw = movie.addedAt || movie.dateAdded || movie.date || "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}


function backupDateStamp(date) {
  const pad = function (value) {
    return String(value).padStart(2, "0");
  };

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "_" + [
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("-");
}

async function createCollectionBackup(button) {
  const originalHtml = button ? button.innerHTML : "";

  try {
    if (button) {
      button.disabled = true;
      button.classList.add("is-loading");
      button.innerHTML = `
        <span class="action-icon backup-icon">↻</span>
        <span class="action-copy">
          <strong>Tworzę kopię…</strong>
          <small>Pobieram najnowsze dane kolekcji</small>
        </span>
        <span class="chevron">…</span>
      `;
    }

    const response = await apiRequest("collection", { sort: "newest" });
    const movies = hydrateCollection(response.movies).map(function (movie) {
      return Object.assign({}, movie, { customCoverData: movie.uuid ? localStorage.getItem(CUSTOM_COVER_STORAGE_PREFIX + movie.uuid) || "" : "" });
    });

    const createdAt = new Date();
    const backup = {
      application: "MovieVault",
      backupVersion: 1,
      appVersion: APP_VERSION,
      createdAt: createdAt.toISOString(),
      movieCount: movies.length,
      movies: movies
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "MovieVault_3.5.0_Backup_" + backupDateStamp(createdAt) + ".json";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    collectionCache = hydrateCollection(movies);
    persistCollectionCache();
    renderHomeDashboard();
    renderStatsFromCollection();

    if (button) {
      button.classList.add("backup-success");
      button.innerHTML = `
        <span class="action-icon backup-icon">✓</span>
        <span class="action-copy">
          <strong>Kopia pobrana</strong>
          <small>${movies.length} filmów zapisano na komputerze</small>
        </span>
        <span class="chevron">✓</span>
      `;

      setTimeout(function () {
        button.classList.remove("backup-success");
        button.innerHTML = originalHtml;
      }, 2600);
    }
  } catch (error) {
    console.error("Backup:", error);
    alert("Nie udało się utworzyć kopii zapasowej: " + error.message);

    if (button) {
      button.innerHTML = originalHtml;
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }
}

function collectionSnapshot(movies) {
  return JSON.stringify((Array.isArray(movies) ? movies : []).map(function (movie) {
    const normalized = {};
    Object.keys(movie || {}).sort().forEach(function (key) {
      normalized[key] = movie[key];
    });
    return normalized;
  }));
}

async function loadHomeDashboard(force) {
  const recentNode = safeElement("recentMovies");
  if (!recentNode) return;

  if (collectionCacheReady) {
    renderHomeDashboard();
    renderStatsFromCollection();
  }

  try {
    const response = await apiRequest("collection", { sort: "newest" });
    const freshMovies = hydrateCollection(response.movies);
    const collectionChanged = !collectionCacheReady || collectionSnapshot(collectionCache) !== collectionSnapshot(freshMovies);

    collectionCache = freshMovies;
    persistCollectionCache();

    if (collectionChanged || force) {
      renderHomeDashboard();
      renderStatsFromCollection();
      const collectionPanel = safeElement("collectionPanel");
      if (collectionPanel && !collectionPanel.classList.contains("hidden")) renderCollection();
      const wishlistPanel = safeElement("wishlistPanel");
      if (wishlistPanel && !wishlistPanel.classList.contains("hidden")) renderWishlist();
    }
  } catch (error) {
    if (!collectionCacheReady) {
      recentNode.innerHTML = '<div class="loading-card">Nie udało się pobrać kolekcji.</div>';
    }
    console.error("Home dashboard:", error);
  }
}

function renderHomeDashboard() {
  renderRecentMovies();
  renderHomeFormatCounts();
  renderCollectorStats();
}

function renderRecentMovies() {
  const node = safeElement("recentMovies");
  if (!node) return;

  const recent = collectionCache
    .filter(isOwned)
    .slice()
    .sort(function (a, b) { return getAddedTimestamp(b) - getAddedTimestamp(a); })
    .slice(0, 8);

  if (!recent.length) {
    node.innerHTML = '<div class="loading-card">Twoja kolekcja czeka na pierwszy film.</div>';
    return;
  }

  node.innerHTML = recent.map(function (movie, index) {
    const poster = effectivePoster(movie);
    const art = poster
      ? '<img src="' + escapeHtml(poster) + '" alt="" loading="lazy">'
      : '<div class="poster-placeholder">▥</div>';
    return `
      <button class="poster-card" type="button" onclick="openHomeMovie(${index})">
        <span class="poster-art">${art}</span>
        <span class="poster-meta">
          <strong>${escapeHtml(movie.title || "Bez tytułu")}</strong>
          <small><span>${escapeHtml(movie.year || "—")}</span><span class="format-pill">${escapeHtml((movie.itemType || "Film") + " • " + (movie.mediaType || movie.format || "DVD"))}</span></small>
        </span>
      </button>
    `;
  }).join("");

  window.homeRecentMovies = recent;
}

function renderHomeFormatCounts() {
  const counts = { dvd: 0, bluray: 0, uhd: 0, steelbook: 0, boxset: 0, vhs: 0 };
  collectionCache.filter(isOwned).forEach(function (movie) {
    const media = normalizeMediaType(movie.mediaType || movie.format);
    if (media === "VHS") counts.vhs++; else if (media === "UHD Blu-ray") counts.uhd++; else if (media === "Blu-ray") counts.bluray++; else counts.dvd++;
    if (/steelbook/i.test(movie.editionType || "")) counts.steelbook++;
    if (/box/i.test(movie.editionType || "")) counts.boxset++;
  });
  const map = { homeDvd:counts.dvd, homeBluray:counts.bluray, homeUhd:counts.uhd, homeSteelbook:counts.steelbook, homeBoxset:counts.boxset, homeVhs:counts.vhs };
  Object.keys(map).forEach(function(id){ const node=safeElement(id); if(node) node.textContent=map[id]; });
}

function renderCollectorStats() {
  const ownedCollection = collectionCache.filter(isOwned);
  const years = ownedCollection
    .map(function (movie) { return Number(movie.year); })
    .filter(function (year) { return year > 1800 && year < 2200; });

  const oldestYear = years.length ? Math.min.apply(null, years) : null;
  const newestYear = years.length ? Math.max.apply(null, years) : null;
  const oldestMovie = ownedCollection.find(function (movie) { return Number(movie.year) === oldestYear; });
  const newestMovie = ownedCollection.find(function (movie) { return Number(movie.year) === newestYear; });

  setText("oldestYear", oldestYear || "—");
  setText("newestYear", newestYear || "—");
  setText("oldestTitle", oldestMovie?.title || "Brak danych");
  setText("newestTitle", newestMovie?.title || "Brak danych");

  const ratings = ownedCollection.map(getMovieRating).filter(function (rating) { return rating > 0; });
  const average = ratings.length ? (ratings.reduce(function (sum, item) { return sum + item; }, 0) / ratings.length).toFixed(1) : "—";
  setText("averageRating", average === "—" ? average : "★ " + average);

  const genreCount = {};
  const directorCount = {};
  collectionCache.forEach(function (movie) {
    movieGenres(movie).forEach(function (genre) {
      genreCount[genre] = (genreCount[genre] || 0) + 1;
    });
    const director = String(movie.director || "").trim();
    if (director) directorCount[director] = (directorCount[director] || 0) + 1;
  });

  const topGenre = topEntry(genreCount);
  const topDirector = topEntry(directorCount);
  setText("topGenre", topGenre ? topGenre[0] : "—");
  setText("topGenreCount", topGenre ? topGenre[1] + " filmów" : "Brak danych");
  setText("topDirector", topDirector ? topDirector[0] : "—");
  setText("topDirectorCount", topDirector ? topDirector[1] + " filmów" : "Brak danych");
}

function topEntry(object) {
  const entries = Object.entries(object);
  if (!entries.length) return null;
  entries.sort(function (a, b) { return b[1] - a[1]; });
  return entries[0];
}

function setText(id, value) {
  const node = safeElement(id);
  if (node) node.textContent = value;
}

function openHomeMovie(index) {
  const movie = window.homeRecentMovies?.[index];
  if (!movie) return;
  showMovieSnapshot(movie);
}

function showMovieSnapshot(movie) {
  const modal = safeElement("randomModal");
  const content = safeElement("randomMovieContent");
  if (!modal || !content) return;
  const poster = effectivePoster(movie);
  content.innerHTML = `
    <div class="random-movie">
      ${poster ? '<img src="' + escapeHtml(poster) + '" alt="">' : '<div class="random-placeholder">▥</div>'}
      <div>
        <h2 id="randomTitle">${escapeHtml(movie.title || "Bez tytułu")}</h2>
        <p>${escapeHtml([movie.year, movie.format].filter(Boolean).join(" • "))}</p>
        <p>${escapeHtml(movie.shelf ? "Półka: " + movie.shelf : "Pozycja z Twojej kolekcji")}</p>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function drawRandomMovie() {
  if (!collectionCache.length) {
    loadHomeDashboard(true).then(drawRandomMovie);
    return;
  }
  const movie = collectionCache[Math.floor(Math.random() * collectionCache.length)];
  showMovieSnapshot(movie);
}

function closeRandomModal() {
  safeElement("randomModal")?.classList.add("hidden");
  document.body.style.overflow = "";
}

function setupCollectorExperience() {
  restoreCollectionCache();
  document.querySelectorAll("[data-home]").forEach(function (button) {
    button.addEventListener("click", showHome);
  });
  document.querySelectorAll("[data-open-collection], [data-mobile-collection]").forEach(function (button) {
    button.addEventListener("click", function () { openCollectionWithFormat(""); });
  });
  document.querySelectorAll("[data-mobile-add]").forEach(function (button) {
    button.addEventListener("click", openAddFromHome);
  });
  document.querySelectorAll("[data-mobile-scan]").forEach(function (button) {
    button.addEventListener("click", openScannerFromHome);
  });
  document.querySelectorAll("[data-mobile-wishlist]").forEach(function (button) { button.addEventListener("click", openWishlist); });
  document.querySelectorAll("[data-mobile-settings]").forEach(function (button) {
    button.addEventListener("click", openSettings);
  });
  document.querySelectorAll(".action-card").forEach(function (button) {
    button.addEventListener("click", function () {
      const action = button.dataset.action;
      if (action === "add") openAddFromHome();
      if (action === "scan") openScannerFromHome();
      if (action === "random") drawRandomMovie();
      if (action === "backup") createCollectionBackup(button);
    });
  });
  document.querySelectorAll("[data-format]").forEach(function (button) {
    button.addEventListener("click", function () { openCollectionWithFormat(button.dataset.format); });
  });
  document.querySelectorAll("[data-close-random]").forEach(function (button) {
    button.addEventListener("click", closeRandomModal);
  });
  safeElement("drawAgainButton")?.addEventListener("click", drawRandomMovie);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeRandomModal();
  });
  document.querySelectorAll("[data-discover]").forEach(function (button) {
    button.addEventListener("click", function () {
      openCollectionWithFormat("");
      const filter = safeElement("collectionFilter");
      if (filter) {
        filter.placeholder = "Wpisz " + ({
          genre: "gatunek",
          director: "nazwisko reżysera",
          year: "rok",
          series: "nazwę serii",
          country: "kraj",
          actor: "nazwisko aktora"
        }[button.dataset.discover] || "szukaną wartość");
        filter.focus();
      }
    });
  });
  showHome();
}

document.addEventListener("DOMContentLoaded", setupCollectorExperience);


const API_URL =
  "https://script.google.com/macros/s/AKfycbyQTE2JyHjVngVHs-OlLIuMHknWa-u81Jx-jG8sJ1K8WpbQi5NZYDvRHOLy2C1gFzoKTQ/exec";

let codeReader = null;
let scannerControls = null;
let scanLock = false;

let tmdbResultsCache = [];
let selectedTmdbMovie = null;

let collectionCache = [];
let collectionCacheReady = false;
let collectionCacheSavedAt = 0;
let editingBarcode = "";
let editingUuid = "";

const COLLECTION_STORAGE_KEY = "movievault.collection.v1";
const COLLECTION_CACHE_MAX_AGE = 5 * 60 * 1000;

function restoreCollectionCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLECTION_STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.movies)) return false;
    collectionCache = hydrateCollection(saved.movies);
    collectionCacheSavedAt = Number(saved.savedAt) || 0;
    collectionCacheReady = true;
    return true;
  } catch (error) {
    console.warn("Nie udało się odczytać lokalnej kolekcji:", error);
    return false;
  }
}

function persistCollectionCache() {
  collectionCacheSavedAt = Date.now();
  collectionCacheReady = true;
  try {
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({
      savedAt: collectionCacheSavedAt,
      movies: collectionCache.map(function (movie) { return Object.assign({}, movie, { customCoverData: movie.uuid ? localStorage.getItem(CUSTOM_COVER_STORAGE_PREFIX + movie.uuid) || "" : "" }); })
    }));
  } catch (error) {
    console.warn("Nie udało się zapisać lokalnej kolekcji:", error);
  }
}

function collectionCacheIsFresh() {
  return collectionCacheReady && (Date.now() - collectionCacheSavedAt) < COLLECTION_CACHE_MAX_AGE;
}

function generateInternalBarcode() {
  let candidate;
  do {
    const timePart = String(Date.now()).slice(-9);
    const randomPart = String(Math.floor(Math.random() * 10));
    candidate = "299" + timePart + randomPart;
  } while (collectionCache.some(function (movie) {
    return normalizeBarcode(movie.barcode) === candidate;
  }));
  return candidate;
}

function sortMoviesLocally(movies, sort) {
  const copy = movies.slice();
  if (sort === "title") {
    return copy.sort(function (a, b) {
      return String(a.title || "").localeCompare(String(b.title || ""), "pl", { sensitivity: "base" });
    });
  }
  if (sort === "oldest") {
    return copy.sort(function (a, b) { return getAddedTimestamp(a) - getAddedTimestamp(b); });
  }
  return copy.sort(function (a, b) { return getAddedTimestamp(b) - getAddedTimestamp(a); });
}

const $ = id => document.getElementById(id);

document.addEventListener(
  "DOMContentLoaded",
  function () {
    $("scanButton").addEventListener(
      "click",
      startScanner
    );

    $("closeScannerButton").addEventListener(
      "click",
      stopScanner
    );

    $("collectionButton").addEventListener(
      "click",
      openCollection
    );

    $("wishlistButton").addEventListener("click", openWishlist);
    $("refreshWishlistButton").addEventListener("click", function () { loadCollection(true).then(renderWishlist); });
    $("wishlistFilter").addEventListener("input", renderWishlist);
    $("itemType").addEventListener("change", syncSeasonField);
    $("customCoverFile").addEventListener("change", handleCustomCoverFile);
    $("clearCollectorFilters").addEventListener("click", clearCollectorFilters);
    document.querySelectorAll("[data-item-filter], [data-media-filter]").forEach(function (button) { button.addEventListener("click", toggleCollectorFilter); });

    $("refreshCollectionButton").addEventListener(
      "click",
      function () { loadCollection(true); }
    );

    $("collectionFilter").addEventListener(
      "input",
      renderCollection
    );

    $("collectionSort").addEventListener(
      "change",
      renderCollection
    );

    $("searchButton").addEventListener(
      "click",
      function () {
        showOnly("searchPanel");
      }
    );

    $("addButton").addEventListener(
      "click",
      function () {
        prepareAdd("");
      }
    );

    $("settingsButton").addEventListener("click", openSettings);
    $("settingsSearchButton").addEventListener("click", openSearchFromHome);
    $("importBackupButton").addEventListener("click", function () { $("backupFileInput").click(); });
    $("backupFileInput").addEventListener("change", function (event) {
      importCollectionBackup(event.target.files && event.target.files[0]);
    });
    $("clearCacheButton").addEventListener("click", clearApplicationCache);

    $("runSearchButton").addEventListener(
      "click",
      runSearch
    );

    $("tmdbSearchButton").addEventListener(
      "click",
      searchTmdb
    );

    $("saveButton").addEventListener(
      "click",
      addMovie
    );

    $("searchQuery").addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Enter") {
          runSearch();
        }
      }
    );

    $("title").addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          searchTmdb();
        }
      }
    );

    updateStats();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("./sw.js")
        .catch(console.error);
    }
  }
);

function apiRequest(
  action,
  parameters = {}
) {
  return new Promise(
    function (resolve, reject) {
      const callbackName =
        "movieVaultCallback_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() * 100000
        );

      const script =
        document.createElement("script");

      const query =
        new URLSearchParams({
          action: action,
          callback: callbackName,
          ...parameters
        });

      const timeout =
        setTimeout(
          function () {
            cleanup();

            reject(
              new Error(
                "Serwer nie odpowiedział."
              )
            );
          },
          20000
        );

      function cleanup() {
        clearTimeout(timeout);

        if (script.parentNode) {
          script.parentNode.removeChild(
            script
          );
        }

        delete window[callbackName];
      }

      window[callbackName] =
        function (data) {
          cleanup();

          if (
            data &&
            data.success === false
          ) {
            reject(
              new Error(
                data.message ||
                "Wystąpił błąd API."
              )
            );

            return;
          }

          resolve(data);
        };

      script.onerror = function () {
        cleanup();

        reject(
          new Error(
            "Nie udało się połączyć z Arkuszem Google."
          )
        );
      };

      script.src =
        API_URL +
        "?" +
        query.toString();

      document.body.appendChild(script);
    }
  );
}

function normalizeBarcode(value) {
  return String(value || "")
    .replace(/\D/g, "");
}

function showOnly(panelId) {
  [
    "homePanel",
    "scannerPanel",
    "resultPanel",
    "collectionPanel",
    "wishlistPanel",
    "searchPanel",
    "settingsPanel",
    "addPanel"
  ].forEach(
    function (id) {
      $(id).classList.toggle(
        "hidden",
        id !== panelId
      );
    }
  );
}

async function openCollection() {
  showOnly("collectionPanel");
  await loadCollection();
}

async function loadCollection(force) {
  if (collectionCacheReady) {
    renderCollection();
    renderHomeDashboard();
    renderStatsFromCollection();
  } else {
    $("collectionCount").textContent = "Ładowanie kolekcji...";
    $("collectionResults").innerHTML = `
      <div class="movie">Pobieram filmy z Arkusza Google...</div>
    `;
  }

  if (!force && collectionCacheIsFresh()) return;

  try {
    const response = await apiRequest("collection", { sort: "newest" });
    collectionCache = hydrateCollection(response.movies);
    persistCollectionCache();
    renderCollection();
    renderHomeDashboard();
    renderStatsFromCollection();
  } catch (error) {
    if (!collectionCacheReady) {
      $("collectionCount").textContent = "Nie udało się pobrać kolekcji.";
      $("collectionResults").innerHTML = `
        <div class="movie owned"><strong>Błąd</strong><p>${escapeHtml(error.message)}</p></div>
      `;
    }
  }
}

function renderCollection() {
  const filter =
    $("collectionFilter")
      .value
      .trim()
      .toLowerCase();

  const sortedMovies = sortMoviesLocally(
    collectionCache,
    $("collectionSort").value
  );

  const visibleMovies =
    sortedMovies.filter(
      function (movie) {
        if (!isOwned(movie)) return false;
        const matchesItem = !activeItemFilters.size || activeItemFilters.has(movie.itemType || "Film");
        const matchesMedia = !activeMediaFilters.size || activeMediaFilters.has(movie.mediaType || normalizeMediaType(movie.format));
        if (!matchesItem || !matchesMedia) return false;
        if (!filter) return true;
        const searchableText = [
          movie.title, movie.originalTitle, movie.year, movie.itemType, movie.mediaType, movie.editionType, movie.condition,
          movie.location, movie.shelf, movie.barcode, movie.catalogBarcode, movie.notes
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          filter
        );
      }
    );

  $("collectionCount").textContent =
    (filter || activeItemFilters.size || activeMediaFilters.size)
      ? (
          "Znaleziono: " +
          visibleMovies.length +
          " z " +
          collectionCache.filter(isOwned).length
        )
      : (
          "Liczba pozycji: " +
          collectionCache.filter(isOwned).length
        );

  if (!visibleMovies.length) {
    $("collectionResults").innerHTML = `
      <div class="empty-collection">
        <div class="empty-collection-icon">
          🎞️
        </div>

        <strong>
          ${
            collectionCache.length
              ? "Brak pasujących filmów"
              : "Kolekcja jest pusta"
          }
        </strong>

        <p>
          ${
            collectionCache.length
              ? "Spróbuj zmienić tekst wyszukiwania."
              : "Zeskanuj kod albo dodaj pierwszy film."
          }
        </p>
      </div>
    `;

    return;
  }

  $("collectionResults").innerHTML =
    visibleMovies
      .map(collectionMovieCard)
      .join("");
}

function collectionMovieCard(movie) {
  const formatClass = getFormatClass(movie.format);
  const year = movie.year ? escapeHtml(movie.year) : "—";
  const activePoster = effectivePoster(movie);
  const cover = activePoster
    ? `<img class="collection-cover" src="${escapeHtml(activePoster)}" alt="Okładka filmu ${escapeHtml(movie.title || "")}" loading="lazy">`
    : `<div class="collection-cover-placeholder">🎬</div>`;

  const barcode = movieKey(movie);

  return `
    <button class="collection-card" type="button" onclick="openCollectionMovie('${escapeHtml(barcode)}')">
      <div class="collection-cover-frame">${cover}</div>
      <div class="collection-main-info">
        <h3>${escapeHtml(movie.title || "Bez tytułu")}</h3>
        <div class="collection-badges">
          <span class="format-badge ${formatClass}">${escapeHtml((movie.itemType || "Film") + " • " + (movie.mediaType || movie.format || "DVD"))}</span>
          <span class="year-badge">${year}</span>
        </div>
      </div>
    </button>
  `;
}


function openCollectionMovie(barcode) {
  const normalized = String(barcode);
  const movie = findCollectorMovie(normalized);

  if (!movie) {
    return;
  }

  const poster = effectivePoster(movie);
  const genres = Array.isArray(movie.genres)
    ? movie.genres
    : String(movie.genres || movie.genre || "")
        .split(/[,|]/)
        .map(function (item) { return item.trim(); })
        .filter(Boolean);

  const cast = Array.isArray(movie.cast)
    ? movie.cast
    : String(movie.cast || "")
        .split(/[,|]/)
        .map(function (item) { return item.trim(); })
        .filter(Boolean);

  const facts = [
    movie.year ? "<span>" + escapeHtml(movie.year) + "</span>" : "",
    movie.itemType ? "<span>" + escapeHtml(movie.itemType) + "</span>" : "",
    movie.mediaType ? "<span>" + escapeHtml(movie.mediaType) + "</span>" : "",
    movie.editionType ? "<span>" + escapeHtml(movie.editionType) + "</span>" : "",
    movie.condition ? "<span>Stan: " + escapeHtml(movie.condition) + "</span>" : "",
    movie.seasonCount ? "<span>Sezony: " + escapeHtml(movie.seasonCount) + "</span>" : "",
    movie.runtime ? "<span>" + escapeHtml(String(movie.runtime)) + " min</span>" : "",
    movie.location ? "<span>Lokalizacja: " + escapeHtml(movie.location) + "</span>" : "",
    movie.ownershipStatus ? "<span>" + escapeHtml(movie.ownershipStatus) + "</span>" : ""
  ].filter(Boolean).join("");

  $("movieDetailsContent").innerHTML = `
    <div class="movie-details-layout">
      <div class="movie-details-poster">
        ${poster
          ? '<img src="' + escapeHtml(poster) + '" alt="Okładka filmu">'
          : '<div class="movie-details-placeholder">🎬</div>'}
      </div>

      <div class="movie-details-copy">
        <p class="eyebrow">TWOJA KOLEKCJA</p>
        <h2>${escapeHtml(movie.title || "Bez tytułu")}</h2>

        <div class="movie-details-facts">${facts}</div>

        ${genres.length
          ? '<div class="movie-details-genres">' +
              genres.map(function (genre) {
                return "<span>" + escapeHtml(genre) + "</span>";
              }).join("") +
            "</div>"
          : ""}

        ${movie.description
          ? '<section><h3>Opis filmu</h3><p>' + escapeHtml(movie.description) + "</p></section>"
          : ""}

        ${movie.director
          ? '<section><h3>Reżyseria</h3><p>' + escapeHtml(movie.director) + "</p></section>"
          : ""}

        ${cast.length
          ? '<section><h3>Obsada</h3><p>' + cast.map(escapeHtml).join(", ") + "</p></section>"
          : ""}

        ${movie.notes
          ? '<section><h3>Notatki</h3><p>' + escapeHtml(movie.notes) + "</p></section>"
          : ""}

        <div class="movie-details-actions">
          <button class="primary-button" type="button" onclick="editCollectionMovie('${escapeHtml(movieKey(movie))}')">Edytuj</button>
          <button class="danger-button" type="button" onclick="deleteCollectionMovie('${escapeHtml(movieKey(movie))}')">Usuń</button>
        </div>
      </div>
    </div>
  `;

  $("movieDetailsModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeMovieDetails() {
  $("movieDetailsModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function editCollectionMovie(barcode) {
  const normalized = String(barcode);
  const movie = findCollectorMovie(normalized);

  if (!movie) {
    return;
  }

  editingUuid = String(movie.uuid || "");
  editingBarcode = normalizeBarcode(movie.barcode);
  window.movieVaultPendingCustomCover = "";
  closeMovieDetails();
  showOnly("addPanel");

  resetTmdbSelection();

  $("barcode").value = movie.catalogBarcode || movie.barcode || "";
  $("title").value = movie.title || "";
  $("itemType").value = movie.itemType || "Film";
  $("format").value = movie.mediaType || normalizeMediaType(movie.format);
  $("seasonCount").value = movie.seasonCount || "";
  $("editionType").value = movie.editionType || "Standard";
  $("condition").value = movie.condition || "Bardzo dobry";
  $("ownershipStatus").value = movie.ownershipStatus || "Posiadam";
  $("customCoverUrl").value = movie.customCoverUrl || "";
  $("customCoverFile").value = "";
  syncSeasonField();
  $("year").value = movie.year || "";
  if ($("itemType").value === "Serial" && movie.seasonCount) {
    $("seasonCount").value = movie.seasonCount;
  }
  $("shelf").value = movie.location || movie.shelf || "";
  $("notes").value = movie.notes || "";

  selectedTmdbMovie = {
    tmdbId: movie.tmdbId || "",
    poster: movie.poster || "",
    title: movie.title || "",
    originalTitle: movie.originalTitle || "",
    year: movie.year || "",
    director: movie.director || "",
    genres: movie.genres || [],
    cast: movie.cast || [],
    description: movie.description || "",
    backdrop: movie.backdrop || "",
    runtime: movie.runtime || "",
    voteAverage: movie.voteAverage || "",
    trailer: movie.trailer || ""
  };

  $("saveButton").textContent = "Zapisz zmiany";
  $("title").focus();
}

async function deleteCollectionMovie(barcode) {
  const normalized = String(barcode);
  const movie = findCollectorMovie(normalized);

  if (!movie) {
    return;
  }

  const confirmed = confirm(
    'Usunąć "' + (movie.title || "ten film") + '" z kolekcji?'
  );

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest("delete", { uuid: movie.uuid, barcode: normalizeBarcode(movie.barcode) });
    collectionCache = collectionCache.filter(function (item) {
      return movieKey(item) !== movieKey(movie);
    });
    persistCollectionCache();
    closeMovieDetails();
    renderCollection();
    renderHomeDashboard();
    renderStatsFromCollection();
  } catch (error) {
    alert("Nie udało się usunąć filmu: " + error.message);
  }
}

function getFormatClass(format) {
  const normalized =
    String(format || "")
      .trim()
      .toLowerCase();

  if (normalized === "dvd") {
    return "format-dvd";
  }

  if (
    normalized === "blu-ray" ||
    normalized === "bluray" ||
    normalized === "blu ray"
  ) {
    return "format-bluray";
  }

  if (
    normalized === "4k" ||
    normalized === "4k uhd" ||
    normalized === "uhd"
  ) {
    return "format-uhd";
  }

  return "";
}

function formatAddedDate(value) {
  if (!value) {
    return "";
  }

  const text =
    String(value).trim();

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (match) {
    return (
      match[3] +
      "." +
      match[2] +
      "." +
      match[1]
    );
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return text;
  }

  return date.toLocaleDateString(
    "pl-PL"
  );
}

async function startScanner() {
  showOnly("scannerPanel");

  $("closeScannerButton")
    .classList.remove("hidden");

  scanLock = false;

  try {
    const ZXingReader =
      window.ZXingBrowser?.BrowserMultiFormatReader ||
      window.ZXing?.BrowserMultiFormatReader;

    if (!ZXingReader) {
      throw new Error("Biblioteka skanera nie została załadowana. Odśwież stronę i spróbuj ponownie.");
    }

    codeReader = new ZXingReader();

    scannerControls =
      await codeReader
        .decodeFromConstraints(
          {
            audio: false,

            video: {
              facingMode: {
                ideal: "environment"
              },

              width: {
                ideal: 1280
              },

              height: {
                ideal: 720
              }
            }
          },

          $("preview"),

          function (result) {
            if (
              result &&
              !scanLock
            ) {
              scanLock = true;

              const barcode =
                normalizeBarcode(
                  result.getText()
                );

              handleBarcode(barcode);
            }
          }
        );
  } catch (error) {
    $("scannerPanel").innerHTML = `
      <div class="movie owned">
        <strong>
          Nie udało się uruchomić kamery.
        </strong>

        <p>
          ${escapeHtml(
            error.message ||
            String(error)
          )}
        </p>
      </div>
    `;
  }
}

function stopScanner() {
  if (scannerControls) {
    scannerControls.stop();
  }

  scannerControls = null;
  codeReader = null;

  $("closeScannerButton")
    .classList.add("hidden");

  $("scannerPanel")
    .classList.add("hidden");
}

async function handleBarcode(barcode) {
  stopScanner();

  if (!barcode) {
    return;
  }

  $("resultPanel").className =
    "panel";

  $("resultPanel")
    .classList.remove("hidden");

  $("resultPanel").innerHTML = `
    <div class="result-title">
      Sprawdzam kolekcję...
    </div>

    Kod:
    ${escapeHtml(barcode)}
  `;

  try {
    if (!collectionCacheReady) restoreCollectionCache();

    if (collectionCacheReady) {
      const localMovie = collectionCache.find(function (movie) {
        return normalizeBarcode(movie.catalogBarcode || movie.barcode) === barcode;
      });
      renderScanResult(barcode, localMovie || null);
      return;
    }

    const response = await apiRequest("find", { barcode: barcode });
    renderScanResult(barcode, response.movie);
  } catch (error) {
    $("resultPanel").className =
      "panel owned";

    $("resultPanel").innerHTML = `
      <div class="result-title">
        Błąd połączenia
      </div>

      <p>
        ${escapeHtml(error.message)}
      </p>

      <button
        class="button scan"
        onclick="startScanner()"
      >
        Spróbuj ponownie
      </button>
    `;
  }
}

function renderScanResult(
  barcode,
  movie
) {
  $("resultPanel")
    .classList.remove("hidden");

  if (movie) {
    navigator.vibrate?.(
      [250, 100, 250]
    );

    $("resultPanel").className =
      "panel owned";

    $("resultPanel").innerHTML = `
      <div class="result-title">
        🟨 MASZ JUŻ EGZEMPLARZ
      </div>

      <strong>
        ${escapeHtml(movie.title)}
      </strong>

      <br>

      ${escapeHtml(
        (movie.itemType || "Film") + " • " + (movie.mediaType || movie.format || "DVD")
      )}

      <br>

      Rok:
      ${escapeHtml(
        movie.year || "brak"
      )}

      <br>

      Półka:
      ${escapeHtml(
        movie.shelf || "brak"
      )}

      <br>

      Kod:
      ${escapeHtml(movie.barcode)}

      <br><br>

      <button class="button add" onclick="prepareAdd('${barcode}')">Dodaj kolejny egzemplarz</button>

      <button
        class="button collection"
        onclick="openCollection()"
      >
        📚 Moja kolekcja
      </button>

      <button
        class="button scan"
        onclick="startScanner()"
      >
        Skanuj następny
      </button>
    `;

    return;
  }

  navigator.vibrate?.(120);

  $("resultPanel").className =
    "panel missing";

  $("resultPanel").innerHTML = `
    <div class="result-title">
      🟩 NIE MA W KOLEKCJI
    </div>

    Kod:
    ${escapeHtml(barcode)}

    <br><br>

    <button
      class="button add"
      onclick="prepareAdd('${barcode}')"
    >
      Dodaj film
    </button>

    <button
      class="button scan"
      onclick="startScanner()"
    >
      Skanuj następny
    </button>
  `;
}

function prepareAdd(barcode) {
  editingBarcode = "";
  editingUuid = "";
  window.movieVaultPendingCustomCover = "";
  showOnly("addPanel");

  resetTmdbSelection();
  $("saveButton").textContent = "Zapisz pozycję";
  $("itemType").value = "Film"; $("format").value = "DVD"; $("seasonCount").value = "";
  $("editionType").value = "Standard"; $("condition").value = "Bardzo dobry"; $("ownershipStatus").value = "Posiadam";
  $("customCoverUrl").value = ""; $("customCoverFile").value = ""; syncSeasonField();

  $("barcode").value =
    normalizeBarcode(barcode);

  $("title").focus();
}

async function searchTmdb() {
  const title =
    $("title").value.trim();

  const year =
    $("year").value.trim();

  if (!title) {
    alert(
      "Najpierw wpisz tytuł filmu."
    );

    $("title").focus();
    return;
  }

  const button =
    $("tmdbSearchButton");

  button.disabled = true;

  button.textContent =
    "Szukanie w TMDb...";

  $("tmdbStatus").innerHTML = `
    <div class="movie">
      Szukam filmu...
    </div>
  `;

  $("tmdbResults").innerHTML = "";

  try {
    const response =
      await apiRequest(
        "tmdbSearch",
        {
          query: title,
          year: year,
          itemType: $("itemType").value
        }
      );

    tmdbResultsCache =
      Array.isArray(response.movies)
        ? response.movies
        : [];

    renderTmdbResults();
  } catch (error) {
    $("tmdbStatus").innerHTML = `
      <div class="movie owned">
        ${escapeHtml(error.message)}
      </div>
    `;
  } finally {
    button.disabled = false;

    button.textContent =
      "🎞 Znajdź dane filmu";
  }
}

function renderTmdbResults() {
  if (!tmdbResultsCache.length) {
    $("tmdbStatus").innerHTML = `
      <div class="movie">
        Nie znaleziono filmu.
        Spróbuj wpisać inny tytuł
        albo usuń rok.
      </div>
    `;

    $("tmdbResults").innerHTML = "";
    return;
  }

  $("tmdbStatus").innerHTML = `
    <p class="hint">
      Wybierz właściwy film:
    </p>
  `;

  $("tmdbResults").innerHTML =
    tmdbResultsCache
      .map(
        function (movie, index) {
          const poster =
            movie.poster
              ? `
                <img
                  class="tmdb-poster"
                  src="${escapeHtml(
                    movie.poster
                  )}"
                  alt=""
                >
              `
              : `
                <div class="tmdb-poster-placeholder">
                  🎬
                </div>
              `;

          return `
            <button
              class="tmdb-result"
              type="button"
              onclick="selectTmdbMovie(${index})"
            >
              ${poster}

              <span class="tmdb-result-text">
                <strong>
                  ${escapeHtml(
                    movie.title ||
                    movie.originalTitle
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    movie.year ||
                    "rok nieznany"
                  )}
                </span>

                ${
                  movie.originalTitle &&
                  movie.originalTitle !==
                    movie.title
                    ? `
                      <small>
                        ${escapeHtml(
                          movie.originalTitle
                        )}
                      </small>
                    `
                    : ""
                }
              </span>
            </button>
          `;
        }
      )
      .join("");
}

async function selectTmdbMovie(index) {
  const selected =
    tmdbResultsCache[index];

  if (!selected) {
    return;
  }

  $("tmdbStatus").innerHTML = `
    <div class="movie">
      Pobieram szczegóły filmu...
    </div>
  `;

  try {
    const response =
      await apiRequest(
        "tmdbMovie",
        {
          id: selected.tmdbId,
          itemType: $("itemType").value
        }
      );

    selectedTmdbMovie =
      response.movie || selected;

    applyTmdbMovie(
      selectedTmdbMovie
    );
  } catch (error) {
    $("tmdbStatus").innerHTML = `
      <div class="movie owned">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function applyTmdbMovie(movie) {
  $("title").value =
    movie.title ||
    movie.originalTitle ||
    "";

  $("year").value =
    movie.year || "";

  $("tmdbResults").innerHTML = "";

  $("tmdbStatus").innerHTML = `
    <div class="movie missing">
      ✅ Wybrano film z TMDb
    </div>
  `;

  const selectedPanel =
    $("selectedMoviePanel");

  selectedPanel.classList.remove(
    "hidden"
  );

  $("selectedMovieTitle").textContent =
    movie.title || "";

  const details = [];

  if (movie.year) {
    details.push(movie.year);
  }

  if (movie.director) {
    details.push(
      "reż. " + movie.director
    );
  }

  if (
    Array.isArray(movie.genres) &&
    movie.genres.length
  ) {
    details.push(
      movie.genres.join(", ")
    );
  }

  $("selectedMovieDetails").textContent =
    details.join(" · ");

  $("selectedMovieDescription").textContent =
    movie.description || "";

  const poster =
    $("selectedPoster");

  if (movie.poster) {
    poster.src = movie.poster;
    poster.classList.remove("hidden");
  } else {
    poster.removeAttribute("src");
    poster.classList.add("hidden");
  }
}

function resetTmdbSelection() {
  tmdbResultsCache = [];
  selectedTmdbMovie = null;

  $("tmdbStatus").innerHTML = "";
  $("tmdbResults").innerHTML = "";

  $("selectedMoviePanel").classList.add(
    "hidden"
  );

  $("selectedPoster").removeAttribute(
    "src"
  );

  $("selectedMovieTitle").textContent =
    "";

  $("selectedMovieDetails").textContent =
    "";

  $("selectedMovieDescription").textContent =
    "";
}

async function addMovie() {
 const enteredBarcode = normalizeBarcode($("barcode").value);
 const existingEditing = editingUuid ? collectionCache.find(function (item) { return String(item.uuid || "") === editingUuid; }) : null;
 const movie = {
  uuid: existingEditing?.uuid || createUuid(),
  catalogBarcode: enteredBarcode,
  barcode: enteredBarcode || existingEditing?.barcode || generateInternalBarcode(),
  originalBarcode: editingBarcode || "",
  itemType: $("itemType").value,
  mediaType: $("format").value,
  seasonCount: $("itemType").value === "Serial" ? $("seasonCount").value.trim() : "",
  editionType: $("editionType").value,
  condition: $("condition").value,
  ownershipStatus: $("ownershipStatus").value,
  customCoverUrl: $("customCoverUrl").value.trim(),
  location: $("shelf").value.trim(),

  title:
    $("title").value.trim(),

  format:
    $("format").value,

  year:
    $("year").value.trim(),

  shelf:
    $("shelf").value.trim(),

  notes:
    $("notes").value.trim(),

  tmdbId:
    selectedTmdbMovie
      ? selectedTmdbMovie.tmdbId || ""
      : "",

  poster:
    selectedTmdbMovie
      ? selectedTmdbMovie.poster || ""
      : "",

  originalTitle:
    selectedTmdbMovie
      ? selectedTmdbMovie.originalTitle || ""
      : "",

  description:
    selectedTmdbMovie
      ? selectedTmdbMovie.description || ""
      : "",

  director:
    selectedTmdbMovie
      ? selectedTmdbMovie.director || ""
      : "",

  genres:
    selectedTmdbMovie
      ? selectedTmdbMovie.genres || []
      : [],

  cast:
    selectedTmdbMovie
      ? selectedTmdbMovie.cast || []
      : [],

  backdrop:
    selectedTmdbMovie
      ? selectedTmdbMovie.backdrop || ""
      : "",

  runtime:
    selectedTmdbMovie
      ? selectedTmdbMovie.runtime || ""
      : "",

  voteAverage:
    selectedTmdbMovie
      ? selectedTmdbMovie.voteAverage || ""
      : "",

  trailer:
    selectedTmdbMovie
      ? selectedTmdbMovie.trailer || ""
      : ""
};

  if (!movie.title) {
    alert("Podaj tytuł pozycji.");
    $("title").focus();
    return;
  }

  const button =
    $("saveButton");

  button.disabled = true;

  button.textContent =
    "Zapisywanie...";

  try {
    const action = editingUuid ? "update" : "add";

    const result =
      await apiRequest(
        action,
        prepareMovieForApi(movie)
      );


    [
      "barcode",
      "title",
      "year", "seasonCount", "customCoverUrl",
      "shelf",
      "notes"
    ].forEach(
      function (id) {
        $(id).value = "";
      }
    );

    const savedMovie = Object.assign({}, movie, {
      addedAt: action === "update"
        ? ((collectionCache.find(function (item) {
            return String(item.uuid || "") === String(movie.uuid || "");
          }) || {}).addedAt || new Date().toISOString())
        : new Date().toISOString()
    });

    if (action === "update") {
      const index = collectionCache.findIndex(function (item) {
        return String(item.uuid || "") === String(movie.uuid || "");
      });
      if (index >= 0) collectionCache[index] = savedMovie;
      else collectionCache.unshift(savedMovie);
    } else {
      collectionCache.unshift(savedMovie);
    }

    const pendingCover = window.movieVaultPendingCustomCover;
    if (pendingCover) { localStorage.setItem(CUSTOM_COVER_STORAGE_PREFIX + savedMovie.uuid, pendingCover); window.movieVaultPendingCustomCover = ""; }
    persistCollectionCache();
    renderHomeDashboard();
    renderStatsFromCollection();

    resetTmdbSelection();
    editingBarcode = "";
    editingUuid = "";
    $("saveButton").textContent = "Zapisz pozycję";

    alert(
      action === "update"
        ? "Zmiany zostały zapisane."
        : "Pozycja została zapisana w Arkuszu Google."
    );

    showOnly("resultPanel");

    $("resultPanel").className =
      "panel missing";

    $("resultPanel").innerHTML = `
      <div class="result-title">
        ✅ POZYCJA ZAPISANA
      </div>

      <button
        class="button collection"
        onclick="openCollection()"
      >
        📚 Zobacz kolekcję
      </button>

      <button
        class="button scan"
        onclick="startScanner()"
      >
        Skanuj następny
      </button>
    `;
  } catch (error) {
    alert(
      "Błąd: " +
      error.message
    );
  } finally {
    button.disabled = false;

    button.textContent =
      "Zapisz pozycję";
  }
}

async function runSearch() {
  const query = $("searchQuery").value.trim();
  if (!query) return;
  $("searchResults").innerHTML = '<div class="movie">Szukanie...</div>';
  try {
    if (!collectionCacheReady) await loadCollection(true);
    const needle = query.toLowerCase();
    const localFound = collectionCache.filter(function (movie) {
      return [movie.title, movie.originalTitle, movie.notes, movie.location, movie.shelf, movie.editionType, movie.condition, movie.itemType, movie.mediaType, movie.catalogBarcode, movie.barcode]
        .join(" ").toLowerCase().includes(needle);
    });
    let remoteFound = [];
    try {
      const response = await apiRequest("search", { query: query });
      remoteFound = hydrateCollection(response.movies);
    } catch (remoteError) {
      console.warn("Wyszukiwanie serwerowe niedostępne, używam lokalnej kolekcji:", remoteError);
    }
    const merged = new Map();
    localFound.concat(remoteFound).forEach(function (movie) { merged.set(movieKey(movie), movie); });
    const found = Array.from(merged.values());
    $("searchResults").innerHTML = found.length ? found.map(movieCard).join("") : '<div class="movie">Nic nie znaleziono.</div>';
  } catch (error) {
    $("searchResults").innerHTML = '<div class="movie owned">' + escapeHtml(error.message) + '</div>';
  }
}

function movieCard(movie) {
  return `
    <div class="movie">
      <strong>
        ${escapeHtml(movie.title)}
      </strong>

      <br>

      ${escapeHtml(
        movie.format || ""
      )}

      ·

      ${escapeHtml(
        movie.year ||
        "rok nieznany"
      )}

      <br>

      Półka:
      ${escapeHtml(
        movie.shelf || "brak"
      )}

      <br>

      Kod:
      ${escapeHtml(movie.barcode)}
    </div>
  `;
}

function renderStatsFromCollection() {
  const owned = collectionCache.filter(isOwned);
  const wishlist = collectionCache.filter(function (movie) { return !isOwned(movie); });
  const counts = { movie: { dvd:0, bluray:0, uhd:0, vhs:0 }, series: { dvd:0, bluray:0, uhd:0, vhs:0 } };
  owned.forEach(function (movie) {
    const group = String(movie.itemType || "Film").toLowerCase() === "serial" ? counts.series : counts.movie;
    const media = normalizeMediaType(movie.mediaType || movie.format);
    if (media === "DVD") group.dvd++; else if (media === "Blu-ray") group.bluray++; else if (media === "UHD Blu-ray") group.uhd++; else if (media === "VHS") group.vhs++;
  });
  const movieTotal = Object.values(counts.movie).reduce(function(a,b){return a+b;},0);
  const seriesTotal = Object.values(counts.series).reduce(function(a,b){return a+b;},0);
  setText("dvd", counts.movie.dvd + counts.series.dvd); setText("bluray", counts.movie.bluray + counts.series.bluray); setText("uhd", counts.movie.uhd + counts.series.uhd); setText("total", owned.length);
  setText("homeMovieTotal", movieTotal); setText("homeSeriesTotal", seriesTotal); setText("homeTotal", owned.length + wishlist.length); setText("homeOwned", owned.length); setText("homeWishlist", wishlist.length);
  setText("homeMovieMedia", "DVD " + counts.movie.dvd + " • Blu-ray " + counts.movie.bluray + " • UHD " + counts.movie.uhd + " • VHS " + counts.movie.vhs);
  setText("homeSeriesMedia", "DVD " + counts.series.dvd + " • Blu-ray " + counts.series.bluray + " • UHD " + counts.series.uhd);
}

function syncSeasonField() {
  const field = safeElement("seasonCountField");
  if (field) field.classList.toggle("hidden", safeElement("itemType")?.value !== "Serial");
}
function toggleCollectorFilter(event) {
  const button = event.currentTarget;
  const set = button.dataset.itemFilter ? activeItemFilters : activeMediaFilters;
  const value = button.dataset.itemFilter || button.dataset.mediaFilter;
  if (set.has(value)) set.delete(value); else set.add(value);
  button.classList.toggle("active", set.has(value));
  renderCollection();
}
function clearCollectorFilters() {
  activeItemFilters.clear(); activeMediaFilters.clear();
  document.querySelectorAll("[data-item-filter], [data-media-filter]").forEach(function(button){button.classList.remove("active");});
  renderCollection();
}
function renderWishlist() {
  const needle = String(safeElement("wishlistFilter")?.value || "").trim().toLowerCase();
  const movies = collectionCache.filter(function(movie){
    if (isOwned(movie)) return false;
    return [movie.title,movie.notes,movie.location,movie.editionType,movie.mediaType].join(" ").toLowerCase().includes(needle);
  });
  setText("wishlistCount", movies.length + " pozycji");
  const node=safeElement("wishlistResults"); if(!node) return;
  node.innerHTML = movies.length ? movies.map(collectionMovieCard).join("") : '<div class="empty-collection"><div class="empty-collection-icon">♡</div><strong>Wishlist jest pusta</strong><p>Dodaj pozycję ze statusem Wishlist.</p></div>';
}
function handleCustomCoverFile(event) {
  const file = event.target.files && event.target.files[0]; if(!file) { window.movieVaultPendingCustomCover=""; return; }
  if(!file.type.startsWith("image/")) { alert("Wybierz plik obrazu."); return; }
  const reader=new FileReader(); reader.onload=function(){ window.movieVaultPendingCustomCover=String(reader.result||""); }; reader.readAsDataURL(file);
}

async function updateStats() {
  if (collectionCacheReady) {
    renderStatsFromCollection();
    return;
  }

  try {
    const response = await apiRequest("stats");
    const stats = response.stats || {};
    setText("dvd", stats.dvd || 0);
    setText("bluray", stats.bluray || 0);
    setText("uhd", stats.uhd || 0);
    setText("total", stats.total || 0);
    setText("homeDvd", stats.dvd || 0);
    setText("homeBluray", stats.bluray || 0);
    setText("homeUhd", stats.uhd || 0);
    setText("homeTotal", stats.total || 0);
  } catch (error) {
    console.error("Nie udało się pobrać statystyk:", error);
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
