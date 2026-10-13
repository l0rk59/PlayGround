/**
 * SCHEMA DE SAUVEGARDE — versionne, valide, migre.
 *
 * Regles :
 *  - Une sauvegarde illisible ne doit JAMAIS faire planter le jeu. On
 *    la rejette, on tente la copie de secours, puis on repart proprement.
 *  - Toute evolution du format passe par une migration explicite et testee,
 *    jamais par un `if` disperse dans le code de chargement.
 *  - Les migrations sont pures : meme entree, meme sortie, sans Date ni Math.random.
 */

import { CLASSES, REWARDS } from '../data/content.js';

export const SAVE_VERSION = 3;

/* ------------------------------------------------------------- FABRICANT -- */

export function createSave(opts = {}) {
  const now = opts.now ?? 0;
  return {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    meta: {
      classId: null,
      level: 1,
      xp: 0,
      scrap: 0,
      rations: 1,
      ammo: 60,
      cores: 0,
      refugeLevel: 1,
      upgrades: [],
      uniques: [],
      equipment: { arme: 'pistol', signe: null },
      discoveries: [],
      bosses: [],
      survivors: [],
      dogUnlocked: false,
      quests: {},
      stats: { runs: 0, deaths: 0, extracted: 0, bossKills: 0, distance: 0, playSeconds: 0 },
      settings: defaultSettings(),
    },
    world: {
      seed: 1337,
      visitedPois: [],
      flags: {},
    },
  };
}

export function defaultSettings() {
  return {
    master: 0.8,
    music: 0.5,
    sfx: 0.9,
    haptics: true,
    reducedEffects: false,
    screenShake: 1,
    showDamage: true,
    stickSide: 'left',
    sensitivity: 1,
  };
}

/* ------------------------------------------------------------- VALIDATION -- */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';

function mergeDefaults(target, defaults) {
  const out = Array.isArray(defaults) ? [] : {};
  for (const [k, dv] of Object.entries(defaults)) {
    const tv = target?.[k];
    if (Array.isArray(dv)) out[k] = Array.isArray(tv) ? tv.filter((x) => typeof x === 'string') : [];
    else if (isObj(dv)) out[k] = mergeDefaults(tv, dv);
    else out[k] = isNum(dv) ? (isNum(tv) ? tv : dv) : isStr(dv) ? (isStr(tv) ? tv : dv) : tv ?? dv;
  }
  return out;
}

/**
 * Valide et complete une sauvegarde. Ne leve jamais : renvoie la liste
 * des problemes rencontres pour que l'appelant puisse journaliser et
 *choisir une strategie de recovery.
 */
export function validateSave(raw) {
  const problems = [];
  if (!isObj(raw)) return { ok: false, problems: ['save_absente'], save: null };
  if (!isNum(raw.version)) problems.push('version_absente');

  const base = createSave();
  const meta = mergeDefaults(raw.meta ?? {}, base.meta);
  const world = mergeDefaults(raw.world ?? {}, base.world);

  if (meta.classId !== null && !CLASSES[meta.classId]) {
    problems.push('classe_inconnue');
    meta.classId = null;
  }
  if (!Number.isInteger(meta.level) || meta.level < 1) {
    problems.push('niveau_invalide');
    meta.level = 1;
  }
  if (!Number.isFinite(meta.scrap) || meta.scrap < 0) {
    problems.push('scrap_invalide');
    meta.scrap = 0;
  }
  for (const u of meta.uniques) {
    if (!REWARDS[u]) problems.push(`recompense_inconnue:${u}`);
  }
  meta.uniques = meta.uniques.filter((u) => REWARDS[u]);
  if (!isNum(world.seed) || world.seed < 0) {
    problems.push('graine_invalide');
    world.seed = base.world.seed;
  }

  return { ok: true, problems, save: { version: SAVE_VERSION, createdAt: raw.createdAt ?? 0, savedAt: raw.savedAt ?? 0, meta, world } };
}

/* -------------------------------------------------------------- MIGRATION -- */

/**
 * Chaque entree transforme une version N en N+1. Pure et testee une par une.
 */
export const MIGRATIONS = {
  /** v1 : premier jet, aucun exemple de progression. */
  1: (save) => {
    save.meta ??= {};
    save.meta.stats ??= { runs: 0, deaths: 0, extracted: 0, bossKills: 0, distance: 0, playSeconds: 0 };
    save.meta.settings ??= defaultSettings();
    save.meta.dogUnlocked = save.meta.dogUnlocked === true;
    save.world ??= { seed: 1337, visitedPois: [], flags: {} };
    return save;
  },
  /** v2 : la classe devient un choix explicite, l'arme se range. */
  2: (save) => {
    save.meta.classId ??= null;
    save.meta.equipment ??= { arme: 'pistol', signe: null };
    save.meta.uniques ??= [];
    save.meta.survivors ??= [];
    save.meta.bosses ??= [];
    return save;
  },
  /** v3 : le refuge devient une progression a niveaux mesurable. */
  3: (save) => {
    save.meta.refugeLevel = Number.isFinite(save.meta.refugeLevel) ? save.meta.refugeLevel : 1;
    save.meta.upgrades ??= [];
    save.meta.quests ??= {};
    return save;
  },
};

/**
 * Fait remonter une sauvegarde jusqu'a la version courante. Une version
 * superieure a la nôtre vient d'un futur : on refuse plutot que de
 * deviner ce que l'auteur voulait.
 */
export function migrate(raw) {
  if (!isObj(raw)) return { ok: false, problems: ['save_absente'], save: null };
  let v = Number.isFinite(raw.version) ? raw.version : 1;
  if (v > SAVE_VERSION) {
    return { ok: false, problems: [`version_trop_recente:${v}`], save: null };
  }
  const trace = [];
  const work = JSON.parse(JSON.stringify(raw));
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return { ok: false, problems: [`migration_absente:${v}`], save: null };
    work.version = v + 1;
    step(work);
    trace.push(v);
    v += 1;
  }
  return { ok: true, problems: [], migratedFrom: trace.length ? trace[0] : null, save: work };
}

/** Chaine migratee -> validee. Le point d'entree unique du chargement. */
export function loadSave(raw) {
  const m = migrate(raw);
  if (!m.ok) return m;
  const v = validateSave(m.save);
  return { ...v, migratedFrom: m.migratedFrom ?? null };
}