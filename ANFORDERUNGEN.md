# Anforderungen – FCA Bier-Roulette

Stand: 07.11.2026 · Auftraggeber: Daniel · Einsatz: im Stadion während FCA-Spielen, am Handy

Legende: `[x]` umgesetzt · `[ ]` offen

## A – Spielprinzip

- [x] **A1 K.-o.-Modus:** Das Rad dreht, wer getroffen wird, ist „Bierholer“ und fliegt vom Rad.
- [x] **A2 Finale:** Sind nur noch 2 übrig, folgt ein anderer Modus: Elfmeterschießen (je 5 Schüsse, danach Sudden Death; der Schütze tippt die Ecke, der Torwart springt zufällig).
- [x] **A3 Champion:** Der Sieger des Finales holt als Einziger kein Bier und wird „FCA Bier-Roulette Champion“. Der Titel bleibt sichtbar, bis es einen neuen Champion gibt.
- [x] **A4 Neue Runde:** Danach startet eine neue Runde mit allen Anwesenden.
- [x] **A5 Rückgängig:** Die letzte Ziehung lässt sich zurücknehmen (Fehltipp).
- [x] **A6 Anwesenheit:** Pro Mitspieler ein Schalter „heute dabei“; maximal 8 auf dem Rad, bis zu 12 im Kader.
- [x] **A7 Faire Auslosung:** Jeder im Topf hat die gleiche Chance; angezeigt wird immer das Segment unter dem Zeiger.

## B – Inhalte

- [x] **B1 Während das Rad dreht:** FCA-Fakten (45 geprüfte, mit Quelle in `js/content.js`) oder Sprüche einblenden.
- [x] **B2 Ergebnis:** „Bierholer: Name“, dazu „zum X. Mal“ plus passende Statistik oder Spruch.
- [x] **B3 Standard-Kader:** Betzmeister, Cousin, Demharter M., Emilio, Schaufi, Schubi.
- [x] **B4 FCA-Wappen** in der Mitte des Rads.

## C – Design

- [x] **C1 Mobile first:** Für das Handy optimiert, Bedienung mit dem Daumen; Desktop nachrangig.
- [x] **C2 Stylisch, keine Emojis.**
- [x] **C3 Spielerfarben:** Farbe im Rad = Farbe in allen Listen; Ergebnisfeld in der Farbe des Bierholers.
- [x] **C4 Beschriftung:** Knopf „Saufen?“, Ergebnis „Bierholer:“.
- [x] **C5 Stadion-Optik:** Rasen, Flutlicht, Vereinsfarben.

## D – Technik und Betrieb

- [x] **D1 Ohne Claude-Konto erreichbar:** über GitHub Pages mit festem Link.
- [x] **D2 Als App aufs Handy:** „Zum Home-Bildschirm“ (PWA), funktioniert auch bei schlechtem Netz im Stadion.
- [x] **D3 Speichern auf dem Handy** (Phase 1): Kader, laufende Runde und Statistik bleiben erhalten.
- [x] **D4 Bildschirm bleibt an**, solange die App offen ist (wo das Handy es erlaubt).
- [ ] **D5 Gemeinsamer Stand für alle Handys** (Phase 2): Firebase-Datenbank, live mitdrehen auf allen Geräten. Braucht ein kostenloses Firebase-Projekt von Daniel.

## E – Statistik

- [x] **E1 Pro Spieler:** Biere geholt, Champion-Titel, Finalteilnahmen; Zeitraum Heute / Gesamt.
- [x] **E2 Ehrentafel:** alle Champions mit Datum, Finalgegner und Ergebnis.
- [x] **E3 Amtierender Champion** dauerhaft im Kopfbereich.

## Ideen-Speicher (noch nicht beauftragt)

| Idee | Nutzen | Aufwand |
|---|---|---|
| Schonfrist für den letzten Champion oder den letzten Bierholer | gefühlt fairer | klein |
| „FCA-Tor!“-Knopf, der eine Sonderrunde auslöst | Spaß am Spieltag | klein |
| Weitere Finalmodi (Münzwurf, Schnick-Schnack-Schnuck) zur Auswahl | Abwechslung | klein |
| Getränkekasse: Preis pro Bier, wer hat wie viel ausgegeben | Abrechnung | mittel |
| Abzeichen und Saisonwertung (Hattrick, Bierholer des Monats) | Langzeitspaß | mittel |
| Mehrere Gruppen mit eigener Statistik | weitere Runden | mittel |
| Live-Daten zum FCA (Tabellenplatz, nächster Gegner) | Gesprächsstoff | mittel |
