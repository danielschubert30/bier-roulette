// Regeln des Tippspiels (js/tipp.js). Start im Projektordner: node tests/tippspiel.mjs
import { readMatch, evaluate, pickMatch, applyLive, newGame, weightOf, scoreOf, normGame, isLocked } from "../js/tipp.js";
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
eq("Gewichte nach Frage 1", ["a", "b", "c", "d"].map((p) => weightOf(g, p)), [0.75, 1.25, 0.75, 1]);
applyLive(g, { first: "fca", early: "yes", half: "yes" }, KO + 60 * MIN);
eq("Gewichte nach allen drei", ["a", "b", "c"].map((p) => weightOf(g, p)), [0.25, 1.75, 0.75]);
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
console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
