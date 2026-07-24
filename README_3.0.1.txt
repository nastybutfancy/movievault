MOVIEVAULT 3.0.1 — HOTFIX

Naprawiono:
- brak ładowania wcześniej dodanych filmów,
- statystyki pozostające na 0,
- niedziałające przyciski Home / Kolekcja / Dodaj,
- zatrzymywanie całego JavaScriptu podczas startu,
- stary cache Service Workera.

NA GITHUBIE PODMIEŃ:
- app.js
- index.html
- sw.js

Pozostałych plików nie musisz zmieniać.

Po publikacji:
1. Poczekaj, aż GitHub Pages zakończy deployment.
2. Na komputerze naciśnij Ctrl+Shift+R albo Ctrl+F5.
3. Gdyby nadal była stara wersja:
   Chrome -> F12 -> Application -> Service Workers -> Unregister,
   następnie odśwież stronę.
4. Na iPhonie zamknij kartę i otwórz stronę ponownie. W razie potrzeby
   wyczyść dane witryny dla GitHub Pages.

Google Apps Script i Arkusz pozostają bez zmian.
Nie uruchamiaj setup().
