# Anforderungen – FCA Bier-Roulette

Stand: 08.11.2026 · Auftraggeber: Daniel · Einsatz: im Stadion während FCA-Spielen, am Handy

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
- [x] **C6 Saison-Auswahl im Bier-Saldo:** schlanke Umschalter wie bei Heute/Saison/Gesamt; bei nur einer Saison steht nur „Saison 2026/27“ da (vorher graues Auswahlfeld, das bei einer Saison scheinbar nichts tat).

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

## F – Tippspiel (beauftragt 08.11.2026)

- [x] **F1 Drei feste Fragen**, früh im Spiel entschieden: „Wer trifft zuerst?“ (FCA / Gegner; fällt kein Tor, zählt die Frage nicht), „Fällt ein Tor bis zur 30. Minute?“ (Ja / Nein, egal welches Team), „Führt der FCA zur Halbzeit?“ (Ja / Nein, Unentschieden = Nein). Die Frage nach der ersten Gelben Karte wurde durch die Halbzeit-Frage ersetzt, weil Karten in den kostenlosen Live-Daten fehlen.
- [x] **F2 Verdeckt tippen:** Leiste „Tippspiel“ unter den Namen. Jeder Anwesende tippt für sich, dann geht das Handy weiter. Die Tipps schließen 3 Minuten nach Anpfiff (mit Live-Daten automatisch, sonst über „Tipps zu“).
- [x] **F3 Wirkung aufs Rad:** Jede richtige Antwort macht das eigene Feld ein Viertel kleiner, jede falsche ein Viertel größer (25 % bis 175 %). Feldgröße = Wahrscheinlichkeit, gezogen zu werden. Gilt den ganzen Abend; ohne Tipp bleibt das Feld normal. Das Finale (Elfmeterschießen) ist davon nicht betroffen.
- [x] **F4 Automatisch auflösen** über OpenLigaDB: Die App sucht das heutige FCA-Spiel in der 1. und 2. Liga und fragt ab Anpfiff einmal pro Minute den Stand ab. „Kein Tor bis zur 30.“ frühestens 42 Minuten nach Anpfiff, Halbzeit frühestens nach 50 Minuten (Puffer für spätes Eintragen). Pokal- und Testspiele stehen dort nicht, dann per Knopf.
- [x] **F5 Per Knopf auflösen:** Wer es im Stadion sieht, tippt das Ergebnis an (schneller als der Live-Ticker). Sperren: „Nein“ bei Frage 2 ab der 30. Minute, Frage 3 ab der Halbzeit, „Kein Tor“ ab der 90. Minute. Direkt danach „Doch nicht“ möglich; später ändern nur mit Admin-PIN. Melden die Live-Daten etwas anderes als von Hand eingetragen, erscheint ein Hinweis mit „Übernehmen“.
- [x] **F6 Sofort sichtbar:** Bei jeder Auflösung ein Fenster: Ergebnis, wer richtig lag (Feld −25 %) und wer daneben (Feld +25 %). Danach wachsen und schrumpfen die Felder sichtbar. An jedem Namen drei Punkte (grün richtig, rot daneben, leer offen), in der Leiste „x von 3 entschieden“, im Ticker die Risiko-Spanne. Im Tipp-Fenster eine Tabelle mit allen Tipps und Feldgrößen.
- [x] **F7 Nur bei Meisterschaften mit „FCA-Spieltag“.** Frühere Tippspiele werden gespeichert (für eine spätere Statistik).

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
| Tippkönig: Trefferquote im Tippspiel pro Saison (Daten werden schon gesammelt) | Langzeitspaß | klein |
| Stärke im Tippspiel einstellbar (z. B. ein Fünftel statt ein Viertel) | Feintuning | klein |
