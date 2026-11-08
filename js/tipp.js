// Tippspiel: drei feste Fragen vor dem Anpfiff, entschieden möglichst früh im Spiel.
// Jede richtige Antwort macht das eigene Feld auf dem Rad ein Viertel kleiner, jede falsche ein Viertel größer.
// Gilt für den ganzen Abend (bis 6 Uhr früh). Aufgelöst wird automatisch über OpenLigaDB
// (kostenlos, ohne Schlüssel, von Freiwilligen gepflegt, Tore mit Minute, Halbzeitstand) oder per Knopf.
// Dieses Modul enthält nur Regeln und Datenauswertung, keine Oberfläche.

export const STEP = 0.25;               // Feldänderung pro Frage
export const MIN_W = 0.25;              // kleinstes Feld (nie ganz weg)
export const LOCK_GRACE = 3 * 60000;    // getippt werden darf bis 3 Minuten nach Anpfiff
export const API = "https://api.openligadb.de";
export const LEAGUES = ["bl1", "bl2"];  // hier wird das heutige FCA-Spiel gesucht
const FCA_ID = 95;                      // FC Augsburg in OpenLigaDB

export const QUESTIONS = [
  { id: "first", text: "Wer trifft zuerst?", short: "1. Tor", opts: ["fca", "opp"] },
  { id: "early", text: "Fällt ein Tor bis zur 30. Minute?", short: "Bis 30.", opts: ["yes", "no"] },
  { id: "half", text: "Führt der FCA zur Halbzeit?", short: "Pause", opts: ["yes", "no"] }
];
const VALUES = { first: ["fca", "opp", "void"], early: ["yes", "no"], half: ["yes", "no"] };

export function optLabel(v, opp) {
  if (v === "fca") return "FCA";
  if (v === "opp") return opp || "Gegner";
  if (v === "yes") return "Ja";
  if (v === "no") return "Nein";
  return "zählt nicht";
}

export function resultText(qid, v, opp) {
  if (qid === "first") return v === "fca" ? "Erstes Tor: FCA" : v === "opp" ? `Erstes Tor: ${opp || "Gegner"}` : "Kein Tor im ganzen Spiel";
  if (qid === "early") return v === "yes" ? "Tor bis zur 30. Minute" : "Kein Tor bis zur 30. Minute";
  return v === "yes" ? "FCA führt zur Halbzeit" : "FCA führt nicht zur Halbzeit";
}

export function newGame(day) {
  return {
    day,                 // Abend (JJJJ-MM-TT), bis 6 Uhr früh
    match: null,         // { id, kickoff, team1, team2, opp, fcaFirst, searched } aus den Live-Daten
    tips: {},            // Spieler-ID -> { first, early, half, at, name, color }
    results: {},         // Frage -> { v, at, src: "live" | "manual" }
    liveSays: {},        // Frage -> was die Live-Daten zuletzt meldeten (für Hinweise bei Abweichung)
    locked: null,        // Zeitpunkt, ab dem nicht mehr getippt werden darf
    seen: {}             // Frage -> Auflösung, die schon angezeigt wurde
  };
}

export function isLocked(g, now) {
  if (!g) return false;
  if (g.locked) return true;
  if (Object.keys(g.results).length) return true;
  return !!(g.match && g.match.kickoff && now >= g.match.kickoff + LOCK_GRACE);
}

// Bilanz eines Spielers: richtige, falsche, offene Fragen und je Frage ein Zeichen
export function scoreOf(g, pid) {
  const t = g && g.tips[pid];
  const out = { right: 0, wrong: 0, open: 0, tipped: !!t, marks: [] };
  for (const q of QUESTIONS) {
    const r = g && g.results[q.id];
    if (!t) { out.marks.push("none"); continue; }
    if (!r) { out.open++; out.marks.push("open"); continue; }
    if (r.v === "void") { out.marks.push("void"); continue; }
    if (r.v === t[q.id]) { out.right++; out.marks.push("right"); } else { out.wrong++; out.marks.push("wrong"); }
  }
  return out;
}

export function weightOf(g, pid) {
  const s = scoreOf(g, pid);
  return Math.max(MIN_W, 1 + STEP * (s.wrong - s.right));
}

/* ---------- Speichern: Daten prüfen ---------- */
const ID = /^[A-Za-z0-9_-]{1,48}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const str = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const pos = (v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };

export function normGame(raw) {
  if (!raw || typeof raw !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw.day))) return null;
  const g = newGame(String(raw.day));
  if (raw.match && typeof raw.match === "object") {
    const m = raw.match;
    g.match = {
      id: pos(m.id), kickoff: pos(m.kickoff), team1: str(m.team1, 40), team2: str(m.team2, 40),
      opp: str(m.opp, 24), fcaFirst: m.fcaFirst !== false, searched: pos(m.searched)
    };
  }
  const tips = raw.tips && typeof raw.tips === "object" ? raw.tips : {};
  for (const pid of Object.keys(tips)) {
    const t = tips[pid];
    if (!ID.test(pid) || !t || QUESTIONS.some((q) => !q.opts.includes(t[q.id]))) continue;
    g.tips[pid] = {
      first: t.first, early: t.early, half: t.half, at: pos(t.at) || 0,
      name: str(t.name, 16) || "?", color: HEX.test(t.color) ? t.color : "#455a64"
    };
  }
  for (const q of QUESTIONS) {
    const r = raw.results && raw.results[q.id];
    if (r && VALUES[q.id].includes(r.v)) g.results[q.id] = { v: r.v, at: pos(r.at) || 0, src: r.src === "manual" ? "manual" : "live" };
    const l = raw.liveSays && raw.liveSays[q.id];
    if (VALUES[q.id].includes(l)) g.liveSays[q.id] = l;
    const s = raw.seen && raw.seen[q.id];
    if (VALUES[q.id].includes(s)) g.seen[q.id] = s;
  }
  g.locked = pos(raw.locked);
  return g;
}

/* ---------- Live-Daten (OpenLigaDB) ---------- */
// Felder kommen je nach Schnittstelle als matchID oder MatchID – beides wird akzeptiert.
function lc(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = {};
  for (const k of Object.keys(o)) r[k.charAt(0).toLowerCase() + k.slice(1)] = o[k];
  return r;
}
const int = (v) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? null : Math.round(Number(v)));
function parseTime(utc, local) {
  if (typeof utc === "string" && utc) {
    const t = Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(utc) ? utc : utc + "Z");
    if (isFinite(t)) return t;
  }
  if (typeof local === "string" && local) {
    const t = Date.parse(local);
    if (isFinite(t)) return t;
  }
  return null;
}
function isFcaTeam(t) {
  if (!t) return false;
  if (int(t.teamId) === FCA_ID) return true;
  const name = `${t.teamName || ""} ${t.shortName || ""}`;
  return /augsburg/i.test(name) && !/\bII\b|frauen|u\s?\d\d|junior/i.test(name);
}

// Ein Spiel aus den Live-Daten in eine einfache Form bringen: Spielstände immer aus FCA-Sicht (f = FCA, o = Gegner)
export function readMatch(raw) {
  const m = lc(raw);
  if (!m) return null;
  const t1 = lc(m.team1), t2 = lc(m.team2);
  const fcaFirst = isFcaTeam(t1) ? true : isFcaTeam(t2) ? false : null;
  if (fcaFirst === null) return null;
  const opp = fcaFirst ? t2 : t1;
  const fc = (a, b) => (fcaFirst ? { f: a, o: b } : { f: b, o: a });
  const goals = (Array.isArray(m.goals) ? m.goals : []).map(lc).filter(Boolean)
    .map((g) => ({ ...fc(int(g.scoreTeam1), int(g.scoreTeam2)), min: int(g.matchMinute) }))
    .filter((g) => g.f != null && g.o != null);
  const results = (Array.isArray(m.matchResults) ? m.matchResults : []).map(lc).filter(Boolean);
  const half = results.find((r) => int(r.resultTypeID) === 1 || /halb/i.test(String(r.resultName || "")));
  const end = results.find((r) => int(r.resultTypeID) === 2 || /end/i.test(String(r.resultName || "")));
  const score = (r) => {
    if (!r) return null;
    const s = fc(int(r.pointsTeam1), int(r.pointsTeam2));
    return s.f == null || s.o == null ? null : s;
  };
  return {
    id: int(m.matchID),
    kickoff: parseTime(m.matchDateTimeUTC, m.matchDateTime),
    team1: str(t1 && t1.teamName, 40), team2: str(t2 && t2.teamName, 40),
    opp: str((opp && (opp.shortName || opp.teamName)) || "Gegner", 24),
    fcaFirst,
    finished: m.matchIsFinished === true,
    goals, half: score(half), cur: score(end)
  };
}

// Das FCA-Spiel mit Anpfiff im Zeitraum [from, to) aus einer Spieltagsliste
export function pickMatch(list, from, to) {
  if (!Array.isArray(list)) return null;
  for (const raw of list) {
    const m = readMatch(raw);
    if (m && m.id && m.kickoff && m.kickoff >= from && m.kickoff < to) return m;
  }
  return null;
}

export function matchMeta(m, now) {
  return { id: m.id, kickoff: m.kickoff, team1: m.team1, team2: m.team2, opp: m.opp, fcaFirst: m.fcaFirst, searched: now };
}

// Was sagen die Live-Daten zu den drei Fragen? null = noch offen.
// Zeitgrenzen in Minuten nach Anpfiff (Uhrzeit, nicht Spielminute), mit Puffer für spätes Eintragen.
export function evaluate(m, now) {
  const out = { first: null, early: null, half: null };
  if (!m) return out;
  if (m.kickoff && now < m.kickoff) return out;    // vor dem Anpfiff nichts werten
  const after = (min) => !!m.kickoff && now >= m.kickoff + min * 60000;
  const goals = m.goals.slice().sort((a, b) => a.f + a.o - (b.f + b.o));
  const lastG = goals[goals.length - 1];
  const total = Math.max(m.cur ? m.cur.f + m.cur.o : 0, lastG ? lastG.f + lastG.o : 0);
  const complete = goals.length >= total;           // jedes Tor einzeln erfasst
  const known = (g) => g.min != null && g.min > 0;

  // Wer trifft zuerst? Kein Tor im ganzen Spiel: zählt nicht.
  const g1 = goals.find((g) => g.f + g.o === 1);
  if (g1) out.first = g1.f === 1 ? "fca" : "opp";
  else if (m.cur && m.cur.f > 0 && m.cur.o === 0) out.first = "fca";
  else if (m.cur && m.cur.o > 0 && m.cur.f === 0) out.first = "opp";
  else if (m.finished && total === 0) out.first = "void";

  // Tor bis zur 30. Minute (egal welches Team)
  if (goals.some((g) => known(g) && g.min <= 30)) out.early = "yes";
  else if (g1 && known(g1) && g1.min > 30) out.early = "no";
  else if (total === 0 && (after(42) || m.finished)) out.early = "no";

  // Führt der FCA zur Halbzeit? Unentschieden heißt Nein.
  if (m.half && (after(50) || m.finished)) out.half = m.half.f > m.half.o ? "yes" : "no";
  else if ((after(75) || m.finished) && complete && goals.every(known)) {
    const firstHalf = goals.filter((g) => g.min <= 45);
    const last = firstHalf[firstHalf.length - 1];
    out.half = last && last.f > last.o ? "yes" : "no";
  }
  return out;
}

// Live-Ergebnis übernehmen. Von Hand Eingetragenes bleibt stehen (Abweichung wird nur gemerkt).
// Gibt die Fragen zurück, deren Ergebnis sich dadurch geändert hat.
export function applyLive(g, ev, now) {
  const changed = [];
  for (const q of QUESTIONS) {
    const v = ev[q.id];
    if (!v) continue;
    g.liveSays[q.id] = v;
    const r = g.results[q.id];
    if (r && (r.src === "manual" || r.v === v)) continue;
    g.results[q.id] = { v, at: now, src: "live" };
    changed.push(q.id);
  }
  if (changed.length && !g.locked) g.locked = now;
  return changed;
}
