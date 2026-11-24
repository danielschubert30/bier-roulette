// Gemeinsamer Stand für alle Handys über Firebase (Cloud Firestore, kostenloser Spark-Tarif).
//
// Aufbau in der Datenbank:
//   groups/{code}                               { createdAt, admin }            Gruppe; der Code steht im Einladungslink
//   groups/{code}/comps/{id}                    { rev, wid, by, at, name, fca, createdAt, s }
//                                               s = Meisterschaft als JSON, ohne fertige Runden
//   groups/{code}/comps/{id}/rounds/{rundenId}  { ord, r }   fertige Runde als JSON (nur hinzufügen, Reihenfolge = ord)
//   groups/{code}/comps/{id}/tipps/{tag}        { day, g }   früheres Tippspiel als JSON
//
// Jedes Handy arbeitet wie bisher mit seinem Stand im Speicher. Jede Änderung wird per Transaktion hochgeladen:
// Stimmt die Versionsnummer (rev) noch, wird einfach geschrieben. Hat inzwischen ein anderes Handy etwas
// geändert, werden beide Stände zusammengeführt (merge3). Haben beide gleichzeitig gedreht oder geschossen,
// gilt das schnellere Handy; das andere übernimmt dessen Stand. Ohne Netz wird gesammelt und nachgetragen.
import { normComp, normRound, uid } from "./store.js";
import { normGame } from "./tipp.js";

export const FIREBASE = {
  apiKey: "AIzaSyC6M9S6qMBprXS8dsWQchHmWwISS4X6_vc",
  authDomain: "bier-roulette.firebaseapp.com",
  projectId: "bier-roulette",
  storageBucket: "bier-roulette.firebasestorage.app",
  messagingSenderId: "992309053929",
  appId: "1:992309053929:web:e7d219253f3f9f2f82e378"
};
const SDK = "../vendor/firebase/";
const GROUP_KEY = "fca-bier-roulette:group";
const META_KEY = "fca-bier-roulette:sync:";
const DEVICE_KEY = "fca-bier-roulette:device";
export const CACHE_KEY = "fca-bier-roulette:g:";

/* ---------- Kleine Hilfen ---------- */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* voll oder privat */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* egal */ } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function withTimeout(p, ms) {
  return Promise.race([p, sleep(ms).then(() => { throw Object.assign(new Error("timeout"), { code: "deadline-exceeded" }); })]);
}
// JSON mit sortierten Schlüsseln: gleicher Inhalt ergibt immer denselben Text
export function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  }
  return JSON.stringify(v === undefined ? null : v);
}
const eq = (a, b) => stable(a) === stable(b);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/* ---------- Gruppe und Gerät ---------- */
export const validCode = (c) => typeof c === "string" && /^[A-Za-z0-9]{16,40}$/.test(c);
export function codeFromUrl() {
  try {
    const u = new URL(location.href);
    const c = u.searchParams.get("g") || new URLSearchParams(u.hash.replace(/^#/, "")).get("g");
    return validCode(c) ? c : null;
  } catch (e) {
    return null;
  }
}
// Akzeptiert einen ganzen Einladungslink oder nur den Code
export function codeFromText(text) {
  const t = String(text || "").trim();
  if (validCode(t)) return t;
  const m = t.match(/[?&#]g=([A-Za-z0-9]{16,40})/);
  return m ? m[1] : null;
}
export function savedGroup() {
  const c = lsGet(GROUP_KEY);
  return validCode(c) ? c : null;
}
export function saveGroup(code) { lsSet(GROUP_KEY, code); }
export function forgetGroup() { lsDel(GROUP_KEY); }
export function inviteUrl(code) {
  const u = new URL(location.href);
  u.hash = "";
  u.search = "?g=" + code;
  u.pathname = u.pathname.replace(/index\.html$/, "");
  return u.href;
}
export function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const a = new Uint32Array(22);
  crypto.getRandomValues(a);
  return [...a].map((x) => abc[x % abc.length]).join("");
}
const DEVICE = (() => {
  let d = lsGet(DEVICE_KEY);
  if (!d) { d = uid("d"); lsSet(DEVICE_KEY, d); }
  return d;
})();

/* ---------- Was geteilt wird ---------- */
// Alles außer fertigen Runden, Tipp-Archiv und dem, was nur dieses Handy betrifft (z. B. gesehene Tipp-Auflösungen)
export const SHARED = ["name", "fca", "createdAt", "players", "round", "pending", "debts", "presence", "tipp", "lastDone"];
export function sharedOf(comp) {
  const o = {};
  for (const k of SHARED) o[k] = comp[k] === undefined ? null : comp[k];
  if (o.tipp) {
    o.tipp = { ...o.tipp };
    delete o.tipp.seen;
  }
  return o;
}
const sj = (comp) => stable(sharedOf(comp));
// Daten von außen immer prüfen und in die gewohnte Form bringen
function parseShared(cid, s) {
  let raw;
  try { raw = typeof s === "string" ? JSON.parse(s) : s; } catch (e) { return null; }
  if (!raw || typeof raw !== "object") return null;
  const c = normComp({ ...raw, id: cid, rounds: [], tippArchive: [] }, raw.name || "Meisterschaft", raw.fca === true);
  return sharedOf(c);
}

/* ---------- Zusammenführen (3 Wege: gemeinsamer Ausgangsstand, eigener Stand, fremder Stand) ---------- */
// Gleichzeitige Änderungen an diesen Stellen gehen nicht zusammen: dann gilt der fremde Stand und der eigene wird verworfen.
const CRIT = new Set(["round", "round.id", "round.picks", "round.final", "pending", "lastDone"]);
// Diese Stellen werden als Ganzes verglichen, nicht Feld für Feld
const ATOMIC = new Set(["round.picks", "round.final", "pending", "presence", "lastDone"]);
// Listen mit eindeutiger id: Einträge werden einzeln zusammengeführt
const BYID = new Set(["players", "debts", "round.pot"]);

export function merge3(base, local, remote) {
  const st = { conflict: false, paths: [] };
  const value = mergeAt("", base, local, remote, st);
  return { value, conflict: st.conflict, paths: st.paths };
}
function mergeAt(path, b, l, r, st) {
  if (eq(l, b)) return r;
  if (eq(r, b)) return l;
  if (eq(l, r)) return r;
  if (path === "tipp") return mergeTipp(b, l, r, st);
  if (!ATOMIC.has(path) && isObj(l) && isObj(r)) {
    const bo = isObj(b) ? b : {};
    const out = {};
    const keys = [...Object.keys(r), ...Object.keys(l).filter((k) => !(k in r))];
    for (const k of keys) {
      const v = mergeAt(path ? path + "." + k : k, bo[k], l[k], r[k], st);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (CRIT.has(path)) {
    st.conflict = true;
    st.paths.push(path);
    return r;
  }
  if (BYID.has(path) && Array.isArray(l) && Array.isArray(r)) return mergeById(path, Array.isArray(b) ? b : [], l, r, st);
  return r;   // gleichzeitig geändert, unkritisch: der fremde Stand gilt
}
// Tippspiel: Abgegebene Tipps gehen beim Zusammenführen nie verloren.
// Verschiedene Abende: Der neuere gilt. Gleicher Abend: Tipps je Spieler und Ergebnisse je Frage einzeln;
// gleichzeitig geändert gewinnt der spätere Tipp bzw. das von Hand eingetragene Ergebnis.
const later = (x, y) => (((x && x.at) || 0) > ((y && y.at) || 0) ? x : y);
const TIPP_EACH = {
  tips: later,
  results: (x, y) => ((x.src === "manual") !== (y.src === "manual") ? (x.src === "manual" ? x : y) : later(x, y))
};
function mergeTipp(b, l, r, st) {
  if (!isObj(l) || !isObj(r)) return r;
  if (l.day !== r.day) return String(l.day) > String(r.day) ? l : r;
  const bo = isObj(b) && b.day === l.day ? b : {};   // Ausgangsstand von einem anderen Abend zählt nicht
  const out = {};
  const keys = [...Object.keys(r), ...Object.keys(l).filter((k) => !(k in r))];
  for (const k of keys) {
    const v = TIPP_EACH[k] ? mergeEach(bo[k], l[k], r[k], TIPP_EACH[k]) : mergeAt("tipp." + k, bo[k], l[k], r[k], st);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
function mergeEach(b, l, r, win) {
  const bo = isObj(b) ? b : {}, lo = isObj(l) ? l : {}, ro = isObj(r) ? r : {};
  const out = {};
  for (const k of new Set([...Object.keys(ro), ...Object.keys(lo)])) {
    const bv = bo[k], lv = lo[k], rv = ro[k];
    let v;
    if (eq(lv, bv)) v = rv;
    else if (eq(rv, bv)) v = lv;
    else if (lv === undefined || rv === undefined) v = lv === undefined ? rv : lv;   // hier gelöscht, dort geändert: bleibt
    else v = win(lv, rv);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
// Zwei Fassungen desselben Tippspiels vereinen (Archiv): alle Tipps und Ergebnisse bleiben
export function unionGame(a, b) {
  if (!isObj(a) || a.day !== (isObj(b) && b.day)) return isObj(b) ? b : a;
  return mergeTipp(null, a, b, { conflict: false, paths: [] });
}
// Zusammenstoß (z. B. zwei Drehs gleichzeitig): Der fremde Stand gilt, die eigenen Tipps kommen trotzdem mit
export function keepTips(base, local, remote) {
  if (!isObj(remote) || !isObj(local)) return { value: remote, kept: false };
  const t = mergeAt("tipp", isObj(base) ? base.tipp : null, local.tipp, remote.tipp, { conflict: false, paths: [] });
  if (eq(t, remote.tipp)) return { value: remote, kept: false };
  return { value: { ...remote, tipp: t }, kept: true };
}
function mergeById(path, b, l, r, st) {
  const key = (x) => (x && typeof x === "object" ? x.id : undefined);
  const bm = new Map(b.map((x) => [key(x), x]));
  const lm = new Map(l.map((x) => [key(x), x]));
  const rm = new Map(r.map((x) => [key(x), x]));
  const order = [...r.map(key), ...l.map(key).filter((k) => !rm.has(k))];
  const out = [];
  for (const k of order) {
    const bi = bm.get(k), li = lm.get(k), ri = rm.get(k);
    if (li !== undefined && ri !== undefined) out.push(mergeAt(path + "[]", bi, li, ri, st));
    else if (li !== undefined) { if (bi === undefined) out.push(li); }                       // neu hier; sonst anderswo gelöscht
    else if (ri !== undefined) { if (bi === undefined || !eq(ri, bi)) out.push(ri); }        // neu dort; sonst hier gelöscht
  }
  return out;
}

/* ---------- Abgleich ---------- */
let fb = null;          // { db, fs, auth, authMod }
let signedIn = false;
let started = false;
let code = null, root = null, hooks = null;
let meta = {};          // pro Meisterschaft: rev, base (gemeinsamer Ausgangsstand), bestätigte Runden und Tipp-Tage
let online = typeof navigator === "undefined" || navigator.onLine !== false;
let lastError = null;
let readyFired = false;
const RETRY_MIN = 3000, RETRY_MAX = 20000;   // nach einem Funkloch erst schnell, dann seltener nachfragen
let retryTimer = 0, metaTimer = 0, retryMs = RETRY_MIN;
let wakeSignIn = null;  // weckt die Anmeldeschleife, sobald wieder Netz da ist
const E = new Map();
const myWids = new Set();

const findComp = (cid) => root && root.competitions.find((c) => c.id === cid);
function entry(cid) {
  let e = E.get(cid);
  if (!e) {
    const m = meta[cid] || {};
    e = {
      rev: m.rev || 0, base: typeof m.base === "string" ? m.base : null,
      rounds: new Set(m.rounds || []), days: new Set(m.days || []),
      running: null, again: false, quiet: true, silent: false, stash: null, timer: 0, roundsUnsub: null,
      seq: 0, pendingS: null, pendingAt: 0, baseP: null, baseO: null, tippsUnsub: null
    };
    E.set(cid, e);
  }
  return e;
}
// Übergabe eines Stands an die App. Die App übernimmt ihn eventuell erst nach einer laufenden Animation.
// Bis dahin gilt dieser Stand als der eigene, und es wird nichts hochgeladen: Sonst würde der veraltete Stand
// im Speicher die Änderungen der anderen Handys überschreiben.
function deliver(cid, value, info) {
  const e = entry(cid);
  e.seq++;
  e.pendingS = stable(value);
  e.pendingAt = Date.now();
  hooks.onRemote(cid, value, { ...info, seq: e.seq });
}
const localOf = (e, comp) => (e.pendingS != null ? e.pendingS : sj(comp));
function loadMeta(c) {
  try { return JSON.parse(lsGet(META_KEY + c) || "{}") || {}; } catch (e) { return {}; }
}
function saveMeta() {
  clearTimeout(metaTimer);
  metaTimer = setTimeout(() => {
    const m = {};
    for (const [cid, e] of E) if (e.rev) m[cid] = { rev: e.rev, base: e.base, rounds: [...e.rounds], days: [...e.days] };
    lsSet(META_KEY + code, JSON.stringify(m));
  }, 200);
}

async function loadSdk() {
  if (fb) return fb;
  const [appMod, authMod, fs] = await Promise.all([
    import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")
  ]);
  const app = appMod.initializeApp(FIREBASE);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) {
    db = fs.getFirestore(app);
  }
  fb = { db, fs, authMod, auth: authMod.getAuth(app) };
  return fb;
}
async function signIn() {
  const { auth, authMod } = fb;
  if (auth.authStateReady) await auth.authStateReady();
  if (!auth.currentUser) await authMod.signInAnonymously(auth);
  signedIn = true;
}
const ref = (...segs) => fb.fs.doc(fb.db, ...segs);
const compRef = (cid) => ref("groups", code, "comps", cid);

export function status() {
  let pending = false;
  if (root) {
    for (const c of root.competitions) {
      const e = E.get(c.id);
      if (!e) continue;
      if (localOf(e, c) !== e.base || c.rounds.some((r) => !e.rounds.has(r.id))) { pending = true; break; }
    }
  }
  const denied = lastError && /permission/i.test(String(lastError.code || lastError.message || ""));
  return { active: started, ready: readyFired, online: online && signedIn, pending, denied };
}
function report() {
  if (hooks && hooks.onStatus) hooks.onStatus(status());
}

export async function start(groupCode, appRoot, appHooks) {
  code = groupCode;
  root = appRoot;
  hooks = appHooks;
  meta = loadMeta(code);
  started = true;
  window.addEventListener("online", () => { online = true; wakeUp(); });
  window.addEventListener("offline", () => { online = false; report(); });
  // Zurück in der App oder wieder Netz: sofort nachsenden, nicht erst beim nächsten Versuch
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wakeUp(); });
  window.addEventListener("pageshow", wakeUp);
  window.addEventListener("focus", wakeUp);
  report();
  for (let attempt = 1; ; attempt++) {
    try {
      await loadSdk();
      await signIn();
      break;
    } catch (e) {
      lastError = e;
      online = false;
      report();
      await new Promise((res) => { wakeSignIn = res; setTimeout(res, Math.min(30000, 3000 * attempt)); });
      wakeSignIn = null;
    }
  }
  online = true;
  listen();
  flushAll();
  report();
}

function wakeUp() {
  if (!started) return;
  if (wakeSignIn) { wakeSignIn(); return; }
  retryMs = RETRY_MIN;
  flushAll();
  report();
}
function onErr(err) {
  lastError = err;
  report();
}
function listen() {
  const { fs } = fb;
  fs.onSnapshot(ref("groups", code), (snap) => {
    const fromCache = !!(snap.metadata && snap.metadata.fromCache);
    if (!snap.exists()) {
      if (!fromCache && hooks.onGroupMissing) hooks.onGroupMissing();
      return;
    }
    const d = snap.data();
    hooks.onGroup({ admin: d.admin && typeof d.admin === "object" ? d.admin : null });
  }, onErr);
  fs.onSnapshot(fs.collection(fb.db, "groups", code, "comps"), (snap) => {
    const fromCache = !!(snap.metadata && snap.metadata.fromCache);
    if (!fromCache) { online = true; lastError = null; }
    const here = new Set();
    snap.docs.forEach((d) => { here.add(d.id); onCompDoc(d.id, d.data()); });
    if (!fromCache) {
      // Auf einem anderen Handy gelöscht: war schon bestätigt und fehlt jetzt
      for (const c of root.competitions.slice()) {
        const e = E.get(c.id);
        if (!here.has(c.id) && e && e.rev > 0) dropComp(c.id);
      }
    }
    if (!readyFired && (!fromCache || snap.docs.length)) {
      readyFired = true;
      hooks.onReady();
    }
    saveMeta();
    report();
  }, onErr);
}
function dropComp(cid) {
  const e = E.get(cid);
  if (e && e.roundsUnsub) e.roundsUnsub();
  if (e && e.tippsUnsub) e.tippsUnsub();
  E.delete(cid);
  hooks.onRemoved(cid);
}

function onCompDoc(cid, d) {
  if (!d || typeof d.s !== "string") return;
  const e = entry(cid);
  ensureRounds(cid);
  ensureTipps(cid);
  if ((d.rev || 0) <= e.rev) return;
  if (myWids.has(d.wid)) { e.rev = d.rev; return; }   // eigene Änderung kommt zurück
  if (e.running) { if (!e.stash || d.rev > e.stash.rev) e.stash = d; return; }
  takeRemote(cid, d);
}
// Fremde Änderung übernehmen; eigene, noch nicht hochgeladene Änderungen bleiben erhalten, wenn möglich
function takeRemote(cid, d) {
  const e = entry(cid);
  const remote = parseShared(cid, d.s);
  if (!remote) return;
  const remoteS = stable(remote);
  const comp = findComp(cid);
  const baseS = e.base;
  const localS = comp ? localOf(e, comp) : null;
  e.rev = d.rev;
  e.base = remoteS;
  if (!comp || baseS == null || localS === baseS) {
    deliver(cid, remote, {});
    return;
  }
  const base = JSON.parse(baseS), local = JSON.parse(localS);
  const m = merge3(base, local, remote);
  if (m.conflict) {
    dropUnsentRounds(cid, e);
    const k = keepTips(base, local, remote);
    deliver(cid, k.value, { dropped: true, base, quiet: e.quiet });
    e.quiet = true;
    if (k.kept) schedule(cid);
  } else {
    deliver(cid, m.value, { merged: true });
    schedule(cid);
  }
}
function dropUnsentRounds(cid, e) {
  const comp = findComp(cid);
  if (comp) comp.rounds = comp.rounds.filter((r) => e.rounds.has(r.id));
}

// Frühere Tippspiele (für die Tippkönig-Tabelle): alle Handys sehen dasselbe Archiv
function ensureTipps(cid) {
  const e = entry(cid);
  if (e.tippsUnsub || !fb) return;
  e.tippsUnsub = fb.fs.onSnapshot(fb.fs.collection(fb.db, "groups", code, "comps", cid, "tipps"), (snap) => {
    const fromCache = !!(snap.metadata && snap.metadata.fromCache);
    if (fromCache && !snap.docs.length) return;
    const games = snap.docs.map((x) => x.data())
      .map((d) => { try { return d && typeof d.g === "string" ? normGame(JSON.parse(d.g)) : null; } catch (err) { return null; } })
      .filter(Boolean);
    games.forEach((g) => { g.seen = {}; });
    // Früher bestätigt und jetzt weg: auf einem anderen Handy zurückgesetzt
    const days = new Set(games.map((g) => g.day));
    const removed = fromCache ? [] : [...e.days].filter((d) => !days.has(d));
    if (fromCache) days.forEach((d) => e.days.add(d));
    else e.days = days;
    saveMeta();
    if ((games.length || removed.length) && hooks.onTipps) hooks.onTipps(cid, games, removed);
  }, onErr);
}
function ensureRounds(cid) {
  const e = entry(cid);
  if (e.roundsUnsub || !fb) return;
  e.roundsUnsub = fb.fs.onSnapshot(fb.fs.collection(fb.db, "groups", code, "comps", cid, "rounds"), (snap) => {
    const comp = findComp(cid);
    if (!comp) return;
    const fromCache = !!(snap.metadata && snap.metadata.fromCache);
    if (fromCache && !snap.docs.length) return;   // leerer Zwischenspeicher: nichts verwerfen
    const list = snap.docs.map((x) => ({ id: x.id, d: x.data() }))
      .filter((x) => x.d && typeof x.d.r === "string")
      .sort((a, b) => (a.d.ord || 0) - (b.d.ord || 0) || a.id.localeCompare(b.id))
      .map((x) => { try { return normRound(JSON.parse(x.d.r)); } catch (err) { return null; } })
      .filter((r) => r && r.final && r.final.winner);
    const ids = new Set(list.map((r) => r.id));
    // Noch nicht hochgeladene eigene Runden behalten; früher bestätigte, die fehlen, wurden gelöscht
    const unsent = comp.rounds.filter((r) => !ids.has(r.id) && !e.rounds.has(r.id));
    e.rounds = ids;
    const next = list.concat(unsent);
    saveMeta();
    if (stable(next.map((r) => r.id)) === stable(comp.rounds.map((r) => r.id))) return;
    hooks.onRounds(cid, next);
  }, onErr);
}

function schedule(cid, ms = 60) {
  const e = entry(cid);
  clearTimeout(e.timer);
  e.timer = setTimeout(() => flush(cid), ms);
}
function flushAll() {
  if (!root) return;
  for (const c of root.competitions) if (!c._ph) schedule(c.id, 10);
}
function retryLater() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(flushAll, retryMs);
  retryMs = Math.min(RETRY_MAX, retryMs * 2);
}
function flush(cid) {
  const e = entry(cid);
  if (!fb || !signedIn) return Promise.resolve("offline");
  if (e.running) { e.again = true; return e.running; }
  e.running = doFlush(cid)
    .then((res) => {
      if (res === "offline") retryLater();
      else if (res === "wait") schedule(cid, 400);
      else retryMs = RETRY_MIN;
      return res;
    })
    .finally(() => {
      e.running = null;
      if (e.stash) {
        const d = e.stash;
        e.stash = null;
        if ((d.rev || 0) > e.rev && !myWids.has(d.wid)) takeRemote(cid, d);
      }
      if (e.again) { e.again = false; schedule(cid); }
      report();
    });
  return e.running;
}

async function doFlush(cid) {
  const e = entry(cid);
  const comp = findComp(cid);
  if (!comp || comp._ph) return "clean";
  // Ein fremder Stand ist unterwegs zur App (sie spielt gerade etwas ab): erst danach hochladen
  if (e.pendingS != null) {
    if (Date.now() - e.pendingAt < 20000) return "wait";
    e.pendingS = null;
  }
  const localS = sj(comp);
  const newRounds = comp.rounds.filter((r) => !e.rounds.has(r.id));
  const newDays = (comp.tippArchive || []).filter((g) => !e.days.has(g.day));
  if (localS === e.base && !newRounds.length && !newDays.length) return "clean";
  const qFlag = e.quiet, sFlag = e.silent;
  const quiet = sFlag || qFlag;   // silent: der Aufrufer wartet und meldet selbst; quiet: automatische Änderung
  e.quiet = true;
  e.silent = false;
  const baseS = e.base, baseRev = e.rev;
  const { fs } = fb;
  try {
    const res = await fs.runTransaction(fb.db, async (tx) => {
      const tipRef = (day) => ref("groups", code, "comps", cid, "tipps", day);
      const oldDays = [];
      for (const g of newDays) oldDays.push(await tx.get(tipRef(g.day)));
      const snap = await tx.get(compRef(cid));
      const d = snap.exists() ? snap.data() : null;
      const rRev = d ? d.rev || 0 : 0;
      let payload = localS, merged = null;
      if (rRev !== baseRev) {
        if (!d) throw Object.assign(new Error("gone"), { gone: true });
        const remote = parseShared(cid, d.s);
        const m = merge3(baseS ? JSON.parse(baseS) : {}, JSON.parse(localS), remote);
        if (m.conflict) throw Object.assign(new Error("conflict"), { conflict: true, d, remote });
        merged = m.value;
        payload = stable(merged);
      }
      const wid = uid("w");
      myWids.add(wid);
      tx.set(compRef(cid), { rev: rRev + 1, wid, by: DEVICE, at: Date.now(), name: comp.name, fca: !!comp.fca, createdAt: comp.createdAt || 0, s: payload });
      const now = Date.now();
      newRounds.forEach((r, i) => tx.set(ref("groups", code, "comps", cid, "rounds", r.id), { ord: now + i, r: JSON.stringify(r) }));
      newDays.forEach((g, i) => {
        let game = { ...g, seen: {} };
        const od = oldDays[i] && oldDays[i].exists() ? oldDays[i].data() : null;
        if (od && typeof od.g === "string") { try { game = unionGame(normGame(JSON.parse(od.g)) || game, game); game.seen = {}; } catch (err) { /* defekt: überschreiben */ } }
        tx.set(tipRef(g.day), { day: g.day, g: JSON.stringify(game) });
      });
      return { rev: rRev + 1, payload, merged };
    });
    e.rev = res.rev;
    e.base = res.payload;
    newRounds.forEach((r) => e.rounds.add(r.id));
    newDays.forEach((g) => e.days.add(g.day));
    if (res.merged) {
      // Was in der Zwischenzeit hier noch dazukam, bleibt erhalten
      const now = findComp(cid);
      const value = now ? merge3(JSON.parse(localS), JSON.parse(sj(now)), res.merged).value : res.merged;
      deliver(cid, value, { merged: true });
    }
    online = true;
    lastError = null;
    saveMeta();
    return "ok";
  } catch (err) {
    if (err && err.conflict) {
      e.rev = err.d.rev || 0;
      e.base = stable(err.remote);
      dropUnsentRounds(cid, e);
      const base = baseS ? JSON.parse(baseS) : null;
      const k = keepTips(base, JSON.parse(localS), err.remote);
      deliver(cid, k.value, { dropped: true, base, quiet });
      if (k.kept) e.again = true;   // gerettete Tipps gleich hochladen
      saveMeta();
      return "conflict";
    }
    if (err && err.gone) { dropComp(cid); return "conflict"; }
    // Noch nicht hochgeladen: Wird das später verworfen, soll es eine Meldung geben (der Dreh wurde hier ja schon gezeigt)
    e.quiet = e.quiet && qFlag && !sFlag;
    lastError = err;
    if (!/permission/i.test(String(err && (err.code || err.message)))) online = false;
    return "offline";
  }
}

/* ---------- Für die App ---------- */
export const isActive = () => started;

// Die App hat den mit onRemote übergebenen Stand übernommen (Nummer aus info.seq)
export function applied(cid, seq) {
  const e = E.get(cid);
  if (e && seq >= e.seq) e.pendingS = null;
}

// Ist der Tipp dieses Spielers schon beim Server angekommen? null = kein Tipp oder keine Gruppe
export function tipSent(cid, pid) {
  if (!started) return null;
  const comp = findComp(cid);
  const t = comp && comp.tipp && comp.tipp.tips && comp.tipp.tips[pid];
  if (!t) return null;
  const e = E.get(cid);
  if (!e || !e.base) return false;
  if (e.baseP !== e.base) {
    e.baseP = e.base;
    try { e.baseO = JSON.parse(e.base); } catch (x) { e.baseO = null; }
  }
  const bt = e.baseO && e.baseO.tipp;
  const s = bt && bt.day === comp.tipp.day && bt.tips && bt.tips[pid];
  return !!s && ["first", "early", "half", "at"].every((k) => s[k] === t[k]);
}

// Nach jeder Änderung aufrufen. quiet: automatische Änderung, bei Verwerfen keine Meldung
export function changed(cid, quiet) {
  if (!started || !root || root._placeholder) return;
  const e = entry(cid);
  if (!quiet) e.quiet = false;
  schedule(cid);
  report();
}

// Sofort hochladen und auf das Ergebnis warten (Drehen, Schießen): "ok", "conflict", "offline" oder "local"
export async function commitNow(cid, ms = 6000) {
  if (!started) return "local";
  if (!fb || !signedIn) return "offline";
  const e = entry(cid);
  clearTimeout(e.timer);
  e.silent = true;
  e.quiet = false;
  const work = (async () => {
    for (;;) {
      if (e.running) await e.running.catch(() => {});
      const r = await flush(cid);
      if (r !== "wait") return r;
      await sleep(250);
    }
  })();
  const r = await Promise.race([work, sleep(ms).then(() => "slow")]);
  if (r === "slow") return "offline";
  return r === "clean" ? "ok" : r;
}

// Neue Gruppe anlegen und den bisherigen Stand dieses Handys hochladen. Gibt den Code zurück.
export async function createGroup(appRoot) {
  await withTimeout((async () => { await loadSdk(); await signIn(); })(), 20000);
  const newC = newCode();
  const { fs } = fb;
  const r = (...segs) => fs.doc(fb.db, "groups", newC, ...segs);
  const ops = [[r(), { createdAt: Date.now(), admin: appRoot.admin || null }]];
  const m = {};
  for (const c of appRoot.competitions) {
    const s = sj(c);
    ops.push([r("comps", c.id), { rev: 1, wid: uid("w"), by: DEVICE, at: Date.now(), name: c.name, fca: !!c.fca, createdAt: c.createdAt || 0, s }]);
    c.rounds.forEach((x, i) => ops.push([r("comps", c.id, "rounds", x.id), { ord: i, r: JSON.stringify(x) }]));
    (c.tippArchive || []).forEach((g) => ops.push([r("comps", c.id, "tipps", g.day), { day: g.day, g: JSON.stringify({ ...g, seen: {} }) }]));
    m[c.id] = { rev: 1, base: s, rounds: c.rounds.map((x) => x.id), days: (c.tippArchive || []).map((g) => g.day) };
  }
  // Gruppe zuerst, dann der Rest in Paketen
  for (let i = 0; i < ops.length; i += 400) {
    const b = fs.writeBatch(fb.db);
    ops.slice(i, i + 400).forEach(([x, data]) => b.set(x, data));
    await withTimeout(b.commit(), 25000);
  }
  lsSet(META_KEY + newC, JSON.stringify(m));
  return newC;
}

// Gibt es die Gruppe? (zum Beitreten per eingefügtem Link)
export async function groupExists(c) {
  await withTimeout((async () => { await loadSdk(); await signIn(); })(), 15000);
  const snap = await withTimeout(fb.fs.getDoc(fb.fs.doc(fb.db, "groups", c)), 15000);
  return snap.exists();
}

// Admin-PIN (Prüfwert) für alle Handys der Gruppe
export function setAdmin(admin) {
  if (!started || !fb) return;
  fb.fs.setDoc(ref("groups", code), { admin: admin || null }, { merge: true }).catch(onErr);
}

// Meisterschaft mit allen Runden löschen
export function removeComp(cid) {
  if (!started || !fb) return;
  const e = entry(cid);
  const b = fb.fs.writeBatch(fb.db);
  for (const rid of e.rounds) b.delete(ref("groups", code, "comps", cid, "rounds", rid));
  for (const day of e.days) b.delete(ref("groups", code, "comps", cid, "tipps", day));
  b.delete(compRef(cid));
  b.commit().catch(onErr);
  if (e.roundsUnsub) e.roundsUnsub();
  if (e.tippsUnsub) e.tippsUnsub();
  E.delete(cid);
  saveMeta();
}

// Statistik zurücksetzen: fertige Runden und Tipp-Archiv auf dem Server löschen
export function clearHistory(cid) {
  if (!started || !fb) return;
  const e = entry(cid);
  const b = fb.fs.writeBatch(fb.db);
  for (const rid of e.rounds) b.delete(ref("groups", code, "comps", cid, "rounds", rid));
  for (const day of e.days) b.delete(ref("groups", code, "comps", cid, "tipps", day));
  b.commit().catch(onErr);
  e.rounds = new Set();
  e.days = new Set();
  saveMeta();
}
