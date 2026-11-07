// FCA Bier-Roulette – Ablauf und Oberfläche.
import { load, save, MAX_WHEEL, MAX_ROSTER, PALETTE, rand, uid, cleanName } from "./store.js";
import { createWheel } from "./wheel.js";
import * as SO from "./shootout.js";
import { SPIN_QUIPS, RESULT_QUIPS, FINAL_INTROS, CHAMPION_QUIPS, SHOT_TEXT, FCA_FACTS } from "./content.js";

const APP_VERSION = "1.0.0";
const NS = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

const els = {
  champPill: $("champPill"), champPillName: $("champPillName"),
  roundNo: $("roundNo"), roundState: $("roundState"), undoBtn: $("undoBtn"), pot: $("pot"),
  stageWheel: $("stageWheel"), stageFinal: $("stageFinal"), stageChamp: $("stageChamp"),
  wheel: $("wheel"), goal: $("goal"), score: $("score"), finalCall: $("finalCall"),
  champName: $("champName"), champMeta: $("champMeta"), champQuip: $("champQuip"), champOrder: $("champOrder"),
  ticker: $("ticker"), tickerLabel: $("tickerLabel"), tickerText: $("tickerText"),
  ctaZone: $("ctaZone"), cta: $("cta"),
  sheet: $("sheet"), sheetBackdrop: $("sheetBackdrop"), sheetName: $("sheetName"), sheetMeta: $("sheetMeta"),
  sheetQuip: $("sheetQuip"), sheetUndo: $("sheetUndo"), sheetNext: $("sheetNext"),
  champCard: $("champCard"), rangeToday: $("rangeToday"), rangeAll: $("rangeAll"), kpis: $("kpis"), table: $("table"), honors: $("honors"),
  squadNote: $("squadNote"), roster: $("roster"), addForm: $("addForm"), nameInput: $("nameInput"), addBtn: $("addBtn"),
  roundTools: $("roundTools"), abortBtn: $("abortBtn"), soundToggle: $("soundToggle"), vibeToggle: $("vibeToggle"),
  resetBtn: $("resetBtn"), version: $("version"), toast: $("toast")
};

const state = load();
const ui = {
  tab: "game", range: "today", spinning: false, shooting: false, sheetFor: null,
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
const pctF = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });
function dayStart() {
  const d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  d.setHours(6, 0, 0, 0);
  return d.getTime();
}
function fmtDay(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "") + " " +
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
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
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3200);
}
let saveWarned = false;
function persist() {
  if (!save(state) && !saveWarned) {
    saveWarned = true;
    toast("Speichern klappt in diesem Browser nicht. Privater Modus?");
  }
}

/* ---------- Daten ---------- */
const activePlayers = () => state.players.filter((p) => p.active);
function remaining(round) {
  const out = new Set(round.picks.map((k) => k.id));
  return round.pot.filter((p) => !out.has(p.id));
}
function phase() {
  const r = state.round;
  if (!r) return "idle";
  if (r.final) return r.final.winner ? "done" : "final";
  return "spin";
}
function infoOf(id, round) {
  const r = state.players.find((p) => p.id === id);
  if (r) return r;
  const sources = [round, state.round, ...state.rounds.slice().reverse()].filter(Boolean);
  for (const src of sources) {
    const p = src.pot.find((x) => x.id === id);
    if (p) return p;
  }
  return { id, name: "?", color: PALETTE[0] };
}
function allRounds() {
  const list = state.rounds.slice();
  if (state.round && !list.some((r) => r.id === state.round.id)) list.push(state.round);
  return list;
}
function beerEvents(rounds) {
  const ev = [];
  for (const r of rounds) {
    for (const k of r.picks) ev.push({ id: k.id, at: k.at });
    if (r.final && r.final.loser) ev.push({ id: r.final.loser, at: r.final.endedAt || r.startedAt });
  }
  return ev;
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
  if (document.visibilityState === "visible" && wantAwake) keepAwake();
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
function tickerFor(ph) {
  if (ph === "idle") {
    const n = activePlayers().length;
    if (n < 2) return { label: "Kader", text: "Schalte im Kader mindestens zwei Mitspieler ein." };
    return { label: "Bereit", text: `Neue Runde mit ${n} im Topf. Jeder hat ${pctF.format(1 / n)} Risiko.` };
  }
  if (ph === "spin") {
    const n = remaining(state.round).length;
    return { label: `Bier Nr. ${state.round.picks.length + 1}`, text: `${n} im Topf, Risiko je ${pctF.format(1 / n)}. Die letzten zwei gehen ins Elfmeterschießen.` };
  }
  if (ph === "final") return ui.finalLine || { label: "Finale", text: FINAL_INTROS[0] };
  const f = state.round.final;
  return { label: "Runde vorbei", text: `${infoOf(f.loser).name} holt das letzte Bier. Danach geht es mit allen von vorne los.` };
}

/* ---------- Spielablauf ---------- */
function startRound() {
  const pot = activePlayers().map((p) => ({ id: p.id, name: p.name, color: p.color, active: true }));
  if (pot.length < 2) return false;
  state.round = { id: uid("r"), startedAt: Date.now(), pot, picks: [], final: null };
  ui.newChamp = false;
  if (pot.length === 2) startFinal();
  persist();
  return true;
}
function startFinal() {
  const rem = remaining(state.round);
  state.round.final = SO.newFinal(rem[0].id, rem[1].id, rand);
  const a = infoOf(rem[0].id).name, b = infoOf(rem[1].id).name;
  ui.finalLine = { label: "Finale", text: `${a} gegen ${b}. ${pick(FINAL_INTROS)}` };
  whistle();
}

async function onCta() {
  unlockAudio();
  keepAwake();
  const ph = phase();
  if (ph === "done") {
    state.round = null;
    ui.newChamp = false;
    persist();
    renderAll(true);
    return;
  }
  if (ph === "final" || ui.spinning || ui.sheetFor) return;
  if (ph === "idle" && !startRound()) {
    toast("Mindestens zwei Mitspieler im Kader einschalten.");
    return;
  }
  if (phase() === "final") { renderAll(true); return; }
  await spin();
}

async function spin() {
  const list = remaining(state.round);
  syncWheel(false);
  ui.spinning = true;
  const line = spinLine();
  setTicker(line.label, line.text);
  renderChrome();
  const idx = Math.floor(rand() * list.length);
  const landed = await wheel.spinTo(idx, {
    rnd: rand,
    duration: reduceMotion ? 1100 : 5200 + rand() * 900,
    turns: reduceMotion ? 1 : 6 + Math.floor(rand() * 3),
    onTick: tick,
    reduceMotion
  });
  const p = wheel.players[landed];
  state.round.picks.push({ id: p.id, at: Date.now() });
  persist();
  ui.spinning = false;
  wheel.highlight(p.id);
  if (!reduceMotion) wheel.celebrate(p.color);
  sting();
  buzz([40, 40, 110]);
  openSheet(p);
  renderChrome();
}

function resultTexts(p) {
  const ev = beerEvents(allRounds());
  const mine = ev.filter((e) => e.id === p.id);
  const total = mine.length;
  const today = mine.filter((e) => e.at >= dayStart()).length;
  let meta = `holt zum ${total}. Mal`;
  if (today > 1) meta += ` · heute schon ${today}×`;

  const stats = [];
  const champ = champion();
  if (champ && champ.id === p.id) stats.push("Ausgerechnet der amtierende Champion. Die Krone wackelt.");
  if (total === 1) stats.push("Premiere: das allererste Bier in der ewigen Statistik.");
  if (state.round.picks.length === 1) {
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
  if (total >= 3 && total === max && leaders === 1) stats.push(`Alleiniger Spitzenreiter der ewigen Bierholer-Tabelle: ${total} Biere.`);

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

function openSheet(p) {
  ui.sheetFor = p.id;
  const { meta, quip } = resultTexts(p);
  els.sheet.style.setProperty("--c", p.color);
  els.sheetName.textContent = p.name;
  els.sheetMeta.textContent = meta;
  els.sheetQuip.textContent = quip;
  els.sheetNext.textContent = remaining(state.round).length === 2 ? "Weiter zum Finale" : "Weiter";
  els.sheet.hidden = false;
  els.sheetBackdrop.hidden = false;
  fitText(els.sheetName, 84, 34);
  setTimeout(() => els.sheetNext.focus({ preventScroll: true }), 60);
}
function closeSheet() {
  els.sheet.hidden = true;
  els.sheetBackdrop.hidden = true;
  ui.sheetFor = null;
}
function sheetNext() {
  if (!ui.sheetFor) return;
  unlockAudio();
  closeSheet();
  wheel.highlight(null);
  if (state.round && !state.round.final && remaining(state.round).length <= 2) {
    startFinal();
    persist();
  }
  renderAll(true);
}
function undoLast() {
  const r = state.round;
  if (!r || r.final || !r.picks.length || ui.spinning) return;
  const k = r.picks.pop();
  persist();
  closeSheet();
  wheel.highlight(null);
  toast(`${infoOf(k.id).name} ist wieder im Topf.`);
  renderAll(true);
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
  const f = state.round && state.round.final;
  if (!f || f.winner || ui.shooting) return;
  unlockAudio();
  keepAwake();
  ui.shooting = true;
  els.goal.classList.remove("is-ready");
  const by = SO.nextShooter(f);
  const res = SO.resolveShot(aim, rand);
  els.finalCall.textContent = `${infoOf(by).name} läuft an …`;
  await animateShot(res);
  f.shots.push({ by, aim: res.aim, dive: res.dive, result: res.result, at: Date.now() });
  showShotText(pick(SHOT_TEXT[res.result]));
  if (res.result === "goal") { cheer(); buzz(60); } else groan();

  const w = SO.decide(f);
  const a = infoOf(f.a).name, b = infoOf(f.b).name;
  if (w) {
    f.winner = w;
    f.loser = SO.other(f, w);
    f.endedAt = Date.now();
    if (!state.rounds.some((r) => r.id === state.round.id)) state.rounds.push(JSON.parse(JSON.stringify(state.round)));
    persist();
    renderFinal();
    els.finalCall.textContent = `${infoOf(w).name} gewinnt ${SO.scoreLine(f)}.`;
    await wait(reduceMotion ? 600 : 1700);
    resetGoal();
    ui.shooting = false;
    ui.newChamp = true;
    champFanfare();
    buzz([60, 40, 60, 40, 220]);
    renderAll(true);
    return;
  }
  persist();
  const both = SO.taken(f, f.a) >= SO.KICKS && SO.taken(f, f.b) >= SO.KICKS;
  ui.finalLine = { label: both ? "Sudden Death" : "Elfmeterschießen", text: `${a} ${SO.goals(f, f.a)} : ${SO.goals(f, f.b)} ${b}` };
  setTicker(ui.finalLine.label, ui.finalLine.text);
  renderFinal();
  await wait(reduceMotion ? 500 : 1250);
  resetGoal();
  ui.shooting = false;
  renderFinal();
}

/* ---------- Darstellung: Spiel ---------- */
function syncWheel(animate) {
  const ph = phase();
  const list = ph === "spin" ? remaining(state.round) : ph === "idle" ? activePlayers() : [];
  const sig = list.map((p) => p.id + p.color + p.name).join("|");
  if (sig === ui.wheelSig) return;
  ui.wheelSig = sig;
  wheel.draw(list, "Kader einschalten");
  const rotor = els.wheel.querySelector(".wheel-rotor");
  if (animate && !reduceMotion && rotor && rotor.animate) {
    rotor.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  }
}

function renderChrome() {
  const ph = phase();
  const roundsDone = state.rounds.length;
  const no = ph === "done" ? roundsDone : roundsDone + 1;
  els.roundNo.textContent = `Runde ${no}`;

  let stateText = "";
  if (ph === "idle") stateText = `${activePlayers().length} im Topf`;
  else if (ph === "spin") stateText = `Bier Nr. ${state.round.picks.length + 1}`;
  else if (ph === "final") stateText = "Finale";
  else stateText = "Entschieden";
  els.roundState.textContent = stateText;

  els.pot.replaceChildren();
  if (ph === "idle") {
    for (const p of activePlayers()) {
      const li = h("li", "chip");
      li.style.setProperty("--c", p.color);
      li.append(h("span", "dot"), h("span", null, p.name));
      els.pot.append(li);
    }
  } else {
    const r = state.round;
    const order = new Map(r.picks.map((k, i) => [k.id, i + 1]));
    if (r.final && r.final.loser) order.set(r.final.loser, r.picks.length + 1);
    for (const p of r.pot) {
      const out = order.get(p.id);
      const inFinal = r.final && (r.final.a === p.id || r.final.b === p.id) && !out;
      const li = h("li", "chip" + (out ? " is-out" : "") + (inFinal ? " is-final" : ""));
      li.style.setProperty("--c", p.color);
      if (out) li.append(h("span", "chip-no", `${out}.`));
      li.append(h("span", "dot"), h("span", null, p.name));
      els.pot.append(li);
    }
  }

  els.undoBtn.hidden = !(ph === "spin" && state.round.picks.length > 0 && !ui.spinning && !ui.sheetFor);

  els.ctaZone.hidden = ph === "final";
  if (ph === "done") {
    els.cta.textContent = "Neue Runde";
    els.cta.classList.add("is-gold");
    els.cta.disabled = false;
  } else {
    els.cta.textContent = "Saufen?";
    els.cta.classList.remove("is-gold");
    els.cta.disabled = ui.spinning || (ph === "idle" && activePlayers().length < 2);
  }

  const c = champion();
  els.champPill.hidden = !c;
  if (c) els.champPillName.textContent = c.info.name;
}

function renderFinal() {
  const f = state.round.final;
  const order = [f.first, SO.other(f, f.first)];
  const up = f.winner ? null : SO.nextShooter(f);
  els.score.replaceChildren();
  for (const id of order) {
    const p = infoOf(id);
    const row = h("div", "score-row" + (id === up && !ui.shooting ? " is-up" : ""));
    row.style.setProperty("--c", p.color);
    const name = h("div", "score-name");
    name.append(h("span", "dot"), h("span", null, p.name));
    const marks = h("div", "marks");
    const shots = f.shots.filter((s) => s.by === id);
    const slots = Math.max(SO.KICKS, shots.length);
    const startAt = Math.max(0, slots - 7);
    for (let i = startAt; i < slots; i++) {
      const s = shots[i];
      marks.append(h("span", "mark" + (s ? (s.result === "goal" ? " is-goal" : " is-miss") : "")));
    }
    row.append(name, marks, h("span", "score-num", String(SO.goals(f, id))));
    els.score.append(row);
  }
  els.goal.classList.toggle("is-ready", !f.winner && !ui.shooting);
  if (!ui.shooting && !f.winner) {
    els.finalCall.replaceChildren(h("strong", null, infoOf(up).name), document.createTextNode(" schießt. Tippe ins Tor."));
  }
}

function renderChampion() {
  const r = state.round, f = r.final;
  const w = infoOf(f.winner, r), l = infoOf(f.loser, r);
  els.champName.textContent = w.name;
  els.champMeta.textContent = `Titel Nr. ${titlesOf(f.winner)} · ${SO.scoreLine(f)} im Elfmeterschießen gegen ${l.name}`;
  els.champQuip.textContent = CHAMPION_QUIPS[hash(r.id) % CHAMPION_QUIPS.length];
  const holers = r.picks.map((k) => infoOf(k.id, r).name).concat([l.name]);
  els.champOrder.textContent = "Bierholer dieser Runde: " + holers.map((n, i) => `${i + 1}. ${n}`).join(", ");
  els.stageChamp.classList.toggle("is-new", ui.newChamp);
  requestAnimationFrame(() => fitText(els.champName, 76, 32));
}

function renderGame(animate) {
  let ph = phase();
  if (ph === "spin" && remaining(state.round).length <= 2 && !ui.sheetFor && !ui.spinning) {
    startFinal();
    persist();
    ph = "final";
  }
  els.stageWheel.hidden = !(ph === "idle" || ph === "spin");
  els.stageFinal.hidden = ph !== "final";
  els.stageChamp.hidden = ph !== "done";
  if (ph === "idle" || ph === "spin") syncWheel(animate);
  if (ph === "final") {
    if (!goalBuilt) buildGoal();
    renderFinal();
  }
  if (ph === "done") renderChampion();
  renderChrome();
  if (!ui.spinning && !ui.shooting) {
    const t = tickerFor(ph);
    setTicker(t.label, t.text);
  }
}

/* ---------- Darstellung: Statistik ---------- */
function computeTable(range) {
  const t = range === "today" ? dayStart() : 0;
  const map = new Map();
  const entry = (id, r) => {
    if (!map.has(id)) {
      const i = infoOf(id, r);
      map.set(id, { id, name: i.name, color: i.color, beers: 0, titles: 0, finals: 0 });
    }
    return map.get(id);
  };
  let roundsDone = 0, beers = 0, first = null;
  for (const r of allRounds()) {
    for (const k of r.picks) if (k.at >= t) { entry(k.id, r).beers++; beers++; }
    const f = r.final;
    if (f && f.winner && (f.endedAt || 0) >= t) {
      roundsDone++;
      if (first == null || r.startedAt < first) first = r.startedAt;
      entry(f.winner, r).titles++;
      entry(f.loser, r).beers++;
      beers++;
      entry(f.a, r).finals++;
      entry(f.b, r).finals++;
    }
  }
  const rows = [...map.values()].sort((a, b) => b.beers - a.beers || a.titles - b.titles || a.name.localeCompare(b.name, "de"));
  return { rows, roundsDone, beers, first };
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
function renderStats() {
  const c = champion();
  els.champCard.replaceChildren();
  els.champCard.classList.toggle("is-empty", !c);
  els.champCard.append(crownIcon());
  if (c) {
    const streak = streakOf(c.id);
    els.champCard.append(h("div", "champ-card-name", c.info.name));
    els.champCard.append(h("div", "champ-card-meta",
      `Amtierender Champion seit ${fmtDay(c.since)} · ${titlesOf(c.id)} ${titlesOf(c.id) === 1 ? "Titel" : "Titel gesamt"}` + (streak > 1 ? ` · ${streak}× in Folge` : "")));
  } else {
    els.champCard.append(h("div", "champ-card-name", "Noch frei"));
    els.champCard.append(h("div", "champ-card-meta", "Wer das erste Elfmeterschießen gewinnt, holt sich die Krone."));
  }

  els.rangeToday.setAttribute("aria-pressed", String(ui.range === "today"));
  els.rangeAll.setAttribute("aria-pressed", String(ui.range === "all"));
  const { rows, roundsDone, beers, first } = computeTable(ui.range);
  els.kpis.replaceChildren();
  const since = ui.range === "today" ? "seit 6 Uhr" : first ? "seit " + new Date(first).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
  els.kpis.append(kpi("Runden", String(roundsDone), since));
  els.kpis.append(kpi("Biere", String(beers), ui.range === "today" ? "heute geholt" : "insgesamt"));
  const top = rows[0];
  if (top && top.beers > 0) {
    const tied = rows.filter((r) => r.beers === top.beers).length;
    const unit = top.beers === 1 ? "Bier" : "Biere";
    els.kpis.append(tied > 1 ? kpi("Pechvogel", `${tied} gleichauf`, `je ${top.beers} ${unit}`) : kpi("Pechvogel", top.name, `${top.beers} ${unit}`, top.color));
  } else {
    els.kpis.append(kpi("Pechvogel", "–", "noch offen"));
  }

  els.table.replaceChildren();
  if (!rows.length) {
    els.table.append(h("p", "empty", ui.range === "today" ? "Heute wurde noch kein Bier ausgelost." : "Noch keine Runden gespielt."));
  } else {
    const t = h("div", "table");
    const head = h("div", "t-head");
    ["Spieler", "Biere", "Titel", "Finale"].forEach((x) => head.append(h("span", null, x)));
    t.append(head);
    const max = Math.max(1, ...rows.map((r) => r.beers));
    for (const r of rows) {
      const row = h("div", "t-row");
      row.style.setProperty("--c", r.color);
      const who = h("div", "who");
      who.append(h("span", "dot"), h("span", null, r.name));
      const bar = h("div", "bar");
      const fill = h("i");
      fill.style.width = r.beers ? `calc(${(r.beers / max) * 100}% - 24px)` : "3px";
      bar.append(fill, h("b", null, String(r.beers)));
      row.append(who, bar, h("span", "num" + (r.titles ? " is-gold" : ""), String(r.titles)), h("span", "num", String(r.finals)));
      t.append(row);
    }
    els.table.append(t);
  }

  els.honors.replaceChildren();
  if (!state.rounds.length) {
    els.honors.append(h("p", "empty", "Hier stehen bald alle Champions."));
  } else {
    const ol = h("ol", "honors");
    const list = state.rounds.slice().reverse();
    for (const r of list.slice(0, 20)) {
      const f = r.final;
      const w = infoOf(f.winner, r), l = infoOf(f.loser, r);
      const li = h("li");
      const name = h("span", "honor-name", w.name);
      name.style.color = w.color;
      li.append(crownIcon(), name, h("span", "honor-date", fmtDay(f.endedAt || r.startedAt)));
      li.append(h("span", "honor-meta", `${SO.scoreLine(f)} i. E. gegen ${l.name} · ${r.pot.length} Spieler`));
      ol.append(li);
    }
    els.honors.append(ol);
    if (list.length > 20) els.honors.append(h("p", "caption", `… und ${list.length - 20} ältere Runden.`));
  }
}

/* ---------- Darstellung: Kader ---------- */
function arm(key) {
  clearTimeout(ui.armTimer);
  ui.armed = key;
  ui.armTimer = setTimeout(() => { ui.armed = null; renderSquad(); }, 3500);
}
function disarm() {
  clearTimeout(ui.armTimer);
  ui.armed = null;
}
function renderSquad() {
  const ph = phase();
  const running = ph === "spin" || ph === "final";
  const activeN = activePlayers().length;
  els.squadNote.textContent = `Eingeschaltet heißt: heute dabei. ${activeN} von höchstens ${MAX_WHEEL} sind eingeschaltet.`;
  const ev = beerEvents(allRounds());

  els.roster.replaceChildren();
  for (const p of state.players) {
    const li = h("li", "player" + (p.active ? "" : " is-off"));
    li.style.setProperty("--c", p.color);
    const beers = ev.filter((e) => e.id === p.id).length;
    const titles = titlesOf(p.id);
    const name = h("div", "player-name", p.name);
    name.append(h("span", "player-meta", `${beers} ${beers === 1 ? "Bier" : "Biere"} · ${titles} Titel`));
    const sw = h("label", "switch");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "on-" + p.id;
    cb.checked = p.active;
    cb.addEventListener("change", () => toggleActive(p.id, cb.checked));
    sw.append(cb, h("span", "track"), h("span", "sr", `${p.name} heute dabei`));
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
  els.resetBtn.disabled = !state.rounds.length && !state.round;
}
function toggleActive(id, on) {
  if (on && activePlayers().length >= MAX_WHEEL) {
    toast(`Höchstens ${MAX_WHEEL} Mitspieler aufs Rad.`);
    renderSquad();
    return;
  }
  state.players = state.players.map((p) => (p.id === id ? { ...p, active: on } : p));
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
  state.players.push({ id: uid("p"), name, color, active });
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
  if (p) toast(`${p.name} ist nicht mehr im Kader. Die Statistik bleibt.`);
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
  if (tab === "stats") { renderStats(); views.stats.scrollTop = 0; }
  if (tab === "squad") { disarm(); renderSquad(); views.squad.scrollTop = 0; }
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
els.sheetNext.addEventListener("click", sheetNext);
els.sheetUndo.addEventListener("click", undoLast);
els.sheetBackdrop.addEventListener("click", sheetNext);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.sheetFor) sheetNext(); });
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  if (ui.spinning || ui.shooting) return;
  switchTab(b.dataset.tab);
}));
els.champPill.addEventListener("click", () => { if (!ui.spinning && !ui.shooting) switchTab("stats"); });
els.rangeToday.addEventListener("click", () => { ui.range = "today"; renderStats(); });
els.rangeAll.addEventListener("click", () => { ui.range = "all"; renderStats(); });
els.addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (addPlayer(els.nameInput.value)) els.nameInput.value = "";
});
els.abortBtn.addEventListener("click", () => {
  if (ui.armed !== "abort") { arm("abort"); renderSquad(); return; }
  disarm();
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
  ui.finalLine = null;
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
  state.rounds.push(JSON.parse(JSON.stringify(state.round)));
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
