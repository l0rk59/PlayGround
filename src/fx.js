// ============================================================================
//  fx.js — effets : traçantes, particules, impacts, explosions, dégâts flottants
// ============================================================================
import * as THREE from 'three';
import { V3, clamp, rand } from './state.js';
import { halo, decal } from './textures.js';

const sceneRef = { s: null, camera: null };
export function initFx(scene, camera) { sceneRef.s = scene; sceneRef.camera = camera; }

/* ---------------- traçantes de balle ---------------- */
const tracers = [];
const tMat = new THREE.LineBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
export function tracer(a, b, color = 0xfff2b0, life = .055) {
  if (!sceneRef.s || !a || !b) return;
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const m = tMat.clone(); m.color.setHex(color);
  const l = new THREE.Line(g, m);
  sceneRef.s.add(l); tracers.push({ l, t: life, life });
}
export function beam(a, b, color = 0x00e8ff, life = .12, wide = .03) {
  if (!sceneRef.s || !a || !b) return;
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(wide, wide, len, 6, 1, true);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(a).lerp(b, .5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  sceneRef.s.add(mesh); tracers.push({ l: mesh, t: life, life });
}

/* ---------------- particules (pool partagé) ---------------- */
const pGeo = new THREE.PlaneGeometry(1, 1);
const pMatCache = new Map();
function pMat(color, additive) {
  const k = color + (additive ? 'a' : 'n');
  if (!pMatCache.has(k)) pMatCache.set(k, new THREE.MeshBasicMaterial({
    map: halo(), color, transparent: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide }));
  return pMatCache.get(k);
}
const parts = [];
export function particle(pos, color, opts = {}) {
  if (!sceneRef.s) return null;
  const m = new THREE.Mesh(pGeo, pMat(color, opts.add !== false));
  m.position.copy(pos);
  const s = opts.size || .3; m.scale.setScalar(s);
  m.rotation.z = Math.random() * 6.28;
  sceneRef.s.add(m);
  parts.push({
    m, v: (opts.vel ? opts.vel.clone() : V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(rand(.6, 2.2))).clone(),
    t: opts.life || .5, life: opts.life || .5, s, g: opts.g === undefined ? -3.2 : opts.g, add: opts.add !== false, fade: opts.fade || .8,
  });
  return m;
}
export function burst(pos, color, n = 10, opts = {}) {
  for (let i = 0; i < n; i++) particle(pos, color, { size: (opts.size || .25) * rand(.6, 1.4), life: (opts.life || .5) * rand(.7, 1.3), vel: opts.vel, g: opts.g });
}
export function bloodHit(pos, dir) {
  for (let i = 0; i < 9; i++) {
    const v = dir.clone().multiplyScalar(rand(1, 5)).add(V3(rand(-1.6, 1.6), rand(.4, 3), rand(-1.6, 1.6)));
    particle(pos, i % 3 ? 0x8e1428 : 0xc41f3a, { size: rand(.1, .3), life: rand(.3, .6), vel: v, g: -7 });
  }
}
export function sparkHit(pos, normal) {
  for (let i = 0; i < 7; i++) {
    const v = normal.clone().multiplyScalar(rand(1, 4)).add(V3(rand(-2, 2), rand(-1, 2), rand(-2, 2)));
    particle(pos, 0xffd27a, { size: rand(.06, .16), life: rand(.15, .35), vel: v, g: -9 });
  }
}
export function muzzle(pos, dir, scale = 1) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: 0xffd08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos); m.scale.setScalar(.9 * scale);
  sceneRef.s.add(m);
  parts.push({ m, t: .06, life: .06, s: .9 * scale, spark: true, add: true });
  for (let i = 0; i < 4; i++) particle(pos, 0xffb347, { size: .12 * scale, life: rand(.1, .25), vel: dir.clone().multiplyScalar(rand(3, 9)), g: 0, add: true });
  return m;
}
export function explosion(pos, radius = 6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: 0xffa63d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.copy(pos); s.scale.setScalar(radius * .7); sceneRef.s.add(s);
  parts.push({ m: s, t: .32, life: .32, s: radius * .7, grow: radius * 1.7, spark: true, add: true });
  for (let i = 0; i < 26; i++) {
    const d = V3(rand(-1, 1), rand(-.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, radius * 2.4));
    particle(pos, i % 4 ? 0xff8c2d : 0xffe27a, { size: rand(.2, .7), life: rand(.3, .8), vel: d, g: -6, add: true });
  }
  for (let i = 0; i < 14; i++) particle(pos, 0x3a3a44, { size: rand(.5, 1.5), life: rand(.7, 1.4), vel: V3(rand(-1, 1), rand(.2, 1.4), rand(-1, 1)).multiplyScalar(rand(1, 3)), g: -.6, add: false });
}
export function shell(pos, dir) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, .11), new THREE.MeshBasicMaterial({ color: 0xd9b45a, transparent: true, opacity: .95 }));
  m.position.copy(pos); m.castShadow = false; sceneRef.s.add(m);
  parts.push({ m, t: 1.6, life: 1.6, s: 1, ground: .02, vel: dir.clone().multiplyScalar(rand(1.5, 3)).add(V3(0, 1.4, 0)), spin: V3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), add: false });
}
export function decalHit(pos, normal) {
  if (!sceneRef.s || !pos || !normal) return;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .28), new THREE.MeshBasicMaterial({ map: decal(), transparent: true, depthWrite: false, opacity: .9 }));
  m.position.copy(pos).addScaledVector(normal, .02);
  m.lookAt(pos.clone().add(normal));
  sceneRef.s.add(m);
  decals.push({ m, t: 14, life: 14 });
  if (decals.length > 60) { const d = decals.shift(); sceneRef.s.remove(d.m); }
}
const decals = [];

/* ---------------- dégâts flottants ---------------- */
const dnLayer = () => document.getElementById('dmgNums');
export function dmgNumber(worldPos, amount, kind = 'hit') {
  const cam = sceneRef.camera; if (!cam) return;
  const el = document.createElement('div');
  el.className = 'dn';
  const col = kind === 'crit' ? '#ffe14d' : kind === 'heal' ? '#5dff8f' : kind === 'armor' ? '#9d6bff' : '#fff';
  el.style.color = col;
  el.style.fontSize = kind === 'crit' ? '20px' : kind === 'hit' ? '15px' : '13px';
  el.textContent = (kind === 'heal' ? '+' : '') + Math.round(amount);
  dnLayer().appendChild(el);
  const p = worldPos.clone().project(cam);
  if (p.z > 1) { el.remove(); return; }
  const x = (p.x * .5 + .5) * innerWidth, y = (-p.y * .5 + .5) * innerHeight;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  setTimeout(() => el.remove(), 900);
}
/** indicateur directionnel de dégâts reçus */
export function dmgDir(angleRad) {
  const wrap = document.getElementById('dirInd');
  const d = document.createElement('div');
  d.className = 'dirI';
  d.style.transform = `rotate(${angleRad}rad)`;
  d.innerHTML = '<i></i>';
  wrap.appendChild(d);
  setTimeout(() => { d.style.transition = 'opacity .5s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 520); }, 420);
}

/* ---------------- update ---------------- */
export function updateFx(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.t -= dt;
    const k = clamp(t.t / t.life, 0, 1);
    t.l.material.opacity = k;
    if (t.t <= 0) { sceneRef.s.remove(t.l); t.l.material.dispose?.(); tracers.splice(i, 1); }
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t -= dt;
    const k = clamp(p.t / p.life, 0, 1);
    if (p.spark) {
      if (!p.m.material) { sceneRef.s.remove(p.m); parts.splice(i, 1); continue; }
      if (p.grow) p.m.scale.setScalar(p.s + (1 - k) * p.grow);
      p.m.material.opacity = k;
    } else {
      if (!p.v) { p.v = V3(); }
      if (!p.m.material) { p.m.material = pMat(0xffffff, true); }
      p.v.y += p.g * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.ground !== undefined && p.m.position.y < p.ground) { p.m.position.y = p.ground; p.v.multiplyScalar(.4); p.v.y = Math.abs(p.v.y) * .35; }
      if (p.spin) { p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; p.m.rotation.z += p.spin.z * dt; }
      p.m.scale.setScalar(p.s * (0.4 + k * .6));
      p.m.material.opacity = k * p.fade;
      if (p.m.material) p.m.material.transparent = true;
    }
    if (p.t <= 0) {
      sceneRef.s.remove(p.m);
      if (p.spark) p.m.material.dispose?.();
      else { /* matériau mutualisé : ne pas dispose */ }
      parts.splice(i, 1);
    }
  }
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i]; d.t -= dt;
    if (d.t < 3) d.m.material.opacity = clamp(d.t / 3, 0, .9);
    if (d.t <= 0) { sceneRef.s.remove(d.m); decals.splice(i, 1); }
  }
}

/** impact visuel quand le joueur est touché */
export function hurtPulse(a = .8) {
  const e = document.getElementById('hurtFlash');
  if (!e) return;
  e.style.opacity = a;
  setTimeout(() => e.style.opacity = 0, 220);
}

/** secousse de caméra */
let shakeAmt = 0, shakeT = 0;
export function shake(a, t = .25) { shakeAmt = Math.max(shakeAmt, a); shakeT = Math.max(shakeT, t); }
export function shakeOffset(out) {
  if (shakeT > 0) {
    shakeT -= out._dt || .016;
    const k = shakeAmt * clamp(shakeT * 3, 0, 1);
    out.x = rand(-k, k); out.y = rand(-k, k); out.r = rand(-k, k) * .3;
    if (shakeT <= 0) shakeAmt = 0;
  } else { out.x = out.y = out.r = 0; }
  return out;
}
export function clearFx() {
  tracers.forEach(t => sceneRef.s.remove(t.l)); tracers.length = 0;
  parts.forEach(p => sceneRef.s.remove(p.m)); parts.length = 0;
  decals.forEach(d => sceneRef.s.remove(d.m)); decals.length = 0;
}
