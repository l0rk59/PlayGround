// ============================================================================
//  director.js — temps, vagues, POI, quêtes, factions, mort
// ============================================================================
import * as THREE from 'three';
import { G, clamp, rand, randi, pick, V3, TAU, addXp } from './state.js';
import { W, inSafeZone } from './world.js';
import { spawnEnemy, E, setBudget, spawnOne } from './enemies.js';
import * as FX from './fx.js';
import { SFX, tension, setAmbience } from './audio.js';
import { recruitCount } from './survivors.js';
import { defenseCount } from './building.js';

export const POIs = [];
let scene = null;
export function initDirector(s) { scene = s; }

/* ---------------- quêtes ---------------- */
export const QUESTS = [
  { id: 'q_start', title: 'Premiers sangs', txt: () => `Élimine 10 infectés (${Math.min(G.kills, 10)}/10)`, done: () => G.kills >= 10, rw: () => ({ scrap: 50, med: 1 }) },
  { id: 'q_camp', title: 'Fortifier le camp', txt: () => `Construis 3 pièces de base (${Math.min(G.built, 3)}/3)`, done: () => G.built >= 3, rw: () => ({ scrap: 70, fuel: 1 }) },
  { id: 'q_squad', title: 'Former l\'escouade', txt: () => `Recrute 2 survivants (${Math.min(G.recruits, 2)}/2)`, done: () => G.recruits >= 2, rw: () => ({ scrap: 80, med: 2 }) },
  { id: 'q_night', title: 'Tenir une nuit', txt: () => `Survis 1 nuit (${Math.min(G.survived, 1)}/1)`, done: () => G.survived >= 1, rw: () => ({ scrap: 120, cells: 1 }) },
  { id: 'q_poi', title: 'Éclaireur', txt: () => `Découvre 2 points d'intérêt (${Math.min(POIs.filter(p => p.found).length, 2)}/2)`, done: () => POIs.filter(p => p.found).length >= 2, rw: () => ({ ammo: 40, scrap: 60 }) },
  { id: 'q_colosse', title: 'Géant', txt: () => `Abats 5 Colosses (${Math.min(G.killsBy.brute || 0, 5)}/5)`, done: () => (G.killsBy.brute || 0) >= 5, rw: () => ({ scrap: 150, weapon: 'dmr' }) },
  { id: 'q_road', title: 'Route libre', txt: () => `Roule 1000 m (${Math.min(Math.floor(G.driveDist), 1000)}/1000)`, done: () => G.driveDist >= 1000, rw: () => ({ fuel: 2, scrap: 80 }) },
  { id: 'q_notes', title: 'Souvenirs', txt: () => `Trouve 3 notes (${Object.keys(G.notesFound).length}/3)`, done: () => Object.keys(G.notesFound).length >= 3, rw: () => ({ scrap: 60, med: 1 }) },
];
export function checkQuests() {
  for (const q of QUESTS) {
    if (G.questDone[q.id]) continue;
    if (q.done()) {
      G.questDone[q.id] = 1;
      const rw = q.rw();
      if (rw.scrap) G.scrap += rw.scrap;
      if (rw.med) G.meds += rw.med;
      if (rw.fuel) G.fuel += rw.fuel;
      if (rw.cells) G.cells += rw.cells;
      if (rw.ammo) { G.ammo.pistol.r += rw.ammo; G.ammo.rifle.r += rw.ammo; }
      if (rw.weapon) G.unlocked[rw.weapon] = 1;
      SFX.quest();
      UI.toast(`✅ QUÊTE : ${q.title} — récompenses reçues !`, 'gold');
      UI.kf(`Quête : ${q.title}`, 'gold');
    }
  }
}
G.questDone = G.questDone || {};

/* ---------------- points d'intérêt ---------------- */
export function buildPOIs() {
  const defs = [
    { id: 'poi_hospital', name: 'HÔPITAL KIRIN', x: -52, z: -22, radius: 14, kind: 'hospital', color: 0x00e8ff },
    { id: 'poi_tunnel', name: 'TUNNEL 9', x: 70, z: -28, radius: 14, kind: 'tunnel', color: 0xff7a3d },
    { id: 'poi_heli', name: 'ÉPAVE D\'HÉLICO', x: -34, z: 86, radius: 14, kind: 'heli', color: 0xffe14d },
    { id: 'poi_lab', name: 'LABORATOIRE NÉON-X', x: 120, z: -100, radius: 16, kind: 'lab', color: 0x5dff8f },
    { id: 'poi_market', name: 'MARCHÉ NOIR', x: W.MARKET.x, z: W.MARKET.z, radius: 12, kind: 'market', color: 0xff2d78 },
    { id: 'poi_camp', name: 'BASE NÉON', x: W.CAMP.x, z: W.CAMP.z, radius: 16, kind: 'camp', color: 0x5dff8f },
  ];
  for (const d of defs) {
    POIs.push({ ...d, found: false, fog: new THREE.Mesh(
      new THREE.CylinderGeometry(d.radius, d.radius * .3, 22, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: .06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    ) });
  }
  // pour POIs du monde (on utilise ceux déjà visuels) — la géométrie existe déjà dans world.js,
  // ce bloc est surtout logique : découverte.
}

/* ---------------- vague de nuit ---------------- */
export function updateWave(dt) {
  //}(spawns){
  const wantBase = G.phase > .82 ? 0 : 0;
  //état de vague
  if (G.waveActive) {
    G.waveT -= dt;
    // spawn progressif
    G.waveSpawnT = (G.waveSpawnT || 0) - dt;
    if (G.waveSpawnT <= 0 && G.waveSpawns > 0) {
      G.waveSpawnT = 1.4;
      G.waveSpawns--;
      const nearCamp = Math.hypot(G.px - W.CAMP.x, G.pz - W.CAMP.z) < 40 || !!inSafeZone(G.px, G.pz, 6);
      if (nearCamp && Math.random() < .6) {
        // assaut de base
        const a = rand(0, TAU), rad = 38;
        spawnEnemy('walker', W.CAMP.x + Math.cos(a) * rad, W.CAMP.z + Math.sin(a) * rad, { night: true, hpMul: 1.15 });
      } else {
        spawnOne({}, false);
      }
    }
    if (G.waveT <= 0) endWave();
  }
}

/* ---------------- cycle jour / nuit ---------------- */
export function updateDirector(dt, ctx) {
  const wasNight = G.phase < .22 || G.phase > .82;
  G.phase += dt / (wasNight ? G.nightLen : G.dayLen);
  if (G.phase >= 1) { G.phase -= 1; G.day++; SFX.dawn(); UI.toast(`☀ JOUR ${G.day} — tu as survécu ! +30 scrap`, 'good'); G.scrap += 30; addXp(40); }
  const nowNight = G.phase < .22 || G.phase > .82;
  if (nowNight && !wasNight) startNight();
  if (!nowNight && wasNight) endNight();
  // ambiance audio
  setAmbience(nowNight, G.rain);
  // budget d'ennemis hors vague
  if (!G.waveActive) setBudget(clamp(6 + G.day * 1.5, 6, 30), .35);
  updatePOIFog();
  checkQuests();
}
function startNight() {
  G.survived++;
  SFX.night();
  UI.toast('🌙 LA NUIT TOMBE — prépare la défense !', 'bad');
  UI.kf('La nuit tombe…', 'info');
  startWave();
  tension(true);
  // menace de horde sur le camp
  const a0 = rand(0, TAU);
  for (let i = 0; i < 6 + G.day * 2; i++) {
    const a = a0 + rand(-.6, .6), rad = 45 + rand(0, 15);
    spawnEnemy(rand() < .2 ? 'runner' : 'walker', W.CAMP.x + Math.cos(a) * rad, W.CAMP.z + Math.sin(a) * rad, { night: true });
  }
}
function endNight() {
  G.wave = 0; G.waveActive = false; tension(false);
  UI.toast('🌅 L\'aube se lève. Recharge-toi.', 'info');
}
function startWave() {
  G.wave++; G.waveActive = true;
  const base = 8 + G.day * 4;
  G.waveSpawns = base;
  G.waveT = 20 + G.day * 6;
  G.waveSpawnT = 0;
  UI.toast(`⚠️ VAGUE ${G.wave} — ${base} infectés`, 'bad');
}
function endWave() {
  G.waveActive = false; G.waveSpawns = 0;
  tension(false);
  const bonus = 60 + G.day * 30;
  G.scrap += bonus; addXp(30 + G.day * 10);
  UI.toast(`✅ Vague ${G.wave} repoussée ! +${bonus} scrap`, 'gold');
  UI.kf(`Vague ${G.wave} terminée (+${bonus}⚙️)`, 'gold');
}
export function updatePOIFog() {
  // fog-war : atténue le fog selon la proximité des POI découverts
  const px = G.px, pz = G.pz;
  let nearest = 1e9;
  for (const p of POIs) nearest = Math.min(nearest, Math.hypot(px - p.x, pz - p.z) - p.radius);
  W.fogBase = clamp((nearest) / 60, 0, 1);
}

/* ---------------- interactions POI ---------------- */
export function poiNear(pos) {
  let best = null, bd = 1e9;
  for (const p of POIs) {
    const d = Math.hypot(pos.x - p.x, pos.z - p.z);
    if (d < p.radius && d < bd) { bd = d; best = p; }
  }
  return best;
}
export function discoverPOI(p) {
  if (!p || p.found) return;
  p.found = true;
  SFX.quest();
  UI.toast(`📍 Point d'intérêt découvert : ${p.name}`, 'gold');
  UI.kf(`${p.name} découvert`, 'gold');
  checkQuests();
}

/* ---------------- factions : commandes ---------------- */
export function factionCommand(fac) {
  const need = fac === 'enclave' ? 2 : 3;
  const cur = G.rep[fac] || 0;
  if (cur < need) { SFX.deny(); UI.toast(`Réputation insuffisante (${cur}/${need})`, 'bad'); return false; }
  G.rep[fac] = 0;
  if (fac === 'enclave') { G.ammo.rifle.r += 60; G.ammo.pistol.r += 40; G.unlocked.shotgun = 1; G.scrap += 100; UI.toast('⚡ Enclave : rations de combat ! Fusil à pompes débloqué.', 'gold'); }
  else { G.maxHp += 15; G.hp = G.maxHp; G.unlocked.dmr = 1; G.scrap += 120; UI.toast(`🔧 Gang :Generator repaired. +15 PV max. DMR débloquée.`, 'gold'); }
  SFX.buy();
  return true;
}

/* ---------------- barre de vie morte ---------------- */
export function resetForRespawn() {
  G.dead = false; G.hp = G.maxHp;
  G.px = W.CAMP.x + 4; G.pz = W.CAMP.z + 8; G.py = 0;
  //allege les ennemis proches pour respirer
  const near = E.filter(e => Math.hypot(e.m.position.x - G.px, e.m.position.z - G.pz) < 30);
  for (const e of near) e.hp = 0; // ils meurent
  UI.hideAll();
}

export function statsBlock() {
  const acc = G.shotsFired ? Math.round(100 * G.shotsHit / G.shotsFired) : 0;
  return [
    ['Jour', G.day], ['☠ Éliminations', G.kills], ['🎯 Précision', acc + '%'], ['💥 Dégâts', Math.round(G.dmgDealt)],
    ['🏃 Distance', Math.round(G.runDist) + ' m'], ['🚗 Roule', Math.round(G.driveDist) + ' m'], ['⭐ Niveau', G.lvl],
    ['⚙️ Scrap', G.scrap], ['🧍 Escouade', recruitCount() + '/4'], ['🛠 Base', defenseCount() + ' pièces'],
    ['🗺 POI', POIs.filter(p => p.found).length + '/' + POIs.length], ['📜 Notes', Object.keys(G.notesFound).length + '/10'],
    ['💀 Tirs', G.shotsFired], ['🔫 Col.', G.shotsFired ? Math.round(G.shotsHit / G.shotsFired * 100) + '%' : '0%'],
  ];
}