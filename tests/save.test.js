import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSave,
  validateSave,
  migrate,
  loadSave,
  defaultSettings,
  SAVE_VERSION,
} from '../src/persist/schema.js';
import { memoryStorage, webStorage, writeSave, readSave, clearSave, SaveStore } from '../src/persist/store.js';

test('sauvegarde neuve : elle est deja valide, aucune migration necessaire', () => {
  const s = createSave({ now: 0 });
  const res = validateSave(s);
  assert.equal(res.ok, true);
  assert.deepEqual(res.problems, []);
  assert.equal(res.save.version, SAVE_VERSION);
});

test('sauvegarde neuve : tous les reglages par defaut sont presents', () => {
  const def = defaultSettings();
  for (const key of ['master', 'music', 'sfx', 'haptics', 'reducedEffects', 'sensitivity']) {
    assert.ok(key in def, `reglage manquant : ${key}`);
  }
});

test('migration : v1 -> version courante sans perte de progression', () => {
  const old = { version: 1, meta: { classId: 'chasseur', scrap: 44, level: 3 }, world: {} };
  const res = loadSave(old);
  assert.equal(res.ok, true);
  assert.equal(res.migratedFrom, 1);
  assert.equal(res.save.meta.classId, 'chasseur');
  assert.equal(res.save.meta.scrap, 44);
  assert.equal(res.save.meta.level, 3);
  assert.equal(res.save.meta.refugeLevel, 1, 'champ absent complete a une valeur saine');
});

test('migration : v2 -> v3 cree l ascension du refuge', () => {
  const old = { version: 2, meta: { classId: 'porteuse', scrap: 10 }, world: {} };
  const res = loadSave(old);
  assert.equal(res.ok, true);
  assert.equal(res.save.meta.refugeLevel, 1);
  assert.deepEqual(res.save.meta.upgrades, []);
});

test('migration : une sauvegarde sans version est traitee comme v1', () => {
  const res = loadSave({ meta: { scrap: 5 } });
  assert.equal(res.ok, true);
  assert.equal(res.migratedFrom, 1);
  assert.equal(res.save.meta.scrap, 5);
});

test('migration : une version plus recente que la nôtre est refusee, pas devinee', () => {
  const res = loadSave({ version: SAVE_VERSION + 5, meta: {} });
  assert.equal(res.ok, false);
  assert.match(res.problems.join(), /version_trop_recente/);
});

test('validation : une classe inconnue est rejetee sans casser le reste', () => {
  const bad = createSave();
  bad.meta.classId = 'paladin';
  bad.meta.scrap = 99;
  const res = validateSave(bad);
  assert.equal(res.ok, true);
  assert.ok(res.problems.includes('classe_inconnue'));
  assert.equal(res.save.meta.classId, null);
  assert.equal(res.save.meta.scrap, 99, 'le reste est conserve');
});

test('validation : des valeurs hors bornes sont ramenees, jamais NaN', () => {
  const bad = createSave();
  bad.meta.level = -4;
  bad.meta.scrap = Number.NaN;
  const res = validateSave(bad);
  assert.equal(res.save.meta.level, 1);
  assert.equal(res.save.meta.scrap, 0);
  assert.ok(!res.save.meta.scrap !== res.save.meta.scrap, 'jamais NaN');
});

test('validation : une recompense inconnue est retirees de la progression', () => {
  const s = createSave();
  s.meta.uniques = ['ward_of_the_house', 'tr_coffre_legendaire'];
  const res = validateSave(s);
  assert.deepEqual(res.save.meta.uniques, ['ward_of_the_house']);
});

test('validation : du bruit dans les tableaux ne fait pas planter', () => {
  const s = createSave();
  s.meta.discoveries = ['note_pile', 42, null, { a: 1 }];
  const res = validateSave(s);
  assert.deepEqual(res.save.meta.discoveries, ['note_pile']);
});

test('validation : une donnee non objet est signalee, pas propagee', () => {
  assert.equal(validateSave(null).ok, false);
  assert.equal(validateSave('plop').ok, false);
  assert.equal(validateSave(42).ok, false);
});

test('persistance : ecrire puis relire redonne la meme partie', async () => {
  const store = memoryStorage();
  const save = createSave({ now: 0 });
  save.meta.classId = 'survivante';
  save.meta.scrap = 137;
  save.meta.discoveries = ['record_gare'];
  await writeSave(store, save, 1000);
  const res = await readSave(store);
  assert.equal(res.ok, true);
  assert.equal(res.save.meta.scrap, 137);
  assert.deepEqual(res.save.meta.discoveries, ['record_gare']);
});

test('persistance : la cle pending est purgee apres une ecriture reussie', async () => {
  const store = memoryStorage();
  await writeSave(store, createSave(), 1);
  assert.equal(store.get('dernier-refuge.save.v1.pending'), null);
});

test('persistance : une coupure en cours d ecriture laisse une version coherente', async () => {
  const store = memoryStorage();
  const good = createSave();
  good.meta.scrap = 10;
  await writeSave(store, good, 1);

  // Simulation de la mort du processus : on ecrit le pending, puis plus rien.
  const newer = { ...createSave(), savedAt: 999 };
  newer.meta.scrap = 500;
  store.set('dernier-refuge.save.v1.pending', JSON.stringify(newer));

  const res = await readSave(store);
  assert.equal(res.ok, true);
  assert.equal(res.source, 'dernier-refuge.save.v1.pending');
  assert.equal(res.save.meta.scrap, 500, 'la partie la plus recente est conservee');
});

test('persistance : la copie principale corrompue bascule sur le secours', async () => {
  const store = memoryStorage();
  const first = createSave();
  first.meta.scrap = 11;
  await writeSave(store, first, 1);
  const second = createSave();
  second.meta.scrap = 22;
  await writeSave(store, second, 2);

  store.set('dernier-refuge.save.v1', '{ ceci n est pas du json');
  const res = await readSave(store);
  assert.equal(res.ok, true);
  assert.equal(res.save.meta.scrap, 11, 'retour a la derniere version saine');
  assert.ok(res.problems.some((p) => p.includes('json_illisible')));
});

test('persistance : une sauvegarde ancienne par-dessus une recente ne la corrompt pas', async () => {
  const store = memoryStorage();
  const recent = createSave();
  recent.meta.scrap = 900;
  await writeSave(store, recent, 50);
  await writeSave(store, (() => { const s = createSave(); s.meta.scrap = 901; return s; })(), 60);

  // Une autre version du jeu, ou une restauration cloud en retard, ecrase
  // la cle principale avec une partie plus ancienne. Elle ne doit pas gagner.
  const stale = { version: 1, savedAt: 5, meta: { scrap: 5 }, world: {} };
  store.set('dernier-refuge.save.v1', JSON.stringify(stale));

  const res = await readSave(store);
  assert.equal(res.ok, true);
  assert.equal(res.save.meta.scrap, 900, 'on ne remplace pas une partie etrangere par une ancienne');
});

test('persistence : effacer laisse repartir d une partie neuve sans erreur', async () => {
  const store = memoryStorage();
  await writeSave(store, createSave(), 1);
  await clearSave(store);
  const res = await readSave(store);
  assert.equal(res.ok, false);
});

test('persistance : rien du tout donne une partie neuve, jamais une exception', async () => {
  const store = new SaveStore(memoryStorage(), () => 0);
  const res = await store.load();
  assert.equal(res.ok, false);
  assert.equal(res.save.__fresh, true);
  assert.equal(res.save.meta.level, 1);
});

test('persistance : un stockage qui jette l ecriture ne casse pas la session en cours', async () => {
  const hostile = {
    kind: 'memory',
    get: () => null,
    set: () => {
      throw new Error('quota');
    },
    del: () => {},
    keys: () => [],
  };
  const store = new SaveStore(hostile, () => 0);
  await store.load();
  const res = await store.save({ meta: { scrap: 10 } });
  assert.equal(res.ok, false, 'l echec est signale, pas propage');
  assert.equal(store.cache.meta.scrap, 10, 'le cache reste la source de verite du run en cours');
  assert.ok(store.lastError, 'la cause est conservee pour l affichage');
});

test('persistance : un backend async est supporte', async () => {
  const mem = memoryStorage();
  const asyncBackend = {
    kind: 'idb',
    get: async (k) => mem.get(k),
    set: async (k, v) => mem.set(k, v),
    del: async (k) => mem.del(k),
    keys: async () => mem.keys(),
  };
  const store = new SaveStore(asyncBackend, () => 7);
  await store.save({ meta: { classId: 'chasseur', scrap: 3 } });
  const reloaded = await store.load();
  assert.equal(reloaded.save.meta.classId, 'chasseur');
  assert.equal(reloaded.save.meta.scrap, 3);
});

test('persistance : un localStorage plein ne doit pas effacer la progression', () => {
  const backing = new Map();
  const local = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => {
      if (v.length > 20_000) throw new Error('QuotaExceededError');
      backing.set(k, v);
    },
    removeItem: (k) => backing.delete(k),
  };
  const store = webStorage(local);
  const save = createSave();
  save.meta.scrap = 50;
  store.set(KEY_SAFE, JSON.stringify(save));
  assert.throws(() => store.set(KEY_SAFE, 'x'.repeat(100_000)));
  assert.ok(store.get(KEY_SAFE), 'la valeur saine est restee en place');
});

const KEY_SAFE = 'dernier-refuge.save.v1';