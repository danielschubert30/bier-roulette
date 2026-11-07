// FCA Bier-Roulette – Ablauf und Oberfläche.
import { load, save, MAX_WHEEL, MAX_ROSTER, PALETTE, rand, uid, cleanName } from "./store.js";
import { createWheel } from "./wheel.js";
import * as SO from "./shootout.js";
import { SPIN_QUIPS, RESULT_QUIPS, FINAL_INTROS, CHAMPION_QUIPS, SHOT_TEXT, FCA_FACTS } from "./content.js";

const APP_VERSION = "1.1.0";
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
  presenceCancel: $("presenceCancel"), presenceOk: $("presenceOk"),
  champCard: $("champCard"), rangeToday: $("rangeToday"), rangeSeason: $("rangeSeason"), rangeAll: $("rangeAll"),
  kpis: $("kpis"), table: $("table"), seasonSel: $("seasonSel"), saldo: $("saldo"), debts: $("debts"), honors: $("honors"),
  squadNote: $("squadNote"), roster: $("roster"), addForm: $("addForm"), nameInput: $("nameInput"), addBtn: $("addBtn"),
  roundTools: $("roundTools"), abortBtn: $("abortBtn"), soundToggle: $("soundToggle"), vibeToggle: $("vibeToggle"),
  resetBtn: $("resetBtn"), version: $("version"), toast: $("toast")
};

const state = load();
const ui = {
  tab: "game", range: "season", seasonStart: null,
  spinning: false, shooting: false, sheetFor: null, sheetDebt: false, presenceCb: null,
  playingId: null,       // offenes Finale, das gerade nachgeholt wird
  champRoundId: null,    // Champion-Anzeige für ein nachgeholtes Finale
  armed: null, armTimer: null, newChamp: false, wheelSig: "", finalLine: null, lastQuip: -1
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
  if (!save(state) && !saveWarned) {
    saveWarned = true;
    toast("Speichern klappt in diesem Browser nicht. Privater Modus?");
  }
}

/* ---------- Anwesenheit ---------- */
const activePlayers = () => state.players.filter((p) => p.active);
const presenceSet = () => !!state.presence && state.presence.day === todayKey();
const isPresent = (id) => (presenceSet() ? state.presence.ids.includes(id) : true);
const presentCount = () => activePlayers().filter((p) => isPresent(p.id)).length;

/* ---------- Runden und Daten ---------- */
function remaining(round) {
  const out = new Set(round.picks.map((k) => k.id));
  return round.pot.filter((p) => !out.has(p.id));
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
  if (!state.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch (e) { actx = null; }
}
const audio = () => (state.settings.sound && actx ? actx : null);
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
  if (!state.settings.vibrate || !navigator.vibrate) return;
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
});

/* ---------- Ticker ---------- */
const decks = { fact: [], quip: [] };
function drawFrom(kind) {
  const src = kind === "fact" ? FCA_FACTS : SPIN_QUIPS;
  if (!decks[kind].length) decks[kind] = shuffle(src.map((_, i) => i));
  return src[decks[kind].pop()];
}
function spinLine() {
  if (FCA_FACTS.length && rand() < 0.6) return { label: "FCA-Fakt", text: drawFrom("fact") };
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
    if (n < 2) return { label: "Kader", text: "Schalte im Kader mindestens zwei Mitspieler ein." };
    if (!presenceSet()) return { label: "Bereit", text: `Neue Runde mit ${n} im Topf. Vor dem ersten Dreh fragt die App, wer heute da ist.` };
    return { label: "Bereit", text: `${presentCount()} von ${n} heute da. Alle ${n} kommen in den Topf, wer fehlt, wird ausgegraut.` };
  }
  if (mode === "spin") {
    const r = state.round;
    const rem = remaining(r);
    const away = rem.filter((p) => !isPresent(p.id)).length;
    const no = r.picks.filter((k) => !k.absent).length + 1;
    return {
      label: `Bier Nr. ${no}`,
      text: `${rem.length} im Topf` + (away ? `, davon ${away} heute nicht da` : "") + `. Risiko je ${pctF.format(1 / rem.length)}.`
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
  const pot = activePlayers().map((p) => ({ id: p.id, name: p.name, color: p.color, active: true }));
  if (pot.length < 2) return false;
  state.round = { id: uid("r"), startedAt: Date.now(), pot, picks: [], final: null };
  ui.newChamp = false;
  ui.wheelSig = "";
  if (pot.length === 2) startFinal();
  persist();
  return true;
}
function startFinal() {
  const r = state.round;
  const rem = remaining(r);
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
    toast("Mindestens zwei Mitspieler im Kader einschalten.");
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
  const r = state.round;
  syncWheel(false);
  ui.spinning = true;
  const line = spinLine();
  setTicker(line.label, line.text);
  renderChrome();
  renderNotices();
  const idx = Math.floor(rand() * wheel.players.length);
  const landed = await wheel.spinTo(idx, {
    rnd: rand,
    duration: reduceMotion ? 1100 : 5200 + rand() * 900,
    turns: reduceMotion ? 1 : 6 + Math.floor(rand() * 3),
    onTick: tick,
    reduceMotion
  });
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
  if (stats.length && rand() < 0.75) quip = stats[0];
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
  const lastTwo = remaining(state.round).length === 2;
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
  if (els.presenceSheet.hidden) els.sheetBackdrop.hidden = true;
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
  if (r && !r.final && remaining(r).length <= 2) {
    startFinal();
    persist();
    renderAll(true);
    return;
  }
  renderAll(true);
  if (respin && viewMode() === "spin") spin();
}
function undoLast() {
  const r = state.round;
  if (!r || r.final || !r.picks.length || ui.spinning) return;
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
  const base = mode === "spin" ? remaining(state.round) : mode === "idle" ? activePlayers() : [];
  const list = base.map((p) => ({ id: p.id, name: p.name, color: p.color, absent: !isPresent(p.id) }));
  const sig = list.map((p) => p.id + p.color + p.name + (p.absent ? "-" : "+")).join("|");
  if (sig === ui.wheelSig) return;
  ui.wheelSig = sig;
  wheel.draw(list, "Kader einschalten");
  const rotor = els.wheel.querySelector(".wheel-rotor");
  if (animate && !reduceMotion && rotor && rotor.animate) {
    rotor.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  }
}

function chip(p, cls, no, tag) {
  const li = h("li", "chip" + (cls ? " " + cls : ""));
  li.style.setProperty("--c", p.color);
  if (no) li.append(h("span", "chip-no", `${no}.`));
  li.append(h("span", "dot"), h("span", null, p.name));
  if (tag) li.append(h("span", "chip-tag", tag));
  return li;
}

function renderChrome() {
  const mode = viewMode();
  const r = shownRound();
  if (ui.playingId && mode === "final") els.roundNo.textContent = "Nachholfinale";
  else if (mode === "champ" && ui.champRoundId) els.roundNo.textContent = "Nachholfinale";
  else els.roundNo.textContent = `Runde ${mode === "champ" ? state.rounds.length : state.rounds.length + 1}`;

  let stateText = "";
  if (mode === "idle") stateText = `${activePlayers().length} im Topf`;
  else if (mode === "spin") stateText = `Bier Nr. ${r.picks.filter((k) => !k.absent).length + 1}`;
  else if (mode === "final") stateText = "Finale";
  else stateText = "Entschieden";
  els.roundState.textContent = stateText;

  els.pot.replaceChildren();
  if (mode === "idle") {
    for (const p of activePlayers()) els.pot.append(chip(p, isPresent(p.id) ? "" : "is-absent", null, isPresent(p.id) ? null : "fehlt"));
  } else if (r) {
    const order = new Map(r.picks.map((k, i) => [k.id, { no: i + 1, debt: k.absent }]));
    if (r.final && r.final.loser) order.set(r.final.loser, { no: r.picks.length + 1, debt: r.final.forfeit });
    for (const p of r.pot) {
      const out = order.get(p.id);
      if (out) { els.pot.append(chip(p, "is-out" + (out.debt ? " is-debt" : ""), out.no, out.debt ? "Schuld" : null)); continue; }
      const inFinal = r.final && (r.final.a === p.id || r.final.b === p.id);
      const away = !isPresent(p.id) && mode !== "champ";
      els.pot.append(chip(p, (inFinal ? "is-final" : "") + (away ? " is-absent" : ""), null, away ? "fehlt" : null));
    }
  }

  els.undoBtn.hidden = !(mode === "spin" && state.round.picks.length > 0 && !ui.spinning && !ui.sheetFor);
  const busy = ui.spinning || ui.shooting || !!ui.sheetFor;
  els.presenceBtn.disabled = busy;
  els.presenceBtn.textContent = presenceSet() ? `${presentCount()}/${activePlayers().length} da` : "Wer ist da?";
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
        if (ui.armed === key) { disarm(); forfeitFinal(r, away[0]); }
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
      if (ui.armed === key) { disarm(); forfeitFinal(r, away[0]); }
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
  let mode = viewMode();
  if (mode === "spin" && remaining(state.round).length <= 2 && !ui.sheetFor && !ui.spinning) {
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
  renderNotices();
  if (!ui.spinning && !ui.shooting) {
    const t = tickerFor(mode);
    setTicker(t.label, t.text);
  }
}

/* ---------- Anwesenheits-Abfrage ---------- */
function openPresence(cb) {
  if (ui.spinning || ui.shooting || ui.sheetFor) return;
  ui.presenceCb = cb || null;
  els.presenceList.replaceChildren();
  for (const p of activePlayers()) {
    const li = h("li");
    const lab = h("label");
    lab.style.setProperty("--c", p.color);
    const cbx = document.createElement("input");
    cbx.type = "checkbox";
    cbx.id = "here-" + p.id;
    cbx.value = p.id;
    cbx.checked = presenceSet() ? isPresent(p.id) : true;
    const sw = h("span", "switch");
    sw.append(cbx, h("span", "track"));
    lab.append(h("span", "dot"), h("span", "player-name", p.name), sw);
    li.append(lab);
    els.presenceList.append(li);
  }
  els.presenceNote.textContent = "Wer fehlt, bleibt im Topf. Wird er gezogen, fliegt er raus und schuldet eine Runde, die er beim nächsten Mal einlöst.";
  els.presenceSheet.hidden = false;
  els.sheetBackdrop.hidden = false;
  setTimeout(() => els.presenceOk.focus({ preventScroll: true }), 60);
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
  if (els.sheet.hidden) els.sheetBackdrop.hidden = true;
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
      map.set(id, { id, name: i.name, color: i.color, got: 0, titles: 0, finals: 0 });
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
    if (!map.has(x.id)) { const i = infoOf(x.id); map.set(x.id, { id: x.id, name: i.name, color: i.color, beers: 0, count: 0 }); }
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
  who.append(h("span", "dot"), h("span", null, p.name));
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

  renderSaldo();
  renderDebtList();
  renderHonors();
}
function renderSaldo() {
  const starts = new Set([seasonStartOf()]);
  for (const x of fetchRecords()) starts.add(seasonStartOf(x.at));
  const list = [...starts].sort((a, b) => b - a);
  if (ui.seasonStart == null || !starts.has(ui.seasonStart)) ui.seasonStart = list[0];
  els.seasonSel.replaceChildren();
  for (const s of list) {
    const o = document.createElement("option");
    o.value = String(s);
    o.textContent = seasonLabel(s);
    o.selected = s === ui.seasonStart;
    els.seasonSel.append(o);
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
  els.squadNote.textContent = `Eingeschaltet heißt: spielt mit. ${activeN} von höchstens ${MAX_WHEEL} sind eingeschaltet.`;
  const ev = duties(allRoundsAll());

  els.roster.replaceChildren();
  for (const p of state.players) {
    const li = h("li", "player" + (p.active ? "" : " is-off"));
    li.style.setProperty("--c", p.color);
    const got = ev.filter((e) => e.id === p.id).length;
    const titles = titlesOf(p.id);
    const debts = openDebts().filter((d) => d.playerId === p.id).length;
    const name = h("div", "player-name", p.name);
    name.append(h("span", "player-meta", `${got}× dran · ${titles} Titel` + (debts ? ` · ${debts} offene Schuld` : "")));
    const sw = h("label", "switch");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "on-" + p.id;
    cb.checked = p.active;
    cb.addEventListener("change", () => toggleActive(p.id, cb.checked));
    sw.append(cb, h("span", "track"), h("span", "sr", `${p.name} spielt mit`));
    const armed = ui.armed === "rm:" + p.id;
    const rm = h("button", "icon-btn" + (armed ? " is-armed" : ""), armed ? "Löschen?" : "×");
    rm.type = "button";
    rm.setAttribute("aria-label", armed ? `${p.name} wirklich löschen` : `${p.name} aus dem Kader löschen`);
    rm.addEventListener("click", () => {
      if (ui.armed === "rm:" + p.id) { disarm(); removePlayer(p.id); }
      else { arm("rm:" + p.id); renderSquad(); }
    });
    li.append(h("span", "dot"), name, sw, rm);
    els.roster.append(li);
  }
  if (!state.players.length) els.roster.append(h("li", "empty", "Noch niemand im Kader."));

  const full = state.players.length >= MAX_ROSTER;
  els.nameInput.disabled = full;
  els.addBtn.disabled = full;
  els.nameInput.placeholder = full ? `Kader voll (max. ${MAX_ROSTER})` : "Neuer Mitspieler";

  els.roundTools.hidden = !running;
  const abortArmed = ui.armed === "abort";
  els.abortBtn.textContent = abortArmed ? "Wirklich abbrechen?" : "Runde abbrechen";
  els.abortBtn.classList.toggle("is-armed", abortArmed);

  els.soundToggle.checked = state.settings.sound;
  els.vibeToggle.checked = state.settings.vibrate;
  const resetArmed = ui.armed === "reset";
  els.resetBtn.textContent = resetArmed ? "Wirklich löschen?" : "Zurücksetzen";
  els.resetBtn.classList.toggle("is-armed", resetArmed);
  els.resetBtn.disabled = !state.rounds.length && !state.round && !state.pending.length && !state.debts.length;
}
function toggleActive(id, on) {
  if (on && activePlayers().length >= MAX_WHEEL) {
    toast(`Höchstens ${MAX_WHEEL} Mitspieler aufs Rad.`);
    renderSquad();
    return;
  }
  state.players = state.players.map((p) => (p.id === id ? { ...p, active: on } : p));
  if (on && presenceSet() && !state.presence.ids.includes(id)) state.presence.ids.push(id);
  persist();
  renderSquad();
  renderGame(false);
}
function addPlayer(raw) {
  const name = cleanName(raw);
  if (!name) { toast("Bitte einen Namen eingeben."); return false; }
  if (state.players.length >= MAX_ROSTER) { toast(`Höchstens ${MAX_ROSTER} im Kader.`); return false; }
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) { toast(`${name} ist schon im Kader.`); return false; }
  const used = new Set(state.players.map((p) => p.color.toLowerCase()));
  const color = PALETTE.find((c) => !used.has(c)) || PALETTE[state.players.length % PALETTE.length];
  const active = activePlayers().length < MAX_WHEEL;
  const id = uid("p");
  state.players.push({ id, name, color, active });
  if (presenceSet()) state.presence.ids.push(id);
  persist();
  if (!active) toast(`${name} ist im Kader, aber ausgeschaltet. Das Rad ist voll.`);
  renderSquad();
  renderGame(false);
  return true;
}
function removePlayer(id) {
  const p = state.players.find((x) => x.id === id);
  state.players = state.players.filter((x) => x.id !== id);
  persist();
  if (p) toast(`${p.name} ist nicht mehr im Kader. Statistik und Schulden bleiben.`);
  renderSquad();
  renderGame(false);
}

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
  if (ui.tab === "stats") renderStats();
  if (ui.tab === "squad") renderSquad();
}

/* ---------- Ereignisse ---------- */
els.cta.addEventListener("click", onCta);
els.undoBtn.addEventListener("click", undoLast);
els.presenceBtn.addEventListener("click", () => openPresence(null));
els.presenceOk.addEventListener("click", () => closePresence(true));
els.presenceCancel.addEventListener("click", () => closePresence(false));
els.sheetNext.addEventListener("click", sheetNext);
els.sheetUndo.addEventListener("click", undoLast);
els.sheetBackdrop.addEventListener("click", () => {
  if (!els.presenceSheet.hidden) closePresence(false);
  else sheetNext();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!els.presenceSheet.hidden) closePresence(false);
  else if (ui.sheetFor) sheetNext();
});
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  if (ui.spinning || ui.shooting) return;
  switchTab(b.dataset.tab);
}));
els.champPill.addEventListener("click", () => { if (!ui.spinning && !ui.shooting) switchTab("stats"); });
els.rangeToday.addEventListener("click", () => { ui.range = "today"; renderStats(); });
els.rangeSeason.addEventListener("click", () => { ui.range = "season"; renderStats(); });
els.rangeAll.addEventListener("click", () => { ui.range = "all"; renderStats(); });
els.seasonSel.addEventListener("change", () => { ui.seasonStart = Number(els.seasonSel.value); renderSaldo(); });
els.addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (addPlayer(els.nameInput.value)) els.nameInput.value = "";
});
els.abortBtn.addEventListener("click", () => {
  if (ui.armed !== "abort") { arm("abort"); renderSquad(); return; }
  disarm();
  if (state.round) state.debts = state.debts.filter((d) => d.roundId !== state.round.id || d.settledAt);
  state.round = null;
  ui.finalLine = null;
  persist();
  toast("Runde abgebrochen. Die nächste startet mit dem aktuellen Kader.");
  renderSquad();
  renderGame(false);
});
els.resetBtn.addEventListener("click", () => {
  if (ui.armed !== "reset") { arm("reset"); renderSquad(); return; }
  disarm();
  state.rounds = [];
  state.round = null;
  state.pending = [];
  state.debts = [];
  ui.finalLine = null;
  ui.playingId = null;
  ui.champRoundId = null;
  persist();
  toast("Statistik gelöscht. Der Kader bleibt.");
  renderSquad();
  renderGame(false);
});
els.soundToggle.addEventListener("change", () => {
  state.settings.sound = els.soundToggle.checked;
  if (state.settings.sound) unlockAudio();
  persist();
});
els.vibeToggle.addEventListener("change", () => {
  state.settings.vibrate = els.vibeToggle.checked;
  persist();
});

/* ---------- Start ---------- */
els.version.textContent = APP_VERSION;
if (state.round && state.round.final && state.round.final.winner && !state.rounds.some((r) => r.id === state.round.id)) {
  state.rounds.push(clone(state.round));
  persist();
}
renderAll(false);
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
