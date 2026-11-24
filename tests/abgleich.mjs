// Zusammenführen zweier Handy-Stände (merge3 und keepTips in js/sync.js). Start im Projektordner: node tests/abgleich.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { href: "http://x/" };
const { merge3, keepTips, stable } = await import("../js/sync.js");
let fails = 0;
const t = (name, got, want) => { const ok = stable(got) === stable(want); if (!ok) fails++; console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : "\n  got  " + stable(got) + "\n  want " + stable(want))); };
const P = (id, name) => ({ id, name, color: "#c8102e", active: true, guest: false });
const tip = (first, at) => ({ first, early: "yes", half: "no", at, name: "X", color: "#c8102e" });
const game = (day, tips = {}, results = {}) => ({ day, match: null, tips, results, liveSays: {}, locked: null });
const base = { players: [P("p1", "A"), P("p2", "B")], round: { id: "r1", pot: [P("p1"), P("p2"), P("p3")], picks: [], final: null }, tipp: game("d"), debts: [], presence: { day: "d", ids: ["p1"] }, pending: [] };
const clone = (o) => JSON.parse(JSON.stringify(o));
let l, r, m;

// --- Bisherige Fälle ---
l = clone(base); r = clone(base); l.tipp.tips.p1 = tip("fca", 1); r.tipp.tips.p2 = tip("opp", 2);
m = merge3(base, l, r); t("Zwei Tipps gleichzeitig", [m.conflict, Object.keys(m.value.tipp.tips).sort()], [false, ["p1", "p2"]]);
l = clone(base); r = clone(base); l.round.picks.push({ id: "p1" }); r.round.picks.push({ id: "p2" });
m = merge3(base, l, r); t("Zwei Drehs gleichzeitig -> Konflikt", [m.conflict, m.paths], [true, ["round.picks"]]);
l = clone(base); r = clone(base); l.tipp.tips.p3 = tip("fca", 1); r.round.picks.push({ id: "p2" });
m = merge3(base, l, r); t("Dreh dort + Tipp hier", [m.conflict, m.value.round.picks.length, !!m.value.tipp.tips.p3], [false, 1, true]);
l = clone(base); r = clone(base); l.players[0].name = "Neu"; r.players.push(P("p9", "Gast"));
m = merge3(base, l, r); t("Kader: umbenannt + neu", m.value.players.map((p) => p.name), ["Neu", "B", "Gast"]);
const b5 = clone(base); b5.debts = [{ id: "d1", settledAt: null }];
l = clone(b5); r = clone(b5); l.debts[0].settledAt = 5; r.debts.push({ id: "d2", settledAt: null });
m = merge3(b5, l, r); t("Schulden: eingelöst + neu", m.value.debts, [{ id: "d1", settledAt: 5 }, { id: "d2", settledAt: null }]);
l = clone(base); r = clone(base); l.tipp.results.first = { v: "fca", at: 1, src: "live" }; r.tipp.results.first = { v: "fca", at: 2, src: "live" };
m = merge3(base, l, r); t("Gleiche Auflösung zweimal", [m.conflict, m.value.tipp.results.first.at], [false, 2]);
l = clone(base); r = clone(base); l.round.picks.push({ id: "p1" }); r.round = null;
m = merge3(base, l, r); t("Runde dort beendet + Dreh hier -> Konflikt", m.conflict, true);
l = clone(base); r = clone(base); l.round.pot.push(P("g1")); r.round.picks.push({ id: "p2" });
m = merge3(base, l, r); t("Gast in den Topf + Dreh dort", [m.conflict, m.value.round.pot.length, m.value.round.picks.length], [false, 4, 1]);
m = merge3(base, clone(base), r); t("Nur dort geändert", stable(m.value) === stable(r), true);

// --- Tipps gehen nicht verloren (1.6.0) ---
// Handy war seit dem letzten Spieltag nicht online: Ausgangsstand ist der alte Abend (mit eigenem alten Tipp)
const old = clone(base); old.tipp = game("2026-11-08", { p1: tip("opp", 5) });
l = clone(old); l.tipp = game("2026-11-22", { p1: tip("fca", 100) });
r = clone(old); r.tipp = game("2026-11-22", { p2: tip("fca", 90), p3: tip("opp", 95) });
m = merge3(old, l, r); t("Alter Abend als Ausgangsstand: eigener neuer Tipp bleibt", [m.conflict, Object.keys(m.value.tipp.tips).sort()], [false, ["p1", "p2", "p3"]]);
l = clone(old); l.tipp = game("2026-11-08", { p1: tip("opp", 5), p4: tip("fca", 6) });
r = clone(old); r.tipp = game("2026-11-22", { p2: tip("fca", 90) });
m = merge3(old, l, r); t("Verschiedene Abende: der neuere gilt", m.value.tipp.day, "2026-11-22");
// Derselbe Spieler auf zwei Handys: der spätere Tipp gilt, nicht gemischt
l = clone(base); r = clone(base); l.tipp.tips.p1 = { ...tip("fca", 10), early: "no" }; r.tipp.tips.p1 = { ...tip("opp", 20), half: "yes" };
m = merge3(base, l, r); t("Zwei Tipps für denselben: der spätere gilt ganz", m.value.tipp.tips.p1, { ...tip("opp", 20), half: "yes" });
// Ergebnis: von Hand schlägt Live
l = clone(base); r = clone(base); l.tipp.results.half = { v: "yes", at: 5, src: "manual" }; r.tipp.results.half = { v: "no", at: 9, src: "live" };
m = merge3(base, l, r); t("Ergebnis: von Hand schlägt Live", m.value.tipp.results.half, { v: "yes", at: 5, src: "manual" });
// Zusammenstoß beim Drehen: fremder Stand gilt, eigener Tipp bleibt trotzdem
l = clone(base); r = clone(base); l.round.picks.push({ id: "p1" }); l.tipp.tips.p4 = tip("fca", 7); r.round.picks.push({ id: "p2" }); r.tipp.tips.p2 = tip("opp", 8);
m = merge3(base, l, r);
const k = keepTips(base, l, r);
t("Zusammenstoß: fremder Dreh gilt, beide Tipps bleiben", [m.conflict, k.kept, k.value.round.picks.map((x) => x.id), Object.keys(k.value.tipp.tips).sort()], [true, true, ["p2"], ["p2", "p4"]]);
l = clone(base); l.round.picks.push({ id: "p1" });
t("Zusammenstoß ohne eigenen Tipp: nichts zu retten", keepTips(base, l, r).kept, false);
console.log(fails ? `${fails} FEHLER` : "Alle Prüfungen bestanden");
