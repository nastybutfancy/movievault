MOVIEVAULT 3.5.3 — iOS COLLECTION STABILITY

Ta wersja naprawia problem, w którym Safari/iPhone potrafił przeładować lub zamknąć kartę po wejściu do zakładki „Kolekcja”.

NAJWAŻNIEJSZE ZMIANY
- Service Worker nie cache'uje już zewnętrznych plakatów, Google Apps Script, fontów ani innych requestów cross-origin.
- Nowy cache PWA usuwa historyczne, rozrastające się cache z poprzednich wersji.
- Kolekcja renderuje się partiami: 36 pozycji na telefonie i 96 na większych ekranach.
- Na iPhone wyłączono kosztowny backdrop-filter na każdej karcie kolekcji.
- Lokalny cache kolekcji nie duplikuje już dużych okładek Base64.
- Starszy cache z customCoverData jest automatycznie odchudzany przy pierwszym uruchomieniu.
- Home respektuje 5-minutowy cache i nie odpytuje Apps Script przy każdym powrocie na ekran główny.

CACHE PWA
movievault-collector-3.5.3-ios-stability1

WDROŻENIE
Wgraj cały frontend, szczególnie index.html, app.js, styles.css i sw.js.
Po pierwszym otwarciu aplikacji na iPhonie daj jej kilka sekund na aktywację nowego Service Workera, następnie zamknij aplikację/kartę i otwórz ponownie.
