import { apiRequest } from "./api-302.js";
import { state } from "./state-302.js";
import { $, normalizeBarcode, showView, escapeHtml } from "./utils-302.js";
import {
  loadCollection,
  renderCollection,
  clearEditState,
  setCollectionFormat
} from "./collection-302.js";
import { searchTmdb } from "./tmdb-302.js";
import { startScanner, stopScanner } from "./scanner-302.js";
import { renderHome, setupHome } from "./home-302.js";


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
  const setBootMessage = message => {
    const description = $("dailyDescription");
    if (description) description.textContent = message;
  };

  // Nawigacja jest uruchamiana jako pierwsza. Nawet błąd innej funkcji
  // nie może już zablokować przycisków Home, Kolekcja i Dodaj.
  try {
    const activateView = async target => {
      if (target === "formView") resetForm();
      showView(target);

      document.querySelectorAll("[data-view-target]").forEach(button => {
        button.classList.toggle("active", button.dataset.viewTarget === target);
      });

      if (target === "collectionView") {
        try {
          if (!state.movies.length) await loadCollection();
          else renderCollection();
        } catch (error) {
          console.error("Błąd kolekcji:", error);
          const count = $("collectionCount");
          const grid = $("collectionGrid");
          if (count) count.textContent = "Nie udało się pobrać kolekcji";
          if (grid) grid.innerHTML =
            `<div class="collection-empty"><span>⚠️</span><h3>Błąd połączenia</h3><p>${escapeHtml(error.message)}</p></div>`;
        }
      }
    };

    const brandButton = $("brandHomeButton");
    if (brandButton) brandButton.onclick = () => activateView("homeView");

    document.querySelectorAll("[data-view-target]").forEach(button => {
      button.onclick = () => activateView(button.dataset.viewTarget);
    });

    document.querySelectorAll(".back-home").forEach(button => {
      button.onclick = () => activateView("homeView");
    });
  } catch (error) {
    console.error("Błąd nawigacji:", error);
  }

  try {
    setupDialogScrollLock();
  } catch (error) {
    console.error("Błąd dialogu:", error);
  }

  try {
    setupHome();
  } catch (error) {
    console.error("Błąd ekranu Home:", error);
    setBootMessage(`Błąd ekranu Home: ${error.message}`);
  }

  const refreshButton = $("refreshButton");
  if (refreshButton) {
    refreshButton.onclick = async () => {
      refreshButton.disabled = true;
      try {
        await updateStats();
        await loadCollection();
        renderHome();
      } catch (error) {
        alert(`Nie udało się odświeżyć kolekcji: ${error.message}`);
      } finally {
        refreshButton.disabled = false;
      }
    };
  }

  const collectionFilter = $("collectionFilter");
  if (collectionFilter) collectionFilter.oninput = renderCollection;

  const collectionSort = $("collectionSort");
  if (collectionSort) collectionSort.onchange = loadCollection;

  document.querySelectorAll("[data-format-filter]").forEach(button => {
    button.addEventListener("click", () => {
      setCollectionFormat(button.dataset.formatFilter);
    });
  });

  const tmdbSearchButton = $("tmdbSearchButton");
  if (tmdbSearchButton) tmdbSearchButton.onclick = searchTmdb;

  const movieForm = $("movieForm");
  if (movieForm) movieForm.onsubmit = saveMovie;

  const cancelFormButton = $("cancelFormButton");
  if (cancelFormButton) {
    cancelFormButton.onclick = () => {
      resetForm();
      showView("homeView");
    };
  }


  const launchScanner = async () => {
    showView("scannerView");

    document.querySelectorAll("[data-view-target]").forEach(button => {
      button.classList.remove("active");
    });

    try {
      await startScanner();
    } catch (error) {
      console.error("Błąd skanera:", error);
      const scannerStatus = $("scannerStatus");
      if (scannerStatus) {
        scannerStatus.textContent =
          "Nie udało się uruchomić aparatu. Sprawdź uprawnienia przeglądarki.";
      }
    }
  };

  const openScannerButton = $("openScannerButton");
  if (openScannerButton) openScannerButton.onclick = launchScanner;

  const mobileScannerButton = $("mobileScannerButton");
  if (mobileScannerButton) mobileScannerButton.onclick = launchScanner;

  const closeScannerButton = $("closeScannerButton");
  if (closeScannerButton) {
    closeScannerButton.onclick = () => {
      stopScanner();
      showView("homeView");
    };
  }

  const runSearchButton = $("runSearchButton");
  if (runSearchButton) runSearchButton.onclick = runSearch;

  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.onkeydown = event => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      }
    };
  }

  const closeDialogButton = $("closeDialogButton");
  if (closeDialogButton) {
    closeDialogButton.onclick = () => $("detailsDialog")?.close();
  }

  const detailsDialog = $("detailsDialog");
  if (detailsDialog) {
    detailsDialog.addEventListener("click", event => {
      if (event.target === detailsDialog) detailsDialog.close();
    });
  }

  document.addEventListener("movievault:add-barcode", event => {
    resetForm(event.detail);
    showView("formView");
  });

  document.addEventListener("movievault:stats", updateStats);

  setBootMessage("Łączę się z Twoją kolekcją…");

  try {
    await updateStats();
    await loadCollection();
    renderHome();
  } catch (error) {
    console.error("Nie udało się uruchomić MovieVault:", error);
    setBootMessage(`Nie udało się pobrać kolekcji: ${error.message}`);
  }
});

