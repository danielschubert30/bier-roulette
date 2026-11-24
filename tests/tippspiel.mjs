// Regeln des Tippspiels (js/tipp.js). Start im Projektordner: node tests/tippspiel.mjs
import { readMatch, evaluate, pickMatch, applyLive, newGame, weightOf, scoreOf, normGame, isLocked, patronsFor, lockTime, helpOf, jokerAwards, jokerProgress, countedGames } from "../js/tipp.js";
const KO = Date.parse("2026-11-14T14:30:00Z"), MIN = 60000;
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)); };
function match({ fcaHome = true, goals = [], half = null, end = null, finished = false, pascal = false }) {
  const fca = { teamId: 95, teamName: "FC Augsburg", shortName: "Augsburg" };
  const opp = { teamId: 134, teamName: "SV Werder Bremen", shortName: "Bremen" };
  const res = [];
  if (end) res.push({ resultID: 1, resultName: "Endergebnis", pointsTeam1: end[0], pointsTeam2: end[1], resultOrderID: 2, resultTypeID: 2 });
  if (half) res.push({ resultID: 2, resultName: "Halbzeit", pointsTeam1: half[0], pointsTeam2: half[1], resultOrderID: 1, resultTypeID: 1 });
  const m = {
    matchID: 77001, matchDateTime: "2026-11-14T15:30:00", timeZoneID: "W. Europe Standard Time", leagueShortcut: "bl1",
    matchDateTimeUTC: "2026-11-14T14:30:00Z", team1: fcaHome ? fca : opp, team2: fcaHome ? opp : fca,
    matchIsFinished: finished, matchResults: res,
    goals: goals.map(([s1, s2, min], i) => ({ goalID: i + 1, scoreTeam1: s1, scoreTeam2: s2, matchMinute: min, goalGetterName: "X", isPenalty: false, isOwnGoal: false, isOvertime: false }))
  };
  if (!pascal) return m;
  const up = (o) => Array.isArray(o) ? o.map(up) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), up(v)])) : o;
  return up(m);
}
const ev = (opts, minutes) => evaluate(readMatch(match(opts)), KO + minutes * MIN);

eq("vor Anpfiff alles offen", ev({ goals: [] }, -5), { first: null, early: null, half: null });
eq("0:0 nach 20 Min: alles offen", ev({ goals: [], end: [0, 0] }, 20), { first: null, early: null, half: null });
eq("FCA trifft 12. (Heim)", ev({ goals: [[1, 0, 12]], end: [1, 0] }, 20), { first: "fca", early: "yes", half: null });
eq("FCA trifft 12. (Auswärts)", ev({ fcaHome: false, goals: [[0, 1, 12]], end: [0, 1] }, 20), { first: "fca", early: "yes", half: null });
eq("Gegner trifft 33. (FCA auswärts)", ev({ fcaHome: false, goals: [[1, 0, 33]], end: [1, 0] }, 40), { first: "opp", early: "no", half: null });
eq("Tor genau in der 30.", ev({ goals: [[0, 1, 30]], end: [0, 1] }, 35), { first: "opp", early: "yes", half: null });
eq("0:0 nach 41 Min: bis-30 noch offen (Puffer)", ev({ goals: [], end: [0, 0] }, 41), { first: null, early: null, half: null });
eq("0:0 nach 42 Min: kein Tor bis 30", ev({ goals: [], end: [0, 0] }, 42), { first: null, early: "no", half: null });
eq("Halbzeit 1:0 eingetragen, 51 Min: noch offen (Nachspielzeit)", ev({ goals: [[1, 0, 38]], half: [1, 0], end: [1, 0] }, 51), { first: "fca", early: "no", half: null });
eq("Halbzeit 1:0 eingetragen, 60 Min", ev({ goals: [[1, 0, 38]], half: [1, 0], end: [1, 0] }, 60), { first: "fca", early: "no", half: "yes" });
eq("22.11. Mainz: Platzhalter 0:0 bei 2:0 nach 51 Min", ev({ goals: [[1, 0, 19], [2, 0, 36]], half: [0, 0], end: [2, 0] }, 51), { first: "fca", early: "yes", half: null });
eq("22.11. Mainz: Platzhalter 0:0 bei 2:0 nach 61 Min wird nicht genommen", ev({ goals: [[1, 0, 19], [2, 0, 36]], half: [0, 0], end: [2, 0] }, 61), { first: "fca", early: "yes", half: null });
eq("22.11. Mainz: Halbzeit 2:0 nach 61 Min", ev({ goals: [[1, 0, 19], [2, 0, 36]], half: [2, 0], end: [2, 0] }, 61), { first: "fca", early: "yes", half: "yes" });
eq("Platzhalter bleibt falsch: nach 75 Min aus den Toren", ev({ goals: [[1, 0, 19], [2, 0, 36], [3, 0, 60]], half: [0, 0], end: [3, 0] }, 76), { first: "fca", early: "yes", half: "yes" });
eq("Halbzeit höher als der Spielstand: nicht genommen", ev({ goals: [], half: [1, 0], end: [0, 0] }, 65), { first: null, early: "no", half: null });
eq("Auswärts: Halbzeit 0:1 = FCA führt", ev({ fcaHome: false, goals: [[0, 1, 40]], half: [0, 1], end: [0, 1] }, 62), { first: "fca", early: "no", half: "yes" });
eq("Halbzeit 1:1 = Nein", ev({ goals: [[1, 0, 10], [1, 1, 40]], half: [1, 1], end: [1, 1] }, 62), { first: "fca", early: "yes", half: "no" });
eq("Halbzeit-Eintrag vor 60 Min ignoriert", ev({ goals: [], half: [0, 0], end: [0, 0] }, 55), { first: null, early: "no", half: null });
eq("Ohne Halbzeiteintrag: aus Toren nach 75 Min", ev({ fcaHome: false, goals: [[0, 1, 44], [1, 1, 70]], end: [1, 1] }, 76), { first: "fca", early: "no", half: "yes" });
eq("Tor ohne Einzeldaten: Stand 0:1 (FCA auswärts) reicht für 1. Tor", ev({ fcaHome: false, goals: [], end: [0, 1] }, 50), { first: "fca", early: null, half: null });
eq("Abpfiff 0:0: Frage 1 zählt nicht", ev({ goals: [], half: [0, 0], end: [0, 0], finished: true }, 115), { first: "void", early: "no", half: "no" });
eq("Großbuchstaben-Format (ältere Schnittstelle)", ev({ pascal: true, goals: [[1, 0, 5]], end: [1, 0] }, 10), { first: "fca", early: "yes", half: null });

// Spiel finden
const day0 = Date.parse("2026-11-14T05:00:00Z"), day1 = day0 + 24 * 3600 * 1000;
const other = { matchID: 1, matchDateTimeUTC: "2026-11-14T14:30:00Z", team1: { teamId: 7, teamName: "Borussia Dortmund" }, team2: { teamId: 40, teamName: "FC Bayern" }, goals: [], matchResults: [] };
const found = pickMatch([other, match({})], day0, day1);
eq("FCA-Spiel im Spieltag gefunden", found && [found.id, found.opp, found.fcaFirst], [77001, "Bremen", true]);
eq("Spiel an anderem Tag nicht genommen", pickMatch([match({})], day1, day1 + 864e5), null);
const fca2 = { matchID: 2, matchDateTimeUTC: "2026-11-14T11:00:00Z", team1: { teamId: 9999, teamName: "FC Augsburg II" }, team2: { teamId: 1, teamName: "X" }, goals: [] };
eq("FC Augsburg II wird ignoriert", pickMatch([fca2], day0, day1), null);

// Gewichte und Übernahme
const g = newGame("2026-11-14");
g.tips = { a: { first: "fca", early: "yes", half: "yes" }, b: { first: "opp", early: "no", half: "no" }, c: { first: "fca", early: "no", half: "yes" } };
let ch = applyLive(g, { first: "fca", early: null, half: null }, KO + 20 * MIN);
eq("Live: Frage 1 übernommen", [ch, g.results.first.v, !!g.locked], [["first"], "fca", true]);
eq("Gewichte nach Frage 1", ["a", "b", "c", "d"].map((p) => weightOf(g, p)), [0.8, 1.2, 0.8, 1]);
applyLive(g, { first: "fca", early: "yes", half: "yes" }, KO + 60 * MIN);
eq("Gewichte nach allen drei", ["a", "b", "c"].map((p) => weightOf(g, p)), [0.4, 1.6, 0.8]);
eq("Zeichen für b", scoreOf(g, "b").marks, ["wrong", "wrong", "wrong"]);
g.results.half = { v: "no", at: 1, src: "manual" };
ch = applyLive(g, { first: "fca", early: "yes", half: "yes" }, KO + 61 * MIN);
eq("Von Hand Eingetragenes bleibt, Abweichung gemerkt", [ch, g.results.half.v, g.liveSays.half], [[], "no", "yes"]);
ch = applyLive(g, { first: "opp", early: "yes", half: null }, KO + 62 * MIN);
eq("Live korrigiert eigenes Live-Ergebnis", [ch, g.results.first.v], [["first"], "opp"]);
g.results.first = { v: "void", at: 1, src: "live" };
eq("Zählt nicht: kein Einfluss", weightOf(g, "a"), 1 + 0.25 * (0 - 1) + 0.25 * 1 - 0.25 * 0); // early right(-), half wrong(+)
const back = normGame(JSON.parse(JSON.stringify(g)));
eq("Speichern und Laden", [Object.keys(back.tips).length, back.results.half.src, back.liveSays.half], [3, "manual", "yes"]);
eq("Sperre: 2 Min nach Anpfiff noch offen, nach 3 zu", [isLocked({ ...newGame("x"), match: { kickoff: KO } }, KO + 2 * MIN), isLocked({ ...newGame("x"), match: { kickoff: KO } }, KO + 3 * MIN)], [false, true]);

// Paten für Ausgeschiedene (1.7.0)
{
  const P = (id, guest = false) => ({ id, name: id, color: "#c8102e", active: !guest, guest });
  const T = (first, at) => ({ first, early: "yes", half: "yes", at, name: "x", color: "#c8102e" });
  const lock = KO + 3 * MIN;
  const round = { id: "r9", startedAt: KO - 300 * MIN, pot: ["a", "b", "c", "d", "e", "f", "g"].map((x) => P(x)), final: null,
    picks: [{ id: "a", at: KO - 200 * MIN }, { id: "b", at: KO - 100 * MIN }, { id: "c", at: KO + 30 * MIN }] };
  const g = newGame("2026-11-29");
  g.match = { id: 1, kickoff: KO };
  g.tips = { a: T("fca", KO - 50 * MIN), b: T("opp", KO - 40 * MIN), c: T("fca", KO - 30 * MIN), d: T("fca", KO - 20 * MIN) };
  eq("Sperrzeit = Anpfiff + 3 Min", lockTime(g), lock);
  const p1 = patronsFor(g, round, lock);
  eq("Nur wer beim Anpfiff schon raus war, bekommt einen Paten", Object.keys(p1).sort(), ["a", "b"]);
  eq("Pate ist noch im Rad und nicht doppelt", [["c", "d", "e", "f", "g"].includes(p1.a), ["c", "d", "e", "f", "g"].includes(p1.b), p1.a !== p1.b], [true, true, true]);
  eq("Jedes Handy lost dasselbe", patronsFor(g, JSON.parse(JSON.stringify(round)), lock), p1);
  g.patron = p1;
  g.tips.x = T("fca", KO - 10 * MIN);   // spät angekommener Tipp (ohne Netz abgegeben)
  round.pot.push(P("x")); round.picks.push({ id: "x", at: KO - 90 * MIN });
  const p2 = patronsFor(g, round, lock);
  eq("Nachzügler bekommt einen Paten, die anderen bleiben", [p2.a, p2.b, !!p2.x, p2.x !== p2.a && p2.x !== p2.b], [p1.a, p1.b, true, true]);
  g.patron = p2;
  g.results = { first: { v: "fca", at: lock + 10 * MIN, src: "live" }, early: { v: "no", at: lock + 30 * MIN, src: "live" } };
  const pa = p2.a;
  eq("Pate von a: eine richtige Antwort von a hilft", [helpOf(g, pa), weightOf(g, pa)], [1, (g.tips[pa] ? weightOf({ ...g, patron: {} }, pa) : 1) - 0.2]);
  eq("Falsche Antworten (b) zählen für den Paten nicht", helpOf(g, p2.b), 0);
  eq("Neue Runde nach dem Anpfiff: keine Paten", patronsFor({ ...g, patron: {} }, { ...round, startedAt: lock + MIN }, lock), {});
  const fin = { id: "r8", startedAt: KO - 300 * MIN, pot: ["a", "b", "c", "d"].map((x) => P(x)), picks: [{ id: "a", at: KO - 9 * MIN }, { id: "b", at: KO - 8 * MIN }], final: null };
  eq("Nur noch Finale offen: keine Paten", patronsFor({ ...g, patron: {} }, fin, lock), {});
  const back = normGame(JSON.parse(JSON.stringify({ ...g, seen: { patron: "a>d" } })));
  eq("Paten speichern und laden", [back.patron, back.seen.patron], [p2, "a>d"]);
}

// Joker für den Tippkönig (1.8.0)
{
  const res = (a, b, c) => ({ first: { v: a, at: 1, src: "live" }, early: { v: b, at: 1, src: "live" }, half: { v: c, at: 1, src: "live" } });
  const tp = (first, early, half) => ({ first, early, half, at: 1, name: "x", color: "#c8102e" });
  const game = (day, tips, results) => ({ ...newGame(day), tips, results });
  const all = { s: tp("fca", "yes", "yes"), b: tp("fca", "no", "no"), c: tp("opp", "no", "no") };
  const days = ["2026-08-01", "2026-08-15", "2026-08-29", "2026-09-12", "2026-09-26", "2026-10-10", "2026-10-24"];
  const gs = days.map((d) => game(d, all, res("fca", "yes", "yes")));
  gs.push(game("2026-07-05", all, {}));   // ohne Ergebnis: zählt nicht
  const aw = jokerAwards(gs, "2026-11-01");
  eq("Nach 5 Spielen ein Joker für den Besten", aw.map((a) => [a.playerId, a.block, a.right]), [["s", 1, 15]]);
  eq("Fortschritt: Spiel 2 von 5 im nächsten Block", jokerProgress(gs, "2026-11-01"), { done: 2, need: 5 });
  eq("Spiel ohne Ergebnis zählt nicht", countedGames(gs, "2026-11-01").length, 7);
  const tie = days.slice(0, 5).map((d, i) => game(d, { s: tp("fca", "yes", "no"), b: tp("fca", "no", "yes"), c: tp("opp", "no", "no") }, res("fca", "yes", "yes")));
  eq("Gleichstand: beide bekommen einen Joker", jokerAwards(tie, "2026-11-01").map((a) => a.playerId).sort(), ["b", "s"]);
  const today = game("2026-11-01", all, { first: { v: "fca", at: 1, src: "live" } });
  const four = gs.slice(0, 4).concat(today);
  eq("Heutiges Spiel zählt erst, wenn alle drei Fragen entschieden sind", jokerAwards(four, "2026-11-01").length, 0);
  today.results = res("fca", "yes", "yes");
  eq("…dann gibt es den Joker noch am selben Abend", jokerAwards(four, "2026-11-01").length, 1);
  const split = ["2026-05-01", "2026-05-15", "2026-06-01", "2026-07-15", "2026-08-01"].map((d) => game(d, all, res("fca", "yes", "yes")));
  eq("Neue Saison ab Juli: Blöcke beginnen neu", jokerAwards(split, "2026-11-01").length, 0);
  eq("Kennung ist fest (gleich auf jedem Handy)", jokerAwards(gs, "2026-11-01")[0].id, "j2026-1-s");
}
console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
