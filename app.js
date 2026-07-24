const STORAGE_KEY = "movievault.movies.v1";
let codeReader = null;
let scannerControls = null;
let scanLock = false;

const $ = id => document.getElementById(id);
const movies = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
const saveMovies = value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
const normalizeBarcode = value => String(value || "").replace(/\D/g, "");

document.addEventListener("DOMContentLoaded", () => {
  $("scanButton").addEventListener("click", startScanner);
  $("closeScannerButton").addEventListener("click", stopScanner);
  $("searchButton").addEventListener("click", () => showOnly("searchPanel"));
  $("addButton").addEventListener("click", () => showOnly("addPanel"));
  $("runSearchButton").addEventListener("click", runSearch);
  $("saveButton").addEventListener("click", addMovie);
  $("searchQuery").addEventListener("keydown", event => {
    if (event.key === "Enter") runSearch();
  });
  updateStats();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
});

function showOnly(panelId) {
  ["scannerPanel","resultPanel","searchPanel","addPanel"].forEach(id => {
    $(id).classList.toggle("hidden", id !== panelId);
  });
}

async function startScanner() {
  showOnly("scannerPanel");
  $("closeScannerButton").classList.remove("hidden");
  scanLock = false;

  try {
    codeReader = new ZXingBrowser.BrowserMultiFormatReader();
    scannerControls = await codeReader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      $("preview"),
      (result, error) => {
        if (result && !scanLock) {
          scanLock = true;
          handleBarcode(normalizeBarcode(result.getText()));
        }
      }
    );
  } catch (error) {
    $("scannerPanel").innerHTML = `<div class="movie owned"><strong>Nie udało się uruchomić kamery.</strong><p>${escapeHtml(error.message || String(error))}</p></div>`;
  }
}

function stopScanner() {
  if (scannerControls) scannerControls.stop();
  scannerControls = null;
  codeReader = null;
  $("closeScannerButton").classList.add("hidden");
  $("scannerPanel").classList.add("hidden");
}

function handleBarcode(barcode) {
  stopScanner();
  if (!barcode) return;

  const movie = movies().find(item => normalizeBarcode(item.barcode) === barcode);
  $("resultPanel").classList.remove("hidden");

  if (movie) {
    navigator.vibrate?.([250,100,250]);
    $("resultPanel").className = "panel owned";
    $("resultPanel").innerHTML = `
      <div class="result-title">🟥 JUŻ POSIADASZ</div>
      <strong>${escapeHtml(movie.title)}</strong><br>
      ${escapeHtml(movie.format)}<br>
      Półka: ${escapeHtml(movie.shelf || "brak")}<br>
      Kod: ${escapeHtml(movie.barcode)}
      <br><br><button class="button scan" onclick="startScanner()">Skanuj następny</button>`;
  } else {
    navigator.vibrate?.(120);
    $("resultPanel").className = "panel missing";
    $("resultPanel").innerHTML = `
      <div class="result-title">🟩 NIE MA W KOLEKCJI</div>
      Kod: ${escapeHtml(barcode)}
      <br><br><button class="button add" onclick="prepareAdd('${barcode}')">Dodaj film</button>
      <button class="button scan" onclick="startScanner()">Skanuj następny</button>`;
  }
}

function prepareAdd(barcode) {
  showOnly("addPanel");
  $("barcode").value = barcode;
  $("title").focus();
}

function addMovie() {
  const movie = {
    barcode: normalizeBarcode($("barcode").value),
    title: $("title").value.trim(),
    format: $("format").value,
    year: $("year").value.trim(),
    shelf: $("shelf").value.trim()
  };

  if (!movie.barcode || !movie.title) {
    alert("Podaj kod kreskowy i tytuł.");
    return;
  }

  const list = movies();
  if (list.some(item => normalizeBarcode(item.barcode) === movie.barcode)) {
    alert("Ten kod jest już w kolekcji.");
    return;
  }

  list.push(movie);
  saveMovies(list);
  ["barcode","title","year","shelf"].forEach(id => $(id).value = "");
  updateStats();
  alert("Film zapisany.");
}

function runSearch() {
  const query = $("searchQuery").value.trim().toLowerCase();
  const found = movies().filter(movie =>
    movie.title.toLowerCase().includes(query) || movie.barcode.includes(query)
  );
  $("searchResults").innerHTML = found.length
    ? found.map(movie => `<div class="movie"><strong>${escapeHtml(movie.title)}</strong><br>${escapeHtml(movie.format)} · ${escapeHtml(movie.year || "rok nieznany")}<br>Kod: ${escapeHtml(movie.barcode)}</div>`).join("")
    : `<div class="movie">Nic nie znaleziono.</div>`;
}

function updateStats() {
  const list = movies();
  $("dvd").textContent = list.filter(x => x.format === "DVD").length;
  $("bluray").textContent = list.filter(x => x.format === "Blu-ray").length;
  $("uhd").textContent = list.filter(x => x.format === "4K UHD").length;
  $("total").textContent = list.length;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
