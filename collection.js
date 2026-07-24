import { apiRequest } from "./api.js";
import { state } from "./state.js";
import { $, escapeHtml, normalizeBarcode, showView, formatDate } from "./utils.js";

export async function loadCollection() {
  $("collectionCount").textContent = "Ładowanie kolekcji...";
  $("collectionGrid").innerHTML = "";
  const response = await apiRequest("collection", { sort: $("collectionSort").value });
  state.movies = Array.isArray(response.movies) ? response.movies : [];
  renderCollection();
}

export function renderCollection() {
  const needle = $("collectionFilter").value.trim().toLowerCase();
  const movies = state.movies.filter(movie =>
    [movie.title, movie.year, movie.format, movie.shelf, movie.barcode, movie.notes]
      .join(" ").toLowerCase().includes(needle)
  );

  $("collectionCount").textContent = needle
    ? `Znaleziono: ${movies.length} z ${state.movies.length}`
    : `Liczba filmów: ${state.movies.length}`;

  $("collectionGrid").innerHTML = movies.length
    ? movies.map(cardTemplate).join("")
    : `<div class="list-item">Brak filmów do wyświetlenia.</div>`;

  document.querySelectorAll("[data-open-movie]").forEach(button => {
    button.addEventListener("click", () => openMovie(button.dataset.openMovie));
  });
  document.querySelectorAll("[data-edit-movie]").forEach(button => {
    button.addEventListener("click", () => startEdit(button.dataset.editMovie));
  });
  document.querySelectorAll("[data-delete-movie]").forEach(button => {
    button.addEventListener("click", () => removeMovie(button.dataset.deleteMovie));
  });
}

function cardTemplate(movie) {
  const barcode = normalizeBarcode(movie.barcode);
  const poster = movie.poster
    ? `<img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)}" loading="lazy">`
    : `<div class="poster-placeholder">🎬</div>`;

  return `<article class="poster-card">
    <button class="poster-button" data-open-movie="${barcode}" type="button">
      <div class="poster-wrap">${poster}</div>
      <div class="poster-meta">
        <h3>${escapeHtml(movie.title || "Bez tytułu")}</h3>
        <div class="badges">
          <span class="badge">${escapeHtml(movie.format || "brak formatu")}</span>
          <span class="badge">${escapeHtml(movie.year || "rok nieznany")}</span>
        </div>
      </div>
    </button>
    <div class="card-actions">
      <button class="edit-button" data-edit-movie="${barcode}" type="button">Edytuj</button>
      <button class="delete-button" data-delete-movie="${barcode}" type="button">Usuń</button>
    </div>
  </article>`;
}

function findMovie(barcode) {
  return state.movies.find(movie => normalizeBarcode(movie.barcode) === normalizeBarcode(barcode));
}

export function openMovie(barcode) {
  const movie = findMovie(barcode);
  if (!movie) return;

  $("dialogContent").innerHTML = `
    ${movie.poster ? `<img class="dialog-poster" src="${escapeHtml(movie.poster)}" alt="">` : ""}
    <h2>${escapeHtml(movie.title || "Bez tytułu")}</h2>
    <p class="muted">${escapeHtml(movie.year || "")} · ${escapeHtml(movie.format || "")}</p>
    <p><strong>Półka:</strong> ${escapeHtml(movie.shelf || "brak")}</p>
    <p><strong>Kod:</strong> ${escapeHtml(movie.barcode || "")}</p>
    ${movie.notes ? `<p>${escapeHtml(movie.notes)}</p>` : ""}
    <p class="muted">Dodano: ${escapeHtml(formatDate(movie.addedAt || movie.dateAdded || movie.date))}</p>
    <div class="dialog-actions">
      <button id="dialogEditButton" class="edit-button" type="button">Edytuj</button>
      <button id="dialogDeleteButton" class="delete-button" type="button">Usuń</button>
    </div>`;

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

export function startEdit(barcode) {
  const movie = findMovie(barcode);
  if (!movie) return;

  state.editingOriginalBarcode = normalizeBarcode(movie.barcode);
  state.editingMovie = { ...movie };
  state.selectedTmdbMovie = {
    tmdbId: movie.tmdbId || "",
    poster: movie.poster || "",
    title: movie.title || "",
    year: movie.year || ""
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
  state.movies = state.movies.filter(item => normalizeBarcode(item.barcode) !== normalizeBarcode(barcode));
  renderCollection();
  document.dispatchEvent(new CustomEvent("movievault:stats"));
  alert("Film został usunięty.");
}

export function clearEditState() {
  state.editingOriginalBarcode = "";
  state.editingMovie = null;
  state.selectedTmdbMovie = null;
}
