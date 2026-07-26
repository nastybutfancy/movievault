MOVIEVAULT 3.5.0 COLLECTOR'S EDITION — WERSJA FINALNA
======================================================

PAKIET ZAWIERA
1. Frontend/ — pliki aplikacji do publikacji na GitHub Pages lub obecnym hostingu.
2. Google Apps Script/ — kompletny backend do wklejenia do projektu Apps Script.
3. Testy/ — testy modelu danych i migratora wykonane przed spakowaniem.
4. RAPORT_TESTOW.txt — wyniki kontroli technicznej.

WAŻNE PRZED WDROŻENIEM
Migrator tworzy kopię zakładki „Filmy” przed pierwszą migracją, ale mimo to nie usuwaj własnej kopii zapasowej pliku JSON. Nie zmieniaj ręcznie nazw istniejących kolumn przed pierwszym uruchomieniem.

KROK 1 — AKTUALIZACJA GOOGLE APPS SCRIPT
1. Otwórz Arkusz Google używany przez MovieVault.
2. Wybierz Rozszerzenia → Apps Script.
3. Zastąp zawartość odpowiednich plików kodem z folderu „Google Apps Script”.
4. Nazwy plików w projekcie powinny odpowiadać nazwom w paczce:
   Code.gs, Database.gs, Movies.gs, Metadata.gs, TMDb.gs,
   Index.html, App.html, Scanner.html, Styles.html oraz appsscript.json.
5. Zachowaj istniejącą właściwość skryptu TMDB_TOKEN.
6. Zapisz projekt.
7. Z listy funkcji uruchom ręcznie funkcję setup().
8. Przy pierwszym uruchomieniu zaakceptuj wymagane uprawnienia do Arkusza.

KROK 2 — MIGRACJA ARKUSZA
Funkcja setup() oraz pierwsze wywołanie API automatycznie:
- wykrywają arkusz „Filmy”,
- tworzą kopię „Filmy_backup_przed_migracja_…”,
- dopisują brakujące kolumny na końcu,
- przenoszą dane przejściowej wersji 3.5.0 z metadanych do kolumn,
- pozostawiają w „Notatki” i legacy „Uwagi” wyłącznie zwykły tekst,
- nadają UUID wpisom z wersji 3.4.0,
- zachowują istniejące UUID,
- zapisują znacznik migracji, aby nie wykonywać jej drugi raz.

Nowe kolumny:
UUID
Rodzaj pozycji
Nośnik
Liczba sezonów
Typ wydania
Stan
Lokalizacja
Status
Własna okładka
Notatki

Żadna istniejąca kolumna ani rekord nie są usuwane.

KROK 3 — NOWE WDROŻENIE WEB APP
1. W Apps Script wybierz Wdróż → Zarządzaj wdrożeniami.
2. Edytuj aktualne wdrożenie aplikacji internetowej, zamiast tworzyć niepotrzebnie drugi projekt.
3. Wybierz „Nowa wersja”.
4. Ustaw wykonywanie jako właściciel projektu.
5. Zachowaj dostęp zgodny z dotychczasowym działającym wdrożeniem.
6. Kliknij Wdróż.
7. Jeżeli adres /exec pozostał ten sam, frontend nie wymaga zmiany API_URL.
8. Jeżeli Google nadał nowy adres /exec, wpisz go w stałej API_URL w pliku Frontend/app.js.

KROK 4 — AKTUALIZACJA FRONTENDU
1. Wgraj całą zawartość folderu Frontend na miejsce obecnej aplikacji.
2. Nie pomijaj sw.js ani index.html.
3. Otwórz stronę online.
4. Przy pierwszym wejściu odczekaj chwilę, aby nowy service worker przejął aplikację.
5. W razie zachowania starego interfejsu zamknij wszystkie karty MovieVault i otwórz stronę ponownie. Rewizja cache to 3.5.0-db1.

KROK 5 — KONTROLA PO WDROŻENIU
1. Otwórz Arkusz i sprawdź obecność 10 nowych kolumn.
2. Sprawdź, czy powstała zakładka kopii przed migracją.
3. Otwórz kilka starych pozycji i sprawdź notatki.
4. Dodaj dwa egzemplarze tego samego tytułu, najlepiej z tym samym kodem.
5. Sprawdź, czy mają różne UUID.
6. Edytuj jeden egzemplarz i upewnij się, że drugi się nie zmienił.
7. Usuń jeden egzemplarz i upewnij się, że drugi pozostał.
8. Sprawdź Wishlist, filtry, statystyki, eksport i import JSON.

UUID — ZASADA
UUID identyfikuje konkretny egzemplarz, nie tytuł, kod kreskowy ani rekord TMDb.
Każde dodanie nowego egzemplarza tworzy nowe UUID. Edycja nie zmienia UUID.
TMDb ID i kod kreskowy są wyłącznie właściwościami rekordu.

NOTATKI
Frontend nadal potrafi odczytać stary blok metadanych z cache lub backupu przejściowej wersji 3.5.0, ale nigdy nie zapisuje go ponownie. Docelowym źródłem danych są osobne kolumny Arkusza Google.

WŁASNE OKŁADKI
Adres URL własnej okładki jest zapisywany w kolumnie „Własna okładka”. Obraz wybrany bezpośrednio jako plik pozostaje lokalny na urządzeniu i jest dołączany do backupu JSON, ponieważ komórki Arkusza nie nadają się do bezpiecznego przechowywania dużych plików graficznych Base64.
