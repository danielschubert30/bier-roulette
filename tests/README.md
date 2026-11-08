# Tests

- `zwei_handys.py`: zwei Handys mit gemeinsamem Stand (Beitreten, Mitdrehen, gleichzeitig drehen, Funkloch, PIN, Elfmeterschießen, Verlassen).
- `fakefb/`: Ersatz für die Firebase-Bausteine. Die Test-Datenbank läuft im Testprogramm (`fakeserver.py`), die Handys sprechen über `window.__fb` mit ihr.

Voraussetzung: Python mit Playwright. Im Projektordner `python3 -m http.server 8080` starten, dann `python3 tests/zwei_handys.py` (optional `CHROME=/pfad/zu/chrome`).
