import { apiRequest } from "./api.js";
import { state } from "./state.js";
import { $, normalizeBarcode, showView, escapeHtml } from "./utils.js";
import {
  loadCollection,
  renderCollection,
  clearEditState,
  setCollectionFormat
} from "./collection.js";
import { searchTmdb } from "./tmdb.js";
import { startScanner, stopScanner } from "./scanner.js";
import { renderHome, setupHome } from "./home.js";


let dialogScrollPosition = 0;

function lockBackgroundScroll() {
  if (document.body.classList.contains("dialog-open")) return;

  dialogScrollPosition = window.scrollY || window.pageYOffset || 0;

  document.documentElement.classList.add("dialog-open");
  document.body.classList.add("dialog-open");
  document.body.style.top = `-${dialogScrollPosition}px`;
}

function unlockBackgroundScroll() {
  if (!document.body.classList.contains("dialog-open")) return;

  document.documentElement.classList.remove("dialog-open");
  document.body.classList.remove("dialog-open");
  document.body.style.top = "";

  window.scrollTo(0, dialogScrollPosition);
}

function setupDialogScrollLock() {
  const dialog = $("detailsDialog");

  const syncDialogState = () => {
    if (dialog.open) {
      lockBackgroundScroll();

      requestAnimationFrame(() => {
        const scroller = dialog.querySelector(".cinematic-details");
        if (scroller) scroller.scrollTop = 0;
      });
    } else {
      unlockBackgroundScroll();
    }
  };

  const observer = new MutationObserver(syncDialogState);
  observer.observe(dialog, {
    attributes: true,
    attributeFilter: ["open"]
  });

  dialog.addEventListener("close", unlockBackgroundScroll);
  dialog.addEventListener("cancel", unlockBackgroundScroll);
}

function resetForm(barcode = "") {
  clearEditState();
  $("movieForm").reset();
  $("barcodeInput").value = normalizeBarcode(barcode);
  $("formEyebrow").textContent = "Nowy wpis";
  $("formTitle").textContent = "Dodaj film";
  $("saveMovieButton").textContent = "Zapisz film";
  $("tmdbStatus").textContent = "";
  $("tmdbResults").innerHTML = "";
  $("selectedTmdb").classList.add("hidden");
}

async function updateStats() {
  try {
    const response = await apiRequest("stats");
    const stats = response.stats || {};
    $("totalStat").textContent = stats.total || 0;
    $("dvdStat").textContent = stats.dvd || 0;
    $("blurayStat").textContent = stats.bluray || 0;
    $("uhdStat").textContent = stats.uhd || 0;
  } catch (error) {
    console.error("Nie udało się pobrać statystyk:", error);
  }
}

async function saveMovie(event) {
  event.preventDefault();

  const previous = state.editingMovie || {};
  const selected = state.selectedTmdbMovie || {};

  const movie = {
    barcode: normalizeBarcode($("barcodeInput").value),
    title: $("titleInput").value.trim(),
    format: $("formatInput").value,
    year: $("yearInput").value.trim(),
    shelf: $("shelfInput").value.trim(),
    notes: $("notesInput").value.trim(),
    tmdbId: selected.tmdbId || previous.tmdbId || "",
    poster: selected.poster || previous.poster || "",
    originalTitle: selected.originalTitle || previous.originalTitle || "",
    description: selected.description || previous.description || "",
    genres: Array.isArray(selected.genres)
      ? selected.genres.join(" | ")
      : (selected.genres || previous.genres || ""),
    runtime: selected.runtime || previous.runtime || "",
    director: selected.director || previous.director || "",
    cast: Array.isArray(selected.cast)
      ? selected.cast.join(" | ")
      : (selected.cast || previous.cast || ""),
    voteAverage: selected.voteAverage || previous.voteAverage || "",
    backdrop: selected.backdrop || previous.backdrop || "",
    trailer: selected.trailer || previous.trailer || ""
  };

  if (!movie.barcode || !movie.title || !movie.format) {
    alert("Podaj kod kreskowy, tytuł i format.");
    return;
  }

  const editing = Boolean(state.editingOriginalBarcode);
  $("saveMovieButton").disabled = true;
  $("saveMovieButton").textContent = editing ? "Zapisywanie zmian..." : "Zapisywanie...";

  try {
    const result = await apiRequest(
      editing ? "update" : "add",
      editing ? { originalBarcode: state.editingOriginalBarcode, ...movie } : movie
    );

    if (result.duplicate) {
      alert(result.message || "Ten kod jest już w kolekcji.");
      return;
    }

    resetForm();
    await updateStats();
    showView("collectionView");
    await loadCollection();
    alert(editing ? "Zmiany zostały zapisane." : "Film został dodany.");
  } catch (error) {
    alert(`Błąd: ${error.message}`);
  } finally {
    $("saveMovieButton").disabled = false;
    $("saveMovieButton").textContent = state.editingOriginalBarcode ? "Zapisz zmiany" : "Zapisz film";
  }
}

async function runSearch() {
  const query = $("searchInput").value.trim();
  if (!query) return;

  $("searchResults").innerHTML = `<div class="list-item">Szukam...</div>`;

  try {
    const response = await apiRequest("search", { query });
    const movies = Array.isArray(response.movies) ? response.movies : [];

    $("searchResults").innerHTML = movies.length
      ? movies.map(movie => `
          <div class="list-item">
            <strong>${escapeHtml(movie.title || "Bez tytułu")}</strong><br>
            <span class="muted">
              ${escapeHtml(movie.format || "")} ·
              ${escapeHtml(movie.year || "")} ·
              ${escapeHtml(movie.barcode || "")}
            </span>
          </div>`).join("")
      : `<div class="list-item">Nic nie znaleziono.</div>`;
  } catch (error) {
    $("searchResults").innerHTML = `<div class="list-item">${escapeHtml(error.message)}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setupDialogScrollLock();
  setupHome();
  $("openCollectionButton").onclick = async () => {
    showView("collectionView");
    await loadCollection();
  };

  $("openAddButton").onclick = () => {
    resetForm();
    showView("formView");
  };

  $("openScannerButton").onclick = startScanner;
  $("openSearchButton").onclick = () => showView("searchView");

  $("refreshButton").onclick = async () => {
    await updateStats();

    if (!$("collectionView").classList.contains("hidden")) {
      await loadCollection();
      renderHome();
    }
  };

  $("collectionFilter").oninput = renderCollection;
  $("collectionSort").onchange = loadCollection;

  document.querySelectorAll("[data-format-filter]").forEach(button => {
    button.addEventListener("click", () => {
      setCollectionFormat(button.dataset.formatFilter);
    });
  });

  $("tmdbSearchButton").onclick = searchTmdb;
  $("movieForm").onsubmit = saveMovie;

  $("cancelFormButton").onclick = () => {
    resetForm();
    showView("homeView");
  };

  $("closeScannerButton").onclick = () => {
    stopScanner();
    showView("homeView");
  };

  $("runSearchButton").onclick = runSearch;

  $("searchInput").onkeydown = event => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  };

  $("closeDialogButton").onclick = () => $("detailsDialog").close();

  $("detailsDialog").addEventListener("click", event => {
    if (event.target === $("detailsDialog")) {
      $("detailsDialog").close();
    }
  });

  document.querySelectorAll(".back-home").forEach(button => {
    button.onclick = () => showView("homeView");
  });

  $("brandHomeButton").onclick = () => showView("homeView");
  document.querySelectorAll("[data-view-target]").forEach(button => {
    button.onclick = async () => {
      const target = button.dataset.viewTarget;
      if (target === "formView") resetForm();
      showView(target);
      if (target === "collectionView" && !state.movies.length) await loadCollection();
    };
  });

  document.addEventListener("movievault:add-barcode", event => {
    resetForm(event.detail);
    showView("formView");
  });

  document.addEventListener("movievault:stats", updateStats);

  await updateStats();
  try { await loadCollection(); renderHome(); } catch (error) { console.error("Nie udało się załadować Home:", error); }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("Błąd Service Workera:", error);
    });
  }
});
