// Speichern auf dem Gerät und Datenmodell.
// Alles, was die App sich merkt, liegt in einem Objekt unter einem localStorage-Schlüssel:
// { version: 2, activeId, competitions: [Meisterschaft, ...], settings, admin }
// Jede Meisterschaft hat ihren eigenen Kader, ihre Runden, Statistik und Bierschulden.
import { normGame } from "./tipp.js";

const KEY = "fca-bier-roulette:v1";

export const PALETTE = [
  "#c8102e", "#1f6fb2", "#c88a0c", "#7b3fa0", "#0f8a6b", "#d4572a",
  "#b5179e", "#3d5a80", "#8a6d3b", "#2e7d32", "#ad1457", "#455a64",
  "#00838f", "#5e35b1", "#6d4c41", "#827717"
];
export const DEFAULT_NAMES = ["Betzmeister", "Cousin", "Demharter M.", "Emilio", "Schaufi", "Schubi"];
export const MAX_WHEEL = 10;      // Stammspieler, die mitspielen
export const MAX_ON_WHEEL = 12;   // Felder auf dem Rad insgesamt (Stammspieler + Gäste des Abends)
export const MAX_ROSTER = 20;     // Kader inklusive Gäste
export const MAX_NAME = 16;
export const MAX_COMPS = 10;      // Meisterschaften
export const MAX_COMP_NAME = 24;

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[A-Za-z0-9_-]{1,48}$/;

export function rand() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  } catch (e) {
    return Math.random();
  }
}

export function uid(prefix = "p") {
  return prefix + Date.now().toString(36) + Math.floor(rand() * 1e9).toString(36);
}

export function cleanName(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

export function cleanTitle(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, MAX_COMP_NAME);
}

export function defaultPlayers() {
  return DEFAULT_NAMES.map((name, i) => ({ id: "p" + (i + 1), name, color: PALETTE[i], active: true, guest: false }));
}

// players: Liste zum Übernehmen (wird kopiert); ohne Angabe der Standard-Kader
export function newCompetition(name, fca, players) {
  return {
    id: uid("c"),
    name: cleanTitle(name) || "Meisterschaft",
    createdAt: Date.now(),
    fca: !!fca,           // FCA-Spieltage: FCA-Fakten beim Drehen
    players: players ? JSON.parse(JSON.stringify(players)) : defaultPlayers(),
    round: null,          // laufende Runde
    rounds: [],           // abgeschlossene Runden (in Reihenfolge des Abschlusses)
    pending: [],          // Runden mit verschobenem Finale
    debts: [],            // Bierschulden von Fehlenden
    presence: null,       // { day: "JJJJ-MM-TT", ids: [...] } – wer an diesem Abend da ist
    tipp: null,           // Tippspiel des Abends (siehe js/tipp.js)
    tippArchive: [],      // frühere Tippspiele mit Tipps (für eine spätere Statistik)
    lastDone: null        // zuletzt entschiedenes Finale (damit andere Handys es live mitsehen)
  };
}

function defaultRoot() {
  const c = newCompetition("FCA-Spieltage", true, null);
  return { version: 2, activeId: c.id, competitions: [c], settings: { sound: true, vibrate: true }, admin: null };
}

function normPlayer(p, i) {
  if (!p || !ID.test(String(p.id || ""))) return null;
  const name = cleanName(p.name);
  if (!name) return null;
  const guest = p.guest === true;   // Gast: kommt nur an Abenden aufs Rad, an denen er da ist
  return {
    id: String(p.id), name, color: HEX.test(p.color) ? p.color : PALETTE[i % PALETTE.length],
    active: !guest && p.active !== false, guest
  };
}

export function normRound(r) {
  if (!r || typeof r !== "object" || !ID.test(String(r.id || ""))) return null;
  const pot = (Array.isArray(r.pot) ? r.pot : []).map(normPlayer).filter(Boolean);
  if (pot.length < 2) return null;
  const potIds = new Set(pot.map((p) => p.id));
  // Ziehung: absent = Spieler war nicht da (dann Bierschuld statt Holen), beers = Anzahl Biere beim Holen
  const picks = (Array.isArray(r.picks) ? r.picks : [])
    .filter((k) => k && potIds.has(k.id) && isFinite(k.at))
    .map((k) => ({
      id: k.id, at: Number(k.at), absent: k.absent === true,
      beers: posInt(k.beers), debtId: ID.test(String(k.debtId || "")) ? String(k.debtId) : null
    }));
  let final = null;
  if (r.final && potIds.has(r.final.a) && potIds.has(r.final.b)) {
    const f = r.final;
    final = {
      a: f.a, b: f.b,
      first: f.first === f.b ? f.b : f.a,
      shots: (Array.isArray(f.shots) ? f.shots : [])
        .filter((s) => s && (s.by === f.a || s.by === f.b))
        .map((s) => ({ by: s.by, aim: s.aim, dive: s.dive, result: s.result, at: Number(s.at) || 0 })),
      winner: potIds.has(f.winner) ? f.winner : null,
      loser: potIds.has(f.loser) ? f.loser : null,
      endedAt: Number(f.endedAt) || null,
      forfeit: f.forfeit === true,          // kampflos entschieden (Verlierer fehlte)
      postponed: f.postponed === true,      // auf ein späteres Treffen verschoben
      beers: posInt(f.beers),               // Biere, die der Verlierer geholt hat
      debtId: ID.test(String(f.debtId || "")) ? String(f.debtId) : null
    };
  }
  return { id: String(r.id), startedAt: Number(r.startedAt) || Date.now(), pot, picks, final };
}

function posInt(v) {
  const n = Math.round(Number(v));
  return isFinite(n) && n > 0 && n < 100 ? n : null;
}

// Bierschuld: Spieler wurde gezogen (oder verlor kampflos), war aber nicht da.
// Eingelöst wird beim nächsten Treffen; dann zählt, wie viele Biere es waren.
function normDebt(d) {
  if (!d || !ID.test(String(d.id || "")) || !ID.test(String(d.playerId || "")) || !isFinite(d.at)) return null;
  return {
    id: String(d.id), playerId: String(d.playerId), at: Number(d.at),
    roundId: ID.test(String(d.roundId || "")) ? String(d.roundId) : null,
    reason: d.reason === "forfeit" ? "forfeit" : "pick",
    name: cleanName(d.name) || "?",
    color: HEX.test(d.color) ? d.color : PALETTE[0],
    settledAt: Number(d.settledAt) || null,
    beers: posInt(d.beers)
  };
}

export function normComp(raw, fallbackName, fallbackFca) {
  const c = newCompetition(cleanTitle(raw.name) || fallbackName, raw.fca === undefined ? fallbackFca : raw.fca === true, []);
  if (ID.test(String(raw.id || ""))) c.id = String(raw.id);
  if (isFinite(raw.createdAt) && raw.createdAt > 0) c.createdAt = Number(raw.createdAt);
  const players = (Array.isArray(raw.players) ? raw.players : []).map(normPlayer).filter(Boolean);
  const seen = new Set();
  c.players = players.filter((p) => (seen.has(p.id) ? false : seen.add(p.id))).slice(0, MAX_ROSTER);
  let active = 0;
  for (const p of c.players) if (!p.guest && p.active && ++active > MAX_WHEEL) p.active = false;
  c.round = normRound(raw.round);
  c.rounds = (Array.isArray(raw.rounds) ? raw.rounds : []).map(normRound).filter((r) => r && r.final && r.final.winner);
  c.pending = (Array.isArray(raw.pending) ? raw.pending : []).map(normRound).filter((r) => r && r.final && !r.final.winner);
  c.debts = (Array.isArray(raw.debts) ? raw.debts : []).map(normDebt).filter(Boolean);
  if (raw.presence && typeof raw.presence.day === "string" && Array.isArray(raw.presence.ids)) {
    c.presence = { day: raw.presence.day, ids: raw.presence.ids.filter((id) => ID.test(String(id))).map(String) };
  }
  c.tipp = normGame(raw.tipp);
  c.tippArchive = (Array.isArray(raw.tippArchive) ? raw.tippArchive : []).map(normGame).filter(Boolean).slice(-60);
  const done = normRound(raw.lastDone);
  c.lastDone = done && done.final && done.final.winner ? done : null;
  return c;
}

// key: eigener Speicherplatz, z. B. für den Zwischenstand einer gemeinsamen Gruppe
export function hasSaved(key = KEY) {
  try { return !!localStorage.getItem(key); } catch (e) { return false; }
}

export function load(key = KEY) {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(key) || "null");
  } catch (e) {
    raw = null;
  }
  if (!raw || typeof raw !== "object") return defaultRoot();
  const root = defaultRoot();
  root.competitions = [];
  if (Array.isArray(raw.competitions)) {
    raw.competitions.forEach((c, i) => {
      if (!c || typeof c !== "object") return;
      const n = normComp(c, `Meisterschaft ${i + 1}`, false);
      if (!root.competitions.some((x) => x.id === n.id)) root.competitions.push(n);
    });
  } else {
    // Fassung 1: alles lag direkt im Objekt – wird zur ersten Meisterschaft
    root.competitions.push(normComp({ ...raw, id: "c1", name: "FCA-Spieltage", fca: true }, "FCA-Spieltage", true));
  }
  if (!root.competitions.length) return defaultRoot();
  root.competitions = root.competitions.slice(0, MAX_COMPS);
  root.activeId = root.competitions.some((c) => c.id === raw.activeId) ? raw.activeId : root.competitions[0].id;
  if (raw.settings && typeof raw.settings === "object") {
    root.settings.sound = raw.settings.sound !== false;
    root.settings.vibrate = raw.settings.vibrate !== false;
  }
  if (raw.admin && /^[0-9a-f]{64}$/.test(String(raw.admin.hash)) && /^[0-9a-f]{32}$/.test(String(raw.admin.salt))) {
    root.admin = { hash: raw.admin.hash, salt: raw.admin.salt };
  }
  return root;
}

export function save(root, key = KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(root));
    return true;
  } catch (e) {
    return false;
  }
}
