// Speichern auf dem Gerät und Datenmodell.
// Alles, was die App sich merkt, liegt in einem Objekt unter einem localStorage-Schlüssel.

const KEY = "fca-bier-roulette:v1";

export const PALETTE = [
  "#c8102e", "#1f6fb2", "#c88a0c", "#7b3fa0", "#0f8a6b", "#d4572a",
  "#b5179e", "#3d5a80", "#8a6d3b", "#2e7d32", "#ad1457", "#455a64"
];
export const DEFAULT_NAMES = ["Betzmeister", "Cousin", "Demharter M.", "Emilio", "Schaufi", "Schubi"];
export const MAX_WHEEL = 8;
export const MAX_ROSTER = 12;
export const MAX_NAME = 16;

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

export function defaultPlayers() {
  return DEFAULT_NAMES.map((name, i) => ({ id: "p" + (i + 1), name, color: PALETTE[i], active: true }));
}

function emptyState() {
  return {
    version: 1,
    players: defaultPlayers(),
    round: null,
    rounds: [],
    settings: { sound: true, vibrate: true }
  };
}

function normPlayer(p, i) {
  if (!p || !ID.test(String(p.id || ""))) return null;
  const name = cleanName(p.name);
  if (!name) return null;
  return { id: String(p.id), name, color: HEX.test(p.color) ? p.color : PALETTE[i % PALETTE.length], active: p.active !== false };
}

function normRound(r) {
  if (!r || typeof r !== "object" || !ID.test(String(r.id || ""))) return null;
  const pot = (Array.isArray(r.pot) ? r.pot : []).map(normPlayer).filter(Boolean);
  if (pot.length < 2) return null;
  const potIds = new Set(pot.map((p) => p.id));
  const picks = (Array.isArray(r.picks) ? r.picks : [])
    .filter((k) => k && potIds.has(k.id) && isFinite(k.at))
    .map((k) => ({ id: k.id, at: Number(k.at) }));
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
      endedAt: Number(f.endedAt) || null
    };
  }
  return { id: String(r.id), startedAt: Number(r.startedAt) || Date.now(), pot, picks, final };
}

export function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch (e) {
    raw = null;
  }
  if (!raw || typeof raw !== "object") return emptyState();
  const state = emptyState();
  const players = (Array.isArray(raw.players) ? raw.players : []).map(normPlayer).filter(Boolean);
  const seen = new Set();
  state.players = players.filter((p) => (seen.has(p.id) ? false : seen.add(p.id))).slice(0, MAX_ROSTER);
  let active = 0;
  for (const p of state.players) if (p.active && ++active > MAX_WHEEL) p.active = false;
  state.round = normRound(raw.round);
  state.rounds = (Array.isArray(raw.rounds) ? raw.rounds : []).map(normRound).filter((r) => r && r.final && r.final.winner);
  if (raw.settings && typeof raw.settings === "object") {
    state.settings.sound = raw.settings.sound !== false;
    state.settings.vibrate = raw.settings.vibrate !== false;
  }
  return state;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}
