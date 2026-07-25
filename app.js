const HOME_PANEL_ID = "homePanel";

function safeElement(id) {
  return document.getElementById(id);
}

function showHome() {
  [
    "homePanel",
    "scannerPanel",
    "resultPanel",
    "collectionPanel",
    "searchPanel",
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
  if (section === "home") {
    document.querySelectorAll("[data-home]").forEach(function (button) {
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
    const movies = Array.isArray(response.movies) ? response.movies : [];

    const createdAt = new Date();
    const backup = {
      application: "MovieVault",
      backupVersion: 1,
      appVersion: "3.3.0",
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
    link.download = "MovieVault_Backup_" + backupDateStamp(createdAt) + ".json";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    collectionCache = movies;
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

async function loadHomeDashboard(force) {
  const recentNode = safeElement("recentMovies");
  if (!recentNode) return;

  if (collectionCacheReady) {
    renderHomeDashboard();
  }

  if (!force && collectionCacheIsFresh()) return;

  try {
    const response = await apiRequest("collection", { sort: "newest" });
    collectionCache = Array.isArray(response.movies) ? response.movies : [];
    persistCollectionCache();
    renderHomeDashboard();
    renderStatsFromCollection();
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
    .slice()
    .sort(function (a, b) { return getAddedTimestamp(b) - getAddedTimestamp(a); })
    .slice(0, 8);

  if (!recent.length) {
    node.innerHTML = '<div class="loading-card">Twoja kolekcja czeka na pierwszy film.</div>';
    return;
  }

  node.innerHTML = recent.map(function (movie, index) {
    const poster = moviePoster(movie);
    const art = poster
      ? '<img src="' + escapeHtml(poster) + '" alt="" loading="lazy">'
      : '<div class="poster-placeholder">▥</div>';
    return `
      <button class="poster-card" type="button" onclick="openHomeMovie(${index})">
        <span class="poster-art">${art}</span>
        <span class="poster-meta">
          <strong>${escapeHtml(movie.title || "Bez tytułu")}</strong>
          <small><span>${escapeHtml(movie.year || "—")}</span><span class="format-pill">${escapeHtml(movie.format || "Film")}</span></small>
        </span>
      </button>
    `;
  }).join("");

  window.homeRecentMovies = recent;
}

function renderHomeFormatCounts() {
  const counts = { dvd: 0, bluray: 0, uhd: 0, steelbook: 0, boxset: 0, vhs: 0 };
  collectionCache.forEach(function (movie) {
    const format = normalizeFormat(movie.format);
    if (format.includes("steelbook")) counts.steelbook++;
    else if (format.includes("boxset") || format.includes("box")) counts.boxset++;
    else if (format.includes("vhs")) counts.vhs++;
    else if (format.includes("4k") || format.includes("uhd")) counts.uhd++;
    else if (format.includes("bluray") || format.includes("blu")) counts.bluray++;
    else if (format.includes("dvd")) counts.dvd++;
  });

  const map = {
    homeDvd: counts.dvd,
    homeBluray: counts.bluray,
    homeUhd: counts.uhd,
    homeSteelbook: counts.steelbook,
    homeBoxset: counts.boxset,
    homeVhs: counts.vhs,
    homeTotal: collectionCache.length
  };
  Object.keys(map).forEach(function (id) {
    const node = safeElement(id);
    if (node) node.textContent = map[id];
  });
}

function renderCollectorStats() {
  const years = collectionCache
    .map(function (movie) { return Number(movie.year); })
    .filter(function (year) { return year > 1800 && year < 2200; });

  const oldestYear = years.length ? Math.min.apply(null, years) : null;
  const newestYear = years.length ? Math.max.apply(null, years) : null;
  const oldestMovie = collectionCache.find(function (movie) { return Number(movie.year) === oldestYear; });
  const newestMovie = collectionCache.find(function (movie) { return Number(movie.year) === newestYear; });

  setText("oldestYear", oldestYear || "—");
  setText("newestYear", newestYear || "—");
  setText("oldestTitle", oldestMovie?.title || "Brak danych");
  setText("newestTitle", newestMovie?.title || "Brak danych");

  const ratings = collectionCache.map(getMovieRating).filter(function (rating) { return rating > 0; });
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
  const poster = moviePoster(movie);
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
  document.querySelectorAll("[data-mobile-search]").forEach(function (button) {
    button.addEventListener("click", openSearchFromHome);
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

const COLLECTION_STORAGE_KEY = "movievault.collection.v1";
const COLLECTION_CACHE_MAX_AGE = 5 * 60 * 1000;

function restoreCollectionCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLECTION_STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.movies)) return false;
    collectionCache = saved.movies;
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
      movies: collectionCache
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
    "searchPanel",
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
    collectionCache = Array.isArray(response.movies) ? response.movies : [];
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
        if (!filter) {
          return true;
        }

        const searchableText = [
          movie.title,
          movie.year,
          movie.format,
          movie.shelf,
          movie.barcode,
          movie.notes
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          filter
        );
      }
    );

  $("collectionCount").textContent =
    filter
      ? (
          "Znaleziono: " +
          visibleMovies.length +
          " z " +
          collectionCache.length
        )
      : (
          "Liczba filmów: " +
          collectionCache.length
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
  const cover = movie.poster
    ? `<img class="collection-cover" src="${escapeHtml(movie.poster)}" alt="Okładka filmu ${escapeHtml(movie.title || "")}" loading="lazy">`
    : `<div class="collection-cover-placeholder">🎬</div>`;

  const barcode = normalizeBarcode(movie.barcode);

  return `
    <button class="collection-card" type="button" onclick="openCollectionMovie('${escapeHtml(barcode)}')">
      <div class="collection-cover-frame">${cover}</div>
      <div class="collection-main-info">
        <h3>${escapeHtml(movie.title || "Bez tytułu")}</h3>
        <div class="collection-badges">
          <span class="format-badge ${formatClass}">${escapeHtml(movie.format || "Film")}</span>
          <span class="year-badge">${year}</span>
        </div>
      </div>
    </button>
  `;
}


function openCollectionMovie(barcode) {
  const normalized = normalizeBarcode(barcode);
  const movie = collectionCache.find(function (item) {
    return normalizeBarcode(item.barcode) === normalized;
  });

  if (!movie) {
    return;
  }

  const poster = moviePoster(movie);
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
    movie.format ? "<span>" + escapeHtml(movie.format) + "</span>" : "",
    movie.runtime ? "<span>" + escapeHtml(String(movie.runtime)) + " min</span>" : "",
    movie.shelf ? "<span>Półka: " + escapeHtml(movie.shelf) + "</span>" : ""
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
          <button class="primary-button" type="button" onclick="editCollectionMovie('${escapeHtml(normalized)}')">Edytuj</button>
          <button class="danger-button" type="button" onclick="deleteCollectionMovie('${escapeHtml(normalized)}')">Usuń</button>
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
  const normalized = normalizeBarcode(barcode);
  const movie = collectionCache.find(function (item) {
    return normalizeBarcode(item.barcode) === normalized;
  });

  if (!movie) {
    return;
  }

  editingBarcode = normalized;
  closeMovieDetails();
  showOnly("addPanel");

  resetTmdbSelection();

  $("barcode").value = normalized;
  $("title").value = movie.title || "";
  $("format").value = movie.format || "DVD";
  $("year").value = movie.year || "";
  $("shelf").value = movie.shelf || "";
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
  const normalized = normalizeBarcode(barcode);
  const movie = collectionCache.find(function (item) {
    return normalizeBarcode(item.barcode) === normalized;
  });

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
    await apiRequest("delete", { barcode: normalized });
    collectionCache = collectionCache.filter(function (item) {
      return normalizeBarcode(item.barcode) !== normalized;
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
        return normalizeBarcode(movie.barcode) === barcode;
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
        🟥 JUŻ POSIADASZ
      </div>

      <strong>
        ${escapeHtml(movie.title)}
      </strong>

      <br>

      ${escapeHtml(
        movie.format || ""
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
  showOnly("addPanel");

  resetTmdbSelection();
  $("saveButton").textContent = "Zapisz film";

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
          year: year
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
          id: selected.tmdbId
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
 const movie = {
  barcode: enteredBarcode || (editingBarcode || generateInternalBarcode()),

  originalBarcode: editingBarcode || "",

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
    alert("Podaj tytuł filmu.");
    $("title").focus();
    return;
  }

  const button =
    $("saveButton");

  button.disabled = true;

  button.textContent =
    "Zapisywanie...";

  try {
    const action = editingBarcode ? "update" : "add";

    const result =
      await apiRequest(
        action,
        movie
      );

    if (!editingBarcode && result.duplicate) {
      alert(
        "Ten film jest już w kolekcji."
      );

      return;
    }

    [
      "barcode",
      "title",
      "year",
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
            return normalizeBarcode(item.barcode) === normalizeBarcode(movie.originalBarcode);
          }) || {}).addedAt || new Date().toISOString())
        : new Date().toISOString()
    });

    if (action === "update") {
      const original = normalizeBarcode(movie.originalBarcode);
      const index = collectionCache.findIndex(function (item) {
        return normalizeBarcode(item.barcode) === original;
      });
      if (index >= 0) collectionCache[index] = savedMovie;
      else collectionCache.unshift(savedMovie);
    } else {
      collectionCache.unshift(savedMovie);
    }

    persistCollectionCache();
    renderHomeDashboard();
    renderStatsFromCollection();

    resetTmdbSelection();
    editingBarcode = "";
    $("saveButton").textContent = "Zapisz film";

    alert(
      action === "update"
        ? "Zmiany zostały zapisane."
        : "Film został zapisany w Arkuszu Google."
    );

    showOnly("resultPanel");

    $("resultPanel").className =
      "panel missing";

    $("resultPanel").innerHTML = `
      <div class="result-title">
        ✅ FILM ZAPISANY
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
      "Zapisz film";
  }
}

async function runSearch() {
  const query =
    $("searchQuery")
      .value
      .trim();

  if (!query) {
    return;
  }

  $("searchResults").innerHTML = `
    <div class="movie">
      Szukanie...
    </div>
  `;

  try {
    const response =
      await apiRequest(
        "search",
        {
          query: query
        }
      );

    const found =
      response.movies || [];

    $("searchResults").innerHTML =
      found.length
        ? found
            .map(movieCard)
            .join("")
        : `
          <div class="movie">
            Nic nie znaleziono.
          </div>
        `;
  } catch (error) {
    $("searchResults").innerHTML = `
      <div class="movie owned">
        ${escapeHtml(error.message)}
      </div>
    `;
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
  const counts = { dvd: 0, bluray: 0, uhd: 0 };
  collectionCache.forEach(function (movie) {
    const format = normalizeFormat(movie.format);
    if (format.includes("4k") || format.includes("uhd")) counts.uhd++;
    else if (format.includes("bluray") || format.includes("blu")) counts.bluray++;
    else if (format.includes("dvd")) counts.dvd++;
  });

  setText("dvd", counts.dvd);
  setText("bluray", counts.bluray);
  setText("uhd", counts.uhd);
  setText("total", collectionCache.length);
  setText("homeDvd", counts.dvd);
  setText("homeBluray", counts.bluray);
  setText("homeUhd", counts.uhd);
  setText("homeTotal", collectionCache.length);
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
