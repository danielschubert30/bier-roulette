let user = null;
const auth = { get currentUser() { return user; }, authStateReady: async () => {} };
export function getAuth() { return auth; }
export async function signInAnonymously() {
  const res = JSON.parse(await window.__fb("auth", "{}"));
  if (res.error) { const e = new Error(res.error); e.code = res.error; throw e; }
  user = { uid: res.value };
  return { user };
}
export function onAuthStateChanged(a, cb) { cb(user); return () => {}; }
