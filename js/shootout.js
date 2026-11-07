// Regeln des Elfmeterschießens im Finale.
// Je 5 Schüsse abwechselnd, vorzeitige Entscheidung, danach Sudden Death.
// Der Schütze wählt die Ecke, der Torwart springt zufällig. Trefferquote insgesamt etwa 71 %.

export const KICKS = 5;
export const AIMS = ["L", "C", "R"];

export function newFinal(a, b, rnd) {
  return { a, b, first: rnd() < 0.5 ? a : b, shots: [], winner: null, loser: null, endedAt: null };
}

export function other(final, id) {
  return id === final.a ? final.b : final.a;
}

export function goals(final, id) {
  return final.shots.filter((s) => s.by === id && s.result === "goal").length;
}

export function taken(final, id) {
  return final.shots.filter((s) => s.by === id).length;
}

export function nextShooter(final) {
  return final.shots.length % 2 === 0 ? final.first : other(final, final.first);
}

export function decide(final) {
  const { a, b } = final;
  const ga = goals(final, a), gb = goals(final, b);
  const na = taken(final, a), nb = taken(final, b);
  if (na <= KICKS && nb <= KICKS) {
    if (ga + (KICKS - na) < gb) return b;
    if (gb + (KICKS - nb) < ga) return a;
  }
  if (na === nb && na >= KICKS && ga !== gb) return ga > gb ? a : b;
  return null;
}

export function resolveShot(aim, rnd) {
  const dive = AIMS[Math.floor(rnd() * 3)];
  if (rnd() < 0.07) return { aim, dive, result: rnd() < 0.5 ? "post" : "over" };
  if (dive === aim && rnd() < 0.7) return { aim, dive, result: "save" };
  return { aim, dive, result: "goal" };
}

// Ergebnis aus Sicht des Siegers, z. B. "4:3"
export function scoreLine(final) {
  if (!final.winner) return `${goals(final, final.a)}:${goals(final, final.b)}`;
  return `${goals(final, final.winner)}:${goals(final, final.loser)}`;
}
