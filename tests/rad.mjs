// Zeiger-Mathematik des Rads (js/wheel.js): angezeigt wird immer das Feld unter dem Zeiger. Start: node tests/rad.mjs
import { indexAtPointer, targetRotation, weightedIndex, segBounds } from "../js/wheel.js";
let bad = 0, runs = 0;
const rnd = Math.random;
// 1) Zeiger zeigt immer das gewünschte Segment – gleich große und gewichtete Felder
for (let k = 0; k < 200000; k++) {
  const n = 1 + Math.floor(rnd() * 12);
  const ws = rnd() < 0.3 ? null : Array.from({ length: n }, () => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75][Math.floor(rnd() * 7)]);
  const idx = Math.floor(rnd() * n);
  let cur = rnd() * 3600 - 1800;
  const target = targetRotation(cur, idx, n, rnd, 6 + Math.floor(rnd() * 3), ws);
  const final = ((target % 360) + 360) % 360;
  const got = indexAtPointer(final, n, ws || undefined);
  runs++; if (got !== idx) { bad++; if (bad < 5) console.log("FEHLER", { n, ws, idx, got, final }); }
}
console.log(`Zeiger-Test: ${runs} Drehungen, Fehler: ${bad}`);
// 2) Gleiche Gewichte = alte Formel
let diff = 0;
for (let k = 0; k < 50000; k++) {
  const n = 2 + Math.floor(rnd() * 11), r = rnd() * 720 - 360;
  if (indexAtPointer(r, n) !== indexAtPointer(r, n, new Array(n).fill(1))) diff++;
}
console.log(`Gleiche Felder wie bisher: Abweichungen ${diff} (an exakten Kanten möglich)`);
// 3) Häufigkeit entspricht der Feldgröße
const ws = [0.25, 1, 1.75, 1, 0.5, 1.5];
const sum = ws.reduce((a, b) => a + b, 0);
const cnt = new Array(ws.length).fill(0);
const N = 600000;
for (let k = 0; k < N; k++) cnt[weightedIndex(ws, rnd())]++;
console.log("Gewicht -> erwartet / gemessen:");
ws.forEach((w, i) => console.log(`  ${w.toFixed(2)} -> ${(100 * w / sum).toFixed(2)} % / ${(100 * cnt[i] / N).toFixed(2)} %`));
// 4) Feldwinkel = Anteil
const b = segBounds(ws.length, ws);
console.log("Feldwinkel:", ws.map((w, i) => (b[i + 1] - b[i]).toFixed(1) + "°").join(" "), "| Summe", b[ws.length]);
