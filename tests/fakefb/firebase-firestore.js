async function call(op, payload) {
  const res = JSON.parse(await window.__fb(op, JSON.stringify(payload || {})));
  if (res.error) { const e = new Error(res.error); e.code = res.error; throw e; }
  return res.value;
}
export function initializeFirestore() { return { kind: "db" }; }
export function getFirestore() { return { kind: "db" }; }
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export function doc(db, ...segs) { return { type: "doc", path: segs.join("/"), id: segs[segs.length - 1] }; }
export function collection(db, ...segs) { return { type: "coll", path: segs.join("/") }; }
const copy = (d) => JSON.parse(JSON.stringify(d));
const docSnap = (path, data) => ({ id: path.split("/").pop(), exists: () => data != null, data: () => (data == null ? undefined : copy(data)), metadata: { fromCache: false, hasPendingWrites: false } });
const cache = new Map();
let ver = 0, polling = false, first = false;
const subs = new Set();
const parent = (p) => p.split("/").slice(0, -1).join("/");
function deliver(s) {
  if (s.ref.type === "doc") { s.next(docSnap(s.ref.path, cache.has(s.ref.path) ? cache.get(s.ref.path) : null)); return; }
  const docs = [...cache.entries()].filter(([p]) => parent(p) === s.ref.path).map(([p, d]) => docSnap(p, d));
  s.next({ docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false }, forEach: (f) => docs.forEach(f) });
}
async function poll() {
  if (polling) return;
  polling = true;
  for (;;) {
    try {
      const res = await call("poll", { since: ver });
      for (const ch of res.changes) { if (ch.data == null) cache.delete(ch.path); else cache.set(ch.path, ch.data); }
      ver = res.ver;
      first = true;
      const paths = res.changes.map((c) => c.path);
      for (const s of [...subs]) {
        const hit = paths.some((p) => (s.ref.type === "doc" ? p === s.ref.path : parent(p) === s.ref.path));
        if (!s.init || hit) { s.init = true; try { deliver(s); } catch (e) { console.error(e); } }
      }
    } catch (e) { /* offline: weiter versuchen */ }
    await new Promise((r) => setTimeout(r, 120));
  }
}
export function onSnapshot(ref, next, err) {
  const s = { ref, next, err, init: false };
  subs.add(s);
  if (first) { s.init = true; setTimeout(() => deliver(s), 0); }
  poll();
  return () => subs.delete(s);
}
export async function runTransaction(db, fn) {
  for (let i = 0; i < 5; i++) {
    const reads = {}, writes = [];
    const tx = {
      get: async (ref) => { const r = await call("get", { path: ref.path }); reads[ref.path] = r.v; return docSnap(ref.path, r.data); },
      set: (ref, data, opts) => { writes.push({ op: "set", path: ref.path, data, merge: !!(opts && opts.merge) }); return tx; },
      delete: (ref) => { writes.push({ op: "delete", path: ref.path }); return tx; }
    };
    const result = await fn(tx);
    if (await call("commit", { reads, writes })) return result;
  }
  const e = new Error("aborted"); e.code = "aborted"; throw e;
}
export function writeBatch() {
  const writes = [];
  const b = {
    set(ref, data, opts) { writes.push({ op: "set", path: ref.path, data, merge: !!(opts && opts.merge) }); return b; },
    delete(ref) { writes.push({ op: "delete", path: ref.path }); return b; },
    commit: () => call("commit", { reads: {}, writes }).then(() => undefined)
  };
  return b;
}
export async function getDoc(ref) { const r = await call("get", { path: ref.path }); return docSnap(ref.path, r.data); }
export async function setDoc(ref, data, opts) { await call("commit", { reads: {}, writes: [{ op: "set", path: ref.path, data, merge: !!(opts && opts.merge) }] }); }
