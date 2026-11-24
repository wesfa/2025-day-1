// Safety net for the app's data, kept in IndexedDB (a second storage area next to localStorage):
// - a mirror copy of every save, used to recover if the main copy goes missing or is older
// - restore points: automatic copies taken each day and before every app update
// Everything here stays on the phone. Removing the app from the home screen still deletes it,
// so exported backups remain the only protection against that.

const DB_NAME = 'macros-vault';
const STORE = 'kv';
const MAX_SNAPS = 14;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; }
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('IndexedDB blocked'));
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

export async function vget(key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function vset(key, value) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function vdel(key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

async function vkeys() {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).getAllKeys();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

// ---------- mirror ----------
export function mirror(json) {
  return vset('state', json).catch((e) => console.warn('mirror failed', e));
}
export function readMirror() {
  return vget('state').catch(() => null);
}

// ---------- restore points ----------
export async function snapshot(label, json) {
  if (!json) return;
  try {
    const at = Date.now();
    await vset(`snap:${String(at).padStart(15, '0')}`, { at, label, json });
    const keys = (await vkeys()).filter((k) => String(k).startsWith('snap:')).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SNAPS))) await vdel(k);
  } catch (e) {
    console.warn('snapshot failed', e);
  }
}

export async function listSnapshots() {
  try {
    const keys = (await vkeys()).filter((k) => String(k).startsWith('snap:')).sort().reverse();
    const out = [];
    for (const k of keys) { const v = await vget(k); if (v) out.push({ key: k, ...v }); }
    return out;
  } catch (e) {
    return [];
  }
}
