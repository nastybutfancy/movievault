MOVIEVAULT 3.0.2 — CACHE RESET

Ta wersja rozwiązuje sytuację, w której wygląd 3.0 się ładuje, ale:
- Home / Kolekcja / Dodaj nie reagują,
- statystyki pokazują 0,
- stare filmy nie pojawiają się.

PRZYCZYNA:
Przeglądarka mogła łączyć nowe HTML i CSS ze starymi modułami JavaScript
z pamięci PWA. Wersja 3.0.2 używa zupełnie nowych nazw plików i usuwa cache.

NA GITHUBIE:
Najbezpieczniej wgraj CAŁĄ zawartość paczki i pozwól zastąpić istniejące pliki.

Najważniejsze nowe pliki:
- app-302.js
- home-302.js
- api-302.js
- state-302.js
- utils-302.js
- collection-302.js
- tmdb-302.js
- scanner-302.js

Koniecznie podmień też:
- index.html
- styles.css
- sw.js

Po zakończeniu GitHub Pages:
1. Zamknij wszystkie karty MovieVault.
2. Otwórz stronę w nowej karcie.
3. Naciśnij Ctrl+Shift+R.
4. Pierwsze wejście może potrwać kilka sekund, ponieważ kolekcja jest pobierana od nowa.

Google Apps Script oraz Arkusz pozostają bez zmian.
Nie uruchamiaj setup().
