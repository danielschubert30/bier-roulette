# Tests

- `zwei_handys.py`: zwei Handys mit gemeinsamem Stand (Beitreten, Mitdrehen, gleichzeitig drehen, Funkloch, PIN, Elfmeterschießen, Verlassen).
- `tipps.py`: Tipps kommen sicher an (Funkloch, Zusammenstoß, fremder Tipp während eines Drehs, fehlende Stammspieler, Home-Bildschirm-App ohne Gruppe).
- `joker.py`: Joker nach 5 Tippspielen, Einsetzen im Ergebnisfenster, zweites Handy sieht es mit (`W=360` für schmale Handys).
- `paten.py`: Paten für Ausgeschiedene und Tippkönig auf zwei Handys (mit nachgestellten Live-Daten; `W=360` für schmale Handys).
- `tippspiel.mjs`, `abgleich.mjs`, `rad.mjs`: Regeln ohne Browser, Start mit `node tests/…`.
- `fakefb/`: Ersatz für die Firebase-Bausteine. Die Test-Datenbank läuft im Testprogramm (`fakeserver.py`), die Handys sprechen über `window.__fb` mit ihr.

Voraussetzung: Python mit Playwright. Im Projektordner `python3 -m http.server 8080` starten, dann `python3 tests/zwei_handys.py` (optional `CHROME=/pfad/zu/chrome`).
