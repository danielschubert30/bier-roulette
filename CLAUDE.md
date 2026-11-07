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
- **Gewinnerlogik nicht anfassen**, ohne sie zu testen: angezeigt wird immer das Segment unter dem Zeiger (`js/wheel.js`, `indexAtPointer` und `targetRotation`). Diese Stelle war früher fehlerhaft.
- Spielerfarbe im Rad = Farbe in allen Listen und im Ergebnisfeld.
- Das FCA-Wappen (`assets/fca-logo.png`) ist eine geschützte Marke. Nur in der Radmitte verwenden, nicht als App-Symbol, und die App nie als offizielle Vereins-App ausgeben.

## Technik

- Reines HTML, CSS und JavaScript (ES-Module), **kein Build-Schritt**, keine Abhängigkeiten außer Google Fonts.
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

### Datenmodell (`js/store.js`)

- `players`: `{id, name, color, active}` – Kader, max. 12; `active` = spielt mit (max. 8).
- `presence`: `{day, ids}` – wer an diesem Abend da ist. Ein Abend geht bis 6 Uhr früh (`dayStart`). Ohne Eintrag für heute fragt die App vor dem ersten Dreh nach.
- `round`: laufende Runde – `pot` (alle Mitspieler beim Start, auch Fehlende), `picks` (`{id, at, absent, beers, debtId}`), `final` (Elfmeterschießen mit `shots`, `winner`, `loser`, `forfeit`, `postponed`, `beers`, `debtId`).
- `pending`: Runden mit verschobenem Finale (werden über Hinweise nachgeholt).
- `rounds`: abgeschlossene Runden in Reihenfolge des Abschlusses. Champion = Sieger der zuletzt abgeschlossenen Runde.
- `debts`: Bierschulden `{id, playerId, at, roundId, reason: pick|forfeit, name, color, settledAt, beers}`.
- `beers` = Anzahl Anwesender (Mitspieler) im Moment des Holens. Daraus rechnet die Statistik den Bier-Saldo pro Saison (Juli–Juni): geholte Biere minus Saisonschnitt × Anzahl.
- Kader-Änderungen gelten ab der nächsten Runde; die laufende Runde arbeitet mit ihrem `pot`.

### Spielregeln bei Fehlenden

- Wer fehlt, bleibt im Topf (Rad ausgegraut). Gezogen → raus, Bierschuld, sofort nachdrehen.
- Finale mit Fehlendem: Auswahl „Nächstes Mal nachholen“ (→ `pending`, neue Runde startet) oder „kampflos“ (Fehlender verliert, Schuld).
- Diese Regeln sind mit Daniel abgestimmt (07.11.2026); Änderungen nur nach Rücksprache.

## Lokal testen

```
python3 -m http.server 8080
```
Dann `http://localhost:8080` öffnen und in den Entwicklertools die Handy-Ansicht wählen.

## Nächster großer Schritt

Phase 2 (`ANFORDERUNGEN.md`, D5): gemeinsamer Stand und live mitdrehen über Firebase Firestore. Daniel legt dafür ein kostenloses Firebase-Projekt an; die Speicherfunktionen in `js/store.js` sind so gekapselt, dass eine zweite Speicherart daneben passt.
