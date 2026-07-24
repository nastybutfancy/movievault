const API_URL =
  "https://script.google.com/macros/s/AKfycbyQTE2JyHjVngVHs-OlLIuMHknWa-u81Jx-jG8sJ1K8WpbQi5NZYDvRHOLy2C1gFzoKTQ/exec";

let codeReader = null;
let scannerControls = null;
let scanLock = false;

let tmdbResultsCache = [];
let selectedTmdbMovie = null;

let collectionCache = [];

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
      loadCollection
    );

    $("collectionFilter").addEventListener(
      "input",
      renderCollection
    );

    $("collectionSort").addEventListener(
      "change",
      loadCollection
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

async function loadCollection() {
  const sort =
    $("collectionSort").value;

  $("collectionCount").textContent =
    "Ładowanie kolekcji...";

  $("collectionResults").innerHTML = `
    <div class="movie">
      Pobieram filmy z Arkusza Google...
    </div>
  `;

  try {
    const response =
      await apiRequest(
        "collection",
        {
          sort: sort
        }
      );

    collectionCache =
      Array.isArray(response.movies)
        ? response.movies
        : [];

    renderCollection();
  } catch (error) {
    $("collectionCount").textContent =
      "Nie udało się pobrać kolekcji.";

    $("collectionResults").innerHTML = `
      <div class="movie owned">
        <strong>Błąd</strong>

        <p>
          ${escapeHtml(error.message)}
        </p>
      </div>
    `;
  }
}

function renderCollection() {
  const filter =
    $("collectionFilter")
      .value
      .trim()
      .toLowerCase();

  const visibleMovies =
    collectionCache.filter(
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
  const formatClass =
    getFormatClass(movie.format);

  const year =
    movie.year
      ? escapeHtml(movie.year)
      : "rok nieznany";

  const shelf =
    movie.shelf
      ? `
        <div class="collection-detail">
          <span>Półka</span>
          <strong>
            ${escapeHtml(movie.shelf)}
          </strong>
        </div>
      `
      : "";

  const notes =
    movie.notes
      ? `
        <p class="collection-notes">
          ${escapeHtml(movie.notes)}
        </p>
      `
      : "";

  const addedDate =
    formatAddedDate(
      movie.addedAt ||
      movie.dateAdded ||
      movie.date
    );

  const added =
    addedDate
      ? `
        <div class="collection-added">
          Dodano: ${escapeHtml(addedDate)}
        </div>
      `
      : "";

  return `
    <article class="collection-card">
      <div class="collection-card-top">
        <div class="collection-cover-placeholder">
          🎬
        </div>

        <div class="collection-main-info">
          <h3>
            ${escapeHtml(
              movie.title ||
              "Bez tytułu"
            )}
          </h3>

          <div class="collection-badges">
            <span class="format-badge ${formatClass}">
              ${escapeHtml(
                movie.format ||
                "brak formatu"
              )}
            </span>

            <span class="year-badge">
              ${year}
            </span>
          </div>
        </div>
      </div>

      <div class="collection-details">
        ${shelf}

        <div class="collection-detail">
          <span>Kod kreskowy</span>
          <strong>
            ${escapeHtml(
              movie.barcode || "brak"
            )}
          </strong>
        </div>
      </div>

      ${notes}
      ${added}
    </article>
  `;
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
    codeReader =
      new ZXingBrowser
        .BrowserMultiFormatReader();

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
    const response =
      await apiRequest(
        "find",
        {
          barcode: barcode
        }
      );

    renderScanResult(
      barcode,
      response.movie
    );
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
  showOnly("addPanel");

  resetTmdbSelection();

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
 const movie = {
  barcode: normalizeBarcode(
    $("barcode").value
  ),

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
      : ""
};

  if (
    !movie.barcode ||
    !movie.title
  ) {
    alert(
      "Podaj kod kreskowy i tytuł."
    );

    return;
  }

  const button =
    $("saveButton");

  button.disabled = true;

  button.textContent =
    "Zapisywanie...";

  try {
    const result =
      await apiRequest(
        "add",
        movie
      );

    if (result.duplicate) {
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

    resetTmdbSelection();

    collectionCache = [];

    await updateStats();

    alert(
      "Film został zapisany w Arkuszu Google."
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

async function updateStats() {
  try {
    const response =
      await apiRequest("stats");

    const stats =
      response.stats || {};

    $("dvd").textContent =
      stats.dvd || 0;

    $("bluray").textContent =
      stats.bluray || 0;

    $("uhd").textContent =
      stats.uhd || 0;

    $("total").textContent =
      stats.total || 0;
  } catch (error) {
    console.error(
      "Nie udało się pobrać statystyk:",
      error
    );
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
