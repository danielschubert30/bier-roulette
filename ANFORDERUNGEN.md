# Anforderungen – FCA Bier-Roulette

Stand: 07.11.2026 · Auftraggeber: Daniel · Einsatz: im Stadion während FCA-Spielen, am Handy

Legende: `[x]` umgesetzt · `[ ]` offen

## A – Spielprinzip

- [x] **A1 K.-o.-Modus:** Das Rad dreht, wer getroffen wird, ist „Bierholer“ und fliegt vom Rad.
- [x] **A2 Finale:** Sind nur noch 2 übrig, folgt ein anderer Modus: Elfmeterschießen (je 5 Schüsse, danach Sudden Death; der Schütze tippt die Ecke, der Torwart springt zufällig).
- [x] **A3 Champion:** Der Sieger des Finales holt als Einziger kein Bier und wird „FCA Bier-Roulette Champion“. Der Titel bleibt sichtbar, bis es einen neuen Champion gibt.
- [x] **A4 Neue Runde:** Danach startet eine neue Runde mit allen Anwesenden.
- [x] **A5 Rückgängig:** Die letzte Ziehung lässt sich zurücknehmen (Fehltipp).
- [x] **A6 Mitspieler:** Im Kader pro Stammspieler ein Schalter „spielt mit“; bis zu 10 Stammspieler, Rad mit bis zu 12 Feldern (inkl. Gäste), Kader bis 20.
- [x] **A7 Faire Auslosung:** Jeder im Topf hat die gleiche Chance; angezeigt wird immer das Segment unter dem Zeiger.

### Runden über mehrere Spieltage (beauftragt 07.11.2026)

- [x] **A8 Anwesenheit pro Abend:** Vor dem ersten Dreh eines Abends fragt die App „Wer ist heute da?“. Änderbar jederzeit über „Anwesenheit“, auch mitten in der Runde. Ein Abend geht bis 6 Uhr früh.
- [x] **A9 Mitlosen mit Bierschuld:** Wer fehlt, bleibt ausgegraut im Topf. Wird er gezogen, fliegt er raus und schuldet eine Runde; fürs aktuelle Bier wird sofort nachgedreht. Offene Schulden erscheinen beim nächsten Treffen als Hinweis und werden mit „Eingelöst“ abgehakt.
- [x] **A10 Finale, wenn einer fehlt:** Wahl im Moment: „Nächstes Mal nachholen“ (Finale wird geparkt, für den Abend startet eine neue Runde) oder „verliert kampflos“ (Fehlender schuldet das letzte Bier, der andere wird Champion). Fehlen beide, wird nachgeholt.
- [x] **A11 Offene Finals nachholen:** Geparkte Finals erscheinen als Hinweis; sind beide da, „Jetzt spielen“. Fehlt wieder einer, kann man dort kampflos werten.

### Gäste und flexibler Kader (beauftragt 07.11.2026)

- [x] **A12 Gäste:** Gäste stehen im Kader und kommen nur an Abenden aufs Rad, an denen sie in der Anwesenheit eingeschaltet sind (neue Gäste direkt dort eintragen). Wird ein Gast gezogen, holt er wie alle anderen. Fehlende Gäste sammeln keine Bierschulden. Gäste stehen in Statistik und Bier-Saldo.
- [x] **A13 Gastrunde:** Ein Finale spielen nur Stammspieler. Sind nur noch zwei Stammspieler übrig, kommen zuerst die Gäste aufs Rad; danach folgt das Finale.
- [x] **A14 Kader jederzeit ändern:** Neue Stammspieler kommen sofort in die laufende Runde. Wer ausgeschaltet oder gelöscht wird, verlässt sie ohne Bierschuld (nicht möglich für Finalisten oder die letzten zwei). Gäste lassen sich mit „Aufnehmen“ zum Stammspieler machen.

### Admin und Meisterschaften (beauftragt 08.11.2026)

- [x] **A15 Admin-PIN:** Optional festlegbar (Kader → Einstellungen). Dann nur mit PIN: Rückgängig, Spieler/Gäste löschen, Runde abbrechen, kampflos werten, Statistik zurücksetzen, Meisterschaft löschen. Nach der Eingabe eine Minute frei. Drehen und Schießen bleiben für alle offen. Schutz gilt nur auf dem Gerät (lokal gespeichert).
- [x] **A16 Rückgängig ins Finale:** Hat das Elfmeterschießen noch nicht begonnen, nimmt Rückgängig die letzte Ziehung zurück und das Finale verschwindet wieder.
- [x] **A17 Meisterschaften:** Mehrere getrennte Wettbewerbe (z. B. „FCA-Spieltage“, „Vatertagstour“), umschaltbar über den Namen oben links. Jede hat eigenen Kader, Runden, Champion, Statistik und Bierschulden. Beim Anlegen „Kader übernehmen“ und „FCA-Spieltag“ (FCA-Fakten) wählbar. Umbenennen und Löschen möglich, höchstens 10.

## B – Inhalte

- [x] **B1 Während das Rad dreht:** FCA-Fakten (45 geprüfte, mit Quelle in `js/content.js`) oder Sprüche einblenden.
- [x] **B2 Ergebnis:** „Bierholer: Name“, dazu „zum X. Mal“ plus passende Statistik oder Spruch.
- [x] **B3 Standard-Kader:** Betzmeister, Cousin, Demharter M., Emilio, Schaufi, Schubi.
- [x] **B4 FCA-Wappen** in der Mitte des Rads.
- [x] **B5 Takt beim Drehen:** Zu Beginn jedes Drehs „Takt · 23 Min“ mit Spruch je nach Tempo (Anstich, Turbo unter 10 Min, zügig, normal, gemütlich, Durststrecke über 60 Min), danach FCA-Fakt oder Spruch. Im Ergebnis „23 Min nach dem letzten Bier“, bei neuem Tages- oder Saisonrekord ein eigener Satz.

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
- [x] **E7 Biertempo:** Heute: Anzahl Biere, Ø Takt, Bestzeit, Zeitleiste in Spielerfarben. Saison: schnellstes Bier, längste Durststrecke, Ø Takt. Gezählt wird nur am selben Abend.

## Live-Ticker (Vorschlag, noch nicht beauftragt)

- Datenquelle: OpenLigaDB (kostenlos, ohne Schlüssel, aus dem Browser abrufbar, von Freiwilligen gepflegt; Tore mit Minute). Verzögerung möglich, im Stadion ist man schneller.
- Darum zweigleisig: Knöpfe „Tor FCA“ / „Gegentor“ für sofort, Live-Daten für Spielstand, Minute und Gegner.
- Spielideen: Gegentor = Frustdreh (sofort ein Extra-Bier), FCA-Tor = Joker für den zuletzt Gezogenen, Spielstand und Minute im Ticker, Tippspiel vor Anpfiff.

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
