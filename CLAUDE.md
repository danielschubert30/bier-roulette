# CLAUDE.md – Übergabe für Claude Code

## Worum es geht

„FCA Bier-Roulette“: ein Glücksrad für eine Fußballrunde, die während FCA-Spielen im Stadion auslost, wer das nächste Bier holt. Wer gezogen wird, fliegt vom Rad; die letzten zwei spielen ein Elfmeterschießen, der Sieger wird Champion. Die Anforderungen mit Status stehen in `ANFORDERUNGEN.md` – dort neue Wünsche eintragen und erledigte abhaken.

## Für wen

- Auftraggeber ist Daniel. Er ist Anforderungsmanager und war technischer Projektleiter, aber kein Entwickler. Antworten auf Deutsch, in einfachen Worten, ohne Fachjargon; Ergebnis und nächsten Schritt nennen statt Technik zu erklären.
- Er diktiert oft per Sprache; Tippfehler und falsch erkannte Wörter sinngemäß lesen.
- Genutzt wird die App fast nur am Handy (iPhone und Android), im Stadion, oft mit schlechtem Netz und viel Licht.

## Feste Regeln

- **Mobile first.** Jede Änderung zuerst bei 360–430 px Breite prüfen. Bedienelemente im Daumenbereich unten, Mindestgröße 44 px.
- **Keine Emojis** in der Oberfläche. Symbole als eigenes SVG.
- **Beschriftungen bleiben:** Knopf „Saufen?“, Ergebnis „Bierholer:“, Titel „FCA Bier-Roulette Champion“.
- **Gewinnerlogik nicht anfassen**, ohne sie zu testen: angezeigt wird immer das Segment unter dem Zeiger (`js/wheel.js`, `indexAtPointer`, `targetRotation`, `segBounds`). Diese Stelle war früher fehlerhaft. Seit dem Tippspiel sind die Felder unterschiedlich groß: gezogen wird mit `weightedIndex` (Chance = Feldgröße), das Rad landet im inneren Bereich dieses Feldes. Geprüft mit 200.000 simulierten Drehungen und Zeiger-Abgleich im Browser.
- Spielerfarbe im Rad = Farbe in allen Listen und im Ergebnisfeld.
- Das FCA-Wappen (`assets/fca-logo.png`) ist eine geschützte Marke. Nur in der Radmitte verwenden, nicht als App-Symbol, und die App nie als offizielle Vereins-App ausgeben.

## Technik

- Reines HTML, CSS und JavaScript (ES-Module), **kein Build-Schritt**. Abhängigkeiten: Google Fonts und das Firebase-SDK als Kopie in `vendor/firebase/` (wird nur im gemeinsamen Modus geladen).
- Gehostet über **GitHub Pages** aus dem Branch `main`, Wurzelverzeichnis. Ein Push auf `main` geht automatisch online (dauert 1–2 Minuten).
- Installierbar als App (PWA): `manifest.webmanifest`, `sw.js`.
- **Bei jeder Veröffentlichung `VERSION` in `sw.js` und `APP_VERSION` in `js/app.js` hochzählen**, sonst sehen Handys mit installierter App die alte Fassung.

### Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst: Spiel, Statistik, Kader, Ergebnis-Fenster |
| `css/style.css` | Gestaltung (dunkles Stadion-Thema, Farbwerte als Variablen in `:root`) |
| `js/app.js` | Ablauf und Oberfläche |
| `js/wheel.js` | Rad zeichnen, drehen, Zeiger-Mathematik |
| `js/shootout.js` | Regeln des Elfmeterschießens |
| `js/store.js` | Speichern auf dem Gerät (localStorage), Datenmodell, Standard-Kader |
| `js/content.js` | Sprüche, FCA-Fakten, Ergebnistexte |
| `js/tipp.js` | Tippspiel: Fragen, Feldgrößen, Auswertung der Live-Daten (OpenLigaDB), ohne Oberfläche |
| `js/sync.js` | Gemeinsamer Stand über Firebase: Hochladen per Transaktion, Zusammenführen (`merge3`), Gruppe anlegen/beitreten |
| `vendor/firebase/` | Firebase JS SDK 13.1.0 (app, auth, firestore), unverändert bis auf die Importpfade |
| `firestore.rules` | Sicherheitsregeln (in der Konsole unter Firestore → Regeln veröffentlicht; bei Änderung dort neu einfügen) |
| `tests/` | Zwei-Handy-Test mit nachgebauter Firebase (`tests/README.md`) |

### Datenmodell (`js/store.js`)

Gespeichert wird ein Objekt `{version: 2, activeId, competitions, settings, admin}`. Ältere Stände (Fassung 1, alles direkt im Objekt) werden beim Laden zur Meisterschaft „FCA-Spieltage“. In `js/app.js` ist `root` das Gesamtobjekt und `state` die aktive Meisterschaft; alle Felder unten gehören zu einer Meisterschaft (`{id, name, createdAt, fca, …}`). `fca` = FCA-Fakten beim Drehen.

- `admin`: `{salt, hash}` der Admin-PIN (SHA-256) oder `null`. `requireAdmin(was, fn)` schützt Rückgängig, Löschen, Abbrechen, Kampflos, Zurücksetzen und Meisterschaft löschen. Geprüft wird in der App (gilt im gemeinsamen Modus für alle Handys der Gruppe); bewusst ohne Server-Prüfung, mit Daniel so abgestimmt (08.11.2026).

- `players`: `{id, name, color, active, guest}` – Kader, max. 20 (`MAX_ROSTER`). Stammspieler: `active` = spielt mit, max. 10 (`MAX_WHEEL`). Gäste (`guest: true`) sind nie `active`; sie stehen nur im Topf, solange sie heute als anwesend markiert sind (`syncRoundMembers`). Rad max. 12 Felder (`MAX_ON_WHEEL`).
- `presence`: `{day, ids}` – wer an diesem Abend da ist. Ein Abend geht bis 6 Uhr früh (`dayStart`). Ohne Eintrag für heute fragt die App vor dem ersten Dreh nach.
- `round`: laufende Runde – `pot` (alle Mitspieler beim Start, auch Fehlende), `picks` (`{id, at, absent, beers, debtId}`), `final` (Elfmeterschießen mit `shots`, `winner`, `loser`, `forfeit`, `postponed`, `beers`, `debtId`).
- `pending`: Runden mit verschobenem Finale (werden über Hinweise nachgeholt).
- `rounds`: abgeschlossene Runden in Reihenfolge des Abschlusses. Champion = Sieger der zuletzt abgeschlossenen Runde.
- `debts`: Bierschulden `{id, playerId, at, roundId, reason: pick|forfeit, name, color, settledAt, beers}`.
- Biertempo: `beerLog` (alle wirklich geholten Biere mit Zeit) und `gapsOf` (Abstände am selben Abend) speisen Ticker, Ergebnis und Statistik.
- `beers` = Anzahl Anwesender (Mitspieler) im Moment des Holens. Daraus rechnet die Statistik den Bier-Saldo pro Saison (Juli–Juni): geholte Biere minus Saisonschnitt × Anzahl.
- `lastDone`: zuletzt entschiedenes Finale (damit andere Handys den letzten Schuss und den Champion sehen, auch bei nachgeholten Finals).
- `tipp`: Tippspiel des Abends `{day, match, tips, results, liveSays, locked, seen}`, `tippArchive`: frühere mit Tipps (max. 60). Regeln und Prüfung in `js/tipp.js` (`normGame`, `weightOf`, `evaluate`, `applyLive`). Feldgröße pro Spieler: 1 ± 0,25 je Frage, mindestens 0,25. Ergebnisse haben `src: live|manual`; Live-Daten überschreiben nie von Hand Eingetragenes.
- Kader-Änderungen wirken sofort: neue Stammspieler kommen in den `pot` der laufenden Runde (`joinRound`), ausgeschaltete oder gelöschte verlassen ihn ohne Schuld (`leaveRound`, gesperrt für Finalisten und die letzten zwei: `leaveBlocker`). Im Finale gelten Neue erst ab der nächsten Runde.

### Spielregeln bei Fehlenden und Gästen

- Wer fehlt, bleibt im Topf (Rad ausgegraut). Gezogen → raus, Bierschuld, sofort nachdrehen.
- Finale mit Fehlendem: Auswahl „Nächstes Mal nachholen“ (→ `pending`, neue Runde startet) oder „kampflos“ (Fehlender verliert, Schuld).
- Gäste spielen kein Finale: Sind nur noch zwei Stammspieler übrig und noch Gäste im Topf, ist „Gastrunde“ (nur Gäste auf dem Rad, `isGuestRound`). Das Finale startet erst, wenn `finalDue` gilt.
- Diese Regeln sind mit Daniel abgestimmt (07.11.2026); Änderungen nur nach Rücksprache.

### Tippspiel und Live-Daten

- Quelle: OpenLigaDB, `https://api.openligadb.de/getmatchdata/bl1` (aktueller Spieltag, danach `bl2`), dann `getmatchdata/{matchID}` einmal pro Minute ab Anpfiff bis 150 Minuten danach. Kein Schlüssel nötig, aus dem Browser erlaubt. FC Augsburg hat dort `teamId` 95. Halbzeitstand: `matchResults` mit `resultTypeID` 1.
- Keine Kartendaten. Deshalb ist die Frage „Gelbe Karte“ durch „Führt der FCA zur Halbzeit?“ ersetzt (mit Daniel abgestimmt, 08.11.2026).
- Aus der Claude-Umgebung ist OpenLigaDB gesperrt. Getestet wird mit nachgestellten Antworten (Playwright `route`). Echte Daten zeigen sich erst am Spieltag.
- Auflösungen erscheinen als eigenes Fenster (`revealSheet`); das Rad wächst/schrumpft erst nach dem Schließen (`ui.revealing` hält `syncWheel` an).

## Lokal testen

```
python3 -m http.server 8080
```
Dann `http://localhost:8080` öffnen und in den Entwicklertools die Handy-Ansicht wählen.

## Gemeinsamer Stand (Firebase, seit 1.5.0)

- Projekt `bier-roulette` (Daniels Google-Konto), Spark-Tarif, Firestore Standardversion in `europe-west3`, Anmeldung „Anonym“ aktiv, Web-App „Bier-Roulette Web“. Zugangsdaten stehen in `js/sync.js` (nicht geheim; geschützt wird über `firestore.rules`).
- Lokal oder gemeinsam: Ohne Gruppe läuft alles wie vorher nur auf dem Handy (`fca-bier-roulette:v1`). Mit Gruppe (`?g=CODE` im Link oder gespeichert unter `fca-bier-roulette:group`) liegt ein Zwischenstand unter `fca-bier-roulette:g:CODE`, Abgleich-Daten unter `fca-bier-roulette:sync:CODE`. Ohne Zwischenstand zeigt die App „Lade den gemeinsamen Stand“ (`root._placeholder`) und lädt nichts hoch.
- Datenbank: `groups/{code}` (admin), `groups/{code}/comps/{id}` (`rev`, `s` = geteilter Teil der Meisterschaft als JSON), `…/rounds/{id}` (fertige Runden, nur hinzufügen), `…/tipps/{tag}` (Tipp-Archiv).
- Geteilt wird `SYNC.SHARED` (Kader, laufende Runde, offene Finals, Schulden, Anwesenheit, Tippspiel, `lastDone`). Nur auf dem Gerät: aktive Meisterschaft, Ton/Vibration, gesehene Tipp-Auflösungen (`tipp.seen`).
- `persist(quiet)` speichert lokal und meldet die Änderung an `SYNC.changed`. Automatische Änderungen (Gäste in den Topf, Finale starten, Tippspiel anlegen, Live-Daten) mit `quiet = true`: werden sie verworfen, gibt es keine Meldung.
- Drehen und Schießen: Ergebnis erst festlegen und mit `SYNC.commitNow` hochladen, dann animieren. „conflict“ = ein anderes Handy war schneller → Meldung, dessen Stand wird nachgespielt. „offline“ = hier weiterspielen, später nachtragen.
- Zusammenführen (`merge3` in `js/sync.js`): Felder einzeln, Listen mit `id` (Kader, Schulden, Topf) eintragsweise. Gleichzeitige Änderungen an `round.picks`, `round.final`, `pending`, `lastDone` oder Runde beendet vs. weitergedreht = Konflikt (fremder Stand gilt).
- Fremde Änderungen: `hookRemote` → Warteschlange (`ui.remoteQ`, nie während einer Animation) → `applyRemote` erkennt neuen Dreh/Schuss/Champion (`remoteEvents`) und spielt ihn nach (`remoteSpin` mit `ui.hidePick`, `remoteShot`).
- Admin-PIN liegt in `groups/{code}.admin` und gilt für alle Handys der Gruppe. Prüfung nur in der App (Schutz vor Versehen, nicht vor Technikern).
- iPhone: Die App auf dem Home-Bildschirm hat einen eigenen Speicher. Wer sie dort ohne Gruppe öffnet, fügt den Link unter Kader → Gemeinsam spielen ein.
- Testen: `tests/zwei_handys.py` mit nachgebauter Firebase. Die echte Datenbank ist aus der Claude-Umgebung nicht erreichbar; ein Kurztest gegen Firebase geht über Daniels Chrome auf der GitHub-Pages-Seite.
