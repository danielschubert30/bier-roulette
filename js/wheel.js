// Das Glücksrad: zeichnen, drehen und die Zeiger-Mathematik.
//
// Winkel werden im Uhrzeigersinn ab 12 Uhr gemessen. Segment i belegt [i*seg, (i+1)*seg).
// Ist das Rad um `rotation` Grad im Uhrzeigersinn gedreht, steht unter dem Zeiger (oben)
// der Radwinkel (-rotation) mod 360.

const NS = "http://www.w3.org/2000/svg";
export const C = 200;
export const R = 168;
const BULBS = 24;

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

export function indexAtPointer(rotation, n) {
  const phi = ((-rotation % 360) + 360) % 360;
  return Math.floor(phi / (360 / n)) % n;
}

// Zielrotation, bei der das Segment `idx` unter dem Zeiger stehen bleibt.
// Der Haltepunkt liegt zufällig im inneren Bereich des Segments, nie auf einer Kante.
export function targetRotation(current, idx, n, rnd, turns) {
  const seg = 360 / n;
  const phi = (idx + 0.12 + 0.76 * rnd()) * seg;
  const base = (((-phi - current) % 360) + 360) % 360;
  return current + turns * 360 + base;
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

  function apply() {
    rotor.setAttribute("transform", `rotate(${rotation.toFixed(3)} ${C} ${C})`);
  }

  function draw(list, emptyText) {
    players = list.slice();
    rotor.replaceChildren();
    const n = players.length;
    if (n === 0) {
      rotor.append(el("circle", { cx: C, cy: C, r: R, class: "wheel-empty" }));
      const t = el("text", { x: C, y: C + 84, class: "wheel-empty-text", "text-anchor": "middle" });
      t.textContent = emptyText || "";
      rotor.append(t);
      apply();
      return;
    }
    const seg = 360 / n;
    players.forEach((p, i) => {
      const path = el("path", { d: segPath(i * seg, (i + 1) * seg), class: "wheel-seg" + (p.absent ? " is-absent" : ""), "data-id": p.id });
      path.style.fill = p.color;
      rotor.append(path);
    });
    players.forEach((p, i) => {
      const mid = (i + 0.5) * seg;
      const [x, y] = polar(R * 0.6, mid);
      const rot = n === 1 ? 0 : mid <= 180 ? mid - 90 : mid + 90;
      let fs = n <= 3 ? 28 : n <= 5 ? 25 : n === 6 ? 23 : 20;
      const room = R * 0.6;
      if (p.name.length * fs * 0.5 > room) fs = Math.max(11, room / (p.name.length * 0.5));
      const t = el("text", {
        x: x.toFixed(2), y: y.toFixed(2), class: "wheel-label" + (p.absent ? " is-absent" : ""),
        "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs.toFixed(1),
        transform: `rotate(${rot.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`
      });
      t.textContent = p.name;
      rotor.append(t);
      // Tatsächliche Breite messen (Schrift kann breiter sein als geschätzt) und notfalls verkleinern
      try {
        const len = t.getComputedTextLength();
        if (len > room) t.setAttribute("font-size", Math.max(10, (fs * room) / len).toFixed(1));
      } catch (e) { /* Rad gerade unsichtbar: Schätzung genügt */ }
    });
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
    const n = players.length;
    const from = rotation;
    const target = targetRotation(from, idx, n, rnd, turns);
    svg.classList.remove("is-celebrating");
    if (!reduceMotion) svg.classList.add("is-spinning");
    return new Promise((resolve) => {
      let last = indexAtPointer(from, n);
      const t0 = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - t, 4);
        rotation = from + (target - from) * e;
        apply();
        const cur = indexAtPointer(rotation, n);
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
        resolve(indexAtPointer(rotation, n));
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

  return { draw, spinTo, highlight, celebrate, get players() { return players; } };
}
