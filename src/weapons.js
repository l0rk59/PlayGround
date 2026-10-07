// ============================================================================
//  weapons.js — arsenal, modèle en vue subjective, recul, rechargement, mods
// ============================================================================
import * as THREE from 'three';
import { G, mods, clamp, lerp, rand, V3 } from './state.js';
import { metal, concrete } from './textures.js';
import { SFX } from './audio.js';
import * as FX from './fx.js';

export const WEAPONS = {
  machete: { name: 'MACHETTE', ic: '🔪', slot: 0, melee: true, dmg: 58, rate: 2.3, range: 3.4, arc: .72, noise: 0, crit: .18 },
  knife: { name: 'SURCOUTEAU', ic: '🗡', slot: 1, melee: true, dmg: 34, rate: 4.2, range: 2.8, arc: .6, noise: 0, crit: .28 },
  pistol: { name: 'PISTOLET K-9', ic: '🔫', slot: 2, dmg: 34, rate: 4.2, mag: 'pistol', magSize: 15, range: 95, spread: .014, noise: 34, recoil: .9, auto: false, reload: 1.5, adsZ: 1.15 },
  rifle: { name: 'FUSIL V-9', ic: '🔥', slot: 3, dmg: 25, rate: 10, mag: 'rifle', magSize: 30, range: 130, spread: .021, noise: 62, recoil: 1.25, auto: true, reload: 2.1, adsZ: 1.25, pellets: 1 },
  shotgun: { name: 'FUSIL À POMPES', ic: '💥', slot: 4, dmg: 17, rate: 1.25, mag: 'shotgun', magSize: 6, range: 38, spread: .075, noise: 82, recoil: 3.4, auto: false, reload: 2.6, pellets: 8, adsZ: .9 },
  dmr: { name: 'PRÉCISION DMR', ic: '🎯', slot: 5, dmg: 88, rate: 1.35, mag: 'dmr', magSize: 8, range: 260, spread: .003, noise: 70, recoil: 3.8, auto: false, reload: 2.4, adsZ: 1.5, critBonus: .35 },
  grenade: { name: 'GRENADE SON', ic: '💣', slot: 6, throwable: true, dmg: 60, radius: 7, rate: .8, noise: 0 },
};
export const ORDER = ['machete', 'knife', 'pistol', 'rifle', 'shotgun', 'dmr', 'grenade'];

export const Wp = {
  rig: null, muzzle: null, muzzleSprite: null, meshes: {}, sway: V3(), bob: 0,
  recoilV: 0, recoilP: 0, reloadT: 0, reloadDur: 0, switchT: 0, aim: 0, chargeT: 0, last: null,
};

let cam = null, scene = null, wcam = null;
const mats = {};
function mat(color, rough = .6, metal = .4) {
  const k = color + rough + metal;
  if (!mats[k]) {
    const c = new THREE.Color(color);
    c.offsetHSL(0, 0, .12); // on éclaircit : l'arme ne doit pas être une silhouette noire
    mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal * .6 });
  }
  return mats[k];
}
function metalMat() { return new THREE.MeshStandardMaterial({ color: 0x8d97a8, roughness: .38, metalness: .55, map: metal() }); }
// matériaux d'arme : standard + un peu d'auto-illumination pour rester lisibles la nuit
function wmat(color, rough = .5, metal = .5, emis = .12) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: color, emissiveIntensity: emis });
}

function box(w, h, d, m, x = 0, y = 0, z = 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; }
function cyl(r1, r2, h, m, seg = 8) { return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); }

export function initWeapons(camera, sceneRef, weaponCam) {
  cam = camera; scene = sceneRef;
  // Caméra dédiée à l'arme : évite le near-plane et les reculs caméra
  wcam = weaponCam || null;
  const holder = new THREE.Group();
  if (wcam) { wcam.add(holder); } else { cam.add(holder); }
  Wp.rig = holder;
  Wp.rig.position.set(.3, -.3, -.95);
  Wp.rig.scale.setScalar(.8);
  Wp.rig.rotation.set(0, -.07, .02);
  Wp.holder = holder;
  // modèle par arme (on les construit tous, on affiche un seul)
  const M = {};
  // --- machette
  {
    const g = new THREE.Group();
    const blade = box(.05, .015, .82, wmat(0xd6e6f5, .18, .9, .35), 0, .02, -.3);
    blade.scale.z = 1;
    g.add(blade);
    const guard = box(.11, .05, .05, mat(0x4a4a56, .5, .7), 0, 0, .1); g.add(guard);
    const handle = cyl(.022, .026, .19, wmat(0x2e2e34, .9, .1, .08), 6);
    handle.rotation.x = Math.PI / 2; handle.position.z = .2; g.add(handle);
    const wrap = cyl(.028, .028, .1, wmat(0x6b3a3a, .95, .05, .1), 6);
    wrap.rotation.x = Math.PI / 2; wrap.position.z = .18; g.add(wrap);
    M.machete = g;
  }
  // --- couteau
  {
    const g = new THREE.Group();
    g.add(box(.04, .012, .34, wmat(0xd0e2f2, .18, .85, .3), 0, .01, -.1));
    const h = cyl(.018, .022, .12, wmat(0x243642, .8, .2, .1), 6);
    h.rotation.x = Math.PI / 2; h.position.z = .12; g.add(h);
    g.add(box(.09, .04, .03, mat(0x3a3a44, .4, .8), 0, 0, .05));
    M.knife = g;
  }
  // --- pistolet
  {
    const g = new THREE.Group();
    const slide = box(.075, .09, .38, metalMat(), 0, .02, -.12); g.add(slide);
    const frame = box(.07, .07, .3, wmat(0x323a48, .7, .3, .12), 0, -.055, -.08); g.add(frame);
    const grip = box(.065, .19, .1, wmat(0x26282f, .95, .05, .08), 0, -.13, .04);
    grip.rotation.x = .22; g.add(grip);
    const trig = box(.02, .05, .03, mat(0xa8b0ba, .3, .9), 0, -.09, -.03); g.add(trig);
    const sight = box(.02, .035, .03, new THREE.MeshBasicMaterial({ color: 0x00e8ff, toneMapped: false }), 0, .08, -.3); g.add(sight);
    g.userData.muzzleZ = -.33;
    M.pistol = g;
  }
  // --- fusil
  {
    const g = new THREE.Group();
    const body = box(.085, .12, .5, wmat(0x3d4756, .6, .45, .14), 0, 0, -.14); g.add(body);
    const bar = cyl(.019, .019, .5, metalMat()); bar.rotation.x = Math.PI / 2; bar.position.set(0, .03, -.48); g.add(bar);
    const mag = box(.07, .19, .1, wmat(0x3e4550, .7, .4, .14), 0, -.13, -.02); mag.rotation.x = .12; g.add(mag);
    const grip = box(.06, .16, .09, wmat(0x26282f, .95, .05, .08), 0, -.12, .11); grip.rotation.x = .3; g.add(grip);
    const stock = box(.06, .09, .2, mat(0x44444e, .8, .2), 0, -.01, .18); g.add(stock);
    const rail = box(.03, .025, .26, mat(0x1a1a1e, .6, .5), 0, .085, -.16); g.add(rail);
    const sight = box(.022, .028, .05, new THREE.MeshBasicMaterial({ color: 0x00e8ff, toneMapped: false }), 0, .1, -.2); g.add(sight);
    g.userData.muzzleZ = -.74;
    M.rifle = g;
  }
  // --- pompe
  {
    const g = new THREE.Group();
    const body = box(.1, .12, .56, wmat(0x5a3c30, .8, .25, .12), 0, 0, -.16); g.add(body);
    const bar = cyl(.026, .026, .58, metalMat()); bar.rotation.x = Math.PI / 2; bar.position.set(0, .045, -.52); g.add(bar);
    const pump = box(.09, .08, .16, wmat(0x7a5238, .85, .1, .12), 0, -.03, -.4); g.add(pump);
    const grip = box(.065, .17, .1, wmat(0x26282f, .95, .05, .08), 0, -.13, .04); grip.rotation.x = .28; g.add(grip);
    const stock = box(.07, .12, .22, wmat(0x7a5238, .85, .1, .12), 0, -.03, .2); g.add(stock);
    const shell = box(.03, .03, .05, new THREE.MeshBasicMaterial({ color: 0xd94a3d, toneMapped: false }), 0, .1, -.3); g.add(shell);
    g.userData.muzzleZ = -.82;
    M.shotgun = g;
  }
  // --- DMR
  {
    const g = new THREE.Group();
    const body = box(.075, .11, .62, wmat(0x36404e, .55, .55, .14), 0, 0, -.2); g.add(body);
    const bar = cyl(.016, .016, .78, metalMat()); bar.rotation.x = Math.PI / 2; bar.position.set(0, .025, -.62); g.add(bar);
    const scope = cyl(.05, .05, .3, mat(0x1a1a20, .4, .6), 10); scope.rotation.x = Math.PI / 2; scope.position.set(0, .13, -.2); g.add(scope);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.046, 12), new THREE.MeshBasicMaterial({ color: 0x00e8ff, toneMapped: false, transparent: true, opacity: .8 }));
    lens.position.set(0, .13, -.36); g.add(lens);
    const bipod = box(.02, .18, .02, mat(0x525260, .5, .7), 0, -.13, -.5); g.add(bipod);
    const grip = box(.06, .15, .09, wmat(0x26282f, .95, .05, .08), 0, -.12, .1); grip.rotation.x = .3; g.add(grip);
    const stock = box(.07, .13, .24, wmat(0x2c2c34, .7, .3, .1), 0, -.02, .2); g.add(stock);
    g.userData.muzzleZ = -1;
    g.userData.lens = lens;
    M.dmr = g;
  }
  // --- grenade
  {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.06, 1), wmat(0x50664f, .7, .4, .12));
    b.position.set(0, 0, -.1); g.add(b);
    const pin = cyl(.008, .008, .07, mat(0xb0b6c0, .3, .9), 5); pin.rotation.z = Math.PI / 2; pin.position.set(0, .07, -.1); g.add(pin);
    const led = new THREE.Mesh(new THREE.SphereGeometry(.014, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2d78, toneMapped: false }));
    led.position.set(.05, .04, -.1); g.add(led);
    g.userData.led = led;
    g.userData.muzzleZ = -.1;
    M.grenade = g;
  }
  Wp.meshes = M;
  for (const k in M) { M[k].visible = false; Wp.rig.add(M[k]); }

  // bouche de tir + flash
  Wp.muzzle = new THREE.PointLight(0xffcf8a, 0, 16, 2);
  Wp.rig.add(Wp.muzzle);
  return Wp;
}
function woodless() { return concrete('#4a2e22'); }

/** sépare les parties du modèle pour le rechargement */
function partsOf(key) {
  const g = Wp.meshes[key]; if (!g) return null;
  const o = { root: g, body: null, mag: null, slide: null, pump: null, led: null };
  g.traverse(c => {
    if (c.isMesh) {
      if (c.geometry.type === 'BoxGeometry' && c.geometry.parameters.depth > .13 && c.geometry.parameters.height < .1) o.body = c;
      else if (c.geometry.type === 'BoxGeometry' && c.geometry.parameters.depth < .16 && c.geometry.parameters.height > .14) o.mag = c;
      else if (c.geometry.parameters.depth < .13 && c.geometry.parameters.height < .06) o.slide = c;
    }
    if (c.userData && c.userData.led) o.led = c.userData.led;
  });
  return o;
}

export function selectWeapon(key, silent) {
  if (!WEAPONS[key] || key === G.wpn) return false;
  if (key !== 'grenade' && G.unlocked[key] !== 1) return false;
  G.wpn = key; Wp.switchT = .28; Wp.last = key;
  for (const k in Wp.meshes) Wp.meshes[k].visible = (k === key);
  if (!silent) SFX.click();
  const w = WEAPONS[key];
  Wp.reloadDur = w.reload || 0; Wp.reloadT = 0;
  return true;
}
export function nextWeapon(dir = 1) {
  const owned = ORDER.filter(k => k === 'grenade' ? G.grenades > 0 : G.unlocked[k] === 1);
  const i = owned.indexOf(G.wpn);
  selectWeapon(owned[(i + dir + owned.length) % owned.length]);
}
export function hasAmmo(key) {
  const w = WEAPONS[key];
  if (w.melee || w.throwable) return true;
  return G.ammo[w.mag].m > 0;
}

/** applique le modèle d'arme et les mods */
export function refreshWeaponModel() {
  const key = G.wpn, w = WEAPONS[key];
  const g = Wp.meshes[key]; if (!g) return;
  g.visible = true;
  // silencieux
  if (key === 'pistol' || key === 'rifle') {
    if (!g.userData.sil) {
      const sil = cyl(.028, .028, .16, mat(0x32323a, .9, .1), 8);
      sil.rotation.x = Math.PI / 2; sil.position.set(0, .03, -((g.userData.muzzleZ || -.4) + .06));
      g.add(sil); g.userData.sil = sil;
    }
    g.userData.sil.visible = mods.silencer;
  }
  // lunette (augmente le zoom d'ADS)
  Wp.scopeBonus = mods.scope ? .32 : 0;
  const parts = partsOf(key);
  if (parts && parts.led) parts.led.material.color.setHex(mods.silencer ? 0x5dff8f : 0xff2d78);
}

/* ---------------- recul / caméra ---------------- */
export function applyRecoil(amount) {
  Wp.recoilV = amount;
  Wp.recoilP += amount * .01;
}
export function updateWeapon(dt, moveAmt, isSprint) {
  const w = WEAPONS[G.wpn];
  Wp.aim = lerp(Wp.aim, G.aiming && !w.melee && !w.throwable ? 1 : 0, dt * 12);
  Wp.switchT = Math.max(0, Wp.switchT - dt);
  Wp.bob += moveAmt * dt * 9;
  // balancement
  const bobX = Math.sin(Wp.bob) * .012 * moveAmt;
  const bobY = Math.abs(Math.cos(Wp.bob)) * .01 * moveAmt;
  Wp.sway.x = lerp(Wp.sway.x, clamp(-INLOOK, -1, 1) * .04 + bobX, dt * 8);
  Wp.sway.y = lerp(Wp.sway.y, clamp(INLOOKY, -1, 1) * .03 + bobY, dt * 8);
  Wp.recoilV = lerp(Wp.recoilV, 0, dt * 11);
  Wp.recoilP = lerp(Wp.recoilP, 0, dt * 9);
  const spread = isSprint ? 1.6 : 1;
  const baseZ = (w.melee ? -.88 : w.throwable ? -.85 : -.95) - Wp.aim * (w.adsZ || .62);
  const baseX = lerp(.3, .012, Wp.aim) + Wp.sway.x;
  const baseY = lerp(-.3, -.17, Wp.aim) + Wp.sway.y - (isSprint ? .05 : 0);
  Wp.rig.position.set(baseX, baseY, baseZ + Wp.recoilV * .05 - Wp.aim * .02);
  Wp.rig.rotation.set(-.02 - Wp.recoilP * .4 + (Wp.switchT > 0 ? -1.2 * Wp.switchT / .28 : 0) + Wp.recoilV * .06, -.07 - Wp.aim * .05, .02);
  // rechargement
  if (Wp.reloadT > 0) {
    Wp.reloadT -= dt;
    const k = 1 - Wp.reloadT / Wp.reloadDur;
    const dip = Math.sin(k * Math.PI);
    Wp.rig.position.y -= dip * .22;
    Wp.rig.position.z += dip * .1;
    Wp.rig.rotation.x += dip * .7;
    Wp.rig.rotation.z = dip * .35;
    const parts = partsOf(G.wpn);
    if (parts && parts.mag) parts.mag.position.y = (parts.mag.userData.y0 ?? (parts.mag.userData.y0 = parts.mag.position.y)) - dip * .18;
  }
  // lumière de bouche
  if (Wp.muzzle.intensity > 0) Wp.muzzle.intensity = Math.max(0, Wp.muzzle.intensity - dt * 900);
  if (isSprint) Wp.rig.rotation.z += Math.sin(Wp.bob * 2) * .05;
  // la caméra de l'arme suit exactement la caméra de jeu
  if (wcam) { wcam.position.copy(cam.position); wcam.quaternion.copy(cam.quaternion); }
}

let INLOOK = 0, INLOOKY = 0;
export function setLook(x, y) { INLOOK = x; INLOOKY = y; }

/* ---------------- tir ---------------- */
export function fireWeapon(target) {
  const key = G.wpn, w = WEAPONS[key];
  if (Wp.reloadT > 0 || Wp.switchT > 0) return false;
  if (w.throwable) return throwGrenade(target);
  if (w.melee) return meleeSwing(target);
  const a = G.ammo[w.mag];
  if (a.m <= 0) { SFX.deny(); reload(); return false; }
  a.m--; G.shotsFired++;
  applyRecoil(w.recoil * (mods.grip ? .68 : 1) * (1 - Wp.aim * .25) * (G.grounded ? 1 : 1.7));
  const silenced = mods.silencer && (key === 'pistol' || key === 'rifle');
  silenced ? SFX.silenced() : (key === 'shotgun' ? SFX.shotgun() : key === 'dmr' ? SFX.dmr() : key === 'rifle' ? SFX.rifle() : SFX.pistol());
  // flash
  const g = Wp.meshes[key];
  const mz = g.userData.muzzleZ || -.5;
  const mw = new THREE.Vector3(0, .02, mz - .1); g.localToWorld(mw);
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  FX.muzzle(mw.clone().addScaledVector(dir, .2), dir, key === 'shotgun' ? 1.6 : 1);
  Wp.muzzle.position.set(0, .02, mz);
  Wp.muzzle.intensity = silenced ? 40 : 120;
  FX.shell(mw.clone().addScaledVector(dir, -.2).add(V3(rand(.04, .1), .04, 0)), dir.clone().negate());
  G.noise += silenced ? 14 : 42;
  // --- hitscan : on part de la caméra, pas du canon (le modèle déborde)
  const rc = Wp._ray || (Wp._ray = new THREE.Raycaster());
  const pellets = w.pellets || 1;
  const spread = spreadFactor() * (G.sprint ? 1.9 : 1);
  for (let p = 0; p < pellets; p++) {
    const sx = pellets > 1 ? rand(-spread, spread) * 3 : rand(-spread, spread);
    const sy = pellets > 1 ? rand(-spread, spread) * 1.2 : rand(-spread, spread);
    rc.setFromCamera({ x: sx, y: sy }, cam);
    rc.far = w.range;
    // infectés touchés
    let best = null, bd = w.range;
    for (const e of target) {
      if (e.die > 0) continue;
      const aim = e.m.position.clone().add(V3(0, 1.15 * TYPES[e.type].sc, 0));
      const to = aim.clone().sub(rc.ray.origin);
      const t = to.dot(rc.ray.direction);
      if (t <= 0 || t > w.range) continue;
      const perp = to.clone().addScaledVector(rc.ray.direction, -t).length();
      const radius = e.type === 'brute' ? 1.15 : e.type === 'crawler' ? .6 : .78;
      if (perp < radius && t < bd) { bd = t; best = e; }
    }
    // le long du rayon : on s'arrête au premier
    if (best) {
      const aimPt = best.m.position.clone().add(V3(0, 1.15 * TYPES[best.type].sc, 0));
      const dir = rc.ray.direction;
      const dist2 = rc.ray.origin.distanceTo(aimPt);
      // probability de headshot : plus forte si la visée est haute
      const hAlign = Math.abs(((rc.ray.origin.y + dir.y * dist2) - (best.m.position.y + 1.62 * TYPES[best.type].sc)));
      const head = hAlign < .28;
      hitEnemy(best, w.dmg * G.dmgBoost * (head ? 1.9 : 1) * (bd < 15 ? 1.15 : 1), {
        dir: dir.clone(), crit: head || Math.random() < (w.critBonus || .04),
      });
      FX.tracer(rc.ray.origin.clone().addScaledVector(dir, .5), aimPt, head ? 0xffe14d : 0xffd27a);
      FX.bloodHit(aimPt, dir.clone().negate());
    } else {
      // impact sur le décor : on cherche un point proche
      const far = rc.ray.at(w.range, new THREE.Vector3());
      let hitPoint = null, hitDist = w.range;
      for (const c of WORLD_COLLIDERS()) {
        const dx = Math.abs(rc.ray.direction.x) > 1e-4 ? (c.x - rc.ray.origin.x) / rc.ray.direction.x : Infinity;
        const dz = Math.abs(rc.ray.direction.z) > 1e-4 ? (c.z - rc.ray.origin.z) / rc.ray.direction.z : Infinity;
        for (const tt of [dx, dz]) {
          if (tt <= 0 || tt > hitDist) continue;
          const yy = rc.ray.origin.y + rc.ray.direction.y * tt;
          if (yy > c.top + 6 || yy < -.5) continue;
          const hx = rc.ray.origin.x + rc.ray.direction.x * tt;
          const hz = rc.ray.origin.z + rc.ray.direction.z * tt;
          if (Math.abs(hx - c.x) < c.hx && Math.abs(hz - c.z) < c.hz) { hitDist = tt; hitPoint = new THREE.Vector3(hx, yy, hz); }
        }
      }
      const end = hitPoint || far;
      FX.tracer(rc.ray.origin.clone().addScaledVector(rc.ray.direction, .5), end, 0x9fd8ff, .04);
      if (hitPoint) { FX.sparkHit(hitPoint, rc.ray.direction.clone().negate()); FX.decalHit(hitPoint, rc.ray.direction.clone().negate()); }
    }
  }
  FX.shake(.1 + w.recoil * .05, .1 + w.recoil * .03);
  // le tir attire les infectés
  if (!silenced) for (let i = 0; i < Math.min(3, Math.ceil(w.noise / 26)); i++) attract();
  return true;
}
/** attire des infectés vers la position du joueur (bruit) */
let attractT = 0;
function attract() {
  const now = performance.now();
  if (now - attractT < 900) return;
  attractT = now;
  const px = G.px, pz = G.pz;
  for (let i = 0; i < 2; i++) {
    const a = rand(0, Math.PI * 2), rad = rand(24, 44);
    spawnEnemy(Math.random() < .4 ? 'runner' : 'walker', px + Math.cos(a) * rad, pz + Math.sin(a) * rad, {});
  }
}

export function reload() {
  const w = WEAPONS[G.wpn];
  if (w.melee || w.throwable || Wp.reloadT > 0) return;
  const a = G.ammo[w.mag];
  if (a.m >= (w.magSize || 30) || a.r <= 0) return;
  Wp.reloadT = Wp.reloadDur = w.reload;
  SFX.reload();
}
export function finishReload() {
  const w = WEAPONS[G.wpn]; if (!w || w.melee) return;
  const a = G.ammo[w.mag]; const need = (w.magSize || 30) - a.m, take = Math.min(need, a.r);
  a.m += take; a.r -= take;
}
export function meleeSwing(target) {
  const w = WEAPONS[G.wpn];
  if (performance.now() - (meleeSwing.t || 0) < 1000 / w.rate) return false;
  meleeSwing.t = performance.now();
  meleeSwing.k = 0; // numéro de combo
  const k = ++meleeSwing.c % 3; meleeSwing.k = k;
  SFX.swing();
  applyRecoil(1.2);
  // arc de coupe
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
  const dmgMul = [1, 1.25, 1.7][k];
  let hits = 0;
  for (const e of target) {
    const dx = e.m.position.x - G.px, dz = e.m.position.z - G.pz;
    const d = Math.hypot(dx, dz);
    if (d > w.range) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (dot < w.arc) continue;
    hitEnemy(e, w.dmg * dmgMul * G.dmgBoost, { melee: true, crit: Math.random() < w.crit + (k === 2 ? .2 : 0), dir: V3(fx, 0, fz) });
    hits++;
  }
  if (hits) { SFX.hitFlesh(); FX.shake(.16 * dmgMul, .16); }
  else SFX.melee();
  meleeSwing.active = .3;
  return true;
}
meleeSwing.c = 0; meleeSwing.t = 0; meleeSwing.active = 0; meleeSwing.k = 0;

/* ---------------- grenades ---------------- */
const thrown = [];
export function throwGrenade(target) {
  if (G.grenades <= 0) { SFX.deny(); return false; }
  if (performance.now() - (throwGrenade.t || 0) < 800) return false;
  throwGrenade.t = performance.now();
  G.grenades--;
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const start = new THREE.Vector3(); cam.getWorldPosition(start);
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.1, 1), new THREE.MeshStandardMaterial({ color: 0x2a3a30, roughness: .7, metalness: .4, emissive: 0x331111, emissiveIntensity: 1 }));
  m.position.copy(start).addScaledVector(dir, .5);
  scene.add(m);
  const l = new THREE.PointLight(0xff2d78, 30, 12, 2); m.add(l);
  thrown.push({ m, v: dir.clone().multiplyScalar(14).add(V3(0, 3.2, 0)), life: 2.6, fuse: 2.6, l });
  SFX.click();
  return true;
}
export function updateGrenades(dt, onExplode) {
  for (let i = thrown.length - 1; i >= 0; i--) {
    const t = thrown[i];
    t.v.y -= 16 * dt;
    t.m.position.addScaledVector(t.v, dt);
    t.m.rotation.x += dt * 9; t.m.rotation.y += dt * 7;
    t.fuse -= dt;
    t.l.intensity = 20 + Math.sin(G.t * 24) * 15 * clamp(1 - t.fuse, 0, 1);
    if (t.m.position.y < .1) { t.m.position.y = .1; t.v.y = Math.abs(t.v.y) * .35; t.v.x *= .6; t.v.z *= .6; }
    if (t.fuse <= 0) {
      FX.explosion(t.m.position.clone(), 5);
      SFX.explode();
      onExplode(t.m.position.clone(), 5.5, WEAPONS.grenade.dmg * G.dmgBoost, true);
      scene.remove(t.m);
      thrown.splice(i, 1);
    }
  }
}
export const grenadeCount = () => thrown.length;

/* ---------------- application des dégâts ---------------- */
import { hitEnemy, spawnEnemy, TYPES } from './enemies.js';
import { W as WORLD_REF } from './world.js';
const WORLD_COLLIDERS = () => WORLD_REF.colliders;

/* ---------------- effets de caméra ---------------- */
export function currentAim() { return Wp.aim; }
export function spreadFactor() {
  const w = WEAPONS[G.wpn];
  if (w.melee || w.throwable) return 0;
  let s = w.spread * (1 - Wp.aim * .62);
  if (!G.grounded) s *= 2.2;
  if (G.sprint) s *= 1.9;
  if (mods.grip) s *= .82;
  if (mods.scope) s *= .7;
  return s;
}
