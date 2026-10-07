// ============================================================================
//  loot.js — caisses / conteneurs pillables + points d'intérêt (POI)
// ============================================================================
import * as THREE from 'three';
import { G, clamp, rand, randi, pick, V3, TAU } from './state.js';
import { addCollider, freeSpot } from './world.js';
import * as FX from './fx.js';
import { SFX } from './audio.js';
import { metal, halo } from './textures.js';
import { POIs } from './director.js';
const WORLD_RMAX = 195;

export const LOOT = [];
let scene = null;

function crateMesh(color = 0x4a5a3a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, .8, 1), new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .2, map: metal() }));
  body.position.y = .4; g.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.05, .12, 1.05), new THREE.MeshStandardMaterial({ color: 0x2e3a30, roughness: .8, metalness: .3 }));
  lid.position.y = .82; g.add(lid);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .2), new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false }));
  glow.position.set(.4, .55, .5); g.add(glow);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: 0xffe14d, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.position.y = .8; sp.scale.setScalar(1.4); g.add(sp);
  return g;
}

export function initLoot(sceneRef) { scene = sceneRef; }

export function spawnCrate(x, z, opts = {}) {
  const spot = freeSpot(x, z, 1.2);
  const g = crateMesh(opts.color);
  g.position.set(spot.x, 0, spot.z); g.rotation.y = rand(TAU);
  scene.add(g);
  const c = {
    m: g, x: spot.x, z: spot.z, looted: false,
    contents: opts.contents || rollLoot(), tier: opts.tier || 1, anim: 0,
  };
  LOOT.push(c);
  addCollider(spot.x, spot.z, .6, .6, .9, 'crate');
  return c;
}
function rollLoot() {
  const r = Math.random();
  if (r < .34) return { type: 'scrap', n: randi(15, 40) };
  if (r < .55) return { type: 'ammo', n: randi(20, 45) };
  if (r < .68) return { type: 'med', n: randi(1, 2) };
  if (r < .78) return { type: 'fuel', n: 1 };
  if (r < .86) return { type: 'grenade', n: randi(1, 2) };
  if (r < .93) return { type: 'part', n: randi(1, 3) };
  return { type: 'weapon', n: pick(['shotgun', 'dmr']) };
}

export function lootNear(pos, maxD = 2.4) {
  let best = null, bd = maxD;
  for (const c of LOOT) {
    if (c.looted) continue;
    const d = Math.hypot(c.x - pos.x, c.z - pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function openCrate(c) {
  if (!c || c.looted) return null;
  c.looted = true; G.lootOpened[c.x + ',' + c.z] = 1;
  const it = c.contents;
  let msg = '';
  if (it.type === 'scrap') { G.scrap += it.n; msg = `⚙️ +${it.n} scrap`; }
  else if (it.type === 'ammo') { const a = pick(['pistol', 'rifle', 'shotgun', 'dmr']); G.ammo[a].r += it.n; msg = `🔫 +${it.n} munitions`; }
  else if (it.type === 'med') { G.meds += it.n; msg = `💊 +${it.n} medkit`; }
  else if (it.type === 'fuel') { G.fuel += it.n; msg = `⛽ +${it.n} carburant`; }
  else if (it.type === 'grenade') { G.grenades += it.n; msg = `💣 +${it.n} grenade`; }
  else if (it.type === 'part') { G.scrap += it.n * 20; msg = `⚙️ +${it.n * 20} pièces`; }
  else if (it.type === 'weapon') {
    G.unlocked[it.n] = 1; G.scrap += 40; msg = `🔫 ${it.n.toUpperCase()} débloquée ! +40 scrap`;
  }
  // animation ouverture + burst
  c.anim = .5;
  SFX.pickup();
  FX.burst(V3(c.x, 1, c.z), 0xffe14d, 14, { size: .25, life: .7 });
  UI.toast(`📦 ${msg}`, 'gold');
  UI.kf(msg, 'gold');
  return it;
}

export function buildLoot() {
  // caisses éparpillées
  for (let i = 0; i < 55; i++) {
    const a = rand(0, TAU), rad = rand(24, WORLD_RMAX);
    spawnCrate(Math.cos(a) * rad, Math.sin(a) * rad, { color: pick([0x4a5a3a, 0x5a4a3a, 0x3a4a5a]) });
  }
  // caisses garanties dans les POI
  for (const p of POIs) {
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU), rad = rand(3, 9);
      spawnCrate(p.x + Math.cos(a) * rad, p.z + Math.sin(a) * rad, {
        tier: 2, color: 0x2a5a4a,
        contents: { type: pick(['scrap', 'ammo', 'med', 'part', 'weapon']), n: randi(30, 60) },
      });
    }
  }
}

/* --------- butin sol (petits items) --------- */
export const DROPS = [];

function dropMesh(kind) {
  const g = new THREE.Group();
  let m;
  if (kind === 'scrap') m = new THREE.Mesh(new THREE.BoxGeometry(.5, .35, .5), new THREE.MeshStandardMaterial({ color: 0x9a8a3a, emissive: 0x886600, emissiveIntensity: .4, roughness: .7, metalness: .5 }));
  else if (kind === 'ammo') m = new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .35), new THREE.MeshStandardMaterial({ color: 0x2a6a3a, emissive: 0x1a5a2a, emissiveIntensity: .5, roughness: .7 }));
  else if (kind === 'med') m = new THREE.Mesh(new THREE.BoxGeometry(.45, .3, .45), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xaa2233, emissiveIntensity: .5, roughness: .5 }));
  else m = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .55, 8), new THREE.MeshStandardMaterial({ color: 0xc06020, emissive: 0x882200, emissiveIntensity: .5, roughness: .6, metalness: .3 }));
  g.add(m);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: kind === 'scrap' ? 0xffe14d : kind === 'med' ? 0xff2d78 : 0x5dff8f, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(1.1); g.add(s);
  return g;
}
export function dropLoot(kind, pos) {
  const g = dropMesh(kind);
  g.position.copy(pos); g.position.y = .5;
  scene.add(g);
  DROPS.push({ m: g, kind, x: pos.x, z: pos.z, y: .5, t: 0 });
}
export function updateDrops(dt) {
  for (let i = DROPS.length - 1; i >= 0; i--) {
    const d = DROPS[i];
    d.t += dt;
    d.m.rotation.y += dt * 2;
    d.m.position.y = .5 + Math.sin(d.t * 3) * .12;
    const dd = Math.hypot(d.x - G.px, d.z - G.pz);
    // aimant
    if (dd < 4) {
      const dx = G.px - d.x, dz = G.pz - d.z, dl = Math.hypot(dx, dz) || 1;
      d.x += dx / dl * dt * 6; d.z += dz / dl * dt * 6;
      d.m.position.x = d.x; d.m.position.z = d.z;
    }
    if (dd < 1.1) { collectDrop(d); scene.remove(d.m); DROPS.splice(i, 1); }
  }
}
function collectDrop(d) {
  SFX.pickup();
  if (d.kind === 'scrap') { G.scrap += randi(5, 14); UI.kf(`+${randi(5, 14)} scrap`, 'gold'); }
  else if (d.kind === 'ammo') { const a = pick(['pistol', 'rifle', 'shotgun', 'dmr']); G.ammo[a].r += randi(8, 20); UI.kf('+munitions', 'good'); }
  else if (d.kind === 'med') { G.meds++; UI.kf('+1 medkit', 'good'); }
  else { G.fuel++; UI.kf('+1 carburant', 'good'); }
}
/** butin aléatoire quand un infecté meurt */
export function dropsFromEnemy(e) {
  const r = Math.random();
  const pos = e.m.position.clone();
  if (r < .3) dropLoot('scrap', pos);
  else if (r < .42) dropLoot('ammo', pos);
  else if (r < .46) dropLoot('med', pos);
  else if (r < .5) dropLoot('fuel', pos);
}
