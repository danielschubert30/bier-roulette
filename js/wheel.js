// Das Glücksrad: zeichnen, drehen und die Zeiger-Mathematik.
//
// Winkel werden im Uhrzeigersinn ab 12 Uhr gemessen. Ohne Gewichte belegt Segment i [i*seg, (i+1)*seg).
// Mit Gewichten (Tippspiel) ist jedes Segment so groß wie sein Anteil an der Summe aller Gewichte;
// genau dieser Anteil ist auch die Wahrscheinlichkeit, gezogen zu werden.
// Ist das Rad um `rotation` Grad im Uhrzeigersinn gedreht, steht unter dem Zeiger (oben)
// der Radwinkel (-rotation) mod 360.

const NS = "http://www.w3.org/2000/svg";
export const C = 200;
export const R = 168;
const BULBS = 24;
const MORPH_MS = 950;

export function polar(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

export function segPath(a0, a1, r = R) {
  if (a1 - a0 >= 359.999) {
    return `M${C} ${C - r} A${r} ${r} 0 1 1 ${C} ${C + r} A${r} ${r} 0 1 1 ${C} ${C - r} Z`;
  }
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M${C} ${C} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function cleanWeights(n, weights) {
  if (!weights || weights.length !== n) return new Array(n).fill(1);
  return weights.map((w) => (isFinite(w) && w > 0 ? w : 1));
}

// Grenzen der Segmente in Grad: n+1 Werte von 0 bis 360
export function segBounds(n, weights) {
  const w = cleanWeights(n, weights);
  const sum = w.reduce((a, b) => a + b, 0);
  const out = [0];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += w[i];
    out.push(i === n - 1 ? 360 : (acc / sum) * 360);
  }
  return out;
}

export function indexAtPointer(rotation, n, weights) {
  const phi = ((-rotation % 360) + 360) % 360;
  if (!weights) return Math.floor(phi / (360 / n)) % n;
  const b = segBounds(n, weights);
  for (let i = 0; i < n; i++) if (phi < b[i + 1]) return i;
  return n - 1;
}

// Zielrotation, bei der das Segment `idx` unter dem Zeiger stehen bleibt.
// Der Haltepunkt liegt zufällig im inneren Bereich des Segments, nie auf einer Kante.
export function targetRotation(current, idx, n, rnd, turns, weights) {
  let a0, a1;
  if (weights) {
    const b = segBounds(n, weights);
    a0 = b[idx];
    a1 = b[idx + 1];
  } else {
    const seg = 360 / n;
    a0 = idx * seg;
    a1 = a0 + seg;
  }
  const phi = a0 + (0.12 + 0.76 * rnd()) * (a1 - a0);
  const base = (((-phi - current) % 360) + 360) % 360;
  return current + turns * 360 + base;
}

// Zieht einen Index mit Wahrscheinlichkeit proportional zum Gewicht (r: Zufallszahl 0 bis 1)
export function weightedIndex(weights, r) {
  const w = cleanWeights(weights.length, weights);
  const sum = w.reduce((a, b) => a + b, 0);
  let x = r * sum;
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x < 0) return i;
  }
  return w.length - 1;
}

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

export function createWheel(svg, { logoHref }) {
  svg.setAttribute("viewBox", "0 0 400 400");
  svg.replaceChildren();

  const defs = el("defs");
  const sheen = el("radialGradient", { id: "wheelSheen", cx: "50%", cy: "50%", r: "50%" });
  const s1 = el("stop", { offset: "52%" });
  s1.style.cssText = "stop-color: var(--wheel-sheen-in); stop-opacity: 0";
  const s2 = el("stop", { offset: "100%" });
  s2.style.cssText = "stop-color: var(--wheel-sheen-out); stop-opacity: 0.42";
  sheen.append(s1, s2);
  defs.append(sheen);
  svg.append(defs);

  svg.append(el("circle", { class: "wheel-rim", cx: C, cy: C, r: 186 }));
  const bulbs = el("g", { class: "wheel-bulbs" });
  for (let i = 0; i < BULBS; i++) {
    const [x, y] = polar(177, (i + 0.5) * (360 / BULBS));
    const b = el("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: "3.1", class: "bulb" });
    b.style.animationDelay = (-(i / BULBS) * 0.9).toFixed(3) + "s";
    bulbs.append(b);
  }
  svg.append(bulbs);
  const rotor = el("g", { class: "wheel-rotor" });
  svg.append(rotor);
  svg.append(el("circle", { cx: C, cy: C, r: R, fill: "url(#wheelSheen)", "pointer-events": "none" }));
  svg.append(el("circle", { class: "wheel-hub", cx: C, cy: C, r: 45 }));
  if (logoHref) {
    svg.append(el("image", { href: logoHref, x: 175, y: 167, width: 50, height: 66, preserveAspectRatio: "xMidYMid meet" }));
  }
  const pointer = el("path", { class: "wheel-pointer", d: "M200 56 L185 22 A15 15 0 0 1 215 22 Z" });
  svg.append(pointer);

  let rotation = 0;
  let players = [];
  let weights = [];       // gültige Gewichte (Zeiger-Mathematik und Ziel jeder Bewegung)
  let shown = [];         // gerade gezeichnete Gewichte (weichen während einer Bewegung ab)
  let segEls = [], labelEls = [], baseFs = [];
  let morphRaf = 0;

  function apply() {
    rotor.setAttribute("transform", `rotate(${rotation.toFixed(3)} ${C} ${C})`);
  }

  // Segmente und Beschriftungen für die Gewichte `ws` setzen
  function layout(ws) {
    shown = ws.slice();
    const n = players.length;
    const b = segBounds(n, ws);
    for (let i = 0; i < n; i++) {
      segEls[i].setAttribute("d", segPath(b[i], b[i + 1]));
      const mid = (b[i] + b[i + 1]) / 2;
      const span = ((b[i + 1] - b[i]) * Math.PI) / 180;
      const [x, y] = polar(R * 0.6, mid);
      const rot = n === 1 ? 0 : mid <= 180 ? mid - 90 : mid + 90;
      // Schmale Felder: Schrift so klein, dass sie ins Feld passt
      const fs = Math.max(8, Math.min(baseFs[i], span * R * 0.5));
      const t = labelEls[i];
      t.setAttribute("x", x.toFixed(2));
      t.setAttribute("y", y.toFixed(2));
      t.setAttribute("font-size", fs.toFixed(1));
      t.setAttribute("transform", `rotate(${rot.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);
    }
  }

  function stopMorph() {
    if (!morphRaf) return;
    cancelAnimationFrame(morphRaf);
    morphRaf = 0;
    layout(weights);
  }

  function morph(from, to) {
    if (morphRaf) cancelAnimationFrame(morphRaf);
    const t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / MORPH_MS);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      layout(from.map((w, i) => w + (to[i] - w) * e));
      if (t < 1) { morphRaf = requestAnimationFrame(frame); return; }
      morphRaf = 0;
      layout(to);
    };
    morphRaf = requestAnimationFrame(frame);
  }

  // list: [{id, name, color, absent, w}] – w ist das Gewicht (Feldgröße), Standard 1.
  // opts.morph: Bleiben dieselben Spieler und ändern sich nur die Gewichte, wachsen/schrumpfen die Felder sichtbar.
  function draw(list, emptyText, opts = {}) {
    const key = (l) => l.map((p) => p.id + "\u0001" + p.name).join("|");
    const prevKey = key(players);
    const next = list.slice();
    const n = next.length;
    const newW = next.map((p) => (isFinite(p.w) && p.w > 0 ? p.w : 1));
    const sameIds = n > 1 && prevKey === key(next) && segEls.length === n;
    if (sameIds) {
      players = next;
      players.forEach((p, i) => {
        segEls[i].style.fill = p.color;
        segEls[i].classList.toggle("is-absent", !!p.absent);
        labelEls[i].classList.toggle("is-absent", !!p.absent);
      });
      const changed = newW.some((w, i) => Math.abs(w - weights[i]) > 1e-6);
      weights = newW;
      if (!changed) return;
      if (opts.morph) {
        morph(shown.slice(), newW);
      } else {
        if (morphRaf) { cancelAnimationFrame(morphRaf); morphRaf = 0; }
        layout(newW);
      }
      return;
    }
    stopMorph();
    players = next;
    weights = newW;
    rotor.replaceChildren();
    segEls = [];
    labelEls = [];
    baseFs = [];
    if (n === 0) {
      rotor.append(el("circle", { cx: C, cy: C, r: R, class: "wheel-empty" }));
      const t = el("text", { x: C, y: C + 84, class: "wheel-empty-text", "text-anchor": "middle" });
      t.textContent = emptyText || "";
      rotor.append(t);
      apply();
      return;
    }
    players.forEach((p) => {
      const path = el("path", { class: "wheel-seg" + (p.absent ? " is-absent" : ""), "data-id": p.id });
      path.style.fill = p.color;
      rotor.append(path);
      segEls.push(path);
    });
    const room = R * 0.6;
    players.forEach((p) => {
      let fs = n <= 3 ? 28 : n <= 5 ? 25 : n === 6 ? 23 : n <= 8 ? 20 : n <= 10 ? 17 : 15;
      if (p.name.length * fs * 0.5 > room) fs = Math.max(11, room / (p.name.length * 0.5));
      const t = el("text", {
        class: "wheel-label" + (p.absent ? " is-absent" : ""), "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": fs.toFixed(1), x: C, y: C
      });
      t.textContent = p.name;
      rotor.append(t);
      // Tatsächliche Breite messen (Schrift kann breiter sein als geschätzt) und notfalls verkleinern
      try {
        const len = t.getComputedTextLength();
        if (len > room) fs = Math.max(10, (fs * room) / len);
      } catch (e) { /* Rad gerade unsichtbar: Schätzung genügt */ }
      labelEls.push(t);
      baseFs.push(fs);
    });
    layout(weights);
    apply();
  }

  function highlight(id) {
    rotor.querySelectorAll(".wheel-seg.is-win").forEach((p) => p.classList.remove("is-win"));
    if (!id) return;
    const path = rotor.querySelector(`.wheel-seg[data-id="${CSS.escape(id)}"]`);
    if (!path) return;
    path.classList.add("is-win");
    const firstLabel = rotor.querySelector("text");
    if (firstLabel) rotor.insertBefore(path, firstLabel);
  }

  // Dreht so, dass Segment `idx` unter dem Zeiger landet. Gibt den Index zurück,
  // der nach dem Stillstand wirklich unter dem Zeiger steht.
  function spinTo(idx, { rnd, duration, turns, onTick, reduceMotion }) {
    stopMorph();
    const n = players.length;
    const ws = weights.slice();
    const from = rotation;
    const target = targetRotation(from, idx, n, rnd, turns, ws);
    svg.classList.remove("is-celebrating");
    if (!reduceMotion) svg.classList.add("is-spinning");
    return new Promise((resolve) => {
      let last = indexAtPointer(from, n, ws);
      const t0 = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - t, 4);
        rotation = from + (target - from) * e;
        apply();
        const cur = indexAtPointer(rotation, n, ws);
        if (cur !== last) {
          last = cur;
          if (onTick) onTick();
          if (!reduceMotion && pointer.animate) {
            pointer.animate([{ transform: "rotate(-16deg)" }, { transform: "rotate(0deg)" }], { duration: 140, easing: "ease-out" });
          }
        }
        if (t < 1) {
          requestAnimationFrame(frame);
          return;
        }
        rotation = ((target % 360) + 360) % 360;
        apply();
        svg.classList.remove("is-spinning");
        resolve(indexAtPointer(rotation, n, ws));
      };
      requestAnimationFrame(frame);
    });
  }

  function celebrate(color) {
    svg.style.setProperty("--win", color);
    svg.classList.remove("is-celebrating");
    void svg.getBoundingClientRect();
    svg.classList.add("is-celebrating");
  }

  return {
    draw, spinTo, highlight, celebrate, stopMorph,
    get players() { return players; },
    get weights() { return weights.slice(); }
  };
}
