# Anforderungen – FCA Bier-Roulette

Stand: 07.11.2026 · Auftraggeber: Daniel · Einsatz: im Stadion während FCA-Spielen, am Handy

Legende: `[x]` umgesetzt · `[ ]` offen

## A – Spielprinzip

- [x] **A1 K.-o.-Modus:** Das Rad dreht, wer getroffen wird, ist „Bierholer“ und fliegt vom Rad.
- [x] **A2 Finale:** Sind nur noch 2 übrig, folgt ein anderer Modus: Elfmeterschießen (je 5 Schüsse, danach Sudden Death; der Schütze tippt die Ecke, der Torwart springt zufällig).
- [x] **A3 Champion:** Der Sieger des Finales holt als Einziger kein Bier und wird „FCA Bier-Roulette Champion“. Der Titel bleibt sichtbar, bis es einen neuen Champion gibt.
- [x] **A4 Neue Runde:** Danach startet eine neue Runde mit allen Anwesenden.
- [x] **A5 Rückgängig:** Die letzte Ziehung lässt sich zurücknehmen (Fehltipp).
- [x] **A6 Mitspieler:** Im Kader pro Mitspieler ein Schalter „spielt mit“; maximal 8 auf dem Rad, bis zu 12 im Kader.
- [x] **A7 Faire Auslosung:** Jeder im Topf hat die gleiche Chance; angezeigt wird immer das Segment unter dem Zeiger.

### Runden über mehrere Spieltage (beauftragt 07.11.2026)

- [x] **A8 Anwesenheit pro Abend:** Vor dem ersten Dreh eines Abends fragt die App „Wer ist heute da?“. Änderbar jederzeit über „Anwesenheit“, auch mitten in der Runde. Ein Abend geht bis 6 Uhr früh.
- [x] **A9 Mitlosen mit Bierschuld:** Wer fehlt, bleibt ausgegraut im Topf. Wird er gezogen, fliegt er raus und schuldet eine Runde; fürs aktuelle Bier wird sofort nachgedreht. Offene Schulden erscheinen beim nächsten Treffen als Hinweis und werden mit „Eingelöst“ abgehakt.
- [x] **A10 Finale, wenn einer fehlt:** Wahl im Moment: „Nächstes Mal nachholen“ (Finale wird geparkt, für den Abend startet eine neue Runde) oder „verliert kampflos“ (Fehlender schuldet das letzte Bier, der andere wird Champion). Fehlen beide, wird nachgeholt.
- [x] **A11 Offene Finals nachholen:** Geparkte Finals erscheinen als Hinweis; sind beide da, „Jetzt spielen“. Fehlt wieder einer, kann man dort kampflos werten.

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

- [x] **E1 Pro Spieler:** wie oft dran, Champion-Titel, Finalteilnahmen; Zeitraum Heute / Saison / Gesamt.
- [x] **E2 Ehrentafel:** alle Champions mit Datum, Finalgegner und Ergebnis (auch „kampflos“).
- [x] **E3 Amtierender Champion** dauerhaft im Kopfbereich.
- [x] **E4 Bier-Saldo pro Saison (Juli–Juni):** Die App merkt sich bei jedem Holen, wie viele Biere es waren (= Anwesende). Saldo = geholte Biere minus Saisonschnitt pro Runde mal Anzahl. Gleicht aus, dass man bei einer kleinen Runde weniger zahlt. Der Champion-Vorteil bleibt bestehen.
- [x] **E5 Ausgleichsliste:** „X gibt Y n Bier aus“, auf ganze Biere gerundet, für die gewählte Saison.
- [x] **E6 Offene Bierschulden** mit Datum und Grund, einlösbar auch in der Statistik.

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
