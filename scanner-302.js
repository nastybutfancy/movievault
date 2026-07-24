import { apiRequest } from "./api-302.js";
import { state } from "./state-302.js";
import { $, normalizeBarcode, showView } from "./utils-302.js";

export async function startScanner() {
  showView("scannerView");
  state.scanLock = false;
  $("scannerStatus").textContent = "Skieruj aparat na kod kreskowy.";

  try {
    state.scannerReader = new ZXingBrowser.BrowserMultiFormatReader();
    state.scannerControls = await state.scannerReader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: "environment" } } },
      $("scannerPreview"),
      async result => {
        if (!result || state.scanLock) return;
        state.scanLock = true;
        const barcode = normalizeBarcode(result.getText());
        stopScanner();

        const response = await apiRequest("find", { barcode });
        if (response.movie) {
          alert(`Już posiadasz: ${response.movie.title}`);
          showView("homeView");
        } else {
          document.dispatchEvent(new CustomEvent("movievault:add-barcode", { detail: barcode }));
        }
      }
    );
  } catch (error) {
    $("scannerStatus").textContent = error.message || "Nie udało się uruchomić kamery.";
  }
}

export function stopScanner() {
  state.scannerControls?.stop();
  state.scannerControls = null;
  state.scannerReader = null;
}
