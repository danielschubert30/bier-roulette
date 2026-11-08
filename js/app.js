// FCA Bier-Roulette – Ablauf und Oberfläche.
import { load, save, MAX_WHEEL, MAX_ON_WHEEL, MAX_ROSTER, MAX_COMPS, PALETTE, rand, uid, cleanName, cleanTitle, newCompetition } from "./store.js";
import { createWheel, weightedIndex } from "./wheel.js";
import * as TP from "./tipp.js";
import * as SO from "./shootout.js";
import { SPIN_QUIPS, RESULT_QUIPS, FINAL_INTROS, CHAMPION_QUIPS, SHOT_TEXT, FCA_FACTS, TEMPO_QUIPS } from "./content.js";

const APP_VERSION = "1.4.0";
const NS = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

const els = {
  champPill: $("champPill"), champPillName: $("champPillName"),
  roundNo: $("roundNo"), roundState: $("roundState"), undoBtn: $("undoBtn"), presenceBtn: $("presenceBtn"),
  pot: $("pot"), notices: $("notices"),
  stageWheel: $("stageWheel"), stageFinal: $("stageFinal"), stageChamp: $("stageChamp"),
  wheel: $("wheel"), goal: $("goal"), goalBox: $("goalBox"), score: $("score"), finalCall: $("finalCall"), finalDecide: $("finalDecide"),
  champName: $("champName"), champMeta: $("champMeta"), champQuip: $("champQuip"), champOrder: $("champOrder"),
  ticker: $("ticker"), tickerLabel: $("tickerLabel"), tickerText: $("tickerText"),
  ctaZone: $("ctaZone"), cta: $("cta"),
  sheet: $("sheet"), sheetBackdrop: $("sheetBackdrop"), sheetLabel: $("sheetLabel"), sheetName: $("sheetName"),
  sheetMeta: $("sheetMeta"), sheetQuip: $("sheetQuip"), sheetUndo: $("sheetUndo"), sheetNext: $("sheetNext"),
  presenceSheet: $("presenceSheet"), presenceList: $("presenceList"), presenceNote: $("presenceNote"),
  presenceCancel: $("presenceCancel"), presenceOk: $("presenceOk"), guestForm: $("guestForm"), guestInput: $("guestInput"),
  guestRoster: $("guestRoster"), roleReg: $("roleReg"), roleGuest: $("roleGuest"),
  champCard: $("champCard"), rangeToday: $("rangeToday"), rangeSeason: $("rangeSeason"), rangeAll: $("rangeAll"),
  kpis: $("kpis"), table: $("table"), seasonSeg: $("seasonSeg"), seasonMeta: $("seasonMeta"), saldo: $("saldo"), debts: $("debts"), honors: $("honors"),
  squadNote: $("squadNote"), roster: $("roster"), addForm: $("addForm"), nameInput: $("nameInput"), addBtn: $("addBtn"),
  roundTools: $("roundTools"), abortBtn: $("abortBtn"), soundToggle: $("soundToggle"), vibeToggle: $("vibeToggle"),
  resetBtn: $("resetBtn"), version: $("version"), toast: $("toast"),
  compBtn: $("compBtn"), compName: $("compName"), compSheet: $("compSheet"), compList: $("compList"),
  compForm: $("compForm"), compInput: $("compInput"), compCopy: $("compCopy"), compFca: $("compFca"), compClose: $("compClose"),
  pinSheet: $("pinSheet"), pinTitle: $("pinTitle"), pinNote: $("pinNote"), pinForm: $("pinForm"),
  pinInput: $("pinInput"), pinInput2: $("pinInput2"), pinOk: $("pinOk"), pinCancel: $("pinCancel"),
  adminInfo: $("adminInfo"), adminSet: $("adminSet"), adminRemove: $("adminRemove"), tempo: $("tempo"),
  tippBar: $("tippBar"), tippMatch: $("tippMatch"), tippSub: $("tippSub"), tippQs: $("tippQs"),
  tippSheet: $("tippSheet"), tippLabel: $("tippLabel"), tippTitle: $("tippTitle"), tippNote: $("tippNote"),
  tippBody: $("tippBody"), tippActions: $("tippActions"),
  revealSheet: $("revealSheet"), revealLabel: $("revealLabel"), revealTitle: $("revealTitle"), revealSrc: $("revealSrc"),
  revealBody: $("revealBody"), revealActions: $("revealActions")
};

const root = load();
let state = root.competitions.find((c) => c.id === root.activeId) || root.competitions[0];   // aktive Meisterschaft
const ui = {
  tab: "game", range: "season", seasonStart: null, addAsGuest: false, renaming: null,
  spinning: false, shooting: false, sheetFor: null, sheetDebt: false, presenceCb: null,
  playingId: null,       // offenes Finale, das gerade nachgeholt wird
  champRoundId: null,    // Champion-Anzeige für ein nachgeholtes Finale
  armed: null, armTimer: null, newChamp: false, wheelSig: "", wheelIds: "", finalLine: null, lastQuip: -1,
  tipFor: null, tipDraft: null, tipDone: null,   // Tippspiel: wer gerade verdeckt tippt / zuletzt getippt hat
  reveals: [], revealing: null,   // Auflösungen, die noch angezeigt werden
  lastManual: null                // letzte Auflösung per Knopf (für „Doch nicht“)
};

const wheel = createWheel(els.wheel, { logoHref: "assets/fca-logo.png" });

/* ---------- Hilfen ---------- */
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function svg(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function btn(cls, text, onClick, disabled) {
  const b = h("button", cls, text);
  b.type = "button";
  b.disabled = !!disabled;
  b.addEventListener("click", onClick);
  return b;
}
const pick = (list) => list[Math.floor(rand() * list.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function hash(s) {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const pctF = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const beerWord = (n) => (n === 1 ? "Bier" : "Biere");

// Ein „Abend“ geht bis 6 Uhr früh – wer nach Mitternacht noch dreht, gehört zum selben Abend.
function dayStart(ts = Date.now()) {
  const d = new Date(ts);
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  d.setHours(6, 0, 0, 0);
  return d.getTime();
}
function todayKey() {
  const d = new Date(dayStart());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDay(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "") + " " +
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
// Saison wie in der Bundesliga: 1. Juli bis 30. Juni
function seasonStartOf(ts = Date.now()) {
  const d = new Date(ts);
  return new Date(d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1, 6, 1).getTime();
}
const seasonEndOf = (start) => new Date(new Date(start).getFullYear() + 1, 6, 1).getTime();
function seasonLabel(start) {
  const y = new Date(start).getFullYear();
  return `Saison ${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}
// Verkleinert eine einzeilige Überschrift, bis sie in ihre Box passt.
function fitText(el, maxPx, minPx) {
  el.style.fontSize = maxPx + "px";
  const parent = el.parentElement;
  const cs = getComputedStyle(parent);
  const avail = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
  if (avail <= 0) return;
  let size = maxPx;
  for (let i = 0; i < 12 && el.scrollWidth > avail && size > minPx; i++) {
    size = Math.max(minPx, Math.floor(size * Math.min(0.97, avail / el.scrollWidth)));
    el.style.fontSize = size + "px";
  }
}
let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3400);
}
let saveWarned = false;
function persist() {
  if (!save(root) && !saveWarned) {
    saveWarned = true;
    toast("Speichern klappt in diesem Browser nicht. Privater Modus?");
  }
}

/* ---------- Anwesenheit, Stammspieler und Gäste ---------- */
const activePlayers = () => state.players.filter((p) => !p.guest && p.active);   // Stammspieler, die mitspielen
const guestList = () => state.players.filter((p) => p.guest);
const presenceSet = () => !!state.presence && state.presence.day === todayKey();
function isGuestId(id) {
  const p = state.players.find((x) => x.id === id);
  if (p) return !!p.guest;
  const q = state.round && state.round.pot.find((x) => x.id === id);
  return !!(q && q.guest);
}
// Ohne Eintrag für heute gelten Stammspieler als da und Gäste als nicht da
const isPresent = (id) => (presenceSet() ? state.presence.ids.includes(id) : !isGuestId(id));
const presentGuests = () => guestList().filter((p) => isPresent(p.id));
const presentCount = () => activePlayers().filter((p) => isPresent(p.id)).length + presentGuests().length;
const guestSlots = () => Math.max(0, MAX_ON_WHEEL - activePlayers().length);

/* ---------- Runden und Daten ---------- */
function remaining(round) {
  const out = new Set(round.picks.map((k) => k.id));
  return round.pot.filter((p) => !out.has(p.id));
}
const remainingRegs = (r) => remaining(r).filter((p) => !p.guest);
const remainingGuests = (r) => remaining(r).filter((p) => p.guest);
// Gastrunde: Sind nur noch zwei Stammspieler übrig, kommen zuerst die Gäste dran. Das Finale bleibt unter Stammspielern.
const isGuestRound = (r) => remainingRegs(r).length <= 2 && remainingGuests(r).length > 0;
const finalDue = (r) => !r.final && remainingRegs(r).length <= 2 && remainingGuests(r).length === 0;
function wheelList(r) {
  return isGuestRound(r) ? remainingGuests(r) : remaining(r);
}
// Gäste stehen nur im Topf, solange sie an diesem Abend da sind
function syncRoundMembers() {
  const r = state.round;
  if (!r || r.final || ui.spinning || ui.sheetFor) return;
  const picked = new Set(r.picks.map((k) => k.id));
  const before = r.pot.length;
  r.pot = r.pot.filter((p) => !p.guest || picked.has(p.id) || (isPresent(p.id) && state.players.some((x) => x.id === p.id)));
  let changed = r.pot.length !== before;
  for (const g of presentGuests()) {
    if (!r.pot.some((p) => p.id === g.id)) {
      r.pot.push({ id: g.id, name: g.name, color: g.color, active: false, guest: true });
      changed = true;
    }
  }
  if (changed) persist();
}
function joinRound(p) {
  const r = state.round;
  if (!r || r.pot.some((x) => x.id === p.id)) return;
  if (r.final) { toast(`${p.name} spielt ab der nächsten Runde mit.`); return; }
  r.pot.push({ id: p.id, name: p.name, color: p.color, active: true, guest: false });
  toast(`${p.name} ist ab sofort im Topf.`);
}
// Darf jemand die laufende Runde verlassen? Gibt den Grund zurück, wenn nicht.
function leaveBlocker(id) {
  const name = (state.players.find((x) => x.id === id) || {}).name || "Er";
  const finals = [state.round, ...state.pending].filter((r) => r && r.final && !r.final.winner);
  if (finals.some((r) => r.final.a === id || r.final.b === id)) return `${name} steht im Finale. Erst danach möglich.`;
  const r = state.round;
  if (r && !r.final && remainingRegs(r).some((p) => p.id === id) && remainingRegs(r).length <= 2) return `${name} ist schon unter den letzten zwei.`;
  return null;
}
function leaveRound(id) {
  const r = state.round;
  if (!r || r.final) return;
  if (remaining(r).some((p) => p.id === id)) r.pot = r.pot.filter((p) => p.id !== id);
}
function finalRound() {
  if (ui.playingId) return state.pending.find((r) => r.id === ui.playingId) || null;
  const r = state.round;
  return r && r.final && !r.final.winner ? r : null;
}
function champRound() {
  if (ui.champRoundId) return state.rounds.find((r) => r.id === ui.champRoundId) || null;
  const r = state.round;
  return r && r.final && r.final.winner ? r : null;
}
function viewMode() {
  if (ui.champRoundId && champRound()) return "champ";
  if (ui.playingId && finalRound()) return "final";
  const r = state.round;
  if (!r) return "idle";
  if (r.final) return r.final.winner ? "champ" : "final";
  return "spin";
}
function shownRound() {
  const m = viewMode();
  if (m === "champ") return champRound();
  if (m === "final") return finalRound();
  return state.round;
}
function allRoundsAll() {
  const map = new Map();
  for (const r of state.rounds) map.set(r.id, r);
  for (const r of state.pending) if (!map.has(r.id)) map.set(r.id, r);
  if (state.round && !map.has(state.round.id)) map.set(state.round.id, state.round);
  return [...map.values()];
}
function infoOf(id, round) {
  const r = state.players.find((p) => p.id === id);
  if (r) return r;
  const sources = [round, state.round, ...state.pending, ...state.rounds.slice().reverse()].filter(Boolean);
  for (const src of sources) {
    const p = src.pot.find((x) => x.id === id);
    if (p) return p;
  }
  const d = state.debts.find((x) => x.playerId === id);
  if (d) return { id, name: d.name, color: d.color };
  return { id, name: "?", color: PALETTE[0] };
}
// Jedes Mal, wenn jemand dran war (auch als Bierschuld oder verlorenes Finale)
function duties(rounds) {
  const ev = [];
  for (const r of rounds) {
    for (const k of r.picks) ev.push({ id: k.id, at: k.at, absent: k.absent });
    if (r.final && r.final.loser) ev.push({ id: r.final.loser, at: r.final.endedAt || r.startedAt, absent: r.final.forfeit });
  }
  return ev;
}
// Tatsächlich geholte Biere: Ziehung mit Anwesenheit, verlorenes Finale, eingelöste Bierschuld
function fetchRecords() {
  const rec = [];
  for (const r of allRoundsAll()) {
    for (const k of r.picks) if (!k.absent && k.beers) rec.push({ id: k.id, at: k.at, beers: k.beers });
    const f = r.final;
    if (f && f.loser && !f.forfeit && f.beers) rec.push({ id: f.loser, at: f.endedAt, beers: f.beers });
  }
  for (const d of state.debts) if (d.settledAt && d.beers) rec.push({ id: d.playerId, at: d.settledAt, beers: d.beers });
  return rec;
}
function champion() {
  const last = state.rounds[state.rounds.length - 1];
  if (!last) return null;
  const id = last.final.winner;
  return { id, info: infoOf(id, last), since: last.final.endedAt || last.startedAt, round: last };
}
const titlesOf = (id) => state.rounds.filter((r) => r.final.winner === id).length;
function streakOf(id) {
  let n = 0;
  for (let i = state.rounds.length - 1; i >= 0 && state.rounds[i].final.winner === id; i--) n++;
  return n;
}
const openDebts = () => state.debts.filter((d) => !d.settledAt);
function newDebt(p, roundId, reason, at) {
  const d = { id: uid("d"), playerId: p.id, at, roundId, reason, name: p.name, color: p.color, settledAt: null, beers: null };
  state.debts.push(d);
  return d;
}

/* ---------- Ton, Vibration, Bildschirm ---------- */
let actx = null;
function unlockAudio() {
  if (!root.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch (e) { actx = null; }
}
const audio = () => (root.settings.sound && actx ? actx : null);
function tone(freq, start, len, vol, type = "triangle", slideTo) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  const t0 = a.currentTime + start;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + len);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + len + 0.03);
}
function noise(start, len, vol, freq) {
  const a = audio();
  if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const g = a.createGain();
  const t0 = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + len * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
  src.stop(t0 + len + 0.05);
}
const tick = () => tone(1500, 0, 0.035, 0.05, "square");
const sting = () => { tone(660, 0, 0.12, 0.08); tone(990, 0.1, 0.3, 0.08); };
const whistle = () => { tone(2900, 0, 0.16, 0.05, "sine"); tone(2900, 0.24, 0.55, 0.05, "sine"); };
const kickSound = () => noise(0, 0.07, 0.25, 320);
const cheer = () => noise(0, 1.3, 0.14, 1100);
const groan = () => tone(240, 0, 0.55, 0.06, "sawtooth", 140);
const champFanfare = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.13, i === 5 ? 0.8 : 0.16, 0.09));
function buzz(pattern) {
  if (!root.settings.vibrate || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* egal */ }
}
let wakeLock = null, wantAwake = false;
async function keepAwake() {
  wantAwake = true;
  if (wakeLock || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (e) { wakeLock = null; }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (wantAwake) keepAwake();
  renderAll(false); // neuer Abend? Dann fragt die App wieder nach der Anwesenheit
  pollLive(true);   // Tippspiel: gleich den aktuellen Stand holen
});

/* ---------- Ticker ---------- */
const decks = { fact: [], quip: [] };
function drawFrom(kind) {
  const src = kind === "fact" ? FCA_FACTS : SPIN_QUIPS;
  if (!decks[kind].length) decks[kind] = shuffle(src.map((_, i) => i));
  return src[decks[kind].pop()];
}
function spinLine() {
  if (state.fca && FCA_FACTS.length && rand() < 0.6) return { label: "FCA-Fakt", text: drawFrom("fact") };
  return { label: "Ansage", text: drawFrom("quip") };
}
function setTicker(label, text) {
  if (els.tickerLabel.textContent === label && els.tickerText.textContent === text) return;
  els.tickerLabel.textContent = label;
  els.tickerText.textContent = text;
  els.ticker.classList.remove("is-swapping");
  void els.ticker.offsetWidth;
  els.ticker.classList.add("is-swapping");
}
function finalNeedsDecision(r) {
  const f = r.final;
  return f.shots.length === 0 && (!isPresent(f.a) || !isPresent(f.b));
}
function tickerFor(mode) {
  if (mode === "idle") {
    const n = activePlayers().length;
    if (n < 2) return { label: "Kader", text: "Schalte im Kader mindestens zwei Stammspieler ein." };
    if (!presenceSet()) return { label: "Bereit", text: `Neue Runde mit ${n} im Topf. Vor dem ersten Dreh fragt die App, wer heute da ist.` };
    const g = presentGuests().length;
    return { label: "Bereit", text: `${presentCount() - g} von ${n} Stammspielern da` + (g ? ` plus ${g} ${g === 1 ? "Gast" : "Gäste"}` : "") + ". Wer fehlt, wird ausgegraut." };
  }
  if (mode === "spin") {
    const r = state.round;
    const list = wheelList(r);
    const no = r.picks.filter((k) => !k.absent).length + 1;
    if (isGuestRound(r)) {
      return { label: `Gastrunde · Bier Nr. ${no}`, text: "Nur noch die Gäste sind auf dem Rad. Das Finale bleibt unter Stammspielern." };
    }
    const away = list.filter((p) => !isPresent(p.id)).length;
    const ws = list.map((p) => weightFor(p.id));
    const sum = ws.reduce((a, b) => a + b, 0);
    const lo = Math.min(...ws) / sum, hi = Math.max(...ws) / sum;
    const risk = hi - lo < 0.005 ? `Risiko je ${pctF.format(1 / list.length)}.` : `Risiko ${pctF.format(lo)} bis ${pctF.format(hi)}, je nach Tipps.`;
    return {
      label: `Bier Nr. ${no}`,
      text: `${list.length} im Topf` + (away ? `, davon ${away} heute nicht da` : "") + `. ${risk}` + lastBeerNote()
    };
  }
  if (mode === "final") {
    const r = finalRound();
    if (finalNeedsDecision(r)) return { label: "Finale", text: "Ein Finalist fehlt heute. Ihr entscheidet: nachholen oder kampflos." };
    return ui.finalLine || { label: "Finale", text: FINAL_INTROS[0] };
  }
  const r = champRound(), f = r.final;
  const l = infoOf(f.loser, r).name;
  const next = ui.champRoundId ? " Danach geht die laufende Runde weiter." : " Danach geht es mit allen von vorne los.";
  return f.forfeit
    ? { label: "Runde vorbei", text: `${l} fehlte und verliert kampflos. Die Bierschuld bleibt offen.` + next }
    : { label: "Runde vorbei", text: `${l} holt das letzte Bier.` + next };
}

/* ---------- Spielablauf ---------- */
function startRound() {
  const regs = activePlayers();
  if (regs.length < 2) return false;
  const pot = regs.map((p) => ({ id: p.id, name: p.name, color: p.color, active: true, guest: false }))
    .concat(presentGuests().map((p) => ({ id: p.id, name: p.name, color: p.color, active: false, guest: true })));
  state.round = { id: uid("r"), startedAt: Date.now(), pot, picks: [], final: null };
  ui.newChamp = false;
  ui.wheelSig = "";
  if (finalDue(state.round)) startFinal();
  persist();
  return true;
}
function startFinal() {
  const r = state.round;
  const rem = remainingRegs(r);
  r.final = SO.newFinal(rem[0].id, rem[1].id, rand);
  const a = infoOf(rem[0].id, r).name, b = infoOf(rem[1].id, r).name;
  ui.finalLine = { label: "Finale", text: `${a} gegen ${b}. ${pick(FINAL_INTROS)}` };
  if (!finalNeedsDecision(r)) whistle();
}

async function onCta() {
  unlockAudio();
  keepAwake();
  const mode = viewMode();
  if (mode === "champ") { finishChamp(); return; }
  if (mode === "final" || ui.spinning || ui.sheetFor) return;
  if (!presenceSet()) { openPresence(onCta); return; }
  if (presentCount() < 1) {
    toast("Niemand ist als anwesend eingetragen.");
    openPresence(onCta);
    return;
  }
  if (mode === "idle" && !startRound()) {
    toast("Mindestens zwei Stammspieler im Kader einschalten.");
    return;
  }
  if (viewMode() !== "spin") { renderAll(true); return; }
  await spin();
}

function finishChamp() {
  if (ui.champRoundId) {
    ui.champRoundId = null;
  } else {
    state.round = null;
    ui.finalLine = null;
    persist();
  }
  ui.newChamp = false;
  renderAll(true);
}

async function spin() {
  if (!els.revealSheet.hidden || !els.tippSheet.hidden) return;
  const r = state.round;
  syncWheel(false);
  ui.spinning = true;
  const line = tempoLine();
  setTicker(line.label, line.text);
  const swap = reduceMotion ? null : setTimeout(() => {
    if (!ui.spinning) return;
    const l = spinLine();
    setTicker(l.label, l.text);
  }, 2900);
  renderChrome();
  renderNotices();
  const idx = weightedIndex(wheel.weights, rand());   // Chance = Feldgröße (Tippspiel), sonst für alle gleich
  const landed = await wheel.spinTo(idx, {
    rnd: rand,
    duration: reduceMotion ? 1100 : 5200 + rand() * 900,
    turns: reduceMotion ? 1 : 6 + Math.floor(rand() * 3),
    onTick: tick,
    reduceMotion
  });
  clearTimeout(swap);
  const p = wheel.players[landed];
  const absent = !isPresent(p.id);
  const rec = { id: p.id, at: Date.now(), absent, beers: absent ? null : presentCount(), debtId: null };
  if (absent) rec.debtId = newDebt(p, r.id, "pick", rec.at).id;
  r.picks.push(rec);
  persist();
  ui.spinning = false;
  wheel.highlight(p.id);
  if (absent) { groan(); buzz(80); }
  else {
    if (!reduceMotion) wheel.celebrate(p.color);
    sting();
    buzz([40, 40, 110]);
  }
  openSheet(p, absent);
  renderChrome();
  renderNotices();
}

function resultTexts(p) {
  const ev = duties(allRoundsAll());
  const mine = ev.filter((e) => e.id === p.id);
  const total = mine.length;
  const today = mine.filter((e) => e.at >= dayStart()).length;
  let meta = `holt zum ${total}. Mal`;
  if (today > 1) meta += ` · heute schon ${today}×`;

  const stats = [];
  let forced = null;
  const todayGaps = gapsOf(beerLog(dayStart()));
  const lastGap = todayGaps[todayGaps.length - 1];
  if (lastGap && lastGap.id === p.id && Date.now() - lastGap.at < 120000) {
    meta += ` · ${shortDur(lastGap.ms)} nach dem letzten Bier`;
    const seasonGaps = gapsOf(beerLog(seasonStartOf()));
    const prevSeason = seasonGaps.slice(0, -1).map((x) => x.ms);
    const prevToday = todayGaps.slice(0, -1).map((x) => x.ms);
    if (prevSeason.length >= 5 && lastGap.ms < Math.min(...prevSeason)) forced = `Saisonrekord im Biertempo: nur ${fmtDur(lastGap.ms)} seit dem letzten Bier.`;
    else if (prevToday.length >= 2 && lastGap.ms < Math.min(...prevToday)) forced = `Tagesrekord im Biertempo: nur ${fmtDur(lastGap.ms)} seit dem letzten Bier.`;
    else if (lastGap.ms >= 3600000) stats.push(`${cap(fmtDur(lastGap.ms))} Durststrecke sind vorbei. Endlich.`);
  }
  const champ = champion();
  if (champ && champ.id === p.id) stats.push("Ausgerechnet der amtierende Champion. Die Krone wackelt.");
  if (total === 1) stats.push("Premiere: das allererste Bier in der ewigen Statistik.");
  const picks = state.round.picks;
  if (picks.length === 1) {
    let s = 1;
    for (let i = state.rounds.length - 1; i >= 0; i--) {
      const first = state.rounds[i].picks[0];
      if (first && first.id === p.id) s++;
      else break;
    }
    if (s >= 2) stats.push(`${s}. Runde in Folge als Erster raus. Das nennt man Konstanz.`);
  }
  if (today >= 3) stats.push(`Heute schon das ${today}. Mal. Am Bierstand kennt man dich jetzt.`);
  const counts = new Map();
  ev.forEach((e) => counts.set(e.id, (counts.get(e.id) || 0) + 1));
  const max = Math.max(...counts.values());
  const leaders = [...counts.values()].filter((v) => v === max).length;
  if (total >= 3 && total === max && leaders === 1) stats.push(`Alleiniger Spitzenreiter der ewigen Bierholer-Tabelle: ${total}× dran.`);

  let quip;
  if (forced) quip = forced;
  else if (stats.length && rand() < 0.75) quip = stats[0];
  else {
    let i = Math.floor(rand() * RESULT_QUIPS.length);
    if (i === ui.lastQuip) i = (i + 1) % RESULT_QUIPS.length;
    ui.lastQuip = i;
    quip = RESULT_QUIPS[i];
  }
  return { meta, quip };
}

function openSheet(p, absent) {
  ui.sheetFor = p.id;
  ui.sheetDebt = absent;
  const lastTwo = finalDue(state.round);
  els.sheet.classList.toggle("is-debt", absent);
  els.sheet.style.setProperty("--c", p.color);
  els.sheetName.textContent = p.name;
  if (absent) {
    els.sheetLabel.textContent = "Bierschuld:";
    els.sheetMeta.textContent = "fehlt heute · fliegt raus und schuldet eine Runde";
    els.sheetQuip.textContent = lastTwo ? "Damit steht das Finale fest." : "Fürs aktuelle Bier wird gleich nachgedreht.";
    els.sheetNext.textContent = lastTwo ? "Weiter zum Finale" : "Nachdrehen";
  } else {
    const { meta, quip } = resultTexts(p);
    els.sheetLabel.textContent = "Bierholer:";
    els.sheetMeta.textContent = meta;
    els.sheetQuip.textContent = quip;
    els.sheetNext.textContent = lastTwo ? "Weiter zum Finale" : "Weiter";
  }
  els.sheet.hidden = false;
  els.sheetBackdrop.hidden = false;
  fitText(els.sheetName, 84, 34);
  setTimeout(() => els.sheetNext.focus({ preventScroll: true }), 60);
}
function closeSheet() {
  els.sheet.hidden = true;
  syncBackdrop();
  ui.sheetFor = null;
  ui.sheetDebt = false;
}
function sheetNext() {
  if (!ui.sheetFor) return;
  unlockAudio();
  const respin = ui.sheetDebt;
  closeSheet();
  wheel.highlight(null);
  const r = state.round;
  if (r && finalDue(r)) {
    startFinal();
    persist();
    renderAll(true);
    return;
  }
  renderAll(true);
  if (respin && viewMode() === "spin") spin();
}
function canUndo() {
  const r = state.round;
  if (!r || ui.spinning || ui.shooting || ui.playingId) return false;
  if (r.final) return !r.final.winner && r.final.shots.length === 0 && r.picks.length > 0;
  return r.picks.length > 0;
}
function undoLast() {
  if (!canUndo()) return;
  const r = state.round;
  if (r.final) { r.final = null; ui.finalLine = null; }
  const k = r.picks.pop();
  if (k.debtId) state.debts = state.debts.filter((d) => d.id !== k.debtId);
  persist();
  closeSheet();
  wheel.highlight(null);
  toast(`${infoOf(k.id, r).name} ist wieder im Topf.`);
  renderAll(true);
}

/* ---------- Finale: nachholen oder kampflos ---------- */
function postponeFinal(r) {
  r.final.postponed = true;
  if (!state.pending.some((x) => x.id === r.id)) state.pending.push(r);
  if (state.round && state.round.id === r.id) state.round = null;
  ui.finalLine = null;
  persist();
  toast("Finale verschoben. Für heute startet eine neue Runde.");
  renderAll(true);
}
function decideFinal(r, winnerId, forfeit) {
  const f = r.final;
  f.winner = winnerId;
  f.loser = SO.other(f, winnerId);
  f.endedAt = Date.now();
  if (forfeit) {
    f.forfeit = true;
    f.debtId = newDebt(infoOf(f.loser, r), r.id, "forfeit", f.endedAt).id;
  } else {
    f.beers = presentCount();
  }
  if (state.pending.some((x) => x.id === r.id)) {
    state.pending = state.pending.filter((x) => x.id !== r.id);
    ui.playingId = null;
    ui.champRoundId = r.id;
  }
  if (!state.rounds.some((x) => x.id === r.id)) state.rounds.push(clone(r));
  ui.newChamp = true;
  persist();
}
function forfeitFinal(r, awayId) {
  decideFinal(r, SO.other(r.final, awayId), true);
  champFanfare();
  buzz([60, 40, 220]);
  renderAll(true);
}
function playPending(r) {
  if (ui.spinning || ui.shooting || ui.sheetFor) return;
  unlockAudio();
  ui.playingId = r.id;
  const a = infoOf(r.final.a, r).name, b = infoOf(r.final.b, r).name;
  ui.finalLine = { label: "Nachholfinale", text: `${a} gegen ${b}. Jetzt wird nachgeholt.` };
  whistle();
  renderAll(true);
}
function settleDebt(d) {
  if (!presenceSet()) { openPresence(() => settleDebt(d)); return; }
  d.settledAt = Date.now();
  d.beers = presentCount();
  persist();
  toast(`Eingelöst: ${d.name} hat ${d.beers} ${beerWord(d.beers)} geholt.`);
  renderAll(false);
}

/* ---------- Elfmeterschießen ---------- */
let goalBuilt = false, keeperG = null, ballG = null, shotText = null;
function buildGoal() {
  const g = els.goal;
  g.replaceChildren();
  g.append(svg("rect", { class: "goal-net", x: 50, y: 36, width: 260, height: 114 }));
  for (let x = 63; x < 310; x += 13) g.append(svg("line", { class: "goal-netline", x1: x, y1: 36, x2: x, y2: 150 }));
  for (let y = 49; y < 150; y += 13) g.append(svg("line", { class: "goal-netline", x1: 50, y1: y, x2: 310, y2: y }));
  g.append(svg("path", { class: "goal-ground", d: "M0 150 H360 M24 198 H336 M24 198 L50 150 M336 198 L310 150" }));
  g.append(svg("circle", { class: "goal-spot", cx: 180, cy: 233, r: 2.5 }));
  g.append(svg("path", { class: "goal-frame", d: "M50 150 V36 H310 V150" }));

  keeperG = svg("g", { class: "keeper" });
  keeperG.append(
    svg("rect", { class: "keeper-dark", x: 169, y: 122, width: 9, height: 28, rx: 3 }),
    svg("rect", { class: "keeper-dark", x: 182, y: 122, width: 9, height: 28, rx: 3 }),
    svg("rect", { class: "keeper-dark", x: 166, y: 110, width: 28, height: 16, rx: 4 }),
    svg("rect", { class: "keeper-shirt", x: 140, y: 82, width: 28, height: 10, rx: 5 }),
    svg("rect", { class: "keeper-shirt", x: 192, y: 82, width: 28, height: 10, rx: 5 }),
    svg("rect", { class: "keeper-shirt", x: 164, y: 78, width: 32, height: 38, rx: 9 }),
    svg("circle", { class: "keeper-skin", cx: 139, cy: 87, r: 7 }),
    svg("circle", { class: "keeper-skin", cx: 221, cy: 87, r: 7 }),
    svg("circle", { class: "keeper-skin", cx: 180, cy: 66, r: 11 })
  );
  g.append(keeperG);

  ballG = svg("g", { class: "ball" });
  ballG.append(
    svg("circle", { class: "ball-body", cx: 180, cy: 222, r: 11 }),
    svg("polygon", { class: "ball-patch", points: "180,216.5 185.2,220.3 183.2,226.4 176.8,226.4 174.8,220.3" })
  );
  g.append(ballG);

  const zones = [["L", 50, 87, 93.5], ["C", 137, 86, 180], ["R", 223, 87, 266.5]];
  for (const [aim, x, w, cx] of zones) {
    const z = svg("rect", { class: "goal-zone", x, y: 36, width: w, height: 114, "data-aim": aim, role: "button", tabindex: "0" });
    z.setAttribute("aria-label", { L: "Links schießen", C: "In die Mitte schießen", R: "Rechts schießen" }[aim]);
    z.addEventListener("click", () => shoot(aim));
    z.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); shoot(aim); } });
    g.append(z, svg("circle", { class: "goal-zone-target", cx, cy: 92, r: 20 }));
  }
  shotText = svg("text", { class: "shot-text", x: 180, y: 128, "text-anchor": "middle" });
  g.append(shotText);
  goalBuilt = true;
}
function aimPoint(aim, result) {
  const x = { L: 92, C: 180, R: 268 }[aim];
  if (result === "over") return { x: x + (aim === "L" ? -8 : aim === "R" ? 8 : 0), y: 6, s: 0.5 };
  if (result === "post") return aim === "L" ? { x: 52, y: 80, s: 0.6 } : aim === "R" ? { x: 308, y: 80, s: 0.6 } : { x: 180, y: 38, s: 0.6 };
  return { x, y: aim === "C" ? 72 : 86, s: 0.6 };
}
const DIVES = {
  L: "translate(-74px, -6px) rotate(-64deg)",
  C: "translate(0px, -18px)",
  R: "translate(74px, -6px) rotate(64deg)"
};
async function animateShot(res) {
  const pt = aimPoint(res.aim, res.result);
  const dx = pt.x - 180, dy = pt.y - 222;
  const dur = reduceMotion ? 20 : 540;
  const end = `translate(${dx}px, ${dy}px) scale(${pt.s})`;
  kickSound();
  keeperG.animate([{ transform: "translate(0px, 0px) rotate(0deg)" }, { transform: DIVES[res.dive] }],
    { duration: dur, delay: reduceMotion ? 0 : 60, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" });
  await ballG.animate([{ transform: "translate(0px, 0px) scale(1)" }, { transform: end }],
    { duration: dur, easing: "cubic-bezier(.15,.7,.3,1)", fill: "forwards" }).finished.catch(() => {});
  if (res.result === "save" || res.result === "post") {
    const bx = res.result === "post" ? (res.aim === "L" ? -40 : res.aim === "R" ? 40 : 0) : dx * 0.4;
    const by = res.result === "post" && res.aim === "C" ? dy - 30 : -40;
    await ballG.animate([{ transform: end }, { transform: `translate(${bx}px, ${by}px) scale(0.8)` }],
      { duration: reduceMotion ? 20 : 380, easing: "ease-out", fill: "forwards" }).finished.catch(() => {});
  }
}
function resetGoal() {
  if (!goalBuilt) return;
  keeperG.getAnimations().forEach((a) => a.cancel());
  ballG.getAnimations().forEach((a) => a.cancel());
}
function showShotText(txt) {
  shotText.textContent = txt;
  shotText.classList.remove("is-on");
  void shotText.getBoundingClientRect();
  shotText.classList.add("is-on");
}
async function shoot(aim) {
  const r = finalRound();
  if (!r || ui.shooting || finalNeedsDecision(r)) return;
  const f = r.final;
  unlockAudio();
  keepAwake();
  ui.shooting = true;
  els.goal.classList.remove("is-ready");
  renderNotices();
  const by = SO.nextShooter(f);
  const res = SO.resolveShot(aim, rand);
  els.finalCall.textContent = `${infoOf(by, r).name} läuft an …`;
  await animateShot(res);
  f.shots.push({ by, aim: res.aim, dive: res.dive, result: res.result, at: Date.now() });
  showShotText(pick(SHOT_TEXT[res.result]));
  if (res.result === "goal") { cheer(); buzz(60); } else groan();

  const w = SO.decide(f);
  const a = infoOf(f.a, r).name, b = infoOf(f.b, r).name;
  if (w) {
    decideFinal(r, w, false);
    renderFinalScore(r);
    els.finalCall.textContent = `${infoOf(w, r).name} gewinnt ${SO.scoreLine(f)}.`;
    await wait(reduceMotion ? 600 : 1700);
    resetGoal();
    ui.shooting = false;
    champFanfare();
    buzz([60, 40, 60, 40, 220]);
    renderAll(true);
    return;
  }
  persist();
  const both = SO.taken(f, f.a) >= SO.KICKS && SO.taken(f, f.b) >= SO.KICKS;
  ui.finalLine = { label: both ? "Sudden Death" : "Elfmeterschießen", text: `${a} ${SO.goals(f, f.a)} : ${SO.goals(f, f.b)} ${b}` };
  setTicker(ui.finalLine.label, ui.finalLine.text);
  renderFinalScore(r);
  await wait(reduceMotion ? 500 : 1250);
  resetGoal();
  ui.shooting = false;
  renderGame(false);
}

/* ---------- Darstellung: Spiel ---------- */
function syncWheel(animate) {
  const mode = viewMode();
  const base = mode === "spin" ? wheelList(state.round) : mode === "idle" ? activePlayers().concat(presentGuests()) : [];
  const list = base.map((p) => ({ id: p.id, name: p.name, color: p.color, absent: !isPresent(p.id), w: weightFor(p.id) }));
  const sig = list.map((p) => p.id + p.color + p.name + (p.absent ? "-" : "+") + p.w.toFixed(2)).join("|");
  if (sig === ui.wheelSig) return;
  if (ui.revealing) return;   // Feldgrößen ändern sich erst sichtbar, wenn das Auflösungs-Fenster zu ist
  const ids = list.map((p) => p.id + p.name).join("|");
  const sameIds = ids === ui.wheelIds;
  ui.wheelSig = sig;
  ui.wheelIds = ids;
  wheel.draw(list, "Kader einschalten", { morph: !reduceMotion });
  const rotor = els.wheel.querySelector(".wheel-rotor");
  if (animate && !sameIds && !reduceMotion && rotor && rotor.animate) {
    rotor.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  }
}

function chip(p, cls, no, tag) {
  const li = h("li", "chip" + (cls ? " " + cls : ""));
  li.style.setProperty("--c", p.color);
  if (no) li.append(h("span", "chip-no", `${no}.`));
  li.append(h("span", "dot"), h("span", null, p.name));
  if (tag) li.append(h("span", "chip-tag", tag));
  if (!no) {
    const tm = tipMarks(p.id);
    if (tm) li.append(tm);
  }
  return li;
}

function renderChrome() {
  const mode = viewMode();
  const r = shownRound();
  if (ui.playingId && mode === "final") els.roundNo.textContent = "Nachholfinale";
  else if (mode === "champ" && ui.champRoundId) els.roundNo.textContent = "Nachholfinale";
  else els.roundNo.textContent = `Runde ${mode === "champ" ? state.rounds.length : state.rounds.length + 1}`;

  let stateText = "";
  if (mode === "idle") stateText = `${activePlayers().length + presentGuests().length} im Topf`;
  else if (mode === "spin") stateText = isGuestRound(r) ? "Gastrunde" : `Bier Nr. ${r.picks.filter((k) => !k.absent).length + 1}`;
  else if (mode === "final") stateText = "Finale";
  else stateText = "Entschieden";
  els.roundState.textContent = stateText;

  els.pot.replaceChildren();
  if (mode === "idle") {
    for (const p of activePlayers()) els.pot.append(chip(p, isPresent(p.id) ? "" : "is-absent", null, isPresent(p.id) ? null : "fehlt"));
    for (const p of presentGuests()) els.pot.append(chip(p, "", null, "Gast"));
  } else if (r) {
    const order = new Map(r.picks.map((k, i) => [k.id, { no: i + 1, debt: k.absent }]));
    if (r.final && r.final.loser) order.set(r.final.loser, { no: r.picks.length + 1, debt: r.final.forfeit });
    for (const p of r.pot) {
      const out = order.get(p.id);
      if (out) { els.pot.append(chip(p, "is-out" + (out.debt ? " is-debt" : ""), out.no, out.debt ? "Schuld" : p.guest ? "Gast" : null)); continue; }
      const inFinal = r.final && (r.final.a === p.id || r.final.b === p.id);
      const away = !isPresent(p.id) && mode !== "champ";
      els.pot.append(chip(p, (inFinal ? "is-final" : "") + (away ? " is-absent" : ""), null, away ? "fehlt" : p.guest ? "Gast" : null));
    }
  }

  els.pot.classList.toggle("is-dense", els.pot.children.length > 8 || (els.pot.children.length > 4 && !!els.pot.querySelector(".tmarks")));
  els.undoBtn.hidden = !((mode === "spin" || mode === "final") && canUndo() && !ui.sheetFor);
  const busy = ui.spinning || ui.shooting || !!ui.sheetFor;
  els.presenceBtn.disabled = busy;
  const gHere = presentGuests().length;
  els.presenceBtn.textContent = presenceSet()
    ? `${presentCount() - gHere}/${activePlayers().length} da` + (gHere ? ` +${gHere}` : "")
    : "Wer ist da?";
  els.presenceBtn.classList.toggle("is-due", !presenceSet());

  els.ctaZone.hidden = mode === "final";
  if (mode === "champ") {
    els.cta.textContent = ui.champRoundId ? "Weiter" : "Neue Runde";
    els.cta.classList.add("is-gold");
    els.cta.disabled = ui.shooting;
  } else {
    els.cta.textContent = "Saufen?";
    els.cta.classList.remove("is-gold");
    els.cta.disabled = ui.spinning || (mode === "idle" && activePlayers().length < 2);
  }

  const c = champion();
  els.champPill.hidden = !c;
  els.compName.textContent = state.name;
  els.compBtn.disabled = busy;
  if (c) els.champPillName.textContent = c.info.name;
}

function notice(color, strongText, rest, small, actions) {
  const row = h("div", "notice");
  row.style.setProperty("--c", color);
  const t = h("div", "notice-text");
  t.append(h("strong", null, strongText), document.createTextNode(" " + rest));
  if (small) t.append(h("small", null, small));
  const a = h("div", "notice-actions");
  actions.forEach((x) => a.append(x));
  row.append(t, a);
  return row;
}
function renderNotices() {
  els.notices.replaceChildren();
  const mode = viewMode();
  const busy = ui.spinning || ui.shooting || !!ui.sheetFor || mode === "final" || mode === "champ";
  for (const r of state.pending) {
    const f = r.final;
    const a = infoOf(f.a, r), b = infoOf(f.b, r);
    const away = [f.a, f.b].filter((id) => !isPresent(id));
    const actions = [];
    let small = `verschoben, Runde vom ${fmtDay(r.startedAt)}`;
    if (away.length === 0) {
      actions.push(btn("mini-btn", "Jetzt spielen", () => playPending(r), busy));
    } else if (away.length === 1) {
      const awayName = infoOf(away[0], r).name;
      small = `${awayName} fehlt heute`;
      const key = "ff:" + r.id;
      const armed = ui.armed === key;
      actions.push(btn("mini-btn ghost" + (armed ? " is-armed" : ""), armed ? `${awayName} verliert?` : "Kampflos", () => {
        if (ui.armed === key) { disarm(); requireAdmin("Kampflos werten", () => forfeitFinal(r, away[0])); }
        else { arm(key); renderNotices(); }
      }, busy));
    } else {
      small = "beide fehlen heute";
    }
    els.notices.append(notice(PALETTE[2], "Offenes Finale:", `${a.name} gegen ${b.name}`, small, actions));
  }
  const due = presenceSet() ? openDebts().filter((d) => isPresent(d.playerId)) : [];
  due.slice(0, 2).forEach((d) => {
    const key = "pay:" + d.id;
    const armed = ui.armed === key;
    const n = presentCount();
    const p = infoOf(d.playerId);
    els.notices.append(notice(p.color, p.name, "schuldet eine Runde", `seit ${fmtDay(d.at)}` + (d.reason === "forfeit" ? " · Finale kampflos verloren" : ""), [
      btn("mini-btn" + (armed ? " is-armed" : ""), armed ? `${n} ${beerWord(n)} geholt?` : "Eingelöst", () => {
        if (ui.armed === key) { disarm(); settleDebt(d); }
        else { arm(key); renderNotices(); }
      }, ui.spinning || ui.shooting || !!ui.sheetFor)
    ]));
  });
  if (due.length > 2) els.notices.append(h("p", "caption", `… und ${due.length - 2} weitere offene Bierschulden in der Statistik.`));
}

function renderFinalScore(r) {
  const f = r.final;
  const order = [f.first, SO.other(f, f.first)];
  const up = f.winner || finalNeedsDecision(r) ? null : SO.nextShooter(f);
  els.score.replaceChildren();
  for (const id of order) {
    const p = infoOf(id, r);
    const row = h("div", "score-row" + (id === up && !ui.shooting ? " is-up" : ""));
    row.style.setProperty("--c", p.color);
    const name = h("div", "score-name");
    name.append(h("span", "dot"), h("span", null, p.name));
    const marks = h("div", "marks");
    if (!isPresent(id) && f.shots.length === 0) {
      marks.append(h("span", "chip-tag", "fehlt"));
    } else {
      const shots = f.shots.filter((s) => s.by === id);
      const slots = Math.max(SO.KICKS, shots.length);
      for (let i = Math.max(0, slots - 7); i < slots; i++) {
        const s = shots[i];
        marks.append(h("span", "mark" + (s ? (s.result === "goal" ? " is-goal" : " is-miss") : "")));
      }
    }
    row.append(name, marks, h("span", "score-num", String(SO.goals(f, id))));
    els.score.append(row);
  }
}
function renderDecide(r) {
  const f = r.final;
  const away = [f.a, f.b].filter((id) => !isPresent(id));
  const box = els.finalDecide;
  box.replaceChildren();
  const p = h("p", "decide-text");
  if (away.length === 2) {
    p.append(document.createTextNode("Beide Finalisten fehlen heute. Das Finale wird beim nächsten Treffen nachgeholt."));
  } else {
    p.append(h("strong", null, infoOf(away[0], r).name), document.createTextNode(" fehlt heute. Wie soll das Finale entschieden werden?"));
  }
  box.append(p);
  if (ui.playingId) {
    box.append(btn("btn", "Weiter warten", () => { ui.playingId = null; renderAll(true); }));
  } else {
    box.append(btn("btn", "Nächstes Mal nachholen", () => postponeFinal(r)));
  }
  if (away.length === 1) {
    const name = infoOf(away[0], r).name;
    const key = "ffnow:" + r.id;
    const armed = ui.armed === key;
    box.append(btn("btn ghost" + (armed ? " is-armed" : ""), armed ? `Sicher? ${name} schuldet dann das Bier` : `${name} verliert kampflos`, () => {
      if (ui.armed === key) { disarm(); requireAdmin("Kampflos werten", () => forfeitFinal(r, away[0])); }
      else { arm(key); renderDecide(r); }
    }));
    box.append(h("p", "caption", `Ist ${name} doch da? Oben bei „Anwesenheit“ einschalten.`));
  }
}
function renderFinal() {
  const r = finalRound();
  renderFinalScore(r);
  const decide = finalNeedsDecision(r);
  els.finalDecide.hidden = !decide;
  els.goalBox.hidden = decide;
  els.finalCall.hidden = decide;
  if (decide) { renderDecide(r); return; }
  if (!goalBuilt) buildGoal();
  els.goal.classList.toggle("is-ready", !ui.shooting);
  if (!ui.shooting) {
    els.finalCall.replaceChildren(h("strong", null, infoOf(SO.nextShooter(r.final), r).name), document.createTextNode(" schießt. Tippe ins Tor."));
  }
}

function renderChampion() {
  const r = champRound(), f = r.final;
  const w = infoOf(f.winner, r), l = infoOf(f.loser, r);
  els.champName.textContent = w.name;
  els.champMeta.textContent = f.forfeit
    ? `Titel Nr. ${titlesOf(f.winner)} · kampflos, ${l.name} fehlte`
    : `Titel Nr. ${titlesOf(f.winner)} · ${SO.scoreLine(f)} im Elfmeterschießen gegen ${l.name}`;
  els.champQuip.textContent = CHAMPION_QUIPS[hash(r.id) % CHAMPION_QUIPS.length];
  const holers = r.picks.map((k) => infoOf(k.id, r).name + (k.absent ? " (Schuld)" : ""))
    .concat([l.name + (f.forfeit ? " (Schuld)" : "")]);
  els.champOrder.textContent = "Bierholer dieser Runde: " + holers.map((n, i) => `${i + 1}. ${n}`).join(", ");
  els.stageChamp.classList.toggle("is-new", ui.newChamp);
  requestAnimationFrame(() => fitText(els.champName, 76, 32));
}

function renderGame(animate) {
  ensureTipGame();
  syncRoundMembers();
  let mode = viewMode();
  if (mode === "spin" && finalDue(state.round) && !ui.sheetFor && !ui.spinning) {
    startFinal();
    persist();
    mode = "final";
  }
  els.stageWheel.hidden = !(mode === "idle" || mode === "spin");
  els.stageFinal.hidden = mode !== "final";
  els.stageChamp.hidden = mode !== "champ";
  if (mode === "idle" || mode === "spin") syncWheel(animate);
  if (mode === "final") renderFinal();
  if (mode === "champ") renderChampion();
  renderChrome();
  renderTipBar();
  renderNotices();
  if (!ui.spinning && !ui.shooting) {
    const t = tickerFor(mode);
    setTicker(t.label, t.text);
  }
  maybeReveal();
}

/* ---------- Anwesenheits-Abfrage ---------- */
function openPresence(cb) {
  if (ui.spinning || ui.shooting || ui.sheetFor) return;
  ui.presenceCb = cb || null;
  els.presenceList.replaceChildren();
  els.presenceList.append(h("li", "presence-head", "Stammspieler"));
  for (const p of activePlayers()) els.presenceList.append(presenceRow(p, presenceSet() ? isPresent(p.id) : true));
  const guests = guestList();
  if (guests.length) {
    els.presenceList.append(h("li", "presence-head", `Gäste · höchstens ${guestSlots()} heute`));
    for (const p of guests) els.presenceList.append(presenceRow(p, isPresent(p.id)));
  }
  els.guestInput.value = "";
  els.presenceNote.textContent = "Wer fehlt, bleibt im Topf. Wird er gezogen, fliegt er raus und schuldet eine Runde, die er beim nächsten Mal einlöst. Gäste kommen nur heute aufs Rad.";
  els.presenceSheet.hidden = false;
  els.sheetBackdrop.hidden = false;
  setTimeout(() => els.presenceOk.focus({ preventScroll: true }), 60);
}
function presenceRow(p, checked) {
  const li = h("li");
  const lab = h("label");
  lab.style.setProperty("--c", p.color);
  const cbx = document.createElement("input");
  cbx.type = "checkbox";
  cbx.id = "here-" + p.id;
  cbx.value = p.id;
  cbx.dataset.guest = p.guest ? "1" : "";
  cbx.checked = checked;
  cbx.addEventListener("change", () => {
    if (!cbx.checked || !p.guest) return;
    const guestsOn = els.presenceList.querySelectorAll('input[data-guest="1"]:checked').length;
    if (guestsOn > guestSlots()) {
      cbx.checked = false;
      toast(`Das Rad hat ${MAX_ON_WHEEL} Felder. Heute passen höchstens ${guestSlots()} Gäste dazu.`);
    }
  });
  const sw = h("span", "switch");
  sw.append(cbx, h("span", "track"));
  const name = h("span", "player-name", p.name);
  if (p.guest) name.append(h("span", "guest-tag", "Gast"));
  lab.append(h("span", "dot"), name, sw);
  li.append(lab);
  return li;
}
function addGuestHere(raw) {
  const p = addPlayer(raw, true, true);
  if (!p) return;
  if (!els.presenceList.querySelector('input[data-guest="1"]')) {
    els.presenceList.append(h("li", "presence-head", `Gäste · höchstens ${guestSlots()} heute`));
  }
  const on = els.presenceList.querySelectorAll('input[data-guest="1"]:checked').length < guestSlots();
  els.presenceList.append(presenceRow(p, on));
  if (!on) toast(`Das Rad ist voll. ${p.name} ist eingetragen, aber heute nicht auf dem Rad.`);
  els.guestInput.value = "";
}
function closePresence(apply) {
  if (els.presenceSheet.hidden) return;
  const cb = ui.presenceCb;
  ui.presenceCb = null;
  if (apply) {
    const ids = [...els.presenceList.querySelectorAll("input:checked")].map((x) => x.value);
    state.presence = { day: todayKey(), ids };
    persist();
  }
  els.presenceSheet.hidden = true;
  syncBackdrop();
  renderAll(false);
  if (apply && cb) cb();
}

/* ---------- Darstellung: Statistik ---------- */
function rangeStart() {
  if (ui.range === "today") return dayStart();
  if (ui.range === "season") return seasonStartOf();
  return 0;
}
function computeTable() {
  const t = rangeStart();
  const map = new Map();
  const entry = (id, r) => {
    if (!map.has(id)) {
      const i = infoOf(id, r);
      map.set(id, { id, name: i.name, color: i.color, guest: !!i.guest, got: 0, titles: 0, finals: 0 });
    }
    return map.get(id);
  };
  let roundsDone = 0, got = 0, first = null;
  for (const r of allRoundsAll()) {
    for (const k of r.picks) if (k.at >= t) { entry(k.id, r).got++; got++; }
    const f = r.final;
    if (f && f.winner && (f.endedAt || 0) >= t) {
      roundsDone++;
      if (first == null || r.startedAt < first) first = r.startedAt;
      entry(f.winner, r).titles++;
      entry(f.loser, r).got++;
      got++;
      entry(f.a, r).finals++;
      entry(f.b, r).finals++;
    }
  }
  const rows = [...map.values()].sort((a, b) => b.got - a.got || a.titles - b.titles || a.name.localeCompare(b.name, "de"));
  return { rows, roundsDone, got, first };
}
function computeSaldo(start) {
  const end = seasonEndOf(start);
  const rec = fetchRecords().filter((x) => x.at >= start && x.at < end);
  if (!rec.length) return null;
  const total = rec.reduce((s, x) => s + x.beers, 0);
  const avg = total / rec.length;
  const map = new Map();
  for (const x of rec) {
    if (!map.has(x.id)) { const i = infoOf(x.id); map.set(x.id, { id: x.id, name: i.name, color: i.color, guest: !!i.guest, beers: 0, count: 0 }); }
    const e = map.get(x.id);
    e.beers += x.beers;
    e.count++;
  }
  const rows = [...map.values()].map((e) => ({ ...e, soll: avg * e.count, diff: e.beers - avg * e.count }))
    .sort((a, b) => b.diff - a.diff);
  // Ausgleich: wer im Minus ist, gibt denen im Plus Bier aus (gerundet auf ganze Biere)
  const cred = rows.filter((r) => r.diff > 0.05).map((r) => ({ r, left: r.diff }));
  const debt = rows.filter((r) => r.diff < -0.05).map((r) => ({ r, left: -r.diff })).sort((a, b) => b.left - a.left);
  const transfers = [];
  for (const d of debt) {
    for (const c of cred) {
      if (d.left <= 0.05) break;
      if (c.left <= 0.05) continue;
      const amt = Math.min(d.left, c.left);
      d.left -= amt;
      c.left -= amt;
      const n = Math.round(amt);
      if (n >= 1) transfers.push({ from: d.r, to: c.r, n });
    }
  }
  return { avg, count: rec.length, rows, transfers };
}
function kpi(label, value, sub, color) {
  const d = h("div", "kpi");
  const s = h("strong", null, value);
  if (color) { d.style.setProperty("--c", color); s.style.color = "var(--c)"; }
  d.append(h("span", null, label), s, h("em", null, sub || " "));
  return d;
}
function crownIcon() {
  const s = svg("svg", { "aria-hidden": "true" });
  s.append(svg("use", { href: "#i-crown" }));
  return s;
}
function whoCell(p) {
  const who = h("div", "who");
  who.style.setProperty("--c", p.color);
  const name = h("span", null, p.name);
  if (p.guest) name.append(h("span", "guest-tag", "Gast"));
  who.append(h("span", "dot"), name);
  return who;
}
function renderStats() {
  const c = champion();
  els.champCard.replaceChildren();
  els.champCard.classList.toggle("is-empty", !c);
  els.champCard.append(crownIcon());
  if (c) {
    const streak = streakOf(c.id), t = titlesOf(c.id);
    els.champCard.append(h("div", "champ-card-name", c.info.name));
    els.champCard.append(h("div", "champ-card-meta",
      `Amtierender Champion seit ${fmtDay(c.since)} · ${t} ${t === 1 ? "Titel" : "Titel gesamt"}` + (streak > 1 ? ` · ${streak}× in Folge` : "")));
  } else {
    els.champCard.append(h("div", "champ-card-name", "Noch frei"));
    els.champCard.append(h("div", "champ-card-meta", "Wer das erste Finale gewinnt, holt sich die Krone."));
  }

  els.rangeToday.setAttribute("aria-pressed", String(ui.range === "today"));
  els.rangeSeason.setAttribute("aria-pressed", String(ui.range === "season"));
  els.rangeAll.setAttribute("aria-pressed", String(ui.range === "all"));
  const { rows, roundsDone, got, first } = computeTable();
  els.kpis.replaceChildren();
  const since = ui.range === "today" ? "seit 6 Uhr" : ui.range === "season" ? seasonLabel(seasonStartOf()).replace("Saison ", "") :
    first ? "seit " + new Date(first).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
  els.kpis.append(kpi("Runden", String(roundsDone), since));
  els.kpis.append(kpi("Geholt", String(got), "mal jemand dran"));
  const top = rows[0];
  if (top && top.got > 0) {
    const tied = rows.filter((r) => r.got === top.got).length;
    els.kpis.append(tied > 1 ? kpi("Pechvogel", `${tied} gleichauf`, `je ${top.got}× dran`) : kpi("Pechvogel", top.name, `${top.got}× dran`, top.color));
  } else {
    els.kpis.append(kpi("Pechvogel", "–", "noch offen"));
  }

  els.table.replaceChildren();
  if (!rows.length) {
    els.table.append(h("p", "empty", ui.range === "today" ? "Heute wurde noch nicht gelost." : "In diesem Zeitraum wurde noch nicht gelost."));
  } else {
    const t = h("div", "table");
    const head = h("div", "t-head");
    ["Spieler", "Geholt", "Titel", "Finale"].forEach((x) => head.append(h("span", null, x)));
    t.append(head);
    const max = Math.max(1, ...rows.map((r) => r.got));
    for (const r of rows) {
      const row = h("div", "t-row");
      row.style.setProperty("--c", r.color);
      const bar = h("div", "bar");
      const fill = h("i");
      fill.style.width = r.got ? `calc(${(r.got / max) * 100}% - 24px)` : "3px";
      bar.append(fill, h("b", null, String(r.got)));
      row.append(whoCell(r), bar, h("span", "num" + (r.titles ? " is-gold" : ""), String(r.titles)), h("span", "num", String(r.finals)));
      t.append(row);
    }
    els.table.append(t);
  }

  renderTempo();
  renderSaldo();
  renderDebtList();
  renderHonors();
}
function renderSaldo() {
  const starts = new Set([seasonStartOf()]);
  for (const x of fetchRecords()) starts.add(seasonStartOf(x.at));
  const list = [...starts].sort((a, b) => b - a);
  if (ui.seasonStart == null || !starts.has(ui.seasonStart)) ui.seasonStart = list[0];
  // Nur eine Saison: kein Umschalter, nur die Angabe. Mehrere: schlanke Knöpfe wie bei Heute/Saison/Gesamt.
  els.seasonMeta.textContent = list.length === 1 ? seasonLabel(list[0]) : "";
  els.seasonSeg.hidden = list.length < 2;
  els.seasonSeg.replaceChildren();
  if (list.length > 1) {
    for (const s of list) {
      const y = new Date(s).getFullYear();
      const b = btn(null, `${String(y % 100).padStart(2, "0")}/${String((y + 1) % 100).padStart(2, "0")}`, () => { ui.seasonStart = s; renderSaldo(); });
      b.setAttribute("aria-pressed", String(s === ui.seasonStart));
      b.setAttribute("aria-label", seasonLabel(s));
      els.seasonSeg.append(b);
    }
  }
  els.saldo.replaceChildren();
  const res = computeSaldo(ui.seasonStart);
  if (!res) {
    els.saldo.append(h("p", "empty", "In dieser Saison wurde noch kein Bier geholt."));
    return;
  }
  els.saldo.append(h("p", "caption", `Im Schnitt ${nf1.format(res.avg)} Bier pro Runde (${res.count}× geholt). Wer bei einer kleinen Runde dran war, steht im Minus und gleicht am Saisonende aus.`));
  const t = h("div", "table");
  const head = h("div", "s-head");
  ["Spieler", "Biere", "Soll", "Saldo"].forEach((x) => head.append(h("span", null, x)));
  t.append(head);
  for (const r of res.rows) {
    const row = h("div", "s-row");
    const sign = Math.abs(r.diff) < 0.05 ? "±0,0" : (r.diff > 0 ? "+" : "−") + nf1.format(Math.abs(r.diff));
    row.append(whoCell(r), h("span", "num", String(r.beers)), h("span", "num", nf1.format(r.soll)),
      h("span", "num " + (r.diff > 0.05 ? "plus" : r.diff < -0.05 ? "minus" : ""), sign));
    t.append(row);
  }
  els.saldo.append(t);
  els.saldo.append(h("h3", "kicker", "Ausgleich"));
  if (!res.transfers.length) {
    els.saldo.append(h("p", "empty", "Alles ausgeglichen. Keiner liegt ein ganzes Bier daneben."));
    return;
  }
  const ul = h("ul", "transfers");
  for (const x of res.transfers) {
    const li = h("li");
    const a = h("b", null, x.from.name), b = h("b", null, x.to.name);
    a.style.color = x.from.color;
    b.style.color = x.to.color;
    li.append(a, document.createTextNode(" gibt "), b, document.createTextNode(" aus"), h("span", "amount", `${x.n} ${beerWord(x.n)}`));
    ul.append(li);
  }
  els.saldo.append(ul);
}
function renderDebtList() {
  els.debts.replaceChildren();
  const open = openDebts();
  if (!open.length) {
    els.debts.append(h("p", "empty", "Keine offenen Bierschulden."));
    return;
  }
  const ul = h("ul", "debt-list");
  for (const d of open) {
    const key = "pay:" + d.id;
    const armed = ui.armed === key;
    const p = infoOf(d.playerId);
    const n = presentCount();
    const label = !presenceSet() ? "Eingelöst" : armed ? `${n} ${beerWord(n)} geholt?` : "Eingelöst";
    const li = h("li");
    li.append(notice(p.color, p.name, "schuldet eine Runde", `seit ${fmtDay(d.at)}` + (d.reason === "forfeit" ? " · Finale kampflos verloren" : " · gezogen, als er fehlte"), [
      btn("mini-btn" + (armed ? " is-armed" : ""), label, () => {
        if (!presenceSet() || ui.armed === key) { disarm(); settleDebt(d); }
        else { arm(key); renderDebtList(); }
      })
    ]));
    ul.append(li);
  }
  els.debts.append(ul);
}
function renderHonors() {
  els.honors.replaceChildren();
  if (!state.rounds.length) {
    els.honors.append(h("p", "empty", "Hier stehen bald alle Champions."));
    return;
  }
  const ol = h("ol", "honors");
  const list = state.rounds.slice().reverse();
  for (const r of list.slice(0, 20)) {
    const f = r.final;
    const w = infoOf(f.winner, r), l = infoOf(f.loser, r);
    const li = h("li");
    const name = h("span", "honor-name", w.name);
    name.style.color = w.color;
    li.append(crownIcon(), name, h("span", "honor-date", fmtDay(f.endedAt || r.startedAt)));
    li.append(h("span", "honor-meta", (f.forfeit ? `kampflos gegen ${l.name}` : `${SO.scoreLine(f)} i. E. gegen ${l.name}`) + ` · ${r.pot.length} Spieler`));
    ol.append(li);
  }
  els.honors.append(ol);
  if (list.length > 20) els.honors.append(h("p", "caption", `… und ${list.length - 20} ältere Runden.`));
}

/* ---------- Darstellung: Kader ---------- */
function arm(key) {
  clearTimeout(ui.armTimer);
  ui.armed = key;
  ui.armTimer = setTimeout(() => { ui.armed = null; renderAll(false); }, 3500);
}
function disarm() {
  clearTimeout(ui.armTimer);
  ui.armed = null;
}
function renderSquad() {
  const mode = viewMode();
  const running = !!state.round && (mode === "spin" || mode === "final") && !ui.playingId;
  const activeN = activePlayers().length;
  els.squadNote.textContent = `${activeN} von höchstens ${MAX_WHEEL} Stammspielern spielen mit, dazu passen an einem Abend Gäste bis zu ${MAX_ON_WHEEL} Feldern aufs Rad.`;
  const ev = duties(allRoundsAll());
  const removeBtn = (p) => {
    const armed = ui.armed === "rm:" + p.id;
    const rm = h("button", "icon-btn" + (armed ? " is-armed" : ""), armed ? "Löschen?" : "×");
    rm.type = "button";
    rm.setAttribute("aria-label", armed ? `${p.name} wirklich löschen` : `${p.name} aus dem Kader löschen`);
    rm.addEventListener("click", () => {
      if (ui.armed === "rm:" + p.id) { disarm(); requireAdmin("Löschen", () => removePlayer(p.id)); }
      else { arm("rm:" + p.id); renderSquad(); }
    });
    return rm;
  };
  const nameCell = (p) => {
    const got = ev.filter((e) => e.id === p.id).length;
    const titles = titlesOf(p.id);
    const debts = openDebts().filter((d) => d.playerId === p.id).length;
    const name = h("div", "player-name", p.name);
    name.append(h("span", "player-meta", `${got}× dran` + (p.guest ? "" : ` · ${titles} Titel`) + (debts ? ` · ${debts} offene Schuld` : "")));
    return name;
  };

  els.roster.replaceChildren();
  for (const p of state.players.filter((x) => !x.guest)) {
    const li = h("li", "player" + (p.active ? "" : " is-off"));
    li.style.setProperty("--c", p.color);
    const sw = h("label", "switch");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "on-" + p.id;
    cb.checked = p.active;
    cb.addEventListener("change", () => toggleActive(p.id, cb.checked));
    sw.append(cb, h("span", "track"), h("span", "sr", `${p.name} spielt mit`));
    li.append(h("span", "dot"), nameCell(p), sw, removeBtn(p));
    els.roster.append(li);
  }
  if (!state.players.some((x) => !x.guest)) els.roster.append(h("li", "empty", "Noch keine Stammspieler."));

  els.guestRoster.replaceChildren();
  for (const p of guestList()) {
    const li = h("li", "player is-guest");
    li.style.setProperty("--c", p.color);
    const up = btn("mini-btn ghost", "Aufnehmen", () => promoteGuest(p.id));
    up.title = "Zum Stammspieler machen";
    li.append(h("span", "dot"), nameCell(p), up, removeBtn(p));
    els.guestRoster.append(li);
  }
  if (!guestList().length) els.guestRoster.append(h("li", "empty", "Noch keine Gäste. Am einfachsten im Spiel unter „Anwesenheit“ eintragen."));

  els.roleReg.setAttribute("aria-pressed", String(!ui.addAsGuest));
  els.roleGuest.setAttribute("aria-pressed", String(ui.addAsGuest));
  const full = state.players.length >= MAX_ROSTER;
  els.nameInput.disabled = full;
  els.addBtn.disabled = full;
  els.nameInput.placeholder = full ? `Kader voll (max. ${MAX_ROSTER})` : ui.addAsGuest ? "Name des Gastes" : "Name des Stammspielers";

  els.roundTools.hidden = !running;
  const abortArmed = ui.armed === "abort";
  els.abortBtn.textContent = abortArmed ? "Wirklich abbrechen?" : "Runde abbrechen";
  els.abortBtn.classList.toggle("is-armed", abortArmed);

  els.adminInfo.textContent = hasAdmin()
    ? "Rückgängig, Löschen, Runde abbrechen, Kampflos und Zurücksetzen nur mit PIN. Nach der Eingabe bleibt es eine Minute frei."
    : "Noch keine PIN. Jeder am Handy darf rückgängig machen, löschen und zurücksetzen.";
  els.adminSet.textContent = hasAdmin() ? "Ändern" : "Festlegen";
  els.adminRemove.hidden = !hasAdmin();
  els.soundToggle.checked = root.settings.sound;
  els.vibeToggle.checked = root.settings.vibrate;
  const resetArmed = ui.armed === "reset";
  els.resetBtn.textContent = resetArmed ? "Wirklich löschen?" : "Zurücksetzen";
  els.resetBtn.classList.toggle("is-armed", resetArmed);
  els.resetBtn.disabled = !state.rounds.length && !state.round && !state.pending.length && !state.debts.length;
}
function toggleActive(id, on) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  if (on && activePlayers().length >= MAX_WHEEL) {
    toast(`Höchstens ${MAX_WHEEL} Stammspieler spielen mit.`);
    renderSquad();
    return;
  }
  if (!on) {
    const why = leaveBlocker(id);
    if (why) { toast(why); renderSquad(); return; }
  }
  p.active = on;
  if (on) {
    if (presenceSet() && !state.presence.ids.includes(id)) state.presence.ids.push(id);
    joinRound(p);
  } else if (state.round && remaining(state.round).some((x) => x.id === id)) {
    leaveRound(id);
    toast(`${p.name} verlässt die laufende Runde ohne Bierschuld.`);
  }
  persist();
  renderSquad();
  renderGame(false);
}
// Legt einen Stammspieler oder Gast an. inSheet: aus der Anwesenheits-Abfrage (dort wird die Anwesenheit erst beim Übernehmen gespeichert).
function addPlayer(raw, guest, inSheet) {
  const name = cleanName(raw);
  if (!name) { toast("Bitte einen Namen eingeben."); return null; }
  if (state.players.length >= MAX_ROSTER) { toast(`Höchstens ${MAX_ROSTER} im Kader.`); return null; }
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) { toast(`${name} ist schon im Kader.`); return null; }
  const used = new Set(state.players.map((p) => p.color.toLowerCase()));
  const color = PALETTE.find((c) => !used.has(c)) || PALETTE[state.players.length % PALETTE.length];
  const p = { id: uid(guest ? "g" : "p"), name, color, active: false, guest: !!guest };
  if (!guest) p.active = activePlayers().length < MAX_WHEEL;
  state.players.push(p);
  if (!inSheet) {
    if (!guest) {
      if (presenceSet()) state.presence.ids.push(p.id);
      if (p.active) joinRound(p);
      else toast(`${name} ist im Kader, aber ausgeschaltet. Es spielen schon ${MAX_WHEEL} mit.`);
    } else if (presenceSet() && presentGuests().length < guestSlots()) {
      state.presence.ids.push(p.id);
      toast(`${name} ist heute als Gast dabei.`);
    } else {
      toast(`${name} ist als Gast eingetragen. Unter „Anwesenheit“ kommt er aufs Rad.`);
    }
  }
  persist();
  if (!inSheet) { renderSquad(); renderGame(false); }
  return p;
}
function promoteGuest(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  p.guest = false;
  p.active = activePlayers().length < MAX_WHEEL;
  const r = state.round;
  const inPot = r && r.pot.find((x) => x.id === id);
  if (inPot) { inPot.guest = false; inPot.active = true; }
  else if (p.active) joinRound(p);
  persist();
  toast(p.active ? `${p.name} ist jetzt Stammspieler.` : `${p.name} ist jetzt Stammspieler, aber ausgeschaltet. Es spielen schon ${MAX_WHEEL} mit.`);
  renderSquad();
  renderGame(false);
}
function removePlayer(id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return;
  const why = leaveBlocker(id);
  if (why) { toast(why); renderSquad(); return; }
  const wasInRound = state.round && remaining(state.round).some((x) => x.id === id);
  leaveRound(id);
  state.players = state.players.filter((x) => x.id !== id);
  if (state.presence) state.presence.ids = state.presence.ids.filter((x) => x !== id);
  persist();
  toast(`${p.name} ist nicht mehr im Kader` + (wasInRound ? " und verlässt die Runde ohne Bierschuld." : ".") + " Die Statistik bleibt.");
  renderSquad();
  renderGame(false);
}

/* ---------- Fenster ---------- */
function syncBackdrop() {
  els.sheetBackdrop.hidden = ![els.sheet, els.presenceSheet, els.compSheet, els.pinSheet, els.tippSheet, els.revealSheet].some((x) => !x.hidden);
}

/* ---------- Biertempo ---------- */
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
function fmtDur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return "unter einer Minute";
  if (m < 60) return `${m} ${m === 1 ? "Minute" : "Minuten"}`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh} Std ${mm} Min` : `${hh} ${hh === 1 ? "Stunde" : "Stunden"}`;
}
function shortDur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} Min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} Std`;
}
// Alle tatsächlich geholten Biere ab einem Zeitpunkt, zeitlich sortiert
function beerLog(from = 0) {
  const out = [];
  for (const r of allRoundsAll()) {
    for (const k of r.picks) if (!k.absent && k.at >= from) out.push({ id: k.id, at: k.at });
    const f = r.final;
    if (f && f.loser && !f.forfeit && f.endedAt && f.endedAt >= from) out.push({ id: f.loser, at: f.endedAt });
  }
  for (const d of state.debts) if (d.settledAt && d.settledAt >= from) out.push({ id: d.playerId, at: d.settledAt });
  return out.sort((a, b) => a.at - b.at);
}
// Abstände zwischen zwei Bieren am selben Abend
function gapsOf(log) {
  const g = [];
  for (let i = 1; i < log.length; i++) {
    if (dayStart(log[i].at) !== dayStart(log[i - 1].at)) continue;
    g.push({ ms: log[i].at - log[i - 1].at, at: log[i].at, id: log[i].id });
  }
  return g;
}
function sinceLastBeer() {
  const log = beerLog(dayStart());
  return log.length ? Date.now() - log[log.length - 1].at : null;
}
function tempoBucket(ms) {
  const m = ms / 60000;
  return m < 10 ? "turbo" : m < 20 ? "fast" : m < 35 ? "normal" : m < 60 ? "slow" : "drought";
}
function tempoLine() {
  const gap = sinceLastBeer();
  if (gap == null) return { label: "Anstich", text: pick(TEMPO_QUIPS.first) };
  return { label: `Takt · ${shortDur(gap)}`, text: cap(pick(TEMPO_QUIPS[tempoBucket(gap)]).replace("{t}", fmtDur(gap))) };
}
function lastBeerNote() {
  const gap = sinceLastBeer();
  return gap == null ? "" : ` Letztes Bier vor ${fmtDur(gap)}.`;
}
function timeline(log) {
  const start = log[0].at;
  const end = Math.max(log[log.length - 1].at, start + 60000);
  const wrap = h("div", "timeline");
  const track = h("div", "tl-track");
  for (const e of log) {
    const i = infoOf(e.id);
    const d = h("span", "tl-dot");
    d.style.setProperty("--c", i.color);
    d.style.left = `${((e.at - start) / (end - start)) * 100}%`;
    d.title = `${fmtTime(e.at)} ${i.name}`;
    track.append(d);
  }
  const axis = h("div", "tl-axis");
  axis.append(h("span", null, fmtTime(start)), h("span", null, `${log.length} ${beerWord(log.length)}`), h("span", null, fmtTime(end)));
  wrap.append(track, axis);
  return wrap;
}
function record(label, value, meta) {
  const li = h("li");
  li.append(h("span", "rec-label", label), h("span", "rec-value", value), h("span", "rec-meta", meta));
  return li;
}
function renderTempo() {
  const box = els.tempo;
  box.replaceChildren();
  const today = beerLog(dayStart());
  const season = beerLog(seasonStartOf());
  if (!today.length && !season.length) {
    box.append(h("p", "empty", "Sobald Biere geholt werden, misst die App hier den Takt zwischen den Bieren."));
    return;
  }
  if (today.length) {
    const g = gapsOf(today);
    const k = h("div", "kpis");
    k.append(kpi("Heute", String(today.length), `${beerWord(today.length)} seit ${fmtTime(today[0].at)}`));
    if (g.length) {
      const avg = g.reduce((t, x) => t + x.ms, 0) / g.length;
      const fast = g.reduce((a, b) => (b.ms < a.ms ? b : a));
      const fi = infoOf(fast.id);
      k.append(kpi("Ø Takt", shortDur(avg), "zwischen zwei Bieren"));
      k.append(kpi("Bestzeit", shortDur(fast.ms), fi.name, fi.color));
    } else {
      k.append(kpi("Ø Takt", "–", "ab zwei Bieren"));
      k.append(kpi("Bestzeit", "–", "ab zwei Bieren"));
    }
    box.append(k, timeline(today));
  } else {
    box.append(h("p", "empty", "Heute wurde noch kein Bier geholt."));
  }
  const sg = gapsOf(season);
  if (sg.length) {
    const fast = sg.reduce((a, b) => (b.ms < a.ms ? b : a));
    const slow = sg.reduce((a, b) => (b.ms > a.ms ? b : a));
    const avg = sg.reduce((t, x) => t + x.ms, 0) / sg.length;
    const ul = h("ul", "records");
    ul.append(
      record("Schnellstes Bier der Saison", shortDur(fast.ms), `${infoOf(fast.id).name} · ${fmtDay(fast.at)}, ${fmtTime(fast.at)}`),
      record("Längste Durststrecke", shortDur(slow.ms), `bis ${infoOf(slow.id).name} holte · ${fmtDay(slow.at)}, ${fmtTime(slow.at)}`),
      record("Ø Takt der Saison", shortDur(avg), `aus ${sg.length} Abständen an ${new Set(season.map((x) => dayStart(x.at))).size} Abenden`)
    );
    box.append(ul);
  }
}
// Ticker in Ruhe regelmäßig auffrischen („Letztes Bier vor …“)
setInterval(() => {
  if (document.visibilityState !== "visible" || ui.tab !== "game" || ui.spinning || ui.shooting || ui.sheetFor) return;
  const t = tickerFor(viewMode());
  setTicker(t.label, t.text);
}, 30000);

/* ---------- Admin ---------- */
const ADMIN_WINDOW = 60 * 1000;   // nach der PIN-Eingabe eine Minute frei
let adminUntil = 0;
const pinFlow = { mode: null, cb: null };
const hasAdmin = () => !!root.admin;
function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ":" + pin);
  if (crypto.subtle) return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
  // Notlösung ohne sichere Verbindung (nur lokal beim Testen)
  let x = 0x811c9dc5;
  for (const b of data) x = Math.imul(x ^ b, 16777619) >>> 0;
  return x.toString(16).padStart(8, "0").repeat(8);
}
function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return toHex(a);
}
// Führt eine geschützte Aktion aus – mit PIN, falls ein Admin festgelegt ist
function requireAdmin(what, fn) {
  if (!hasAdmin() || Date.now() < adminUntil) { fn(); return; }
  openPin("check", what, fn);
}
function openPin(mode, what, cb) {
  pinFlow.mode = mode;
  pinFlow.cb = cb || null;
  els.pinInput.value = "";
  els.pinInput2.value = "";
  els.pinInput2.hidden = mode !== "set";
  els.pinTitle.textContent = mode === "set" ? "Neue Admin-PIN" : "Admin-PIN";
  els.pinNote.textContent = mode === "set"
    ? "4 bis 8 Ziffern, zweimal eingeben. Gut merken: Ohne PIN lassen sich diese Funktionen nicht mehr freischalten."
    : `${what} darf nur der Admin.`;
  els.pinOk.textContent = mode === "set" ? "Speichern" : "Freischalten";
  els.pinSheet.hidden = false;
  els.sheetBackdrop.hidden = false;
  setTimeout(() => els.pinInput.focus(), 80);
}
function closePin() {
  els.pinSheet.hidden = true;
  pinFlow.mode = null;
  pinFlow.cb = null;
  syncBackdrop();
}
async function submitPin() {
  const pin = els.pinInput.value.trim();
  if (!/^[0-9]{4,8}$/.test(pin)) { toast("Die PIN hat 4 bis 8 Ziffern."); return; }
  const cb = pinFlow.cb;
  if (pinFlow.mode === "set") {
    if (pin !== els.pinInput2.value.trim()) { toast("Die beiden Eingaben sind unterschiedlich."); return; }
    const salt = randomSalt();
    root.admin = { salt, hash: await hashPin(pin, salt) };
    adminUntil = Date.now() + ADMIN_WINDOW;
    persist();
    closePin();
    toast("Admin-PIN gespeichert.");
    renderSquad();
    if (cb) cb();
    return;
  }
  if (!root.admin || (await hashPin(pin, root.admin.salt)) !== root.admin.hash) {
    els.pinInput.value = "";
    toast("Falsche PIN.");
    buzz(150);
    return;
  }
  adminUntil = Date.now() + ADMIN_WINDOW;
  closePin();
  if (cb) cb();
}

/* ---------- Meisterschaften ---------- */
const busyNow = () => ui.spinning || ui.shooting || !!ui.sheetFor;
function lastChampOf(c) {
  const r = c.rounds[c.rounds.length - 1];
  if (!r) return null;
  const id = r.final.winner;
  const p = c.players.find((x) => x.id === id) || r.pot.find((x) => x.id === id);
  return p ? p.name : null;
}
function resetUi() {
  disarm();
  closeSheet();
  els.tippSheet.hidden = true;
  els.revealSheet.hidden = true;
  syncBackdrop();
  ui.tipFor = null;
  ui.tipDraft = null;
  ui.reveals = [];
  ui.revealing = null;
  ui.lastManual = null;
  ui.wheelIds = "";
  resetGoal();
  wheel.highlight(null);
  ui.playingId = null;
  ui.champRoundId = null;
  ui.newChamp = false;
  ui.finalLine = null;
  ui.wheelSig = "";
  ui.seasonStart = null;
  ui.renaming = null;
}
function openComp() {
  if (busyNow()) return;
  ui.renaming = null;
  els.compInput.value = "";
  els.compCopy.checked = true;
  els.compFca.checked = false;
  renderCompList();
  els.compSheet.hidden = false;
  els.sheetBackdrop.hidden = false;
}
function closeComp() {
  els.compSheet.hidden = true;
  ui.renaming = null;
  syncBackdrop();
}
function renderCompList() {
  els.compList.replaceChildren();
  for (const c of root.competitions) {
    const active = c.id === state.id;
    const li = h("li", "comp" + (active ? " is-active" : ""));
    if (ui.renaming === c.id) {
      const f = h("form", "comp-rename");
      const inp = document.createElement("input");
      inp.type = "text";
      inp.id = "renameInput";
      inp.maxLength = 24;
      inp.value = c.name;
      inp.setAttribute("aria-label", "Neuer Name");
      const ok = h("button", "mini-btn", "OK");
      ok.type = "submit";
      f.append(inp, ok);
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = cleanTitle(inp.value);
        if (name) c.name = name;
        ui.renaming = null;
        persist();
        renderCompList();
        renderChrome();
      });
      li.append(f);
      els.compList.append(li);
      setTimeout(() => inp.focus(), 40);
      continue;
    }
    const main = h("button", "comp-main");
    main.type = "button";
    const champ = lastChampOf(c);
    const n = c.rounds.length;
    main.append(
      h("span", "comp-name", c.name),
      h("span", "comp-meta", `${n} ${n === 1 ? "Runde" : "Runden"} · ${champ ? "Champion " + champ : "noch kein Champion"}` + (active ? " · aktiv" : ""))
    );
    main.addEventListener("click", () => switchComp(c.id));
    li.append(main);
    const acts = h("div", "comp-actions");
    if (active) acts.append(btn("mini-btn ghost", "Umbenennen", () => { ui.renaming = c.id; renderCompList(); }));
    if (root.competitions.length > 1) {
      const key = "comp:" + c.id;
      const armed = ui.armed === key;
      const del = btn("icon-btn" + (armed ? " is-armed" : ""), armed ? "Löschen?" : "×", () => {
        if (ui.armed === key) { disarm(); requireAdmin("Meisterschaft löschen", () => deleteComp(c.id)); }
        else { arm(key); renderCompList(); }
      });
      del.setAttribute("aria-label", armed ? `${c.name} mit allen Daten löschen` : `${c.name} löschen`);
      acts.append(del);
    }
    li.append(acts);
    els.compList.append(li);
  }
}
function switchComp(id) {
  if (busyNow()) return;
  if (id === state.id) { closeComp(); return; }
  const c = root.competitions.find((x) => x.id === id);
  if (!c) return;
  resetUi();
  root.activeId = c.id;
  state = c;
  persist();
  closeComp();
  renderAll(true);
  toast(`Jetzt aktiv: ${c.name}`);
  pollLive(true);
}
function createComp() {
  const name = cleanTitle(els.compInput.value);
  if (!name) { toast("Bitte einen Namen eingeben."); return; }
  if (root.competitions.length >= MAX_COMPS) { toast(`Höchstens ${MAX_COMPS} Meisterschaften.`); return; }
  if (root.competitions.some((c) => c.name.toLowerCase() === name.toLowerCase())) { toast(`„${name}“ gibt es schon.`); return; }
  const players = els.compCopy.checked ? state.players.map((p) => ({ ...p })) : [];
  const c = newCompetition(name, els.compFca.checked, players);
  root.competitions.push(c);
  persist();
  switchComp(c.id);
  if (!players.length) toast(`„${name}“ angelegt. Trag im Kader die Mitspieler ein.`);
}
function deleteComp(id) {
  const c = root.competitions.find((x) => x.id === id);
  if (!c || root.competitions.length < 2) return;
  root.competitions = root.competitions.filter((x) => x.id !== id);
  if (state.id === id) {
    resetUi();
    state = root.competitions[0];
    root.activeId = state.id;
  }
  persist();
  toast(`„${c.name}“ gelöscht.`);
  renderCompList();
  renderAll(true);
}

/* ---------- Tippspiel ---------- */
// Drei feste Fragen vor dem Anpfiff (Regeln und Auswertung in js/tipp.js). Nur bei Meisterschaften mit „FCA-Spieltag“.
const tippOn = () => !!state.fca;
const tipGame = () => (tippOn() && state.tipp && state.tipp.day === todayKey() ? state.tipp : null);
const tipCount = (g) => (g ? Object.keys(g.tips).length : 0);
const tipLocked = (g) => TP.isLocked(g, Date.now());
const oppOf = (g) => (g && g.match && g.match.opp) || "Gegner";
const fieldPct = (w) => `${Math.round(w * 100)}\u00a0%`;
function ensureTipGame() {
  if (!tippOn()) return null;
  const day = todayKey();
  if (state.tipp && state.tipp.day === day) return state.tipp;
  if (state.tipp && tipCount(state.tipp)) {
    state.tippArchive.push(state.tipp);
    if (state.tippArchive.length > 60) state.tippArchive.splice(0, state.tippArchive.length - 60);
  }
  state.tipp = TP.newGame(day);
  ui.reveals = [];
  persist();
  return state.tipp;
}
function weightFor(id) {
  const g = tipGame();
  return g ? TP.weightOf(g, id) : 1;
}
function tipPerson(g, pid) {
  const p = state.players.find((x) => x.id === pid);
  if (p) return p;
  const t = g.tips[pid];
  return { id: pid, name: t ? t.name : "?", color: t ? t.color : PALETTE[0] };
}
// Wer heute tippen kann: anwesende Stammspieler und Gäste, dazu alle, die schon getippt haben
function tipPeople(g) {
  const list = activePlayers().filter((p) => isPresent(p.id)).concat(presentGuests());
  if (g) for (const pid of Object.keys(g.tips)) if (!list.some((p) => p.id === pid)) list.push(tipPerson(g, pid));
  return list;
}
function icon(id, cls) {
  const s = svg("svg", { class: cls || "ico", "aria-hidden": "true" });
  s.append(svg("use", { href: "#" + id }));
  return s;
}
function kickText(ts) {
  if (!ts) return "";
  return dayStart(ts) === dayStart() ? fmtTime(ts) : `${fmtDay(ts).split(" ")[0]} ${fmtTime(ts)}`;
}
function matchLine(g) {
  const m = g.match;
  if (m && m.id) return `${m.fcaFirst ? "FCA" : m.opp} gegen ${m.fcaFirst ? m.opp : "FCA"}, Anpfiff ${kickText(m.kickoff)}`;
  if (m) return "Kein FCA-Spiel von heute in den Live-Daten. Getippt wird trotzdem, aufgelöst dann per Knopf.";
  return LIVE.failed ? "Live-Daten gerade nicht erreichbar. Getippt wird trotzdem." : "Suche das heutige FCA-Spiel …";
}
function liveLine(g) {
  if (!g.match || !g.match.id) return "Ohne Live-Daten: Wer es im Stadion sieht, tippt das Ergebnis an.";
  if (LIVE.failed) return "Live-Ticker gerade nicht erreichbar. Wer es sieht, tippt das Ergebnis an.";
  if (LIVE.ok) return `Live-Ticker zuletzt ${fmtTime(LIVE.ok)}. Schneller geht es per Knopf.`;
  return "Live-Ticker wird abgefragt …";
}
// Drei kleine Punkte am Namen: richtig, daneben, offen
function tipMarks(id) {
  const g = tipGame();
  if (!g || !g.tips[id] || !tipLocked(g)) return null;
  const s = TP.scoreOf(g, id);
  const wrap = h("span", "tmarks");
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", `Tipps: ${s.right} richtig, ${s.wrong} daneben, ${s.open} offen`);
  s.marks.forEach((m) => wrap.append(h("i", "tm tm-" + m)));
  return wrap;
}

function renderTipBar() {
  const bar = els.tippBar;
  const g = tipGame();
  const mode = viewMode();
  const n = tipCount(g);
  const locked = g ? tipLocked(g) : false;
  const show = !!g && (mode === "idle" || mode === "spin") && !(locked && n === 0);
  bar.hidden = !show;
  if (!show) return;
  bar.disabled = ui.spinning || ui.shooting || !!ui.sheetFor;
  const m = g.match && g.match.id ? g.match : null;
  els.tippMatch.textContent = m ? `gegen ${m.opp}` + (locked ? "" : ` · ${kickText(m.kickoff)}`) : "";
  els.tippQs.replaceChildren();
  let sub;
  if (!locked) {
    sub = n ? `${n} von ${Math.max(n, tipPeople(g).length)} haben getippt` : "Vor dem Anpfiff tippen";
  } else {
    const done = TP.QUESTIONS.filter((q) => g.results[q.id]).length;
    sub = done === 3 ? "Alles entschieden" : `${done} von 3 entschieden`;
    for (const q of TP.QUESTIONS) {
      const r = g.results[q.id];
      els.tippQs.append(h("i", "tq-dot" + (r ? (r.v === "void" ? " is-void" : " is-done") : "")));
    }
  }
  els.tippSub.textContent = sub;
  bar.classList.toggle("is-due", !locked && n === 0);
}

/* Tipp-Fenster */
function openTipp() {
  if (busyNow() || !els.revealSheet.hidden) return;
  const g = ensureTipGame();
  if (!g) return;
  ui.tipDone = null;
  ui.tipFor = null;
  ui.tipDraft = null;
  disarm();
  els.tippSheet.hidden = false;
  els.sheetBackdrop.hidden = false;
  renderTipp();
  els.tippSheet.scrollTop = 0;
  pollLive(true);
}
function closeTipp() {
  if (els.tippSheet.hidden) return;
  els.tippSheet.hidden = true;
  ui.tipFor = null;
  ui.tipDraft = null;
  disarm();
  syncBackdrop();
  renderAll(true);
}
function renderTipp() {
  if (els.tippSheet.hidden) return;
  const g = tipGame();
  if (!g) { closeTipp(); return; }
  const locked = tipLocked(g);
  els.tippBody.replaceChildren();
  els.tippActions.replaceChildren();
  els.tippActions.className = "sheet-actions";
  els.tippLabel.textContent = "Tippspiel";
  if (ui.tipFor && locked) {
    ui.tipFor = null;
    ui.tipDraft = null;
    toast("Anpfiff ist durch, die Tipps sind zu.");
  }
  if (ui.tipFor) renderTipForm(g);
  else if (!locked) renderTipList(g);
  else renderTipLive(g);
}
function renderTipList(g) {
  els.tippTitle.textContent = "Wer tippt?";
  els.tippNote.textContent = matchLine(g);
  if (ui.tipDone) {
    const ok = h("p", "tipp-ok");
    ok.append(icon("i-check"), document.createTextNode(`${ui.tipDone} hat getippt. Handy weitergeben.`));
    els.tippBody.append(ok);
  }
  const ul = h("ul", "tipp-people");
  const people = tipPeople(g);
  for (const p of people) {
    const done = !!g.tips[p.id];
    const li = h("li");
    const b = h("button", "tipp-person" + (done ? " is-done" : ""));
    b.type = "button";
    b.style.setProperty("--c", p.color);
    const st = h("span", "tipp-state");
    if (done) st.append(icon("i-check"), document.createTextNode("getippt"));
    else st.textContent = "Tippen";
    b.append(h("span", "dot"), h("span", "player-name", p.name), st);
    b.addEventListener("click", () => {
      ui.tipDone = null;
      ui.tipFor = p.id;
      ui.tipDraft = { first: null, early: null, half: null };
      disarm();
      renderTipp();
      els.tippSheet.scrollTop = 0;
    });
    li.append(b);
    ul.append(li);
  }
  if (!people.length) ul.append(h("li", "empty", "Heute ist noch niemand als anwesend eingetragen."));
  els.tippBody.append(ul);
  els.tippBody.append(btn("link-btn tipp-who", "Fehlt jemand? Anwesenheit ändern", () => { closeTipp(); openPresence(openTipp); }));
  els.tippBody.append(h("p", "caption", "Drei Fragen, immer dieselben. Jede richtige Antwort macht dein Feld auf dem Rad ein Viertel kleiner, jede falsche ein Viertel größer. Gilt den ganzen Abend."));
  const ko = g.match && g.match.kickoff;
  if (ko) {
    els.tippBody.append(h("p", "caption", `Die Tipps schließen automatisch um ${fmtTime(ko + TP.LOCK_GRACE)}.`));
    els.tippActions.className = "sheet-actions sheet-actions-single";
    els.tippActions.append(btn("sheet-next", "Fertig", closeTipp));
    return;
  }
  const key = "tipplock";
  const armed = ui.armed === key;
  const lock = btn("sheet-undo" + (armed ? " is-armed" : ""), armed ? "Wirklich zu?" : "Tipps zu", () => {
    if (ui.armed !== key) { arm(key); renderTipp(); return; }
    disarm();
    g.locked = Date.now();
    persist();
    renderTipp();
    renderGame(false);
  });
  els.tippActions.append(lock, btn("sheet-next", "Fertig", closeTipp));
}
function renderTipForm(g) {
  const p = tipPerson(g, ui.tipFor);
  const d = ui.tipDraft;
  els.tippLabel.textContent = "Tippspiel · verdeckt";
  els.tippTitle.textContent = p.name;
  els.tippNote.textContent = "Nur du schaust hin. Die Tipps bleiben bis zum Anpfiff verdeckt.";
  TP.QUESTIONS.forEach((q, i) => {
    const box = h("div", "tq");
    box.append(h("p", "tq-text", `${i + 1}. ${q.text}`));
    const row = h("div", "tq-opts");
    for (const v of q.opts) {
      const b = btn("tq-opt", TP.optLabel(v, oppOf(g)), () => { d[q.id] = v; renderTipp(); });
      b.setAttribute("aria-pressed", String(d[q.id] === v));
      row.append(b);
    }
    box.append(row);
    els.tippBody.append(box);
  });
  els.tippBody.append(h("p", "caption", "Fällt im ganzen Spiel kein Tor, zählt Frage 1 nicht. Unentschieden zur Pause heißt bei Frage 3 Nein."));
  const ready = TP.QUESTIONS.every((q) => d[q.id]);
  els.tippActions.append(
    btn("sheet-undo", "Zurück", () => { ui.tipFor = null; ui.tipDraft = null; renderTipp(); }),
    btn("sheet-next", "Tipp abgeben", () => submitTip(g, p), !ready)
  );
}
function submitTip(g, p) {
  if (tipLocked(g)) { ui.tipFor = null; renderTipp(); toast("Zu spät: Die Tipps sind schon zu."); return; }
  const d = ui.tipDraft;
  g.tips[p.id] = { first: d.first, early: d.early, half: d.half, at: Date.now(), name: p.name, color: p.color };
  ui.tipFor = null;
  ui.tipDraft = null;
  ui.tipDone = p.name;
  persist();
  renderTipp();
  renderTipBar();
  els.tippSheet.scrollTop = 0;
}
const MANUAL_OPTS = {
  first: [["fca", 0], ["opp", 0], ["void", 90]],
  early: [["yes", 0], ["no", 30]],
  half: [["yes", 45], ["no", 45]]
};
const MANUAL_LATER = { first: "„Kein Tor“ geht ab der 90. Minute.", early: "„Nein“ geht ab der 30. Minute.", half: "Geht ab der Halbzeit." };
function renderTipLive(g) {
  const done = TP.QUESTIONS.filter((q) => g.results[q.id]).length;
  els.tippTitle.textContent = done === 3 ? "Alles entschieden" : "Läuft";
  els.tippNote.textContent = (g.match && g.match.id ? matchLine(g) + ". " : "") + liveLine(g);
  const now = Date.now();
  const ko = g.match && g.match.kickoff;
  const opp = oppOf(g);
  const list = h("div", "tres-list");
  TP.QUESTIONS.forEach((q, i) => {
    const r = g.results[q.id];
    const box = h("div", "tres" + (r ? " is-done" : ""));
    const top = h("div", "tres-top");
    top.append(h("span", "tres-q", `${i + 1}. ${q.text}`));
    box.append(top);
    if (r) {
      top.append(h("span", "tres-v" + (r.v === "void" ? " is-void" : ""), TP.optLabel(r.v, opp)));
      const meta = h("div", "tres-meta");
      meta.append(h("span", null, (r.src === "live" ? "laut Live-Ticker" : "von Hand eingetragen") + `, ${fmtTime(r.at)}`));
      meta.append(btn("link-btn", "Ändern", () => requireAdmin("Tipp-Auflösung ändern", () => clearResult(q.id))));
      box.append(meta);
      const ls = g.liveSays[q.id];
      if (r.src === "manual" && ls && ls !== r.v) {
        const hint = h("div", "tres-hint");
        hint.append(h("span", null, `Live-Ticker meldet: ${TP.optLabel(ls, opp)}`),
          btn("mini-btn ghost", "Übernehmen", () => requireAdmin("Live-Ergebnis übernehmen", () => setResult(q.id, ls, "live"))));
        box.append(hint);
      }
    } else {
      top.append(h("span", "tres-v is-open", "offen"));
      const row = h("div", "tres-opts");
      let later = false;
      for (const [v, min] of MANUAL_OPTS[q.id]) {
        const ok = !ko || now >= ko + min * 60000;
        if (!ok) later = true;
        row.append(btn("mini-btn ghost", v === "void" ? "Kein Tor" : TP.optLabel(v, opp), () => setResult(q.id, v, "manual"), !ok));
      }
      box.append(row);
      if (later) box.append(h("p", "tres-note", MANUAL_LATER[q.id]));
    }
    list.append(box);
  });
  els.tippBody.append(list);

  els.tippBody.append(h("h3", "kicker tipp-kicker", "Tipps und Feldgröße"));
  const t = h("div", "table tipp-table");
  const head = h("div", "tt-row tt-head");
  head.append(h("span", null, "Spieler"), ...TP.QUESTIONS.map((q) => h("span", null, q.short)), h("span", null, "Feld"));
  t.append(head);
  const tippers = Object.keys(g.tips).map((pid) => tipPerson(g, pid))
    .sort((a, b) => TP.weightOf(g, a.id) - TP.weightOf(g, b.id) || a.name.localeCompare(b.name, "de"));
  for (const p of tippers) {
    const s = TP.scoreOf(g, p.id);
    const tip = g.tips[p.id];
    const row = h("div", "tt-row");
    row.append(whoCell(p));
    TP.QUESTIONS.forEach((q, i) => {
      const v = tip[q.id];
      row.append(h("span", "tt-cell tt-" + s.marks[i], v === "opp" ? "Geg." : TP.optLabel(v)));
    });
    const w = TP.weightOf(g, p.id);
    row.append(h("span", "num tt-w" + (w < 1 ? " plus" : w > 1 ? " minus" : ""), fieldPct(w)));
    t.append(row);
  }
  els.tippBody.append(t);
  const none = tipPeople(g).filter((p) => !g.tips[p.id]);
  if (none.length) els.tippBody.append(h("p", "caption", `Ohne Tipp, Feld bleibt normal: ${none.map((p) => p.name).join(", ")}.`));
  els.tippBody.append(h("p", "caption", "100 % ist ein normales Feld. Jede richtige Antwort nimmt ein Viertel weg, jede falsche legt ein Viertel drauf. Die Chance, gezogen zu werden, entspricht der Feldgröße."));
  els.tippActions.className = "sheet-actions sheet-actions-single";
  els.tippActions.append(btn("sheet-next", "Fertig", closeTipp));
}
function setResult(qid, v, src) {
  const g = tipGame();
  if (!g) return;
  const prev = g.results[qid];
  if (prev && prev.v === v && prev.src === src) return;
  ui.lastManual = src === "manual" ? { qid, prev: prev ? { ...prev } : null, prevSeen: g.seen[qid], prevLocked: g.locked } : null;
  g.results[qid] = { v, at: Date.now(), src };
  if (!g.locked) g.locked = Date.now();
  persist();
  queueReveal(qid);
  renderTipp();
  renderTipBar();
  renderChrome();
  maybeReveal();
}
function clearResult(qid) {
  const g = tipGame();
  if (!g) return;
  delete g.results[qid];
  delete g.seen[qid];
  persist();
  toast("Frage ist wieder offen. Jetzt das richtige Ergebnis antippen.");
  renderAll(true);
}

/* Auflösung anzeigen */
function queueReveal(qid) {
  if (!ui.reveals.includes(qid)) ui.reveals.push(qid);
}
const revealBlocked = () => ui.spinning || ui.shooting || !!ui.sheetFor || !els.revealSheet.hidden ||
  !els.presenceSheet.hidden || !els.compSheet.hidden || !els.pinSheet.hidden || (!els.tippSheet.hidden && !!ui.tipFor);
function maybeReveal() {
  const g = tipGame();
  if (!g) { ui.reveals = []; return; }
  if (revealBlocked()) return;
  // auch Auflösungen, die noch nie gezeigt wurden (z. B. weil die App zu war)
  for (const q of TP.QUESTIONS) {
    const r = g.results[q.id];
    if (r && g.seen[q.id] !== r.v) queueReveal(q.id);
  }
  while (ui.reveals.length) {
    const qid = ui.reveals.shift();
    const r = g.results[qid];
    if (!r || g.seen[qid] === r.v) continue;
    openReveal(g, qid);
    return;
  }
}
function revealGroup(title, people, cls, iconId, delta) {
  const box = h("div", "rv-group " + cls);
  box.append(h("p", "rv-head", title));
  if (!people.length) {
    box.append(h("p", "rv-empty", "niemand"));
    return box;
  }
  const ul = h("ul", "rv-list");
  for (const p of people) {
    const li = h("li");
    li.style.setProperty("--c", p.color);
    li.append(icon(iconId, "rv-ico"), h("span", "dot"), h("span", "rv-name", p.name), h("span", "rv-w", delta));
    ul.append(li);
  }
  box.append(ul);
  return box;
}
function openReveal(g, qid) {
  const r = g.results[qid];
  const qi = TP.QUESTIONS.findIndex((q) => q.id === qid);
  const correction = g.seen[qid] != null && g.seen[qid] !== r.v;
  g.seen[qid] = r.v;
  persist();
  ui.revealing = { qid };
  els.revealLabel.textContent = correction ? `Korrektur · Frage ${qi + 1}` : `Tippspiel · Frage ${qi + 1} von 3`;
  els.revealTitle.textContent = TP.resultText(qid, r.v, oppOf(g));
  els.revealSrc.textContent = (r.src === "live" ? "Laut Live-Ticker" : "Von Hand eingetragen") + `, ${fmtTime(r.at)} Uhr`;
  const body = els.revealBody;
  body.replaceChildren();
  const tippers = Object.keys(g.tips).map((pid) => tipPerson(g, pid));
  if (r.v === "void") {
    body.append(h("p", "rv-void", "Diese Frage zählt nicht. Kein Feld ändert sich."));
  } else {
    const right = tippers.filter((p) => g.tips[p.id][qid] === r.v);
    const wrong = tippers.filter((p) => g.tips[p.id][qid] !== r.v);
    body.append(
      revealGroup("Richtig · Feld wird kleiner", right, "is-right", "i-check", `\u2212${Math.round(TP.STEP * 100)}\u00a0%`),
      revealGroup("Daneben · Feld wird größer", wrong, "is-wrong", "i-cross", `+${Math.round(TP.STEP * 100)}\u00a0%`)
    );
  }
  const acts = els.revealActions;
  acts.replaceChildren();
  const more = ui.reveals.some((x) => g.results[x] && g.seen[x] !== g.results[x].v);
  const canTakeBack = r.src === "manual" && ui.lastManual && ui.lastManual.qid === qid;
  acts.className = "sheet-actions" + (canTakeBack ? "" : " sheet-actions-single");
  if (canTakeBack) acts.append(btn("sheet-undo", "Doch nicht", takeBackManual));
  acts.append(btn("sheet-next", more ? "Nächste" : ui.tab === "game" && els.tippSheet.hidden ? "Zum Rad" : "Weiter", closeReveal));
  els.revealSheet.hidden = false;
  els.sheetBackdrop.hidden = false;
  els.revealSheet.scrollTop = 0;
  sting();
  buzz([30, 50, 30]);
}
function closeReveal() {
  if (els.revealSheet.hidden) return;
  els.revealSheet.hidden = true;
  ui.revealing = null;
  syncBackdrop();
  renderAll(true);   // jetzt wachsen/schrumpfen die Felder sichtbar
}
function takeBackManual() {
  const g = tipGame();
  const lm = ui.lastManual;
  if (!g || !lm) return;
  if (lm.prev) g.results[lm.qid] = lm.prev;
  else delete g.results[lm.qid];
  if (lm.prevSeen) g.seen[lm.qid] = lm.prevSeen;
  else delete g.seen[lm.qid];
  g.locked = lm.prevLocked;
  ui.lastManual = null;
  ui.reveals = ui.reveals.filter((x) => x !== lm.qid);
  persist();
  closeReveal();
  toast("Zurückgenommen.");
}

/* Live-Daten: OpenLigaDB */
const LIVE = { busy: false, last: 0, ok: 0, failed: false };
async function getJson(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(TP.API + path, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
// Fragt höchstens einmal pro Minute ab: das heutige FCA-Spiel suchen, ab Anpfiff den Stand holen
async function pollLive(force) {
  const g = tipGame();
  if (!g || LIVE.busy || document.visibilityState !== "visible") return;
  const now = Date.now();
  const m = g.match;
  const needSearch = !m || (!m.id && (!m.searched || now - m.searched > 15 * 60000));
  const needData = !!(m && m.id && tipCount(g) && m.kickoff && now >= m.kickoff && now <= m.kickoff + 150 * 60000);
  if (!needSearch && !needData) return;
  if (now - LIVE.last < (force ? 15000 : 55000)) return;
  LIVE.busy = true;
  LIVE.last = now;
  try {
    if (needSearch) {
      let found = null;
      for (const lg of TP.LEAGUES) {
        found = TP.pickMatch(await getJson(`/getmatchdata/${lg}`), dayStart(), dayStart() + 864e5);
        if (found) break;
      }
      g.match = found ? TP.matchMeta(found, Date.now())
        : { id: null, kickoff: null, team1: "", team2: "", opp: "", fcaFirst: true, searched: Date.now() };
      if (found) takeLive(g, found);
    } else {
      const raw = await getJson(`/getmatchdata/${m.id}`);
      const one = TP.readMatch(Array.isArray(raw) ? raw[0] : raw);
      if (one) {
        g.match = TP.matchMeta(one, m.searched || Date.now());
        takeLive(g, one);
      }
    }
    LIVE.ok = Date.now();
    LIVE.failed = false;
  } catch (e) {
    LIVE.failed = true;
  } finally {
    LIVE.busy = false;
    persist();
    if (tipGame() === g) {
      renderTipBar();
      renderChrome();
      if (!els.tippSheet.hidden && !ui.tipFor) renderTipp();
      maybeReveal();
    }
  }
}
function takeLive(g, m) {
  if (!tipCount(g)) return;   // ohne Tipps gibt es nichts aufzulösen
  TP.applyLive(g, TP.evaluate(m, Date.now()), Date.now()).forEach(queueReveal);
}
// Regelmäßig: Live-Daten, automatische Tipp-Sperre zum Anpfiff, ausstehende Auflösungen
setInterval(() => {
  if (document.visibilityState !== "visible" || !tippOn()) return;
  ensureTipGame();
  pollLive(false);
  renderTipBar();
  if (!els.tippSheet.hidden && !ui.tipFor) renderTipp();
  if (!ui.spinning && !ui.shooting) renderChrome();
  maybeReveal();
}, 20000);

/* ---------- Bereiche ---------- */
const views = { game: $("view-game"), stats: $("view-stats"), squad: $("view-squad") };
function switchTab(tab) {
  ui.tab = tab;
  for (const k in views) views[k].hidden = k !== tab;
  document.querySelectorAll(".tab").forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  disarm();
  if (tab === "stats") { renderStats(); views.stats.scrollTop = 0; }
  if (tab === "squad") { renderSquad(); views.squad.scrollTop = 0; }
  if (tab === "game") renderGame(false);
}
function renderAll(animate) {
  renderGame(animate);
  if (!els.tippSheet.hidden) renderTipp();
  if (ui.tab === "stats") renderStats();
  if (ui.tab === "squad") renderSquad();
}

/* ---------- Ereignisse ---------- */
els.cta.addEventListener("click", onCta);
els.undoBtn.addEventListener("click", () => requireAdmin("Rückgängig", undoLast));
els.presenceBtn.addEventListener("click", () => openPresence(null));
els.presenceOk.addEventListener("click", () => closePresence(true));
els.presenceCancel.addEventListener("click", () => closePresence(false));
els.sheetNext.addEventListener("click", sheetNext);
els.sheetUndo.addEventListener("click", () => requireAdmin("Rückgängig", undoLast));
function closeTopSheet() {
  if (!els.pinSheet.hidden) closePin();
  else if (!els.revealSheet.hidden) closeReveal();
  else if (!els.tippSheet.hidden) {
    if (ui.tipFor) { ui.tipFor = null; ui.tipDraft = null; renderTipp(); }
    else closeTipp();
  }
  else if (!els.compSheet.hidden) closeComp();
  else if (!els.presenceSheet.hidden) closePresence(false);
  else if (ui.sheetFor) sheetNext();
}
els.sheetBackdrop.addEventListener("click", closeTopSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTopSheet(); });
els.compBtn.addEventListener("click", openComp);
els.compClose.addEventListener("click", closeComp);
els.compForm.addEventListener("submit", (e) => { e.preventDefault(); createComp(); });
els.pinForm.addEventListener("submit", (e) => { e.preventDefault(); submitPin(); });
els.pinCancel.addEventListener("click", closePin);
els.adminSet.addEventListener("click", () => {
  if (hasAdmin()) requireAdmin("PIN ändern", () => openPin("set"));
  else openPin("set");
});
els.adminRemove.addEventListener("click", () => requireAdmin("PIN entfernen", () => {
  root.admin = null;
  adminUntil = 0;
  persist();
  toast("Admin-PIN entfernt. Alle dürfen wieder alles.");
  renderSquad();
}));
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  if (ui.spinning || ui.shooting) return;
  switchTab(b.dataset.tab);
}));
els.champPill.addEventListener("click", () => { if (!ui.spinning && !ui.shooting) switchTab("stats"); });
els.tippBar.addEventListener("click", openTipp);
els.rangeToday.addEventListener("click", () => { ui.range = "today"; renderStats(); });
els.rangeSeason.addEventListener("click", () => { ui.range = "season"; renderStats(); });
els.rangeAll.addEventListener("click", () => { ui.range = "all"; renderStats(); });
els.addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (addPlayer(els.nameInput.value, ui.addAsGuest, false)) els.nameInput.value = "";
});
els.roleReg.addEventListener("click", () => { ui.addAsGuest = false; renderSquad(); });
els.roleGuest.addEventListener("click", () => { ui.addAsGuest = true; renderSquad(); });
els.guestForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addGuestHere(els.guestInput.value);
});
els.abortBtn.addEventListener("click", () => {
  if (ui.armed !== "abort") { arm("abort"); renderSquad(); return; }
  disarm();
  requireAdmin("Runde abbrechen", abortRound);
});
function abortRound() {
  if (state.round) state.debts = state.debts.filter((d) => d.roundId !== state.round.id || d.settledAt);
  state.round = null;
  ui.finalLine = null;
  persist();
  toast("Runde abgebrochen. Die nächste startet mit dem aktuellen Kader.");
  renderSquad();
  renderGame(false);
}
els.resetBtn.addEventListener("click", () => {
  if (ui.armed !== "reset") { arm("reset"); renderSquad(); return; }
  disarm();
  requireAdmin("Statistik zurücksetzen", resetStats);
});
function resetStats() {
  state.rounds = [];
  state.round = null;
  state.pending = [];
  state.debts = [];
  state.tippArchive = [];
  ui.finalLine = null;
  ui.playingId = null;
  ui.champRoundId = null;
  persist();
  toast(`Statistik von „${state.name}“ gelöscht. Der Kader bleibt.`);
  renderSquad();
  renderGame(false);
}
els.soundToggle.addEventListener("change", () => {
  root.settings.sound = els.soundToggle.checked;
  if (root.settings.sound) unlockAudio();
  persist();
});
els.vibeToggle.addEventListener("change", () => {
  root.settings.vibrate = els.vibeToggle.checked;
  persist();
});

/* ---------- Start ---------- */
els.version.textContent = APP_VERSION;
persist(); // ältere Speicherstände gleich im neuen Format sichern
if (state.round && state.round.final && state.round.final.winner && !state.rounds.some((r) => r.id === state.round.id)) {
  state.rounds.push(clone(state.round));
  persist();
}
renderAll(false);
pollLive(true);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    ui.wheelSig = "";
    renderGame(false);
    if (!els.sheet.hidden) fitText(els.sheetName, 84, 34);
  });
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
