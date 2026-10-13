/**
 * PERSISTANCE — ecriture atomique, copie de secours, adaptateurs.
 *
 * Un telephone Android peut tuer le processus a n'importe quel instant :
 * appel entrant, memoire basse, onglet ecrase. Une sauvegarde qui n'est
 * pas ecrite atomiquement perd la partie du joueur dans ce cas.
 *
 * Protocole : on ecrit la nouvelle version dans une cle `pending`,
 * on la copie dans la cle principale, puis on met a jour la copie de
 * secours avec l'ancienne version. Si le processus meurt au milieu, le
 * chargement lit `pending` puis `main` puis `backup`.
 */

import { loadSave, createSave, SAVE_VERSION } from './schema.js';

const KEY = 'dernier-refuge.save.v1';

/** Adaptateur memoire : sert aux tests et au repli securise. */
export function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    kind: 'memory',
    get: (k) => (map.has(k) ? map.get(k) : null),
    set: (k, v) => map.set(k, v),
    del: (k) => map.delete(k),
    keys: () => [...map.keys()],
  };
}

/** localStorage : synchronise, fiable, mais plafonne (~5 Mo). */
export function webStorage(local) {
  return {
    kind: 'localStorage',
    get: (k) => local.getItem(k),
    set: (k, v) => local.setItem(k, v),
    del: (k) => local.removeItem(k),
    keys: () => Object.keys(local),
  };
}

async function readRaw(store, key) {
  const s = await store.get(key);
  if (s == null) return { value: null, error: null };
  try {
    return { value: typeof s === 'string' ? JSON.parse(s) : s, error: null };
  } catch {
    return { value: null, error: 'json_illisible' };
  }
}

const writeRaw = (store, key, value) => store.set(key, JSON.stringify(value));

const readCandidate = async (store, key) => {
  const probe = await store.get(key);
  if (probe == null) return null;
  const { value, error } = await readRaw(store, key);
  if (error) return { key, error };
  const res = loadSave(value);
  if (!res.ok) return { key, error: res.problems.join(',') };
  return { key, save: res.save, ok: true };
};

/**
 * Ecriture atomique. Le `pending` n'est efface qu'apres la copie
 * principale : une coupure au milieu laisse toujours une version
 * coherente, et la version anterieure reste dans le secours.
 */
export async function writeSave(store, save, now = 0) {
  const payload = { ...save, version: SAVE_VERSION, savedAt: now };
  await writeRaw(store, `${KEY}.pending`, payload);
  const previous = await readRaw(store, KEY);
  if (previous.value) await writeRaw(store, `${KEY}.backup`, previous.value);
  await writeRaw(store, KEY, payload);
  await store.del(`${KEY}.pending`);
  return payload;
}

/**
 * Charge la meilleure sauvegarde disponible. On ne prend pas la premiere
 * trouvee : on compare les `savedAt` et on garde la plus recente. C'est ce
 * qui protege le joueur d'une sauvegarde ancienne venue d'une autre
 * version du jeu, ou d'une restauration cloud en retard.
 */
export async function readSave(store) {
  const problems = [];
  const candidates = [];
  for (const key of [`${KEY}.pending`, KEY, `${KEY}.backup`]) {
    const c = await readCandidate(store, key);
    if (!c) continue;
    if (!c.ok) {
      problems.push(`${key}:${c.error}`);
      continue;
    }
    candidates.push(c);
  }
  if (candidates.length === 0) return { ok: false, problems, save: null };

  candidates.sort((a, b) => (b.save.savedAt ?? 0) - (a.save.savedAt ?? 0));
  return { ok: true, source: candidates[0].key, problems, save: candidates[0].save };
}

export async function clearSave(store) {
  await store.del(KEY);
  await store.del(`${KEY}.pending`);
  await store.del(`${KEY}.backup`);
}

/**
 * Boutique de sauvegarde. `backend` est asynchrone ou synchrone : on
 * normalise en promesses pour que l'appelant ne s'en occupe pas.
 */
export class SaveStore {
  constructor(store = memoryStorage(), now = () => Date.now()) {
    this.store = store;
    this.now = now;
    this.cache = null;
  }

  async backend() {
    if (this.store.kind === 'localStorage') return this.store;
    try {
      const idb = await openIdb();
      if (idb) return idb;
    } catch {
      /* pas d'IndexedDB : on reste sur l'adaptateur fourni */
    }
    return this.store;
  }

  /** Charge une sauvegarde migree et validee. Jamais d'exception. */
  async load() {
    const be = await this.backend();
    const res = await readSave(be);
    if (!res.ok) {
      this.cache = createSave({ now: this.now() });
      this.cache.__fresh = true;
      return { ...res, save: this.cache };
    }
    this.cache = res.save;
    return res;
  }

  /**
   * Sauvegarde automatique. Ne leve JAMAIS : un quota plein ou un stockage
   * refuse l'ecriture doit laisser la session en cours intacte. On se
   * contente de consigner l'echec pour l'afficher plus tard.
   */
  async save(patch) {
    const next = { ...(this.cache ?? createSave({ now: this.now() })), ...patch };
    if (patch?.meta) next.meta = { ...next.meta, ...patch.meta };
    if (patch?.world) next.world = { ...next.world, ...patch.world };
    const now = this.now();
    this.cache = next;
    try {
      const be = await this.backend();
      await writeSave(be, next, now);
      this.lastError = null;
      return { ok: true, save: this.cache };
    } catch (err) {
      this.lastError = String(err?.message ?? err);
      return { ok: false, save: this.cache, error: this.lastError };
    }
  }

  async reset() {
    const be = await this.backend();
    await clearSave(be);
    this.cache = createSave({ now: this.now() });
    return this.cache;
  }
}

/** IndexedDB : lecapacite dont le joueur dispose reellement sur mobile. */
export async function openIdb(name = 'dernier-refuge', storeName = 'saves') {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = (mode) => db.transaction(storeName, mode).objectStore(storeName);
      resolve({
        kind: 'idb',
        get: (k) =>
          new Promise((res, rej) => {
            const r = tx('readonly').get(k);
            r.onsuccess = () => res(r.result ?? null);
            r.onerror = () => rej(r.error);
          }),
        set: (k, v) =>
          new Promise((res, rej) => {
            const t = db.transaction(storeName, 'readwrite');
            t.objectStore(storeName).put(v, k);
            t.oncomplete = () => res();
            t.onerror = () => rej(t.error);
          }),
        del: (k) =>
          new Promise((res, rej) => {
            const t = db.transaction(storeName, 'readwrite');
            t.objectStore(storeName).delete(k);
            t.oncomplete = () => res();
            t.onerror = () => rej(t.error);
          }),
        keys: () =>
          new Promise((res) => {
            const r = tx('readonly').getAllKeys();
            r.onsuccess = () => res(r.result ?? []);
          }),
      });
    };
  });
}