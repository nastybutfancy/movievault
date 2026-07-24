import { apiRequest } from "./api.js";
import { state } from "./state.js";
import { $, escapeHtml, normalizeBarcode, showView, formatDate } from "./utils.js";

let activeFormat = "all";

export async function loadCollection() {
  $("collectionCount").textContent = "Ładowanie kolekcji...";
  $("collectionGrid").innerHTML = "";
  $("recentCollection").innerHTML = "";

  const response = await apiRequest("collection", {
    sort: $("collectionSort").value
  });

  state.movies = Array.isArray(response.movies) ? response.movies : [];
  activeFormat = "all";
  syncFormatChips();
  renderCollection();
}

export function renderCollection() {
  const needle = $("collectionFilter").value.trim().toLowerCase();

  const movies = state.movies.filter(movie => {
    const matchesSearch = [
      movie.title,
      movie.year,
      movie.format,
      movie.shelf,
      movie.barcode,
      movie.notes
    ].join(" ").toLowerCase().includes(needle);

    const matchesFormat =
      activeFormat === "all" ||
      normalizeFormat(movie.format) === activeFormat;

    return matchesSearch && matchesFormat;
  });

  renderRecentMovies();

  $("collectionCount").textContent =
    needle || activeFormat !== "all"
      ? `Wyświetlono ${movies.length} z ${state.movies.length}`
      : `${state.movies.length} ${pluralizeMovies(state.movies.length)} w kolekcji`;

  $("collectionGrid").innerHTML = movies.length
    ? movies.map(cardTemplate).join("")
    : emptyStateTemplate();

  bindMovieButtons();
}

export function setCollectionFormat(format) {
  activeFormat = format;
  syncFormatChips();
  renderCollection();
}

function renderRecentMovies() {
  const recentMovies = [...state.movies]
    .sort((a, b) => getMovieTimestamp(b) - getMovieTimestamp(a))
    .slice(0, 10);

  $("recentCollection").innerHTML = recentMovies.length
    ? recentMovies.map(recentCardTemplate).join("")
    : `<div class="collection-empty compact">
        <span>🎞️</span>
        <p>Ostatnio dodane filmy pojawią się tutaj.</p>
      </div>`;
}

function cardTemplate(movie) {
  const barcode = normalizeBarcode(movie.barcode);

  return `<article class="poster-card">
    <button class="poster-button" data-open-movie="${escapeHtml(barcode)}" type="button">
      <div class="poster-wrap">
        ${posterTemplate(movie)}
        <span class="format-ribbon">${escapeHtml(movie.format || "Film")}</span>
      </div>
      <div class="poster-meta">
        <h3>${escapeHtml(movie.title || "Bez tytułu")}</h3>
        <p>${escapeHtml(movie.year || "Rok nieznany")}</p>
      </div>
    </button>
  </article>`;
}

function recentCardTemplate(movie) {
  const barcode = normalizeBarcode(movie.barcode);

  return `<button class="recent-card" data-open-movie="${escapeHtml(barcode)}" type="button">
    <div class="recent-poster">${posterTemplate(movie)}</div>
    <strong>${escapeHtml(movie.title || "Bez tytułu")}</strong>
    <span>${escapeHtml(movie.format || "Film")} · ${escapeHtml(movie.year || "—")}</span>
  </button>`;
}

function posterTemplate(movie) {
  return movie.poster
    ? `<img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title || "Okładka filmu")}" loading="lazy">`
    : `<div class="poster-placeholder" aria-hidden="true">🎬</div>`;
}

function emptyStateTemplate() {
  return `<div class="collection-empty">
    <span>📼</span>
    <h3>Ta część półki jest jeszcze pusta</h3>
    <p>Zmień filtr albo dodaj nowy film do kolekcji.</p>
  </div>`;
}

function bindMovieButtons() {
  document.querySelectorAll("[data-open-movie]").forEach(button => {
    button.addEventListener("click", () => openMovie(button.dataset.openMovie));
  });
}

function syncFormatChips() {
  document.querySelectorAll("[data-format-filter]").forEach(button => {
    const isActive = button.dataset.formatFilter === activeFormat;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function findMovie(barcode) {
  return state.movies.find(
    movie => normalizeBarcode(movie.barcode) === normalizeBarcode(barcode)
  );
}

export function openMovie(barcode) {
  const movie = findMovie(barcode);
  if (!movie) return;

  const poster = movie.poster
    ? `<img class="details-poster" src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title || "Okładka filmu")}">`
    : `<div class="details-poster details-placeholder">🎬</div>`;

  const backdropStyle = movie.backdrop
    ? `style="background-image: linear-gradient(to top, #0b1220 0%, rgba(11,18,32,.15) 58%, rgba(11,18,32,.48) 100%), url('${escapeHtml(movie.backdrop)}')"`
    : "";

  const genres = splitMetadata(movie.genres);
  const cast = splitMetadata(movie.cast);
  const rating = movie.voteAverage
    ? `<span class="rating-badge">★ ${escapeHtml(formatRating(movie.voteAverage))} TMDb</span>`
    : "";

  $("dialogContent").innerHTML = `
    <article class="movie-details cinematic-details">
      <div class="cinematic-backdrop" ${backdropStyle}></div>

      <div class="details-visual">
        ${poster}
      </div>

      <div class="details-copy">
        <p class="eyebrow">MovieVault Collection</p>
        <h2>${escapeHtml(movie.title || "Bez tytułu")}</h2>
        ${movie.originalTitle && movie.originalTitle !== movie.title
          ? `<p class="original-title">${escapeHtml(movie.originalTitle)}</p>`
          : ""}

        <div class="details-badges">
          <span>${escapeHtml(movie.format || "Brak formatu")}</span>
          <span>${escapeHtml(movie.year || "Rok nieznany")}</span>
          ${movie.runtime ? `<span>${escapeHtml(formatRuntime(movie.runtime))}</span>` : ""}
          ${movie.shelf ? `<span>📍 ${escapeHtml(movie.shelf)}</span>` : ""}
          ${rating}
        </div>

        ${genres.length ? `
          <div class="genre-list">
            ${genres.map(genre => `<span>${escapeHtml(genre)}</span>`).join("")}
          </div>` : ""}

        ${movie.description ? `
          <section class="details-section synopsis-section">
            <h3>Opis filmu</h3>
            <p>${escapeHtml(movie.description)}</p>
          </section>` : ""}

        ${movie.director || cast.length ? `
          <section class="credits-grid">
            ${movie.director ? `
              <div>
                <span>Reżyseria</span>
                <strong>${escapeHtml(movie.director)}</strong>
              </div>` : ""}
            ${cast.length ? `
              <div>
                <span>Obsada</span>
                <strong>${cast.map(escapeHtml).join(", ")}</strong>
              </div>` : ""}
          </section>` : ""}

        ${movie.notes ? `
          <section class="details-section collector-notes">
            <h3>Notatki kolekcjonera</h3>
            <p>${escapeHtml(movie.notes)}</p>
          </section>` : ""}

        <section class="details-facts">
          <div>
            <span>Kod kreskowy</span>
            <strong>${escapeHtml(movie.barcode || "Brak")}</strong>
          </div>
          <div>
            <span>Dodano</span>
            <strong>${escapeHtml(formatDate(movie.addedAt || movie.dateAdded || movie.date))}</strong>
          </div>
          <div>
            <span>TMDb</span>
            <strong>${escapeHtml(movie.tmdbId || "Niepołączony")}</strong>
          </div>
        </section>

        <div class="dialog-actions metadata-actions">
          ${movie.trailer
            ? `<a class="trailer-button" href="${escapeHtml(movie.trailer)}" target="_blank" rel="noopener noreferrer">▶ Zwiastun</a>`
            : ""}
          <button id="dialogEditButton" class="edit-button" type="button">Edytuj film</button>
          <button id="dialogDeleteButton" class="delete-button" type="button">Usuń</button>
        </div>
      </div>
    </article>`;

  applyMovieAccent(movie.poster || movie.backdrop || "");
  $("detailsDialog").showModal();

  $("dialogEditButton").onclick = () => {
    $("detailsDialog").close();
    startEdit(barcode);
  };

  $("dialogDeleteButton").onclick = async () => {
    $("detailsDialog").close();
    await removeMovie(barcode);
  };
}

function splitMetadata(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split(/\s*\|\s*|\s*,\s*/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatRuntime(value) {
  const minutes = Number.parseInt(value, 10);
  if (!minutes) return String(value || "");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} godz. ${rest} min` : `${rest} min`;
}

function formatRating(value) {
  const rating = Number.parseFloat(value);
  return Number.isFinite(rating) ? rating.toFixed(1) : String(value || "");
}


function applyMovieAccent(imageUrl) {
  const dialog = $("detailsDialog");
  const fallback = { r: 99, g: 102, b: 241 };

  const setAccent = ({ r, g, b }) => {
    dialog.style.setProperty("--movie-accent-rgb", `${r}, ${g}, ${b}`);
    dialog.style.setProperty("--movie-accent", `rgb(${r}, ${g}, ${b})`);
  };

  if (!imageUrl) {
    setAccent(fallback);
    return;
  }

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";

  image.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });

      canvas.width = 32;
      canvas.height = 32;
      context.drawImage(image, 0, 0, 32, 32);

      const pixels = context.getImageData(0, 0, 32, 32).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let weightTotal = 0;

      for (let index = 0; index < pixels.length; index += 16) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const alpha = pixels[index + 3] / 255;

        const brightness = (r + g + b) / 3;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);

        if (alpha < .6 || brightness < 24 || brightness > 232) continue;

        const weight = 1 + saturation / 90;
        red += r * weight;
        green += g * weight;
        blue += b * weight;
        weightTotal += weight;
      }

      if (!weightTotal) {
        setAccent(fallback);
        return;
      }

      const normalize = value => Math.max(54, Math.min(214, Math.round(value / weightTotal)));

      setAccent({
        r: normalize(red),
        g: normalize(green),
        b: normalize(blue)
      });
    } catch (error) {
      setAccent(fallback);
    }
  };

  image.onerror = () => setAccent(fallback);
  image.src = imageUrl;
}

export function startEdit(barcode) {
  const movie = findMovie(barcode);
  if (!movie) return;

  state.editingOriginalBarcode = normalizeBarcode(movie.barcode);
  state.editingMovie = { ...movie };
  state.selectedTmdbMovie = {
    tmdbId: movie.tmdbId || "",
    poster: movie.poster || "",
    title: movie.title || "",
    originalTitle: movie.originalTitle || "",
    year: movie.year || "",
    description: movie.description || "",
    genres: movie.genres || "",
    runtime: movie.runtime || "",
    director: movie.director || "",
    cast: movie.cast || "",
    voteAverage: movie.voteAverage || "",
    backdrop: movie.backdrop || "",
    trailer: movie.trailer || ""
  };

  $("formEyebrow").textContent = "Edycja";
  $("formTitle").textContent = "Edytuj film";
  $("saveMovieButton").textContent = "Zapisz zmiany";
  $("barcodeInput").value = movie.barcode || "";
  $("titleInput").value = movie.title || "";
  $("formatInput").value = movie.format || "DVD";
  $("yearInput").value = movie.year || "";
  $("shelfInput").value = movie.shelf || "";
  $("notesInput").value = movie.notes || "";

  if (movie.poster) {
    $("selectedPoster").src = movie.poster;
    $("selectedTmdbTitle").textContent = movie.title || "";
    $("selectedTmdbDetails").textContent = movie.year || "";
    $("selectedTmdb").classList.remove("hidden");
  } else {
    $("selectedTmdb").classList.add("hidden");
  }

  showView("formView");
}

export async function removeMovie(barcode) {
  const movie = findMovie(barcode);
  if (!movie) return;

  if (!confirm(`Usunąć film „${movie.title || "Bez tytułu"}”?\n\nTej operacji nie można cofnąć.`)) return;

  await apiRequest("delete", { barcode: movie.barcode });

  state.movies = state.movies.filter(
    item => normalizeBarcode(item.barcode) !== normalizeBarcode(barcode)
  );

  renderCollection();
  document.dispatchEvent(new CustomEvent("movievault:stats"));
  alert("Film został usunięty.");
}

export function clearEditState() {
  state.editingOriginalBarcode = "";
  state.editingMovie = null;
  state.selectedTmdbMovie = null;
}

function normalizeFormat(format = "") {
  const value = String(format).trim().toLowerCase();

  if (value.includes("vhs")) return "vhs";
  if (value.includes("4k") || value.includes("uhd")) return "4k";
  if (value.includes("blu")) return "bluray";
  if (value.includes("dvd")) return "dvd";

  return "other";
}

function getMovieTimestamp(movie) {
  const rawDate = movie.addedAt || movie.dateAdded || movie.date;
  const timestamp = new Date(rawDate || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function pluralizeMovies(count) {
  if (count === 1) return "film";
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) return "filmy";
  return "filmów";
}
