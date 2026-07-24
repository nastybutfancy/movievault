MOVIEVAULT 2.2: ULTIMATE METADATA

WAŻNE: wdrożenie ma 2 części.

CZĘŚĆ 1 — GOOGLE APPS SCRIPT
1. Otwórz Arkusz Google → Rozszerzenia → Apps Script.
2. Podmień zawartość plików:
   - Code.gs
   - DATABASE.gs
   - MOVIES.gs
   - TMDB.gs
   plikami z folderu apps-script.
3. Plik METADATA.gs pozostaw bez zmian.
4. Uruchom ręcznie funkcję setup().
   Nie usuwa ona filmów. Rozszerza pierwszy wiersz arkusza o nowe kolumny.
5. Wybierz Wdróż → Zarządzaj wdrożeniami → Edytuj → Nowa wersja → Wdróż.
6. Adres aplikacji internetowej powinien pozostać ten sam.

CZĘŚĆ 2 — GITHUB PAGES
Podmień pliki:
- index.html
- app.js
- collection.js
- styles.css

Pozostałe pliki możesz zostawić bez zmian.

Po wdrożeniu:
- nowe filmy wybrane z TMDb zapiszą opis, gatunki, reżysera, obsadę,
  czas trwania, ocenę, backdrop i zwiastun;
- stare filmy pozostaną bezpieczne, ale nowe pola będą puste;
- aby uzupełnić stary film, wejdź w Edytuj film, wybierz go ponownie z TMDb
  i zapisz zmiany.

Na końcu wykonaj Ctrl+F5 lub otwórz stronę w trybie incognito.
