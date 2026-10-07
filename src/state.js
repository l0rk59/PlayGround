// ============================================================================
//  state.js — état global partagé + réglages + sauvegarde locale
// ============================================================================
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** générateur pseudo-aléatoire déterministe (pour le monde) */
export function makeRng(seed = 20871) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export const WORLD = { R: 330, fogDay: 0x0a0a1e, fogNight: 0x0c0118 };

/** jour/nuit : 0 = minuit, .25 = aube, .5 = midi, .75 = crépuscule */
export function sunHeight(phase) { return Math.sin(phase * TAU); }
export function isNight(phase) { return phase < .22 || phase > .82; }

export const G = {
  /* run */
  started: false, running: false, paused: false, dead: false, over: false,
  t: 0, dt: 0, frame: 0,
  /* temps */
  day: 1, phase: .32, dayLen: 150, nightLen: 95,
  weather: 'clear', weatherT: 0, rain: 0, wind: .3,
  /* joueur */
  hp: 100, maxHp: 100, stam: 100, xp: 0, lvl: 1,
  px: 0, py: 0, pz: 0, vx: 0, vz: 0, vy: 0, grounded: true,
  yaw: 0, pitch: 0, crouch: 0, sprint: false, noise: 0, hurtT: 0, regenT: 0,
  dmgBoost: 1, healBoost: 1, iframeT: 0, invuln: false,
  /* inventaire */
  scrap: 45, meds: 2, grenades: 2, fuel: 1, cells: 0,
  yen: 0,                     // monnaie des améliorations (gagnée à chaque kill)
  ammo: { pistol: { m: 15, r: 75 }, rifle: { m: 30, r: 180 }, shotgun: { m: 6, r: 32 }, dmr: { m: 8, r: 48 } },
  silencer: false, scope: false, grip: false,
  /* armes */
  wpn: 'machete', unlocked: { machete: 1, pistol: 1, rifle: 1 }, ammoIn: { pistol: 999, shotgun: 0, dmr: 0 },
  /* combat */
  kills: 0, killsBy: {}, headshots: 0, shotsFired: 0, shotsHit: 0, dmgDealt: 0, runDist: 0, driveDist: 0,
  /* systèmes */
  wave: 0, waveActive: false, waveT: 0, waveSpawns: 0, survived: 0,
  notesFound: {}, built: 0, recruits: 0, rep: { enclave: 0, rouille: 0 }, factions: {},
  lootOpened: {},
  /* config */
  uiHidden: false,
};
export const S = { // réglages persistants
  sens: 1, fov: 78, vol: .7, quality: 'high', bloom: true, shake: true, invertY: false, showUi: true,
  leftHanded: false, qualityLocked: false, haptic: true, layout: null,
};
const SK = 'neondead.settings.v1', GVK = 'neondead.save.v1';

export function loadSettings() {
  try { Object.assign(S, JSON.parse(localStorage.getItem(SK) || '{}')); } catch (e) { /* ignore */ }
  if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency <= 3) { S.quality = 'low'; S.bloom = false; S.qualityLocked = true; }
  else if (/Mobi|Android/i.test(navigator.userAgent) && (navigator.deviceMemory || 4) <= 4) { S.quality = 'med'; S.qualityLocked = true; }
  applyQuality();
}
export function saveSettings() { try { localStorage.setItem(SK, JSON.stringify(S)); } catch (e) { /* ignore */ } }
export function applyQuality() {
  const dprCap = S.quality === 'low' ? 1 : S.quality === 'med' ? 1.4 : 2;
  S.dpr = Math.min(devicePixelRatio || 1, dprCap);
  S.shadow = S.quality === 'high';
  S.bloomOn = S.bloom && S.quality !== 'low';
  S.fogFar = S.quality === 'low' ? 150 : S.quality === 'med' ? 210 : 300;
}

export const SAVE_KEY = GVK;
export function hasSave() { try { const r = localStorage.getItem(GVK); return !!r && !!JSON.parse(r).day; } catch (e) { return false; } }
export function peekSave() { try { return JSON.parse(localStorage.getItem(GVK) || 'null'); } catch (e) { return null; } }
export function clearSave() { try { localStorage.removeItem(GVK); } catch (e) { /* ignore */ } }

let saveT = 0;
export function requestSave() { saveT = 4; } // sauvegarde différée (4 s)
export function tickSave(dt) {
  if (saveT > 0) { saveT -= dt; if (saveT <= 0) doSave(); }
}
export function doSave(snapshot = null) {
  try {
    const data = snapshot || {
      day: G.day, phase: G.phase, t: G.t, hp: G.hp, maxHp: G.maxHp, lvl: G.lvl, xp: G.xp,
      px: G.px, py: G.py, pz: G.pz, scrap: G.scrap, meds: G.meds, grenades: G.grenades, fuel: G.fuel, cells: G.cells,
      ammo: G.ammo, ammoIn: G.ammoIn, unlocked: G.unlocked, silencer: S.silencer, wpn: G.wpn,
      kills: G.kills, killsBy: G.killsBy, headshots: G.headshots, shotsFired: G.shotsFired, shotsHit: G.shotsHit,
      yen: G.yen, levels: G.levels, accLv: G.accLv, mods: { ...mods, extmag: G.accLv.extmag > 0 },
      dmgDealt: G.dmgDealt, runDist: G.runDist, driveDist: G.driveDist, notesFound: G.notesFound,
      built: G.built, recruits: G.recruits, survived: G.survived, rep: G.rep, lootOpened: G.lootOpened,
      mods: modsSnapshot(),
    };
    localStorage.setItem(GVK, JSON.stringify({ v: 1, ts: Date.now(), ...data }));
    return true;
  } catch (e) { return false; }
}
export function restoreFrom(d) {
  if (!d) return false;
  const n = (k, v) => (typeof d[k] === 'number' ? d[k] : v);
  G.day = n('day', 1); G.phase = Math.min(Math.max(n('phase', .32), .02), .98); G.t = n('t', 0);
  G.maxHp = n('maxHp', 100); G.hp = Math.min(n('hp', 100), G.maxHp);
  G.lvl = Math.max(1, n('lvl', 1)); G.xp = n('xp', 0);
  G.px = n('px', 40); G.py = n('py', 0); G.pz = n('pz', -45);
  G.scrap = n('scrap', 45); G.meds = n('meds', 2); G.grenades = n('grenades', 2); G.fuel = n('fuel', 1); G.cells = n('cells', 0);
  G.ammo = Object.assign(G.ammo, d.ammo || {});
  G.ammoIn = Object.assign(G.ammoIn, d.ammoIn || {});
  G.unlocked = Object.assign(G.unlocked, d.unlocked || {});
  S.silencer = !!d.silencer; G.wpn = d.wpn || 'machete';
  G.kills = n('kills', 0); G.killsBy = d.killsBy || {}; G.headshots = n('headshots', 0);
  G.yen = n('yen', 0);
  G.levels = Object.assign({ machete: 1, knife: 1, pistol: 1, rifle: 1, shotgun: 1, dmr: 1, grenade: 1 }, d.levels || {});
  G.accLv = Object.assign({ silencer: 0, scope: 0, grip: 0, extmag: 0 }, d.accLv || {});
  Object.assign(mods, { silencer: G.accLv.silencer > 0, scope: G.accLv.scope > 0, grip: G.accLv.grip > 0 });
  G.shotsFired = n('shotsFired', 0); G.shotsHit = n('shotsHit', 0); G.dmgDealt = n('dmgDealt', 0);
  G.runDist = n('runDist', 0); G.driveDist = n('driveDist', 0);
  G.notesFound = d.notesFound || {}; G.built = n('built', 0); G.recruits = n('recruits', 0);
  G.survived = n('survived', 0); G.rep = Object.assign({ enclave: 0, rouille: 0 }, d.rep || {});
  G.lootOpened = d.lootOpened || {};
  modsRestore(d.mods || {});
  return true;
}

export const mods = { silencer: false, scope: false, grip: false };
export function modsSnapshot() { return { ...mods }; }
export function modsRestore(m) { Object.assign(mods, m); S.silencer = mods.silencer; }

/* ==================== PROGRESSION DES ARMES ====================
   Chaque arme a 5 niveaux. Chaque niveau : +dégâts, +cadence, +chargeur.
   Améliorer coûte des yens (gagnés en tuant) + du scrap.            */
export const UPGRADES = {
  machete: { max: 5, cost: [120, 260, 520, 950], dmg: [58, 66, 76, 88, 102], rate: [2.3, 2.4, 2.5, 2.6, 2.8], price: 0, desc: 'Lame aiguisée' },
  knife: { max: 5, cost: [90, 200, 420, 780], dmg: [34, 40, 47, 55, 64], rate: [4.2, 4.4, 4.6, 4.8, 5], price: 400, desc: 'Couteau tactique' },
  pistol: { max: 5, cost: [150, 320, 640, 1150], dmg: [34, 39, 45, 52, 60], rate: [4.2, 4.4, 4.6, 4.9, 5.2], price: 0, desc: 'Pistolet K-9' },
  rifle: { max: 5, cost: [200, 430, 850, 1550], dmg: [25, 29, 33, 38, 44], rate: [10, 10.5, 11, 11.5, 12], price: 0, desc: 'Fusil V-9' },
  shotgun: { max: 5, cost: [280, 600, 1150, 2000], dmg: [17, 20, 23, 27, 31], rate: [1.25, 1.3, 1.4, 1.5, 1.6], price: 2200, desc: 'Fusil a pompes' },
  dmr: { max: 5, cost: [400, 850, 1600, 2800], dmg: [88, 102, 118, 136, 156], rate: [1.35, 1.4, 1.45, 1.5, 1.6], price: 3400, desc: 'DMR de precision' },
  grenade: { max: 3, cost: [200, 420], dmg: [60, 78, 100], rate: [.8, .8, .9], price: 0, desc: 'Grenade a bruit' },
};
export const ACCS = {
  silencer: { name: 'Silencieux', desc: 'Tir discret, -70% de bruit', price: 1400, levels: [1400, 2800, 5000] },
  scope: { name: 'Lunette', desc: '-45% de dispersion', price: 1800, levels: [1800, 3400, 6000] },
  grip: { name: 'Poignee stabilisee', desc: '-40% de recul', price: 1200, levels: [1200, 2400, 4200] },
  extmag: { name: 'Chargeur etendu', desc: '+60% de capacite', price: 1600, levels: [1600, 3000, 5200] },
};
/** niveaux d'arme/accessoire (sauvegardés) */
G.levels = G.levels || { machete: 1, knife: 1, pistol: 1, rifle: 1, shotgun: 1, dmr: 1, grenade: 1 };
G.accLv = G.accLv || { silencer: 0, scope: 0, grip: 0, extmag: 0 };

export function upgradeCost(w, lv) {
  const u = UPGRADES[w]; if (!u || lv >= u.max) return null;
  return { yen: u.cost[lv - 1], scrap: Math.round(u.cost[lv - 1] * .45) };
}
export function accCost(a, lv) {
  const d = ACCS[a]; if (!d || lv >= d.levels.length) return null;
  return { yen: d.levels[lv] };
}
export function weaponPower(w, lv) {
  const u = UPGRADES[w]; const i = Math.max(0, Math.min(u.max - 1, (lv || 1) - 1));
  return { dmg: u.dmg[i], rate: u.rate[i] };
}

/* ---- progression du chargement (écran de démarrage) ---- */
export const LOAD = { step: 0, total: 12, label: 'INITIALISATION' };
export function loadStep(label, pct) {
  LOAD.step++; LOAD.label = label;
  try {
    const l = document.getElementById('loadMsg');
    if (l) l.textContent = label + '… ' + Math.round(pct * 100) + '%';
  } catch (e) { /* ignore */ }
}

/* ---- grille de progression ---- */
export function xpForLevel(l) { return Math.round(120 + l * 78 + Math.pow(l, 1.85) * 12); }
export function addXp(n) {
  G.xp += n; let leveled = 0;
  while (G.xp >= xpForLevel(G.lvl)) { G.xp -= xpForLevel(G.lvl); G.lvl++; leveled++; }
  if (leveled) {
    G.maxHp += 8 + (G.lvl % 3 === 0 ? 5 : 0);
    G.hp = Math.min(G.maxHp, G.hp + 30 + 6 * leveled);
    G.dmgBoost = 1 + 0.035 * (G.lvl - 1);
    G.healBoost = 1 + 0.04 * (G.lvl - 1);
  }
  return leveled;
}