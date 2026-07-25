MovieVault 3.3.0 — Performance + opcjonalny kod kreskowy

Podmień na GitHubie tylko pliki:
- app.js
- index.html
- styles.css
- sw.js

Zmiany:
- kolekcja jest zapisywana lokalnie i pokazuje się od razu,
- sortowanie nie pobiera ponownie danych z Google Sheets,
- skan kodu sprawdza lokalną kolekcję bez oczekiwania na serwer,
- po dodaniu, edycji i usunięciu nie jest ponownie pobierana cała kolekcja,
- statystyki aktualizują się lokalnie,
- kod kreskowy jest opcjonalny; dla płyt bez kodu aplikacja tworzy wewnętrzny identyfikator.

Po pierwszym uruchomieniu tej wersji kolekcja może załadować się normalnie z serwera. Kolejne otwarcia powinny być znacznie szybsze.
