// ============================================================================
//  vehicles.js — buggy, camion blindé, van à tourelle : conduite, carburant
// ============================================================================
import * as THREE from 'three';
import { G, clamp, lerp, damp, rand, randi, V3, TAU } from './state.js';
import { W, collide, blocked, freeSpot, addCollider } from './world.js';
import { hitEnemy, enemiesInRadius, spawnEnemy } from './enemies.js';
import * as FX from './fx.js';
import { SFX, engineOn, engineUpdate, engineOff } from './audio.js';
import { metal, concrete } from './textures.js';

export const V = [];   // véhicules
let scene = null;

const KINDS = {
  buggy: { name: 'BUGGY NÉON', hp: 150, maxSpeed: 26, accel: 15, turn: 2.0, fuel: 60, color: 0x00c8e0, pl: 2, turret: false, horn: 'beep' },
  truck: { name: 'CAMION BASTION', hp: 320, maxSpeed: 15, accel: 10, turn: 1.35, fuel: 90, color: 0xd06a1a, pl: 1, turret: false, horn: 'air' },
  van: { name: 'VAN RENARD', hp: 220, maxSpeed: 21, accel: 13, turn: 1.7, fuel: 75, color: 0x7c4dff, pl: 1, turret: true, horn: 'siren' },
};

function buildMesh(kind) {
  const K = KINDS[kind];
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: K.color, roughness: .45, metalness: .55, map: metal() });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: .5, metalness: .6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1620, roughness: .15, metalness: .8, transparent: true, opacity: .85 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: .3, metalness: .9 });
  if (kind === 'buggy') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, .6, 3.8), paint); body.position.y = .8; g.add(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, .4, 1.2), paint); hood.position.set(0, 1.05, -1.1); g.add(hood);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, .8, 1.4), glass); cab.position.set(0, 1.4, .1); g.add(cab);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.85, .1, 1.9), chrome); cage.position.set(0, 1.9, .1); g.add(cage);
    for (const [sx, sz] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.2, 5), chrome);
      post.position.set(sx * .85, 1.5, sz * .8); g.add(post);
    }
  } else if (kind === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 2.4), paint); cab.position.set(0, 1.6, -1.8); g.add(cab);
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, .2), glass); win.position.set(0, 1.9, -3); g.add(win);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 4.6), new THREE.MeshStandardMaterial({ color: 0x3a3a40, map: metal(), roughness: .8, metalness: .4 })); bed.position.set(0, 1.4, 1.2); g.add(bed);
    const plow = new THREE.Mesh(new THREE.BoxGeometry(3, .8, .4), chrome); plow.position.set(0, .8, -3.4); plow.rotation.x = -.3; g.add(plow);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.7, .2, .1), new THREE.MeshBasicMaterial({ color: 0xffe14d, toneMapped: false })); bar.position.set(0, .6, -3.6); g.add(bar);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 5.4), paint); box.position.y = 1.6; g.add(box);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.6), paint); nose.position.set(0, 1.3, -3.2); g.add(nose);
    const win = new THREE.Mesh(new THREE.BoxGeometry(2, .8, .2), glass); win.position.set(0, 1.6, -4); g.add(win);
    // tourelle
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.6, .7, .2, 10), chrome); ring.position.y = 2.8; g.add(ring);
    const gun = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, 1.2), dark); gun.add(body);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1.8, 8), chrome); bar.rotation.x = Math.PI / 2; bar.position.z = -1; gun.add(bar);
    gun.position.y = 3.2; g.add(gun);
    g.userData.gun = gun;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .4, 8), dark); post.position.y = 2.8; g.add(post);
  }
  // roues
  const wg = new THREE.CylinderGeometry(.55, .55, .38, 12);
  const wm = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: .95 });
  const wheels = [];
  const wr = kind === 'truck' ? 1.45 : 1.2, wl = kind === 'truck' ? 2.1 : 1.5;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = new THREE.Mesh(wg, wm); w.rotation.z = Math.PI / 2; w.position.set(sx * wr, .55, sz * wl); g.add(w);
    wheels.push(w);
  }
  // néons
  const neonColor = kind === 'buggy' ? 0xff2d78 : kind === 'truck' ? 0xffe14d : 0x9d6bff;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, .16, .3), new THREE.MeshBasicMaterial({ color: neonColor, toneMapped: false }));
  strip.position.set(0, 1.4, -2.2); g.add(strip);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: neonColor, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(0, 1.4, -2.2); glow.scale.setScalar(3); g.add(glow);
  // phares (spot) + feu stop
  const head = new THREE.SpotLight(0xcfe8ff, 0, 55, .5, .5, 1.5);
  head.position.set(0, 1.2, -2.5); head.target.position.set(0, .3, -14);
  g.add(head); g.add(head.target);
  return { g, wheels, head, gun: g.userData.gun, neon: neonColor };
}
import { halo as haloTex } from './textures.js';

export function initVehicles(sceneRef) { scene = sceneRef; }

export function spawnVehicle(kind, x, z, rot = 0) {
  const K = KINDS[kind];
  const built = buildMesh(kind);
  const spot = freeSpot(x, z, 3);
  built.g.position.set(spot.x, 0, spot.z); built.g.rotation.y = rot;
  scene.add(built.g);
  const v = {
    kind, K, m: built.g, wheels: built.wheels, head: built.head, gun: built.gun,
    speed: 0, angle: rot, fuel: K.fuel, maxFuel: K.fuel, hp: K.hp, maxhp: K.hp,
    dead: false, smokeT: 0, lastHit: 0, turretCd: 0,
  };
  V.push(v);
  return v;
}
export function buildFleet() {
  // garés à l'EXTÉRIEUR de l'enceinte du camp (sinon le véhicule est piégé par les clôtures)
  const out = (cx, cz, r) => ({ x: cx + Math.cos(r) * 24, z: cz + Math.sin(r) * 24 });
  let p = out(W.CAMP.x, W.CAMP.z, 2.6); spawnVehicle('buggy', p.x, p.z, .6 + Math.PI);
  p = out(W.CAMP.x, W.CAMP.z, -1.1); spawnVehicle('truck', p.x, p.z, 1.4);
  spawnVehicle('buggy', 88, 52, 2.2);
  spawnVehicle('van', -100, 30, 1.1);
  spawnVehicle('truck', 120, -60, 3);
}

export function nearestVehicle(pos, maxD = 4.4) {
  let best = null, bd = maxD;
  for (const v of V) {
    if (v.dead) continue;
    const d = Math.hypot(v.m.position.x - pos.x, v.m.position.z - pos.z);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function enterVehicle(v) {
  if (v.dead) return false;
  if (v.fuel <= 0) { SFX.deny(); UI.toast('⛽ Réservoir vide ! Trouve du carburant (jerricans ou Fixer).', 'bad'); return false; }
  G.inVeh = v; G.velSeat = 0;
  document.body.classList.add('driving');
  UI.toast(`🚗 À bord du ${v.K.name}`, 'info');
  SFX.click();
  engineOn(true, v.kind);
  document.body.classList.add('driving');
  return true;
}
export function exitVehicle() {
  const v = G.inVeh; if (!v) return;
  G.inVeh = null;
  document.body.classList.remove('driving');
  const vh = document.getElementById('vehHUD'); if (vh) vh.style.display = 'none';
  engineOff();
  // sortir côté conducteur
  const a = v.angle;
  const p = V3(v.m.position.x + Math.sin(a + Math.PI) * 2.4, 0, v.m.position.z + Math.cos(a + Math.PI) * 2.4);
  collide(p, .5);
  G.px = p.x; G.pz = p.z;
  G.yaw = v.angle + Math.PI;
  UI.toast('Tu sors du véhicule.', 'info');
}

export function refuel(v) {
  if (G.fuel <= 0) return false;
  if (v.fuel >= v.maxFuel) { UI.toast('Le réservoir est plein.', 'info'); return false; }
  G.fuel--; v.fuel = Math.min(v.maxFuel, v.fuel + 40);
  SFX.buy(); UI.toast(`⛽ Ravitaillement +40 (${Math.round(v.fuel)}%)`, 'good');
  return true;
}
export function repairVehicle(v) {
  if (v.hp >= v.maxhp) { UI.toast('Véhicule déjà intact.', 'info'); return false; }
  const cost = Math.ceil((v.maxhp - v.hp) / 3);
  if (G.scrap < cost) { SFX.deny(); UI.toast(`🔧 Réparation : ${cost}⚙️ requis.`, 'bad'); return false; }
  G.scrap -= cost; v.hp = v.maxhp; SFX.build(); UI.toast(`🔧 ${v.K.name} réparé (-${cost}⚙️)`, 'good');
  return true;
}

export function updateVehicle(dt, IN, ctx) {
  const v = G.inVeh;
  if (!v) { for (const vv of V) updateIdle(vv, dt); return; }
  let th = IN.fwd, st = IN.side;
  th = clamp(th, -1, 1); st = clamp(st, -1, 1);
  if (v.fuel <= 0) th = Math.min(th, 0);
  const target = th * v.K.maxSpeed * (th < 0 ? .45 : 1);
  const acc = v.K.accel * dt * (th !== 0 ? 1 : .6);
  v.speed = Math.abs(v.speed) < .2 && th === 0 ? 0 : v.speed + clamp(target - v.speed, -acc, acc);
  v.angle += st * v.K.turn * dt * clamp(v.speed / 6, -1, 1) * (v.speed < 0 ? -1 : 1);
  // moteur
  engineUpdate(v.speed, v.K.maxSpeed, v.kind);
  // déplacement + collisions
  const nx = v.m.position.x - Math.sin(v.angle) * v.speed * dt;
  const nz = v.m.position.z - Math.cos(v.angle) * v.speed * dt;
  const pos = V3(nx, 0, nz);
  // position réellement parcourue (avant résolution des collisions)
  const oldX = v.m.position.x, oldZ = v.m.position.z;
  collide(pos, 1.9, 0, { soft: true });
  const moved = Math.hypot(pos.x - oldX, pos.z - oldZ);
  v.m.position.x = pos.x; v.m.position.z = pos.z;
  // choc : seulement si vraiment bloqué contre un obstacle dur
  if (moved < Math.abs(v.speed) * dt * .12 && Math.abs(v.speed) > 2) {
    v.hitCd = (v.hitCd || 0) - dt;
    if (v.hitCd <= 0) {
      v.hitCd = .5;
      const impact = Math.abs(v.speed);
      v.hp -= impact * .6;
      FX.shake(.4, .2); SFX.hitArmor();
      v.speed *= impact > 14 ? -.2 : .25;
    }
  }
  G.driveDist += Math.abs(v.speed) * dt;
  // carburant
  if (Math.abs(v.speed) > .5) {
    v.fuel = Math.max(0, v.fuel - Math.abs(v.speed) * dt * .075);
    G.noise += 8 * dt;
  }
  if (v.fuel <= 0 && !v.warned) { v.warned = true; UI.toast('⛽ PANNE SÈCHE ! Sors et trouve du carburant.', 'bad'); }
  if (v.fuel > 5) v.warned = false;
  // écrasement
  for (const e of enemiesInRadius(v.m.position, 3)) {
    const dmg = 60 + Math.abs(v.speed) * 12;
    hitEnemy(e, dmg, { dir: V3(-Math.sin(v.angle), 0, -Math.cos(v.angle)), crit: Math.random() < .1 });
    v.hp -= 1.5;
    if (Math.random() < .3) { SFX.hitFlesh(); FX.burst(e.m.position.clone().add(V3(0, 1, 0)), 0x8e1428, 4, { size: .2, life: .4 }); }
  }
  // dégâts par zombies (contact)
  for (const e of enemiesInRadius(v.m.position, 3.2)) {
    e.hitCd = (e.hitCd || 0) - dt;
    if (e.hitCd <= 0) { e.hitCd = .8; v.hp -= e.dmg * .8; FX.shake(.2, .15); }
  }
  if (v.hp <= 0 && !v.dead) { v.dead = true; explosionAt(v.m.position.clone().add(V3(0, 1, 0))); exitVehicle(); UI.toast('🔥 Véhicule détruit !', 'bad'); }
  // fumée si endommagé
  if (v.hp < v.maxhp * .4) {
    v.smokeT -= dt;
    if (v.smokeT <= 0) { v.smokeT = .06; FX.particle(v.m.position.clone().add(V3(0, 1.6, 1.5)), 0x2a2a2a, { size: .8, life: 1.4, vel: V3(0, 1.4, 0), g: .2, add: false }); }
  }
  // tourelle du van
  if (v.K.turret) {
    v.turretCd -= dt;
    if (IN.fire && v.turretCd <= 0) {
      v.turretCd = .1;
      turretFire(v, ctx);
    }
    if (v.gun) v.gun.rotation.y = Math.atan2(-Math.sin(G.yaw), -Math.cos(G.yaw)) + v.angle;
  }
  // caméra : suivi + secousse
  const camAng = G.yaw;
  const fwdX = -Math.sin(v.angle), fwdZ = -Math.cos(v.angle);
  const camPos = ctx.cam.position;
  const targetX = v.m.position.x + fwdX * -8.5, targetZ = v.m.position.z + fwdZ * -8.5;
  camPos.x = damp(camPos.x, targetX, 6, dt);
  camPos.z = damp(camPos.z, targetZ, 6, dt);
  camPos.y = damp(camPos.y, 4.4, 5, dt);
  ctx.cam.lookAt(v.m.position.x + fwdX * 4, 1.6, v.m.position.z + fwdZ * 4);
  // HUD
  ctx.updateVehicleHUD?.(v);
  //animation roues
  for (const w of v.wheels) w.rotation.x += v.speed * dt * 1.5;
  v.m.rotation.y = v.angle;
}

function turretFire(v, ctx) {
  SFX.shotgun();
  const muz = v.m.position.clone(); muz.y = 3.2;
  const dir = new THREE.Vector3(); ctx.cam.getWorldDirection(dir);
  const from = muz.addScaledVector(dir, 2.5);
  for (const e of enemiesInRadius(ctx.cam.position, 60)) {
    const to = e.m.position.clone().add(V3(0, 1, 0));
    const d = to.distanceTo(from);
    const ang = dir.angleTo(to.clone().sub(from).normalize());
    if (ang < .2) {
      hitEnemy(e, 45, { dir: to.clone().sub(from).normalize(), crit: Math.random() < .12 });
    }
  }
  FX.muzzle(from, dir, 1.2);
  FX.beam(from, from.clone().addScaledVector(dir, 40), 0xffe14d, .08, .04);
  FX.shake(.12, .08);
}

function updateIdle(v, dt) {
  if (v.dead) return;
  v.head.intensity = 0;
  if (v.hp < v.maxhp * .4 && Math.random() < .01) FX.particle(v.m.position.clone().add(V3(0, 1.6, 0)), 0x2a2a2a, { size: .7, life: 1.2, vel: V3(0, 1, 0), add: false });
}

export function vehicleHorn(v) {
  if (!v) return;
  if (v.K.horn === 'air') { SFX.horn(); }
  else if (v.K.horn === 'siren') { SFX.horn(); setTimeout(() => SFX.horn(), 200); }
  else { SFX.horn(); }
  // attire les zombies
  for (let i = 0; i < 5; i++) {
    const a = rand(0, TAU), rad = rand(20, 40);
    const px2 = v.m.position.x + Math.cos(a) * rad, pz2 = v.m.position.z + Math.sin(a) * rad;
    spawnEnemy('walker', px2, pz2, {});
  }
  UI.toast('📯 Klaxon ! Les infectés convergent.', 'info');
}

function explosionAt(pos) {
  FX.explosion(pos, 8); SFX.explode(); FX.shake(1.2, .7);
}

