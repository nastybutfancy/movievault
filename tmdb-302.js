import { apiRequest } from "./api-302.js";
import { state } from "./state-302.js";
import { $, escapeHtml } from "./utils-302.js";

let results = [];

export async function searchTmdb() {
  const query = $("titleInput").value.trim();
  const year = $("yearInput").value.trim();
  if (!query) {
    alert("Najpierw wpisz tytuł filmu.");
    return;
  }

  $("tmdbStatus").textContent = "Szukam filmu...";
  $("tmdbResults").innerHTML = "";

  const response = await apiRequest("tmdbSearch", { query, year });
  results = Array.isArray(response.movies) ? response.movies : [];
  $("tmdbStatus").textContent = results.length ? "Wybierz właściwy film:" : "Nie znaleziono filmu.";

  $("tmdbResults").innerHTML = results.map((movie, index) => `
    <button class="tmdb-result" data-tmdb-index="${index}" type="button">
      ${movie.poster ? `<img src="${escapeHtml(movie.poster)}" alt="">` : `<div>🎬</div>`}
      <span><strong>${escapeHtml(movie.title || movie.originalTitle || "")}</strong><br>
      <small>${escapeHtml(movie.year || "rok nieznany")}</small></span>
    </button>`).join("");

  document.querySelectorAll("[data-tmdb-index]").forEach(button => {
    button.addEventListener("click", () => selectTmdb(Number(button.dataset.tmdbIndex)));
  });
}

async function selectTmdb(index) {
  const selected = results[index];
  if (!selected) return;

  $("tmdbStatus").textContent = "Pobieram szczegóły...";
  const response = await apiRequest("tmdbMovie", { id: selected.tmdbId });
  state.selectedTmdbMovie = response.movie || selected;

  const movie = state.selectedTmdbMovie;
  $("titleInput").value = movie.title || movie.originalTitle || "";
  $("yearInput").value = movie.year || "";
  $("tmdbResults").innerHTML = "";
  $("tmdbStatus").textContent = "Wybrano film z TMDb.";

  if (movie.poster) {
    $("selectedPoster").src = movie.poster;
    $("selectedTmdbTitle").textContent = movie.title || "";
    $("selectedTmdbDetails").textContent = [movie.year, movie.director].filter(Boolean).join(" · ");
    $("selectedTmdb").classList.remove("hidden");
  }
}
