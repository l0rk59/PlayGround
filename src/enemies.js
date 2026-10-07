// ============================================================================
//  enemies.js — infectés : 5 types, IA, animation procédurale, mort
// ============================================================================
import * as THREE from 'three';
import { G, clamp, lerp, rand, randi, V3, TAU, addXp } from './state.js';
import { spawnPoint, blocked, freeSpot, inSafeZone, SAFE_ZONES } from './world.js';
import * as FX from './fx.js';
import { halo as haloTex } from './textures.js';
import { SFX } from './audio.js';

export const TYPES = {
  walker:  { name: 'MARCHEUR', hp: 62, speed: 2.7, dmg: 7, atkCd: 1.0, xp: 11, sc: 1,   col: 0x7fa85c, head: 0xa8cf72, eye: 0xff2d44, reach: 1.5, aggro: 34, gib: 1 },
  runner:  { name: 'COUREUR', hp: 46, speed: 6.1, dmg: 5, atkCd: .62, xp: 15, sc: .9,  col: 0xd05a72, head: 0xf08098, eye: 0xff4466, reach: 1.4, aggro: 48, gib: 1, sprint: true },
  crawler: { name: 'RAMPANT', hp: 58, speed: 4.4, dmg: 6, atkCd: .8,  xp: 13, sc: .82, col: 0x8a7fc4, head: 0xb0a4e0, eye: 0xc48cff, reach: 1.3, aggro: 30, gib: 1, low: true },
  spitter: { name: 'CRACHEUR', hp: 58, speed: 2.3, dmg: 11, atkCd: 2.1, xp: 24, sc: .96, col: 0x5fc98c, head: 0x86f0b0, eye: 0x5dff9a, reach: 17, aggro: 30, gib: 1, ranged: true },
  brute:   { name: 'COLOSSE', hp: 320, speed: 2.1, dmg: 20, atkCd: 1.6, xp: 46, sc: 1.7, col: 0xa068c0, head: 0xc490e0, eye: 0xff88ff, reach: 2.2, aggro: 40, gib: 2, boss: true },
};

export const E = [];            // tous les infectés
const geo = {};
let scene = null, cam = null;

/* géométries partagées */
function geoms() {
  if (geo.init) return geo;
  geo.init = true;
  geo.body = new THREE.CapsuleGeometry(.34, .7, 5, 10);
  geo.head = new THREE.SphereGeometry(.24, 10, 8);
  geo.eye = new THREE.SphereGeometry(.045, 6, 5);
  geo.arm = new THREE.CapsuleGeometry(.09, .55, 4, 7);
  geo.leg = new THREE.CapsuleGeometry(.11, .5, 4, 7);
  geo.jaw = new THREE.BoxGeometry(.2, .1, .18);
  geo.acid = new THREE.SphereGeometry(.13, 8, 6);
  return geo;
}
const matCache = new Map();
/** matière « chair » : légèrement auto-illuminée pour rester lisible dans la nuit */
function mtl(color, em = 0, emis = .22) {
  const k = color + '_' + em;
  if (!matCache.has(k)) {
    const c = new THREE.Color(color);
    const e = em ? new THREE.Color(em) : c.clone().multiplyScalar(.5);
    matCache.set(k, new THREE.MeshStandardMaterial({
      color: c, roughness: .82, metalness: .03,
      emissive: e, emissiveIntensity: em ? .9 : emis,
    }));
  }
  return matCache.get(k);
}

const rndSym = a => (Math.random() * 2 - 1) * a;

export function initEnemies(sceneRef, camera) { scene = sceneRef; cam = camera; geoms(); }

function buildModel(type) {
  const T = TYPES[type];
  const g = new THREE.Group();
  const skin = mtl(T.col);
  const dark = new THREE.Color(T.col).multiplyScalar(.72);
  const fleshDark = mtl(dark.getHex());

  /* ---------- anatomie : torse, bassin, tête, cou ---------- */
  // torse (plus large que la capsule d'origine, épaules marquées)
  const torso = new THREE.Mesh(geoms().torso, skin);
  torso.position.y = 1.18; torso.scale.set(1, 1, .78); g.add(torso);
  // ventre rentré
  const belly = new THREE.Mesh(new THREE.SphereGeometry(.27, 10, 8), skin);
  belly.position.y = .82; belly.scale.set(1, .82, .85); g.add(belly);
  // bassin
  const hips = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 7), fleshDark);
  hips.position.y = .66; hips.scale.set(1.1, .8, .9); g.add(hips);
  // cou penché + tête
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .18, 6), fleshDark);
  neck.position.set(0, 1.5, .06); neck.rotation.x = .3; g.add(neck);
  const head = new THREE.Mesh(geoms().head, mtl(T.head));
  head.position.set(0, 1.7, .1); head.rotation.x = .3;   // menton baissé = posture morte-vivant
  head.scale.set(1.08, 1.14, 1.1); g.add(head);

  /* ---------- visage : mâchoire ouverte, dents, orbites ---------- */
  const jaw = new THREE.Group();
  const jawBone = new THREE.Mesh(new THREE.BoxGeometry(.26, .09, .22), fleshDark);
  jawBone.position.set(0, 1.5, .19); jaw.add(jawBone);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .04), new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: .8 }));
  teeth.position.set(0, 1.56, .21); jaw.add(teeth);
  const lowerTeeth = new THREE.Mesh(new THREE.BoxGeometry(.18, .04, .04), new THREE.MeshStandardMaterial({ color: 0xc0b89c, roughness: .85 }));
  lowerTeeth.position.set(0, 1.47, .21); jaw.add(lowerTeeth);
  g.add(jaw);
  // orbites creuses (pas de cornea : regard mort)
  const eyeM = new THREE.MeshBasicMaterial({ color: T.eye, toneMapped: false });
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(.085, 8, 6), mtl(0x120c10));
    socket.position.set(s * .1, 1.72, .17); g.add(socket);
    const e = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), eyeM);
    e.position.set(s * .105, 1.72, .2); g.add(e);
    // sourcil saillant
    const brow = new THREE.Mesh(new THREE.BoxGeometry(.11, .035, .06), fleshDark);
    brow.position.set(s * .1, 1.78, .2); brow.rotation.z = -s * .25; g.add(brow);
  }

  // nez + oreilles : la tête ne doit plus être une simple boule
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.045, .1, 5), mtl(T.head));
  nose.position.set(0, 1.68, .27); nose.rotation.x = Math.PI / 2; g.add(nose);
  for (const sgn of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(.05, .13, 5), mtl(T.head));
    ear.position.set(sgn * .23, 1.7, .04); ear.rotation.z = -sgn * 1.2; g.add(ear);
  }

  /* ---------- membres : bras tendus vers l'avant ---------- */
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    // bras : pivot à l'épaule, segment haut + avant-bras
    const sh = new THREE.Group();
    sh.position.set(s * .34, 1.36, .04);
    const upper = new THREE.Mesh(geoms().arm, skin);
    upper.position.y = -.22; sh.add(upper);
    const fore = new THREE.Mesh(geoms().fore, fleshDark);
    fore.position.set(0, -.6, .16); fore.rotation.x = -.7; sh.add(fore);
    // main : doigts écartés
    const hand = new THREE.Mesh(geoms().hand, fleshDark);
    hand.position.set(0, -.72, .34); sh.add(hand);
    g.add(sh); arms.push(sh);
    // jambe : cuisse + tibia
    const hip = new THREE.Group();
    hip.position.set(s * .15, .6, 0);
    const thigh = new THREE.Mesh(geoms().thigh, fleshDark);
    thigh.position.y = -.2; hip.add(thigh);
    const shin = new THREE.Mesh(geoms().shin, skin);
    shin.position.set(0, -.5, .04); shin.rotation.x = .16; hip.add(shin);
    g.add(hip); legs.push(hip);
  }

  /* ---------- vêtements en lambeaux ---------- */
  const clothCol = new THREE.Color(T.col).multiplyScalar(.5).offsetHSL(.02, -.15, .04);
  const cloth = new THREE.MeshStandardMaterial({ color: clothCol, roughness: 1, emissive: clothCol, emissiveIntensity: .1 });
  // chemise déchirée autour du torse
  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(.315, .28, .52, 12), new THREE.MeshStandardMaterial({
    color: clothCol, roughness: .98, emissive: clothCol, emissiveIntensity: .12,
  }));
  shirt.position.y = 1.1; shirt.scale.set(1, 1, .82); shirt.rotation.z = .05; g.add(shirt);
  // col relevé
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.19, .24, .14, 10), new THREE.MeshStandardMaterial({
    color: clothCol.getHex(), roughness: .98, emissive: clothCol, emissiveIntensity: .12,
  }));
  collar.position.y = 1.44; g.add(collar);
  // pans qui pendent
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + .3;
    const w = .13 + Math.random() * .1, h = .26 + Math.random() * .42;
    const rag = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloth);
    rag.position.set(Math.cos(a) * .3, .95 - Math.random() * .25, Math.sin(a) * .24);
    rag.rotation.set(rndSym(.3), a, rndSym(.35));
    g.add(rag);
  }
  // ceinture / lambeau de pantalon
  const belt = new THREE.Mesh(new THREE.BoxGeometry(.52, .1, .4), new THREE.MeshStandardMaterial({ color: clothCol.getHex(), roughness: 1 }));
  belt.position.y = .68; g.add(belt);

  /* ---------- veines du virus ---------- */
  const veinMat = new THREE.MeshBasicMaterial({ color: T.eye, transparent: true, opacity: .8, toneMapped: false });
  for (let i = 0; i < 5; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(.022, .14 + Math.random() * .26, .022), veinMat);
    v.position.set(rndSym(.26), 1 + Math.random() * .6, .2 - Math.random() * .1);
    v.rotation.set(rndSym(.5), Math.random() * TAU, rndSym(.5));
    g.add(v);
  }
  // fissures émissives sur le torse (plus lisibles qu'avant)
  for (let i = 0; i < 3; i++) {
    const cr = new THREE.Mesh(new THREE.BoxGeometry(.16, .022, .022), veinMat);
    cr.position.set(rndSym(.2), 1.1 + Math.random() * .3, .24);
    cr.rotation.set(rndSym(.4), 0, rndSym(.9));
    g.add(cr);
  }
  // halo oculaire
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: T.eye, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
  eyeGlow.position.set(0, 1.72, .26); eyeGlow.scale.setScalar(.72);
  g.add(eyeGlow); g.userData.eyeGlow = eyeGlow;

  /* ---------- spécificités ---------- */
  if (T.boss) {
    // Colosse : massif, cornes, blindage, poings lourds
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(.1, .4, 6), new THREE.MeshStandardMaterial({ color: 0xcbbb96, roughness: .85 }));
      horn.position.set(s * .17, 1.95, .04); horn.rotation.set(.3, 0, -s * .45); g.add(horn);
      const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(.17, 0), mtl(T.head));
      fist.position.set(0, -.78, .38); arms[arms.length - 1].add(fist);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.62, .5, .14), new THREE.MeshStandardMaterial({ color: 0x6a6a78, roughness: .5, metalness: .6, emissive: 0x221133, emissiveIntensity: 1 }));
    plate.position.set(0, 1.24, .24); g.add(plate);
    for (let i = 0; i < 4; i++) {
      const st = new THREE.Mesh(new THREE.ConeGeometry(.05, .16, 4), new THREE.MeshStandardMaterial({ color: 0x8a8f9a, metalness: .8, roughness: .3 }));
      st.position.set(-.2 + i * .13, 1.02, .28); st.rotation.x = Math.PI; g.add(st);
    }
  }
  if (T.ranged) {
    // Cracheur : sac acide gonflé dans le dos + buboes
    const sac = new THREE.Group();
    const bladder = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2f8f58, emissive: 0x1f8f52, emissiveIntensity: 1, transparent: true, opacity: .85, roughness: .4 }));
    bladder.scale.set(1, 1.25, .8); sac.add(bladder);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(.07 + Math.random() * .05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x5dff9a, toneMapped: false }));
      b.position.set(rndSym(.18), (i - 1) * .14, -.16); sac.add(b);
    }
    sac.position.set(0, 1.2, -.32); g.add(sac); g.userData.sac = bladder;
  }
  if (T.sprint) {
    // Coureur : plus maigre, tendons marqués
    torso.scale.set(.9, 1.04, .7);
    head.scale.set(.86, .94, 1);
  }
  if (T.low) {
    // Rampant : posture au sol, membres repliés
    g.rotation.x = -.32; g.position.y = -.18;
    g.scale.set(1.05, .82, 1.15);
  }

  g.scale.setScalar(T.sc);
  return { m: g, arms, legs, head, jaw };
}

export function spawnEnemy(type, x, z, opts = {}) {
  const T = TYPES[type] || TYPES.walker;
  const g = buildModel(type);
  const spot = freeSpot(x, z, .6);
  g.m.position.set(spot.x, 0, spot.z);
  scene.add(g.m);
  const hp = T.hp * (1 + (G.day - 1) * .1) * (opts.hpMul || 1) * (1 + (opts.night ? .12 : 0));
  const e = {
    type, m: g.m, arms: g.arms, legs: g.legs, head: g.head, jaw: g.jaw, sac: g.sac, eyeGlow: g.m.userData.eyeGlow,
    hp, maxhp: hp, spd: T.speed * rand(.9, 1.12), dmg: T.dmg * (1 + (G.day - 1) * .06),
    atk: rand(0, 1), phase: rand(0, TAU), hit: 0, die: 0, target: null, wander: rand(0, TAU),
    aggro: false, loseT: 0, stuck: 0, lastX: spot.x, lastZ: spot.z, lunge: 0, slow: rand(.6, 1.5),
    elite: opts.elite || false,
  };
  if (e.elite) { e.hp *= 1.9; e.maxhp = e.hp; e.dmg *= 1.25; mtl(T.col); }
  E.push(e);
  return e;
}

/* ---------------- dégâts ---------------- */
export function hitEnemy(e, dmg, opts = {}) {
  if (!e || e.die > 0) return 0;
  let d = dmg;
  const crit = opts.crit;
  if (crit) d *= 2;
  e.hp -= d;
  e.hit = .12;
  G.dmgDealt += d;
  G.shotsHit++;
  // reveal
  e.aggro = true; e.loseT = 6;
  e.target = opts.from || targetOf(e);
  const hpPos = e.m.position.clone().add(V3(0, 1.6 * (TYPES[e.type].sc), 0));
  FX.dmgNumber(hpPos, d, crit ? 'crit' : (opts.melee ? 'hit' : 'hit'));
  if (crit) SFX.crit();
  // physique de recul
  if (opts.dir) e.m.position.addScaledVector(opts.dir, e.type === 'brute' ? .05 : .28);
  if (e.hp <= 0) { killEnemy(e, opts); return d; }
  return d;
}
function targetOf(e) { return { x: G.px, z: G.pz }; }

export function killEnemy(e, opts = {}) {
  if (e.die > 0) return;
  e.die = .001;
  const T = TYPES[e.type];
  G.kills++; G.killsBy[e.type] = (G.killsBy[e.type] || 0) + 1;
  if (opts.headshot) { G.headshots++; G.yen += 6; }
  const levels = addXp(Math.round(T.xp * (e.elite ? 1.6 : 1)));
  // --- monnaie : c'est la récompense principale des éliminations
  G.yen += Math.round((8 + T.gib * 5 + (e.type === 'brute' ? 40 : e.type === 'runner' ? 6 : 0)) * (e.elite ? 2.2 : 1));
  // butin
  const luck = Math.random();
  let scrap = randi(2, 5) + (T.gib - 1) * 3;
  if (e.elite) scrap *= 2;
  G.scrap += scrap;
  if (luck < .16) { const a = pick(['pistol', 'rifle', 'shotgun', 'dmr']); G.ammo[a].r += Math.round((a === 'pistol' ? 12 : a === 'rifle' ? 20 : a === 'shotgun' ? 6 : 5) * (e.elite ? 2 : 1)); FX.particle(e.m.position.clone().add(V3(0, 1, 0)), 0x5dff8f, { size: .5, life: .6 }); }
  else if (luck < .24 && G.grenades < 3) { G.grenades++; }
  else if (luck < .3) { G.meds = Math.min(5, G.meds + 1); }
  // gibs
  FX.burst(e.m.position.clone().add(V3(0, 1 * T.sc, 0)), T.eye, 8 * T.gib, { size: .22, life: .7 });
  SFX.zDie();
  UI.kill(e.type, opts.headshot);
  if (UI.drop) UI.drop(e);
  if (levels > 0) UI.levelUp(G.lvl);
}

export function explosionDamage(pos, radius, dmg) {
  const r2 = radius * radius;
  for (let i = E.length - 1; i >= 0; i--) {
    const e = E[i];
    if (e.die > 0) continue;
    const d = e.m.position.distanceTo(pos);
    if (d < radius) {
      const f = 1 - d / radius;
      hitEnemy(e, dmg * f, { dir: e.m.position.clone().sub(pos).normalize(), crit: Math.random() < .15 });
    }
  }
  FX.shake(.9, .5);
}

/* ---------------- IA + animation ---------------- */
const tmp = V3();
export function updateEnemies(dt, playerObj) {
  const px = G.inVeh ? G.inVeh.m.position.x : G.px;
  const pz = G.inVeh ? G.inVeh.m.position.z : G.pz;
  const night = isNightTime();
  const budget = S_BUDGET;
  for (let i = E.length - 1; i >= 0; i--) {
    const e = E[i];
    const T = TYPES[e.type];
    // --- mort : animation + fonte
    if (e.die > 0) {
      e.die += dt;
      const k = clamp(e.die / (e.type === 'brute' ? 1.6 : .9), 0, 1);
      e.m.rotation.x = lerp(e.m.rotation.x, T.low ? -1.4 : -1.5, dt * 7);
      e.m.position.y = -k * .55;
      for (const a of e.arms) a.rotation.x = lerp(a.rotation.x, -.4, dt * 5);
      for (const l of e.legs) l.rotation.x = lerp(l.rotation.x, .8, dt * 5);
      if (e.m.position.y < .1) {
        const sc = T.sc * (1 - k);
        e.m.scale.setScalar(Math.max(.01, sc));
      }
      if (k >= 1) { scene.remove(e.m); E.splice(i, 1); }
      continue;
    }
    e.hit = Math.max(0, e.hit - dt);
    // flash blanc quand touché
    const hitScale = e.hit > 0 ? 1.06 : 1;
    e.m.scale.setScalar(T.sc * hitScale);
    // --- zone franche : l'infecté n'y entre pas et perd la cible
    let inZone = null, zonePush = null;
    for (const z of SAFE_ZONES) {
      const dzc = Math.hypot(e.m.position.x - z.x, e.m.position.z - z.z);
      if (dzc < z.r) { inZone = z; break; }
      if (dzc < z.r + 5) zonePush = { z, dzc };
    }
    const playerZone = G.invuln ? null : inSafeZone(px, pz);
    if (inZone) {
      // il veut sortir : pousse vers le bord
      const a = Math.atan2(e.m.position.x - inZone.x, e.m.position.z - inZone.z);
      e.m.position.x += Math.sin(a) * e.spd * 1.2 * dt;
      e.m.position.z += Math.cos(a) * e.spd * 1.2 * dt;
      e.aggro = false; e.target = null;
      e.m.rotation.y = lerpAngle(e.m.rotation.y, a, dt * 5);
      for (let a2 = 0; a2 < e.arms.length; a2++) e.arms[a2].rotation.x = Math.sin(G.t * 6 + e.phase) * .5 - .4;
      for (let l = 0; l < e.legs.length; l++) e.legs[l].rotation.x = Math.sin(G.t * 8 + e.phase + l) * .5;
      continue;
    }
    // --- détection
    const dx0 = px - e.m.position.x, dz0 = pz - e.m.position.z;
    const dist = Math.hypot(dx0, dz0) || .001;
    let canSee = dist < T.aggro + (G.sprint ? 12 : 0) + (G.crouch > .5 ? -8 : 0);
    if (playerZone && dist > playerZone.r * 1.4) canSee = false; // ne poursuit pas jusqu'au camp
    if (zonePush && dist < zonePush.z.r + 8) canSee = false;
    if (canSee || e.aggro) { e.aggro = true; e.loseT = 6; e.target = { x: px, z: pz }; }
    else if (e.aggro) { e.loseT -= dt; if (e.loseT <= 0) { e.aggro = false; e.target = null; } }
    let tx, tz;
    if (e.aggro && e.target) { tx = e.target.x; tz = e.target.z; }
    else {
      // errance
      e.wander += rand(-.4, .4) * dt;
      tx = e.m.position.x + Math.cos(e.wander) * 4; tz = e.m.position.z + Math.sin(e.wander) * 4;
    }
    // évitement de file : décalage personnel
    const lane = Math.sin(G.t * .5 + e.phase) * .8;
    const ang = Math.atan2(tx - e.m.position.x, tz - e.m.position.z);
    const gx = e.m.position.x + Math.sin(ang) * Math.cos(lane) * 1.2;
    const gz = e.m.position.z + Math.cos(ang) * Math.cos(lane) * 1.2;
    let dx = gx - e.m.position.x, dz = gz - e.m.position.z;
    let d = Math.hypot(dx, dz);
    // --- obstacle bas : pieux / défenses dans le chemin
    let spd = e.spd * (e.aggro ? (night ? 1.15 : 1) : .55) * (e.slow > 0 ? 1 : 0);
    if (e.slow > 0) e.slow -= dt; else e.slow = 0;
    // si bloqué, contourne
    const before = tmp.set(e.m.position.x, 0, e.m.position.z);
    if (d > (T.ranged ? T.reach * .7 : 1.1) && spd > 0) {
      const step = spd * dt;
      const nx = e.m.position.x + (dx / d) * step, nz = e.m.position.z + (dz / d) * step;
      if (blocked(nx, nz, T.sc * .45)) {
        // glisse le long du mur
        const side = (e.phase > 3 ? 1 : -1);
        const px2 = e.m.position.x + Math.cos(ang) * step * side, pz2 = e.m.position.z - Math.sin(ang) * step * side;
        if (!blocked(px2, pz2, T.sc * .45)) { e.m.position.x = px2; e.m.position.z = pz2; }
        else { e.stuck += dt; e.wander += rand(-3, 3); }
      } else { e.m.position.x = nx; e.m.position.z = nz; }
      // désaccélération si bloqué longtemps
      if (e.stuck > .8) { e.stuck = 0; e.wander = Math.atan2(e.m.position.x - tx, e.m.position.z - tz) + rand(-1.5, 1.5); }
    }
    // --- attaque
    if (e.aggro && d < T.reach && !playerZone) {
      e.atk -= dt;
      e.lunge = Math.max(0, e.lunge - dt * 3);
      if (e.atk <= 0) {
        e.atk = T.atkCd * rand(.85, 1.2);
        if (T.ranged) { spitterAttack(e); }
        else { playerHit(e.dmg, e.m.position); e.lunge = 1; }
      }
    } else e.lunge = Math.max(0, e.lunge - dt * 2);
    // --- animation
    const moving = d > (T.ranged ? T.reach * .8 : 1.2);
    e.phase += dt * (moving ? (T.sprint ? 12 : 7) * T.sc : 1.5);
    const sw = Math.sin(e.phase), sw2 = Math.sin(e.phase * 2);
    // bras : balancier ample + extension quand il attaque
    for (let a = 0; a < e.arms.length; a++) {
      const sgn = a === 0 ? 1 : -1;
      const reach = e.aggro && d < T.reach ? 1 : 0;
      e.arms[a].rotation.x = (moving ? sw * .55 * sgn - .75 : -.55 + sw * .08)
        - reach * .9 * e.lunge - (T.ranged ? .5 : 0);
      e.arms[a].rotation.z = sgn * (.14 + (T.ranged ? .35 : 0) + (moving ? Math.abs(sw) * .08 : 0));
    }
    // jambes : marche alternée (hanches)
    for (let l = 0; l < e.legs.length; l++) {
      const sgn = l === 0 ? 1 : -1;
      e.legs[l].rotation.x = moving ? sw2 * .62 * sgn : 0;
      e.legs[l].rotation.z = 0;
    }
    // tête : ballant, mâchoire
    e.head.rotation.y = Math.sin(e.phase * .5) * .2;
    e.head.rotation.z = Math.sin(e.phase) * .07;
    e.head.rotation.x = .28 + (e.aggro ? .18 : 0) + (T.low ? .35 : 0);
    // mâchoire : s'ouvre quand il chasse
    e.jaw.position.y = 1.5 - (e.aggro ? .04 : 0) - Math.abs(Math.sin(e.phase * 1.2)) * .045;
    e.m.position.y = Math.abs(Math.sin(e.phase * 2)) * (T.low ? .015 : .045);
    if (!T.low) e.m.rotation.x = lerp(e.m.rotation.x, moving ? .1 : .02, dt * 4);
    // orientation
    if (e.aggro || moving) e.m.rotation.y = lerpAngle(e.m.rotation.y, ang, dt * 6);
    // grognements
    e.grrow = (e.grrow || rand(3, 12)) - dt;
    if (e.grrow <= 0) { e.grrow = rand(6, 20); if (dist < 34) SFX.zGrowl(dist); if (e.type === 'runner' && dist < 22) SFX.zShriek(); }
    if (e.sac) e.sac.scale.set(1 + Math.sin(G.t * 3 + e.phase) * .1, 1.25 + Math.sin(G.t * 3 + e.phase) * .14, .8);
    if (e.eyeGlow) e.eyeGlow.material.opacity = .4 + Math.abs(Math.sin(G.t * 2 + e.phase)) * .45;
  }
  // population de fond
  const want = budget.want;
  if (E.length < want) {
    spawnAcc += dt * budget.rate;
    if (spawnAcc > 1) { spawnAcc = 0; spawnOne(playerObj, false); }
  }
}
let spawnAcc = 0;
let S_BUDGET = { want: 8, rate: .4 };
export function setBudget(want, rate) { S_BUDGET = { want, rate }; }
function isNightTime() { return G.phase < .22 || G.phase > .82; }
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

export function spawnOne(playerObj, elite = false) {
  const p = { x: G.px, z: G.pz };
  let sp = spawnPoint(p);
  // jamais dans une zone franche
  let guard = 0;
  while (inSafeZone(sp.x, sp.z, 4) && guard++ < 8) sp = spawnPoint(p);
  const pool = nightPool();
  const type = elite ? (Math.random() < .5 ? 'brute' : 'spitter') : pickWeighted(pool);
  return spawnEnemy(type, sp.x, sp.z, { elite, night: isNightTime() });
}
function pickWeighted(pool) {
  const total = pool.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.k; }
  return 'walker';
}
function nightPool() {
  const d = G.day;
  return [
    { k: 'walker', w: Math.max(6, 30 - d * 2) },
    { k: 'runner', w: Math.min(26, 8 + d * 3) },
    { k: 'crawler', w: Math.min(18, 5 + d * 1.6) },
    { k: 'spitter', w: d > 2 ? Math.min(12, (d - 2) * 2.5) : 0 },
    { k: 'brute', w: d > 3 ? Math.min(7, (d - 3) * 1.2) : 0 },
  ].filter(p => p.w > 0);
}

/* ---------------- projectiles de cracheur ---------------- */
const acids = [];
function spitterAttack(e) {
  if (!scene) return;
  const from = e.m.position.clone().add(V3(0, 1.3 * TYPES[e.type].sc, 0));
  const to = V3(G.px, G.py + 1.2, G.pz);
  const d = from.distanceTo(to);
  const m = new THREE.Mesh(geoms().acid, new THREE.MeshBasicMaterial({ color: 0x5dff9a, toneMapped: false }));
  m.position.copy(from); m.scale.setScalar(1.1);
  scene.add(m);
  const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0x3dff9a, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.scale.setScalar(1.1); m.add(g);
  acids.push({ m, v: to.sub(from).normalize().multiplyScalar(d / .55), life: 3 });
  SFX.spit();
  FX.particle(from, 0x5dff9a, { size: .4, life: .3 });
}
export function updateAcids(dt) {
  for (let i = acids.length - 1; i >= 0; i--) {
    const a = acids[i];
    a.v.y -= 6 * dt;
    a.m.position.addScaledVector(a.v, dt);
    a.life -= dt;
    const p = a.m.position;
    const d = Math.hypot(p.x - G.px, p.z - G.pz);
    if (d < 1.2 && Math.abs(p.y - (G.py + 1.1)) < 1.6) {
      playerHit(TYPES.spitter.dmg * (1 + (G.day - 1) * .05), p);
      // graine de crachat : s'évapore au contact d'une zone franche
      acids.splice(i, 1); scene.remove(a.m); continue;
    }
    if (p.y < .12 || a.life <= 0) {
      FX.burst(p.clone(), 0x5dff9a, 8, { size: .2, life: .5 });
      FX.particle(p.clone(), 0x3dff9a, { size: .9, life: .4 });
      acids.splice(i, 1); scene.remove(a.m); continue;
    }
    if (Math.random() < .3) FX.particle(p.clone(), 0x3dff9a, { size: .18, life: .3, add: true, g: -.4 });
  }
}
export const acidCount = () => acids.length;

/* ---------------- dégâts au joueur ---------------- */
let onPlayerHit = null;
export function setPlayerHitHandler(fn) { onPlayerHit = fn; }
function playerHit(dmg, fromPos) {
  if (G.invuln) return;                       // mode entraînement
  if (inSafeZone(G.px, G.pz, -0.5)) return;   // zone franche : explicitly immunisé
  if (onPlayerHit) onPlayerHit(dmg, fromPos);
}

/* ---------------- utils ---------------- */
export function nearestEnemy(pos, maxD = 3) {
  let best = null, bd = maxD;
  for (const e of E) { if (e.die > 0) continue; const d = e.m.position.distanceTo(pos); if (d < bd) { bd = d; best = e; } }
  return best;
}
export function enemiesInRadius(pos, r) {
  return E.filter(e => e.die <= 0 && e.m.position.distanceTo(pos) < r);
}
export function livingCount() { let n = 0; for (const e of E) if (e.die <= 0) n++; return n; }
export function clearEnemies() { for (const e of E) scene.remove(e.m); E.length = 0; acids.forEach(a => scene.remove(a.m)); acids.length = 0; }
export function alive() { return E.filter(e => e.die <= 0); }

/* hook UI (injecté par hud.js pour éviter une dépendance circulaire) */
export const UI = {
  kill: () => { },
  levelUp: () => { },
};
export function setUI(hooks) { Object.assign(UI, hooks); }

/* pour le mini-map */
export const enemyList = () => E;
export { lerp };