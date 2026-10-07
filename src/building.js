// ============================================================================
//  building.js — construction de base (barricades, pieux, tourelles, générateur)
// ============================================================================
import * as THREE from 'three';
import { G, clamp, rand, V3, TAU } from './state.js';
import { W, addCollider, blocked } from './world.js';
import { hitEnemy, enemiesInRadius } from './enemies.js';
import * as FX from './fx.js';
import { SFX } from './audio.js';
import { metal } from './textures.js';

export const DEFS = [];   // pièces construites
let scene = null, ghost = null, ghostMat = null;

export const PARTS = [
  { id: 'wall', name: '🛡 BARRICADE', cost: 25, hp: 260, blocks: true, desc: 'Bloque les infectés' },
  { id: 'spike', name: '🗡 PIEUX', cost: 20, hp: 140, dmg: 40, desc: 'Dégâts au contact' },
  { id: 'turret', name: '🔫 TOURELLE', cost: 90, hp: 180, dmg: 22, range: 30, desc: 'Tire automatiquement' },
  { id: 'wallgate', name: '🚪 PORTE', cost: 45, hp: 320, blocks: false, desc: 'Passage contrôlé' },
  { id: 'repair', name: '🔧 ATELIER', cost: 60, hp: 200, heal: true, desc: 'Répare la base' },
];
let sel = 0;
export const buildSel = () => sel;
export function setBuildSel(i) { sel = clamp(i, 0, PARTS.length - 1); return sel; }

export function initBuilding(sceneRef) {
  scene = sceneRef;
  ghostMat = new THREE.MeshBasicMaterial({ color: 0x00e8ff, transparent: true, opacity: .35, depthWrite: false });
  ghost = new THREE.Group();
  const g1 = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, .5), ghostMat); g1.position.y = 1.1; ghost.add(g1);
  const g2 = new THREE.Mesh(new THREE.BoxGeometry(3, .12, .6), ghostMat); g2.position.y = 2.25; ghost.add(g2);
  ghost.visible = false;
  scene.add(ghost);
}
export function showGhost(on) { if (ghost) ghost.visible = on; }
export function ghostPos(yaw, px, pz) {
  if (!ghost) return null;
  ghost.position.set(px - Math.sin(yaw) * 4.5, 0, pz - Math.cos(yaw) * 4.5);
  ghost.rotation.y = yaw;
  return ghost.position;
}
export function setGhostOk(ok) { ghostMat.color.setHex(ok ? 0x5dff8f : 0xff2d78); }
export function ghostCostOk() { return G.scrap >= PARTS[sel].cost; }

function nearCamp(x, z) { return Math.hypot(x - W.CAMP.x, z - W.CAMP.z) < 34; }

export function placePart(px, pz, yaw) {
  const P = PARTS[sel];
  if (G.scrap < P.cost) { SFX.deny(); UI.toast(`❌ Scrap insuffisant (${P.cost}⚙️)`, 'bad'); return false; }
  const x = px - Math.sin(yaw) * 4.5, z = pz - Math.cos(yaw) * 4.5;
  if (!nearCamp(x, z)) { SFX.deny(); UI.toast('❌ Construis près de ta base ⛺', 'bad'); return false; }
  if (blocked(x, z, 1.6)) { SFX.deny(); UI.toast('❌ Emplacement occupé', 'bad'); return false; }
  const d = createPart(P.id, x, z, yaw);
  G.scrap -= P.cost; G.built++;
  SFX.build(); FX.shake(.12, .1);
  UI.toast(`🛠 ${P.name} construit (-${P.cost}⚙️)`, 'good');
  return d;
}
export function createPart(id, x, z, yaw = 0) {
  const g = new THREE.Group();
  let hp = 0, dmg = 0, range = 0, blocks = false, heal = false, barrel = null, top = null;
  const steel = new THREE.MeshStandardMaterial({ color: 0x4d5560, roughness: .75, metalness: .5, map: metal() });
  const rust = new THREE.MeshStandardMaterial({ color: 0x5e3a26, roughness: .9, metalness: .2, map: metal() });
  if (id === 'wall') {
    const w = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, .4), steel); w.position.y = 1.1; g.add(w);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.3, .15, .5), new THREE.MeshBasicMaterial({ color: 0x00e8ff, toneMapped: false })); cap.position.y = 2.25; g.add(cap);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.2, 2.2, .5), rust); b.position.set(-1.1 + i * 1.1, 1.1, 0); g.add(b); }
    hp = 260; blocks = true;
  } else if (id === 'spike') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, .3, 1.4), rust); base.position.y = .15; g.add(base);
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x8a8f9a, metalness: .8, roughness: .3 })); s.position.set(-1.2 + i * .6, .95, (i % 2 ? .3 : -.3)); g.add(s); }
    hp = 140; dmg = 40; range = 2.4;
  } else if (id === 'turret') {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, .9, 8), steel); ped.position.y = .45; g.add(ped);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), rust); dome.position.y = 1.05; g.add(dome);
    barrel = new THREE.Mesh(new THREE.BoxGeometry(.28, .28, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: .6, roughness: .5 })); barrel.position.set(0, 1.15, -.6); g.add(barrel);
    const led = new THREE.Mesh(new THREE.SphereGeometry(.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2d78, toneMapped: false })); led.position.set(.35, 1.15, 0); g.add(led);
    const lens = new THREE.PointLight(0xff2d78, 0, 12, 2); lens.position.set(0, 1.3, 0); g.add(lens);
    top = { barrel, led, lens };
    hp = 180; dmg = 22; range = 30; blocks = false;
  } else if (id === 'wallgate') {
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.5, 2.6, .6), steel); post.position.set(s * 1.5, 1.3, 0); g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.4, .3, .7), new THREE.MeshStandardMaterial({ color: 0x6a5a3a, map: metal(), roughness: .8 })); beam.position.y = 2.6; g.add(beam);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, .2), new THREE.MeshStandardMaterial({ color: 0x3a3a30, map: metal(), roughness: .7, metalness: .5 })); door.position.y = 1.15; g.add(door);
    hp = 320; blocks = false;
  } else if (id === 'repair') {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, 1.2), rust); bench.position.y = 1; g.add(bench);
    for (const [ox, oz] of [[-1.1, -.5], [1.1, -.5], [-1.1, .5], [1.1, .5]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.14, 1, .14), steel); leg.position.set(ox, .5, oz); g.add(leg); }
    const gen = new THREE.Mesh(new THREE.BoxGeometry(.8, .6, .7), new THREE.MeshStandardMaterial({ color: 0x2e4a52, metalness: .6, roughness: .5 })); gen.position.set(.8, 1.4, 0); g.add(gen);
    const weld = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, toneMapped: false })); weld.position.set(-.6, 1.2, 0); g.add(weld);
    const l = new THREE.PointLight(0x9fd8ff, 0, 14, 2); l.position.set(0, 1.4, 0); g.add(l);
    top = { led: weld, lens: l };
    hp = 200; heal = true;
  }
  g.position.set(x, 0, z); g.rotation.y = yaw;
  scene.add(g);
  const def = { id, m: g, hp, maxhp: hp, dmg, range, blocks, heal, ...(top || {}), cd: 0, x, z };
  DEFS.push(def);
  if (blocks) addCollider(x, z, 1.7, .4, 2.3, 'built');
  else addCollider(x, z, .6, .6, 2.6, 'built');
  return def;
}

/* --- mise à jour : tourelles, pieux, réparation, dégâts --- */
export function updateBuilding(dt) {
  const px = G.px, pz = G.pz;
  for (let i = DEFS.length - 1; i >= 0; i--) {
    const d = DEFS[i];
    // tourelles
    if (d.id === 'turret') {
      d.cd -= dt;
      if (d.barrel) {
        // vise le plus proche
        const tgt = enemiesInRadius(V3(d.x, 0, d.z), d.range);
        let best = null, bd = d.range;
        for (const e of tgt) { const dd = Math.hypot(e.m.position.x - d.x, e.m.position.z - d.z); if (dd < bd) { bd = dd; best = e; } }
        if (best) {
          const ang = Math.atan2(best.m.position.x - d.x, best.m.position.z - d.z);
          d.barrel.rotation.y = ang;
          if (d.led) d.led.material.color.setHex(0xff2d78);
          if (d.lens) d.lens.intensity = 25;
          if (d.cd <= 0) {
            d.cd = .28;
            SFX.sp();
            const from = new THREE.Vector3(d.x, 1.15, d.z);
            const to = best.m.position.clone().add(V3(0, 1.2, 0));
            FX.beam(from, to, 0xffe14d, .06, .02);
            FX.muzzle(from, to.clone().sub(from).normalize(), .7);
            hitEnemy(best, d.dmg, { dir: to.clone().sub(from).normalize(), crit: Math.random() < .1 });
          }
        } else { if (d.lens) d.lens.intensity = 8; d.barrel.rotation.y += dt * .6; }
      }
    }
    // pieux
    if (d.id === 'spike') {
      for (const e of enemiesInRadius(V3(d.x, 0, d.z), d.range)) {
        hitEnemy(e, d.dmg * dt, { dir: V3(0, 0, 1) });
      }
    }
    // atelier : répare
    if (d.heal) {
      // répare la base la plus proche
      let nearest = null, bd = 30;
      for (const o of DEFS) { if (o === d) continue; const dd = Math.hypot(o.x - d.x, o.z - d.z); if (dd < bd) { bd = dd; nearest = o; } }
      if (nearest && nearest.hp < nearest.maxhp) { nearest.hp = Math.min(nearest.maxhp, nearest.hp + 4 * dt); if (d.lens) d.lens.intensity = 20; }
      else if (d.lens) d.lens.intensity = 4;
      if (d.led) d.led.material.color.setHex(nearest && nearest.hp < nearest.maxhp ? 0x9fd8ff : 0x2a3a44);
    }
    // geld par les infectés (bloquants)
    if (d.blocks) {
      for (const e of enemiesInRadius(V3(d.x, 0, d.z), 2.2)) {
        e.atkCd = (e.atkCd || 0) - dt;
        if (e.atkCd <= 0) { e.atkCd = .9; d.hp -= 8; FX.sparkHit(e.m.position.clone().add(V3(0, 1, 0)), V3(0, 1, 0)); }
      }
    }
    if (d.hp <= 0) { destroyPart(i); }
  }
}
function destroyPart(i) {
  const d = DEFS[i];
  FX.explosion(d.m.position.clone().add(V3(0, 1, 0)), 3);
  SFX.hitArmor();
  scene.remove(d.m);
  // remove collider
  for (let c = W.colliders.length - 1; c >= 0; c--) if (W.colliders[c].kind === 'built' && Math.hypot(W.colliders[c].x - d.x, W.colliders[c].z - d.z) < .1) W.colliders.splice(c, 1);
  DEFS.splice(i, 1);
  UI.toast('💥 Une défense est détruite !', 'bad');
}
export function repairAllNear() {
  let n = 0;
  for (const d of DEFS) {
    const cost = Math.ceil((d.maxhp - d.hp) / 6);
    if (cost > 0 && G.scrap >= cost) { G.scrap -= cost; d.hp = d.maxhp; n++; }
  }
  if (n) { SFX.build(); UI.toast(`🔧 ${n} pièce(s) réparée(s)`, 'good'); }
  else UI.toast('Rien à réparer ou pas assez de scrap.', 'info');
  return n;
}

export function defenseCount() { return DEFS.length; }
