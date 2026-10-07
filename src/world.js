// ============================================================================
//  world.js — génération du monde : ciel, ville en ruines, forêt, POI, météo
// ============================================================================
import * as THREE from 'three';
import { G, WORLD, makeRng, clamp, lerp, TAU, V3, isNight, rand, randi } from './state.js';
import { asphalt, concrete, metal, ground, facade, neonSign, halo } from './textures.js';
import { S } from './state.js';

/** Zones de sûreté : aucune infestation à l'intérieur, aucun dégât subi. */
export const SAFE_ZONES = [
  { name: 'BASE NÉON', x: 42, z: -46, r: 23, color: 0x5dff8f },
  { name: 'ENCLAVE 7', x: -92, z: 40, r: 17, color: 0x00e8ff },
  { name: 'GANG ROUILLE', x: 96, z: 86, r: 17, color: 0xff5a2d },
  { name: 'MARCHÉ NOIR', x: -38, z: -72, r: 14, color: 0xff2d78 },
  { name: 'HÔPITAL KIRIN', x: -52, z: -22, r: 13, color: 0x00e8ff },
  { name: 'LABORATOIRE', x: 120, z: -100, r: 12, color: 0x5dff8f },
];

export const W = {
  scene: null, root: null, colliders: [], solids: [],
  safeMeshes: [],
  CAMP: V3(42, 0, -46), MARKET: V3(-38, 0, -72), ENCLAVE: V3(-92, 0, 40), ROUILLE: V3(96, 0, 86),
  POI: [], enemiesSpawn: [], lights: [], neonSprites: [], lamps: [],
  campfire: null, generator: null, helipad: null,
  blocks: [],
};

const rng = makeRng(20871);
const r = (a, b) => a + rng() * (b - a);
const ri = (a, b) => Math.floor(r(a, b + 1));
export const rr = r, rri = ri;

/* ---------------- helpers ---------------- */
export function addCollider(x, z, hx, hz, top = 6, kind = 'wall') {
  W.colliders.push({ x, z, hx, hz, top, kind });
}
/** résolution collisions cercle vs AABB (2.5D, sol plat + hauteur) */
const SOFT = { pole: 1, crate: 1, trash: 1, barrier: 1, car: 1, tent: 1, bar: 1 };
/** collision douce : ignore les petits objets (le véhicule les écrase) */
export function collide(pos, radius, feetY = 0, opts = {}) {
  const soft = opts.soft;
  for (let i = 0; i < W.colliders.length; i++) {
    const c = W.colliders[i];
    if (feetY > c.top) continue;
    if (soft && SOFT[c.kind]) continue;
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const ox = c.hx + radius - Math.abs(dx), oz = c.hz + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) pos.x = c.x + Math.sign(dx || 1) * (c.hx + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hz + radius);
    }
  }
  const d = Math.hypot(pos.x, pos.z);
  if (d > WORLD.R) { pos.x *= WORLD.R / d; pos.z *= WORLD.R / d; }
}
export function blocked(x, z, rad = 1.2) {
  for (const c of W.colliders) if (Math.abs(x - c.x) < c.hx + rad && Math.abs(z - c.z) < c.hz + rad) return true;
  return false;
}
export function freeSpot(x, z, rad = 1.6) {
  if (!blocked(x, z, rad) && Math.hypot(x, z) < WORLD.R - 8) return { x, z };
  for (let rad2 = 4; rad2 < 60; rad2 += 4) for (let a = 0; a < 16; a++) {
    const nx = x + Math.cos(a / 16 * TAU) * rad2, nz = z + Math.sin(a / 16 * TAU) * rad2;
    if (!blocked(nx, nz, rad) && Math.hypot(nx, nz) < WORLD.R - 8) return { x: nx, z: nz };
  }
  return { x, z };
}
/** hauteur du sol (0 sauf zones surélevées) */
export const groundY = () => 0;

/** true si (x,z) est dans une zone de sûreté */
export function inSafeZone(x, z, margin = 0) {
  for (const s of SAFE_ZONES) {
    if (Math.hypot(x - s.x, z - s.z) < s.r + margin) return s;
  }
  return null;
}
/** la zone de sûreté la plus proche (pour le HUD) */
export function nearestSafeZone(x, z) {
  let best = null, bd = 1e9;
  for (const s of SAFE_ZONES) { const d = Math.hypot(x - s.x, z - s.z); if (d < bd) { bd = d; best = s; } }
  return best;
}

function pointLight(color, x, y, z, dist = 44, intensity = 1) {
  const l = new THREE.PointLight(color, 0, dist, 1.7);
  l.position.set(x, y, z);
  l.userData.base = intensity;
  W.scene.add(l); W.lights.push(l);
  return l;
}
function neonGlow(color, x, y, z, size = 3, op = .75) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.set(x, y, z); s.scale.setScalar(size);
  W.scene.add(s); W.neonSprites.push(s);
  return s;
}

/* ---------------- ciel ---------------- */
function buildSky() {
  const geo = new THREE.SphereGeometry(430, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: {
      topColor: { value: new THREE.Color(0x05051a) },
      midColor: { value: new THREE.Color(0x140a2e) },
      botColor: { value: new THREE.Color(0x2a1030) },
      sunDir: { value: new THREE.Vector3(0, .3, -1) },
      sunColor: { value: new THREE.Color(0xff7a3d) },
      night: { value: 0 }, time: { value: 0 },
    },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vD; uniform vec3 topColor, midColor, botColor, sunColor, sunDir; uniform float night, time;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
      void main(){
        float h = clamp(vD.y*.5+.5, 0.0, 1.0);
        vec3 c = mix(botColor, midColor, smoothstep(0.0,0.42,h));
        c = mix(c, topColor, smoothstep(0.42,1.0,h));
        float sd = max(dot(normalize(vD), normalize(sunDir)), 0.0);
        c += sunColor * pow(sd, 8.0) * (0.55 - night * 0.4) * 0.55;
        c += sunColor * pow(sd, 90.0) * (1.0 - night) * 1.1;
        // étoiles la nuit
        float st = step(0.9992, h21(floor(vD.xz*260.0 + vD.y*90.0)));
        c += vec3(0.85,0.9,1.0) * st * night * smoothstep(0.05,0.5,h) * 2.0;
        // scintillement
        c += vec3(0.5,0.7,1.0) * st * night * (0.5+0.5*sin(time*3.0+hash(vD.xz))) * 0.6;
        // nuages bas
        float cl = 0.0;
        for(int i=0;i<3;i++){
          float fi = float(i);
          vec2 q = vD.xz/(max(vD.y,0.08)+0.35) * (1.2+fi*0.9) + time*(0.006+fi*0.004);
          cl += (sin(q.x*1.7+sin(q.y*1.3+time*0.05)) * sin(q.y*1.9+sin(q.x*1.1)) ) * (0.055/(1.0+fi));
        }
        c -= vec3(cl) * (1.0 - night*0.55);
        // haze néon bas
        c += vec3(0.09,0.028,0.13) * pow(1.0-h, 7.0) * 0.55;
        gl_FragColor = vec4(c, 1.0);
      }`.replace('hash(vD.xz)', 'fract(sin(dot(vD.xz,vec2(12.9,78.2)))*43758.5)'),
  });
  W.skyMat = mat;
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  W.scene.add(sky);
  W.sky = sky;
}

/* ---------------- routes & sol ---------------- */
function buildGround() {
  const gTex = ground(); gTex.repeat.set(38, 38);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), new THREE.MeshLambertMaterial({ map: gTex, color: 0x9aa0a8 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = S.shadow;
  W.scene.add(floor); W.solids.push(floor);

  const aTex = asphalt(); aTex.repeat.set(1, 26);
  const roadMat = new THREE.MeshLambertMaterial({ map: aTex, color: 0xd8d8e2 });
  const ringTex = asphalt(); ringTex.repeat.set(26, 1);
  const roadMat2 = new THREE.MeshLambertMaterial({ map: ringTex, color: 0xd8d8e2 });

  const roads = [
    { x: 0, z: 0, w: 22, l: WORLD.R * 2, m: roadMat },
    { x: 0, z: 0, w: WORLD.R * 2, l: 22, m: roadMat2, rot: true },
    { x: -105, z: 30, w: 14, l: 300, m: roadMat, rot: false, ox: 0, oz: 40 },
    { x: 100, z: 40, w: 14, l: 280, m: roadMat, rot: false },
  ];
  for (const rd of roads) {
    const g = new THREE.PlaneGeometry(rd.rot ? rd.l : rd.w, rd.rot ? rd.w : rd.l);
    const m = new THREE.Mesh(g, rd.m);
    m.rotation.x = -Math.PI / 2; m.position.set(rd.x, .03, rd.z); m.receiveShadow = S.shadow;
    W.scene.add(m); W.solids.push(m);
  }
  // lignes centrales lumineuses
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: .55 });
  for (let i = -190; i <= 190; i += 11) {
    for (const along of [true, false]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(along ? .35 : 3.2, along ? 3.2 : .35), lineMat);
      s.rotation.x = -Math.PI / 2; s.position.set(along ? 0 : i, .05, along ? i : 0); W.scene.add(s);
    }
  }
  // chaussée与企业 parking au camp
  const padTex = concrete('#2b2f38'); padTex.repeat.set(3, 3);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(17, 28), new THREE.MeshLambertMaterial({ map: padTex, color: 0xc0c6d0 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(W.CAMP.x, .04, W.CAMP.z); pad.receiveShadow = S.shadow;
  W.scene.add(pad);
}

/* ---------------- zones de sûreté (visuel) ---------------- */
function buildSafeZoneVisual(z) {
  const g = new THREE.Group();
  // sol tinté
  const disc = new THREE.Mesh(new THREE.CircleGeometry(z.r, 44), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: .022, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(z.x, .06, z.z); g.add(disc);
  // anneau
  const ring = new THREE.Mesh(new THREE.TorusGeometry(z.r, .1, 5, 52), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: .34, toneMapped: false }));
  ring.rotation.x = Math.PI / 2; ring.position.set(z.x, .28, z.z); g.add(ring);
  // seconde anneau extérieure
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(z.r + .8, .05, 5, 52), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: .18, toneMapped: false }));
  ring2.rotation.x = Math.PI / 2; ring2.position.set(z.x, .2, z.z); g.add(ring2);
  // dôme très discret
  const dome = new THREE.Mesh(new THREE.SphereGeometry(z.r, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: .016, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  dome.position.set(z.x, 0, z.z); g.add(dome);
  // balises aux 4 points cardinaux
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, 3.4, 6), new THREE.MeshStandardMaterial({ color: 0x2a3038, emissive: z.color, emissiveIntensity: .18, roughness: .8, metalness: .3 }));
    p.position.set(z.x + Math.cos(a) * z.r, 1.7, z.z + Math.sin(a) * z.r); g.add(p);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshBasicMaterial({ color: z.color, toneMapped: false }));
    tip.position.set(p.position.x, 3.5, p.position.z); g.add(tip);
    const spr = neonGlow(z.color, p.position.x, 3.5, p.position.z, 2.2, .32);
    W.lamps.push({ s: spr, i: .5, c: z.color });
  }
  // panneau « ZONE FRANCHE »
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(z.r * .8, z.r * .2), new THREE.MeshBasicMaterial({ map: neonSign('ZONE FRANCHE', '#' + new THREE.Color(z.color).getHexString()), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  sign.position.set(z.x, 7.5, z.z + z.r * .92); g.add(sign);
  neonGlow(z.color, z.x, 7.5, z.z + z.r * .92, 9, .45);
  W.root.add(g);
  W.safeMeshes.push({ zone: z, g, ring, disc, dome, sign });
}

/* ---------------- ville ---------------- */
const SIGN_WORDS = ['MARCHÉ NOIR', 'BAR', 'RAMEN 24/7', 'HÔTEL', 'NEON-X', 'CLINIQUE', 'GARAGE', 'KIRIN', 'SYNTH', 'CAFÉ', 'ARCADE', 'TOKYO-9', 'SUSHI', 'DOCTEUR', 'NETRUNNER', 'GANG'];
const SIGN_COLORS = ['#00e8ff', '#ff2d78', '#ffe14d', '#9d6bff', '#5dff8f', '#ff7a3d'];

function building(x, z, w, d, h, opt = {}) {
  const grp = new THREE.Group();
  const tex = facade(ri(1, 9));
  tex.repeat.set(Math.max(1, w / 14), Math.max(1, h / 26));
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: opt.col || 0x8d94a6, roughness: .92, metalness: .05, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2; body.castShadow = !!S.shadow; body.receiveShadow = !!S.shadow;
  grp.add(body);
  // couronnement néon
  const nc = SIGN_COLORS[ri(0, SIGN_COLORS.length - 1)];
  const ncDim = new THREE.Color(nc).multiplyScalar(.34);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w + .5, .32, d + .5), new THREE.MeshStandardMaterial({ color: ncDim, emissive: ncDim, emissiveIntensity: 1, roughness: .7 }));
  rim.position.y = h - r(.2, 1.2); grp.add(rim);
  neonGlow(nc, x, h, z, Math.max(w, d) * .28, .1);
  // arêtes lumineuses
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: ncDim, transparent: true, opacity: .4 }));
  edges.position.y = h / 2; grp.add(edges);
  // racine / base
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 1.2, d + 1.2), new THREE.MeshLambertMaterial({ color: 0x2a2e38, map: concrete() }));
  skirt.position.y = .6; skirt.receiveShadow = !!S.shadow; grp.add(skirt);
  grp.position.set(x, 0, z);
  grp.rotation.y = opt.rot || 0;
  W.root.add(grp);
  addCollider(x, z, w / 2 + .4, d / 2 + .4, h);
  W.blocks.push({ x, z, w, d, h });

  // enseignes
  if (rng() < .55) {
    const word = SIGN_WORDS[ri(0, SIGN_WORDS.length - 1)];
    const col = SIGN_COLORS[ri(0, SIGN_COLORS.length - 1)];
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * .95, 13), 3.2), new THREE.MeshBasicMaterial({ map: neonSign(word, col), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    sign.position.set(x + Math.sin(opt.rot || 0) * 0, r(4, Math.max(5, h - 4)), z + d / 2 + .5);
    sign.rotation.y = opt.rot || 0;
    W.root.add(sign);
    neonGlow(new THREE.Color(col), x, sign.position.y, z + d / 2 + 1, 5, .5);
  }
  // porte + intérieur noir
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), new THREE.MeshBasicMaterial({ color: 0x04060c }));
  door.position.set(x + r(-w * .25, w * .25), 1.3, z + d / 2 + .1);
  W.root.add(door);
  // escalier de secours / coursive
  if (opt.rot === 0 && h > 14) {
    for (let lv = 1; lv * 9 < h - 3; lv++) {
      const y = lv * 9;
      const plat = new THREE.Mesh(new THREE.BoxGeometry(w * .34, .18, 1.5), rustMat);
      plat.position.set(x - w * .5, y, z + d / 2 + .7);
      grp.add(plat);
      for (let b = 0; b < 5; b++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(.06, .9, .06), rustMat);
        rail.position.set(x - w * .5 - w * .17 + b * (w * .085), y + .5, z + d / 2 + 1.4);
        grp.add(rail);
      }
    }
  }
  // conduits verticaux
  if (rng() < .6) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, h * .8, 5), rustMat);
    pipe.position.set(x + w * .5 + .2, h * .4, z + d * .3);
    grp.add(pipe);
  }
  // bloc de détail sur le toit (variation de silhouette)
  if (rng() < .45) {
    const bh = r(3, 8);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w * .35, bh, d * .35), matFacade());
    box.position.set(x + r(-w * .2, w * .2), h + bh / 2, z + r(-d * .2, d * .2));
    box.castShadow = !!S.shadow;
    grp.add(box);
  }
  return grp;
}

/* --- rooftop detailing partagé (instancié, 1 draw call) --- */
function matFacade() { return new THREE.MeshStandardMaterial({ color: 0x353b46, roughness: .9, metalness: .1 }); }
let roofMat = null;
function buildRooftops() {
  if (roofMat) return;
  roofMat = new THREE.MeshStandardMaterial({ color: 0x4a5260, roughness: .85, metalness: .35, map: metal() });
  const tanks = [], acs = [], ants = [], rails = [], vents = [];
  for (const b of W.blocks) {
    if (b.h < 12) continue;
    // château d'eau
    if (Math.random() < .42) tanks.push([b.x + r(-b.w * .25, b.w * .25), b.h, b.z + r(-b.d * .25, b.d * .25), r(.9, 1.6)]);
    // groupes de clim
    const nAc = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nAc; i++) acs.push([b.x + r(-b.w * .4, b.w * .4), b.h + .6, b.z + r(-b.d * .4, b.d * .4), r(.7, 1.5)]);
    // antenne
    if (Math.random() < .35) ants.push([b.x, b.h, b.z, r(4, 11)]);
    // garde-corps
    rails.push([b.x, b.h + .4, b.z, b.w, b.d]);
    // conduits
    if (Math.random() < .5) vents.push([b.x + r(-b.w * .3, b.w * .3), b.h + .9, b.z + r(-b.d * .3, b.d * .3)]);
  }
  const d = new THREE.Object3D();
  // château d'eau (cylindre sur pieds)
  if (tanks.length) {
    const g = new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10);
    const im = new THREE.InstancedMesh(g, roofMat, tanks.length);
    tanks.forEach((p, i) => { d.position.set(p[0], p[1] + 2.4, p[2]); d.scale.setScalar(p[3]); d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = !!S.shadow; W.root.add(im);
    const leg = new THREE.CylinderGeometry(.12, .12, 1.6, 5);
    const lm = new THREE.InstancedMesh(leg, roofMat, tanks.length * 4);
    tanks.forEach((p, i) => { for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; d.position.set(p[0] + Math.cos(a) * 1.1 * p[3], p[1] + .8, p[2] + Math.sin(a) * 1.1 * p[3]); d.scale.setScalar(p[3] * .7); d.updateMatrix(); lm.setMatrixAt(i * 4 + k, d.matrix); } });
    lm.instanceMatrix.needsUpdate = true;
    W.root.add(lm);
  }
  // clim
  if (acs.length) {
    const g = new THREE.BoxGeometry(1.5, 1, 1.5);
    const im = new THREE.InstancedMesh(g, roofMat, acs.length);
    acs.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.scale.setScalar(p[3]); d.rotation.set(0, r(0, TAU), 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = !!S.shadow; W.root.add(im);
  }
  // antennes
  if (ants.length) {
    const g = new THREE.CylinderGeometry(.07, .11, 1, 4);
    const im = new THREE.InstancedMesh(g, roofMat, ants.length);
    ants.forEach((p, i) => { d.position.set(p[0], p[1] + p[3] / 2, p[2]); d.scale.set(1, p[3], 1); d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true;
    W.root.add(im);
    // feu de balisage rouge
    const bg = new THREE.SphereGeometry(.18, 6, 5);
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xff2d3d, toneMapped: false }), ants.length);
    ants.forEach((p, i) => { d.position.set(p[0], p[1] + p[3], p[2]); d.scale.setScalar(1); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); });
    bm.instanceMatrix.needsUpdate = true;
    W.root.add(bm);
  }
  // garde-corps (4 barres par toit)
  if (rails.length) {
    const g = new THREE.BoxGeometry(1, .5, .1);
    const im = new THREE.InstancedMesh(g, roofMat, rails.length * 4);
    let k = 0;
    rails.forEach(p => {
      for (let e = 0; e < 4; e++) {
        const horiz = e % 2 === 0;
        const off = (e < 2 ? 1 : -1) * (horiz ? p[3] : p[3]) / 2;
        d.position.set(p[0] + (horiz ? 0 : off), p[1] + .35, p[2] + (horiz ? off : 0));
        d.scale.set(horiz ? p[3] : 1, 1, horiz ? 1 : p[4]);
        d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(k++, d.matrix);
      }
    });
    im.instanceMatrix.needsUpdate = true;
    W.root.add(im);
  }
  // conduits
  if (vents.length) {
    const g = new THREE.CylinderGeometry(.35, .45, 1.4, 7);
    const im = new THREE.InstancedMesh(g, roofMat, vents.length);
    vents.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.scale.setScalar(1); d.rotation.set(0, r(0, TAU), 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    W.root.add(im);
  }
  W.roofBuilt = true;
}

const rustMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: .95, metalness: .2, map: concrete('#3a332e') });

function buildCity() {
  const plots = [];
  // grille de îlots autour des routes principales
  for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
    if (gx === 0 || gz === 0) continue; // laisse les avenues
    if (Math.abs(gx) < 2 && Math.abs(gz) < 2) continue;
    const bx = gx * 44 + r(-6, 6), bz = gz * 44 + r(-6, 6);
    plots.push({ x: bx, z: bz, w: r(11, 22), d: r(11, 22), h: r(9, 46) });
  }
  let built = 0;
  for (const p of plots) {
    if (Math.hypot(p.x, p.z) > WORLD.R - 20) continue;
    if (Math.hypot(p.x - W.CAMP.x, p.z - W.CAMP.z) < 34) continue;
    if (Math.hypot(p.x - W.MARKET.x, p.z - W.MARKET.z) < 30) continue;
    if (Math.hypot(p.x - W.ENCLAVE.x, p.z - W.ENCLAVE.z) < 30) continue;
    if (Math.hypot(p.x - W.ROUILLE.x, p.z - W.ROUILLE.z) < 28) continue;
    building(p.x, p.z, p.w, p.d, p.h, { rot: rng() < .5 ? 0 : Math.PI / 2 });
    built++;
  }
  buildRooftops();
  // toursellation : quelques gratte-ciel de fond
  for (let i = 0; i < 10; i++) {
    const a = r(0, TAU), rad = r(150, 205);
    building(Math.cos(a) * rad, Math.sin(a) * rad, r(16, 26), r(16, 26), r(55, 95), { rot: rng() < .5 ? 0 : Math.PI / 2 });
  }
  W.buildingCount = built;
}

/* ---------------- mobilier urbain cyberpunk ---------------- */
function buildStreetProps() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x50596a, roughness: .7, metalness: .5, map: metal() });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: .8, metalness: .35 });

  // --- distributeurs automatiques néon (le trope cyberpunk par excellence)
  const vendColors = [0x00e8ff, 0xff2d78, 0xffe14d, 0x5dff8f, 0x9d6bff];
  const vendG = new THREE.BoxGeometry(1.1, 2, .75);
  const panelG = new THREE.PlaneGeometry(.95, 1.25);
  const d = new THREE.Object3D();
  const spots = [];
  for (let i = 0; i < 34; i++) {
    const a = r(0, TAU), rad = r(18, WORLD.R - 25);
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    // le long des avenues
    const px = Math.abs(x) < 16 ? 15 : x, pz = Math.abs(z) < 16 ? 15 : z;
    if (blocked(px, pz, 2)) continue;
    spots.push([px, pz, Math.atan2(-pz, -px) + r(-.3, .3), vendColors[i % vendColors.length]]);
  }
  if (spots.length) {
    const vendM = new THREE.InstancedMesh(vendG, dark, spots.length);
    vendM.castShadow = !!S.shadow;
    spots.forEach((p, i) => { d.position.set(p[0], 1, p[1]); d.rotation.set(0, p[2], 0); d.scale.setScalar(1); d.updateMatrix(); vendM.setMatrixAt(i, d.matrix); addCollider(p[0], p[1], .6, .45, 2, 'vend'); });
    vendM.instanceMatrix.needsUpdate = true;
    W.root.add(vendM);
  }
  // vitrines lumineuses (une par couleur, quelques draw calls)
  for (const c of vendColors) {
    const grp = spots.filter(p => p[3] === c);
    if (!grp.length) continue;
    const pm = new THREE.InstancedMesh(panelG, new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), grp.length);
    grp.forEach((p, i) => {
      d.position.set(p[0] + Math.sin(p[2]) * .38, 1.35, p[1] + Math.cos(p[2]) * .38);
      d.rotation.set(0, p[2], 0); d.scale.setScalar(1); d.updateMatrix(); pm.setMatrixAt(i, d.matrix);
    });
    pm.instanceMatrix.needsUpdate = true;
    W.root.add(pm);
    const glow = neonGlow(c, grp[0][0], 1.4, grp[0][1], 3.4, .3);
    if (grp.length > 2) { for (let k = 1; k < Math.min(4, grp.length); k++) neonGlow(c, grp[k][0], 1.4, grp[k][1], 3, .28); }
  }

  // --- feux tricolores aux carrefours
  const tlG = new THREE.BoxGeometry(.42, 1.1, .34);
  const lampColors = [0xff3b30, 0xffcc00, 0x30d158];
  const tlCount = 12;
  const tlM = new THREE.InstancedMesh(tlG, dark, tlCount);
  for (let i = 0; i < tlCount; i++) {
    const cx = (i % 2 ? 1 : -1) * 22, cz = (Math.floor(i / 2) % 2 ? 1 : -1) * 22;
    const jx = cx + r(-8, 8), jz = cz + r(-8, 8);
    d.position.set(jx, 5.2, jz); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); tlM.setMatrixAt(i, d.matrix);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.13, .17, 5.2, 6), steel);
    pole.position.set(jx, 2.6, jz); W.root.add(pole);
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(.11, 6, 5), new THREE.MeshBasicMaterial({ color: lampColors[k], toneMapped: false }));
      b.position.set(jx, 5.55 - k * .35, jz + .19);
      b.material.opacity = 1;
      W.root.add(b);
      if (k === 2) neonGlow(0x30d158, jx, 4.85, jz + .2, 1.5, .35);
    }
  }
  tlM.instanceMatrix.needsUpdate = true;
  W.root.add(tlM);

  // --- plaques d'égout & marquage au sol
  const mhG = new THREE.CircleGeometry(.55, 12);
  const mhCount = 30;
  const mhM = new THREE.InstancedMesh(mhG, new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: .9, metalness: .4 }), mhCount);
  for (let i = 0; i < mhCount; i++) {
    const along = r(-180, 180);
    const onX = i % 2 === 0;
    d.position.set(onX ? along : r(-8, 8), .06, onX ? r(-8, 8) : along);
    d.rotation.set(-Math.PI / 2, 0, r(0, TAU)); d.scale.setScalar(1); d.updateMatrix(); mhM.setMatrixAt(i, d.matrix);
  }
  mhM.instanceMatrix.needsUpdate = true;
  W.root.add(mhM);

  // --- sacs poubelle & caisses renversées le long des trottoirs
  const bagM = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: .95 });
  for (let i = 0; i < 60; i++) {
    const a = r(0, TAU), rad = r(20, WORLD.R - 20);
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (blocked(x, z, 1.5)) continue;
    const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 0), bagM);
    bag.position.set(x, .45, z); bag.rotation.set(r(0, TAU), r(0, TAU), r(0, TAU));
    bag.scale.set(1, .85, 1.1);
    bag.castShadow = !!S.shadow;
    W.root.add(bag);
  }

  // --- câbles entre les immeubles (avec lanternes)
  const cableMat = new THREE.LineBasicMaterial({ color: 0x0a0a12, transparent: true, opacity: .85 });
  for (let i = 0; i < 22; i++) {
    const a = r(0, TAU), rad = r(40, 130);
    const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad;
    const len = r(18, 42), dir = r(0, TAU);
    const p1 = new THREE.Vector3(cx, r(12, 30), cz);
    const p2 = new THREE.Vector3(cx + Math.cos(dir) * len, r(10, 26), cz + Math.sin(dir) * len);
    const mid = p1.clone().lerp(p2, .5); mid.y -= r(2, 6);
    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const geo2 = new THREE.BufferGeometry().setFromPoints(curve.getPoints(14));
    W.root.add(new THREE.Line(geo2, cableMat));
    // lanternes suspendues
    for (let k = 1; k < 4; k++) {
      const p = curve.getPoint(k / 4);
      const col = [0xff2d78, 0x00e8ff, 0xffe14d][k % 3];
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.2, 6, 5), new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
      bulb.position.copy(p).y -= .35; W.root.add(bulb);
      const g = neonGlow(col, p.x, p.y - .35, p.z, 2.2, .5);
      W.lamps.push({ s: g, i: .5, c: col });
    }
  }
}

/* ---------------- lampadaires & poteaux ---------------- */
function streetFurniture() {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: .7, metalness: .5, map: metal() });
  for (let i = -170; i <= 170; i += 34) {
    for (const [lx, lz, rot] of [[14, i, 0], [-14, i, 0], [i, 14, Math.PI / 2], [i, -14, Math.PI / 2]]) {
      if (Math.abs(lx) > 8 && Math.abs(lz) > 8) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.16, .24, 8, 6), poleMat);
      pole.position.set(lx, 4, lz); pole.castShadow = !!S.shadow;
      W.root.add(pole); addCollider(lx, lz, .3, .3, 8, 'pole');
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.9, .16, .16), poleMat);
      arm.position.set(lx + Math.cos(rot) * .95, 7.9, lz + Math.sin(rot) * .95);
      W.root.add(arm);
      const bulbColor = i % 68 === 0 ? 0xff2d78 : 0x9fd8ff;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.26, 8, 6), new THREE.MeshBasicMaterial({ color: bulbColor, toneMapped: false }));
      bulb.position.set(lx + Math.cos(rot) * 1.7, 7.75, lz + Math.sin(rot) * 1.7);
      W.root.add(bulb);
      const gl = neonGlow(bulbColor, bulb.position.x, 7.7, bulb.position.z, 2.4, .4);
      W.lamps.push({ s: gl, i: .55, c: bulbColor });
    }
  }
  // bennes, caisses, Educator poubelles
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: .85, metalness: .1, map: metal() });
  const trashMat = new THREE.MeshStandardMaterial({ color: 0x2c3a44, roughness: .8, metalness: .3, map: metal() });
  for (let i = 0; i < 90; i++) {
    const a = r(0, TAU), rad = r(20, WORLD.R - 12), x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (blocked(x, z, 2)) continue;
    const kind = rng();
    if (kind < .45) {
      const s = r(.8, 1.3);
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
      c.position.set(x, s / 2, z); c.rotation.y = r(0, TAU); c.castShadow = !!S.shadow;
      W.root.add(c); addCollider(x, z, s / 2, s / 2, s, 'crate');
    } else if (kind < .8) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.6, .55, 1.3, 10), trashMat);
      c.position.set(x, .65, z); c.castShadow = !!S.shadow;
      W.root.add(c); addCollider(x, z, .6, .6, 1.3, 'trash');
    } else {
      // glissières / barrières de route : le véhicule les fracasse
      const bar = new THREE.Mesh(new THREE.BoxGeometry(r(3, 5), .6, .35), trashMat);
      bar.position.set(x, .6, z); bar.rotation.y = rng() < .5 ? 0 : Math.PI / 2;
      W.root.add(bar); addCollider(x, z, bar.rotation.y === 0 ? 2.2 : .4, bar.rotation.y === 0 ? .4 : 2.2, .7, 'barrier');
    }
  }
  // véhicules brûlés (statique)
  for (let i = 0; i < 26; i++) {
    const a = r(0, TAU), rad = r(25, WORLD.R - 15), x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (blocked(x, z, 2.4)) continue;
    burntCar(x, z, r(0, TAU));
  }
}
function burntCar(x, z, rot) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, .8, 4.2), new THREE.MeshLambertMaterial({ color: 0x2a1a18 }));
  body.position.y = .75; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, .7, 2), new THREE.MeshLambertMaterial({ color: 0x1a1414 }));
  cab.position.set(0, 1.45, -.2); g.add(cab);
  for (const [sx, sz] of [[-1, -1.4], [1, -1.4], [-1, 1.4], [1, 1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .3, 8), new THREE.MeshLambertMaterial({ color: 0x141414 }));
    w.rotation.z = Math.PI / 2; w.position.set(sx * .95, .45, sz); g.add(w);
  }
  if (rng() < .3) { // épave en feu
    const f = new THREE.Mesh(new THREE.ConeGeometry(.7, 1.8, 7), new THREE.MeshBasicMaterial({ color: 0xff7a1f, transparent: true, opacity: .8 }));
    f.position.set(0, 1.6, 1.2); g.add(f);
    const l = new THREE.PointLight(0xff6a1f, 40, 26, 2); l.position.set(0, 1.6, 1.2); W.scene.add(l); W.lights.push(l); l.userData.base = 1; l.userData.flicker = true;
    W.fireGlow = W.fireGlow || []; W.fireGlow.push(new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: 0xff7a1f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    W.fireGlow[W.fireGlow.length - 1].position.set(x, 1.6, z + 1.2); W.fireGlow[W.fireGlow.length - 1].scale.setScalar(4);
    W.scene.add(W.fireGlow[W.fireGlow.length - 1]);
  }
  g.position.set(x, 0, z); g.rotation.y = rot;
  W.root.add(g); addCollider(x, z, 1.1, 2.2, 1.6, 'car');
}

/* ---------------- camp de base ---------------- */
function buildCamp() {
  const { x, z } = W.CAMP;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16, .13, 5, 44), new THREE.MeshStandardMaterial({ color: 0x2f7a4e, emissive: 0x123d28, emissiveIntensity: 1, roughness: .8 }));
  ring.rotation.x = Math.PI / 2; ring.position.set(x, .22, z); W.root.add(ring);

  // tente principale
  const tent = new THREE.Group();
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0x27453a, roughness: .95, side: THREE.DoubleSide });
  const t1 = new THREE.Mesh(new THREE.ConeGeometry(4.2, 3.6, 4), canvasMat);
  t1.position.y = 1.8; t1.rotation.y = Math.PI / 4; tent.add(t1);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 4, 5), new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: .7, roughness: .4 }));
  pole.position.y = 2; tent.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .8), new THREE.MeshBasicMaterial({ color: 0x5dff8f, side: THREE.DoubleSide, toneMapped: false }));
  flag.position.set(.75, 3.2, 0); tent.add(flag);
  tent.position.set(x, 0, z - 3);
  W.root.add(tent); addCollider(x, z - 3, 3, 3, 3.6, 'tent');

  // feu de camp
  const fire = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, 1.8, 5), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    log.rotation.set(Math.PI / 2 - r(.2, .5), r(0, TAU), 0);
    log.position.set(Math.cos(i / 6 * TAU) * .5, .3, Math.sin(i / 6 * TAU) * .5);
    fire.add(log);
  }
  const flames = new THREE.Mesh(new THREE.ConeGeometry(.9, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0xff9d2d, transparent: true, opacity: .9, toneMapped: false }));
  flames.position.y = 1.2; fire.add(flames);
  const fLight = new THREE.PointLight(0xff8a2d, 0, 40, 1.8); fLight.position.set(0, 2, 0); fire.add(fLight);
  W.lights.push(fLight); fLight.userData.base = 1.4; fLight.userData.flicker = true;
  const fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: 0xffa03d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  fs.position.y = 1.4; fs.scale.setScalar(5); fire.add(fs); W.fireGlow = W.fireGlow || []; W.fireGlow.push(fs);
  fire.position.set(x + 6, 0, z + 4); W.root.add(fire);
  W.campfire = { grp: fire, flames, light: fLight, sprite: fs };

  // caisses de ressources + établi
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, .9, 1.1), new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: .85, metalness: .15, map: metal() }));
    const a = i / 5 * TAU;
    c.position.set(x - 7 + Math.cos(a) * 2.2, .5, z + 6 + Math.sin(a) * 2.2); c.rotation.y = a;
    c.castShadow = !!S.shadow; W.root.add(c); addCollider(c.position.x, c.position.z, .6, .6, .9, 'crate');
  }
  const workbench = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, 1.2), new THREE.MeshStandardMaterial({ color: 0x6a5638, roughness: .8, map: metal() }));
  workbench.position.set(x - 5, 1, z - 5); workbench.rotation.y = .5; workbench.castShadow = !!S.shadow;
  W.root.add(workbench);
  for (const [ox, oz] of [[-1.1, -.5], [1.1, -.5], [-1.1, .5], [1.1, .5]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, 1, .12), new THREE.MeshStandardMaterial({ color: 0x4a4a52, metalness: .6, roughness: .5 }));
    leg.position.set(x - 5 + ox, .5, z - 5 + oz); W.root.add(leg);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: neonSign('BASE NÉON', '#5dff8f'), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  sign.position.set(x, 4.2, z - 8); W.root.add(sign);
  neonGlow(0x5dff8f, x, 4.2, z - 8, 7, .5);
  pointLight(0x5dff8f, x, 6, z, 30, .45);

  // générateur (alimente les tourelles)
  const gen = new THREE.Group();
  const gbody = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x3a4a52, roughness: .7, metalness: .6, map: metal() }));
  gbody.position.y = .7; gen.add(gbody);
  const gvent = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x22282e, metalness: .7, roughness: .4 }));
  gvent.rotation.z = Math.PI / 2; gvent.position.set(0, 1.5, 0); gen.add(gvent);
  const genLed = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshBasicMaterial({ color: 0x5dff8f, toneMapped: false }));
  genLed.position.set(1.02, 1, 0); gen.add(genLed);
  gen.position.set(x + 8, 0, z - 6);
  W.root.add(gen); addCollider(x + 8, z - 6, 1, .8, 1.5, 'gen');
  const gl = new THREE.PointLight(0x5dff8f, 0, 26, 2); gl.position.set(x + 8, 1.6, z - 6); W.scene.add(gl); W.lights.push(gl); gl.userData.base = .5;
  W.generator = { m: gen, light: gl, led: genLed };
  // poteaux électriques
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: .6, roughness: .5 });
  for (const [px, pz] of [[x + 3, z + 10], [x - 6, z - 9], [x + 11, z + 3]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.14, .18, 10, 6), poleMat);
    p.position.set(px, 5, pz); W.root.add(p); addCollider(px, pz, .25, .25, 10, 'pole');
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }));
    bulb.position.set(px, 10, pz); W.root.add(bulb);
    const g = neonGlow(0xfff0c0, px, 10, pz, 5, .5); W.lamps.push({ s: g, i: .5, c: 0xfff0c0 });
    const pl = new THREE.PointLight(0xffe9c0, 0, 30, 1.8); pl.position.set(px, 9.6, pz); W.scene.add(pl); W.lights.push(pl); pl.userData.base = .55;
  }
  // clôtures défensives
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x556070, roughness: .8, metalness: .4, map: metal() });
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU;
    const fx = x + Math.cos(a) * 16.5, fz = z + Math.sin(a) * 16.5;
    if (Math.abs(fx - x) < 3 && Math.abs(fz - z) < 3) continue;
    const f = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, .25), fenceMat);
    f.position.set(fx, 1.1, fz); f.rotation.y = -a + Math.PI / 2;
    if ((i % 4) === 0) continue; // ouvertures larges pour sortir en véhicule
    f.castShadow = !!S.shadow; W.root.add(f);
    addCollider(fx, fz, 1.7, .4, 2.2, 'fence');
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.5, .12, .3), new THREE.MeshBasicMaterial({ color: 0x00e8ff, toneMapped: false }));
    cap.position.set(fx, 2.25, fz); cap.rotation.y = -a + Math.PI / 2; W.root.add(cap);
  }
  pointLight(0x9fd8ff, x, 9, z, 34, .3);
}

/* ---------------- marché noir + factions ---------------- */
function marketStand(x, z, color, label, lightColor) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.6, 3.4), new THREE.MeshStandardMaterial({ color: 0x1c1024, roughness: .9, map: concrete('#2a1b33') }));
  box.position.y = 1.3; g.add(box);
  const awn = new THREE.Mesh(new THREE.BoxGeometry(7.2, .25, 4.4), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  awn.position.y = 3; g.add(awn);
  for (const [ox, oz] of [[-3, -1.5], [3, -1.5], [-3, 1.5], [3, 1.5]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 3, 5), new THREE.MeshStandardMaterial({ color: 0x444c58, metalness: .5 }));
    p.position.set(ox, 1.5, oz); g.add(p);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: neonSign(label, color), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  sign.position.set(0, 4.9, 0); g.add(sign);
  g.position.set(x, 0, z);
  W.root.add(g); addCollider(x, z, 3.4, 1.8, 3.4, 'stand');
  neonGlow(new THREE.Color(color), x, 4.9, z, 8, .6);
  pointLight(lightColor, x, 4, z, 42, 1);
  // caisses et accessoires
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(.9, .8, .9), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, map: metal(), roughness: .85 }));
    c.position.set(x + r(-4, 4), .4, z + r(2.4, 4.4)); c.rotation.y = r(0, TAU); c.castShadow = !!S.shadow;
    W.root.add(c); addCollider(c.position.x, c.position.z, .5, .5, .8, 'crate');
  }
  const glowBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, 1), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  glowBox.position.set(x + 2.4, .5, z + 2.2); W.root.add(glowBox);
  return g;
}
function buildMarket() {
  marketStand(W.MARKET.x, W.MARKET.z, '#ff2d78', 'MARCHÉ NOIR', 0xff2d78);
  // tensions / lanternes
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.18, 6, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff2d78 : 0xffe14d, toneMapped: false }));
    bulb.position.set(W.MARKET.x + Math.cos(a) * 9, 3.4 + Math.sin(a * 2) * .5, W.MARKET.z + Math.sin(a) * 9);
    W.root.add(bulb);
    const col = i % 2 ? 0xff2d78 : 0xffe14d;
    const g = neonGlow(col, bulb.position.x, bulb.position.y, bulb.position.z, 2.6, .55);
    W.lamps.push({ s: g, i: .55, c: col, sway: true, ph: r(0, 6) });
  }
  // véhicule du fixer
  marketVan(W.MARKET.x - 12, W.MARKET.z + 6, -1.2);
}
function marketVan(x, z, rot) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 5.6), new THREE.MeshStandardMaterial({ color: 0x2a1a30, roughness: .8, metalness: .35, map: metal() }));
  body.position.y = 1.4; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.8), new THREE.MeshStandardMaterial({ color: 0x101820, roughness: .4, metalness: .5 }));
  cab.position.set(0, 2.4, -1.9); g.add(cab);
  for (const [sx, sz] of [[-1, -2], [1, -2], [-1, 2], [1, 2]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .4, 10), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    w.rotation.z = Math.PI / 2; w.position.set(sx * 1.35, .6, sz); g.add(w);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.7, .16, 5), new THREE.MeshBasicMaterial({ color: 0xff2d78, toneMapped: false }));
  strip.position.y = 2.7; g.add(strip);
  g.position.set(x, 0, z); g.rotation.y = rot; W.root.add(g);
  addCollider(x, z, 1.5, 3, 2.8, 'van');
  neonGlow(0xff2d78, x, 2.7, z, 8, .4);
}
function buildFaction(p, color, label, tag) {
  // campement faction : tentes, barricades, drapeau,[mTower]
  const { x, z } = p;
  const dim = new THREE.Color(color).multiplyScalar(.22);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(13, .12, 5, 34), new THREE.MeshStandardMaterial({ color: dim, emissive: dim, emissiveIntensity: .8, roughness: .85 }));
  ring.rotation.x = Math.PI / 2; ring.position.set(x, .2, z); W.root.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + .4;
    const t = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 4), new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: .95, side: THREE.DoubleSide }));
    t.position.set(x + Math.cos(a) * 8, 1.5, z + Math.sin(a) * 8); t.rotation.y = Math.PI / 4;
    t.castShadow = !!S.shadow; W.root.add(t);
    addCollider(t.position.x, t.position.z, 2, 2, 3, 'tent');
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: neonSign(label, color), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  sign.position.set(x, 6, z); W.root.add(sign);
  neonGlow(new THREE.Color(color), x, 6, z, 10, .6);
  pointLight(new THREE.Color(color), x, 5, z, 50, 1);
  // tour de guet
  const tower = new THREE.Group();
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.14, .18, 7, 5), new THREE.MeshStandardMaterial({ color: 0x4a4a52, metalness: .6, roughness: .5 }));
    leg.position.set(ox, 3.5, oz); tower.add(leg);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, .3, 3.2), new THREE.MeshStandardMaterial({ color: 0x5a5a62, map: metal(), metalness: .5, roughness: .6 }));
  deck.position.y = 7; tower.add(deck);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, .8, .1), new THREE.MeshStandardMaterial({ color, toneMapped: false }));
  rail.position.set(0, 7.5, 1.6); tower.add(rail);
  tower.position.set(x + 12, 0, z + 4); W.root.add(tower);
  addCollider(x + 12, z + 4, 1.6, 1.6, 7, 'tower');
  const search = new THREE.SpotLight(new THREE.Color(color), 0, 60, .5, .4, 1.5);
  search.position.set(x + 12, 8, z + 4); search.target.position.set(x, 0, z);
  W.scene.add(search); W.scene.add(search.target); W.lights.push(search); search.userData.base = 2.2;
  W.searchlights = W.searchlights || []; W.searchlights.push(search);
  W[tag] = { x, z, sign, tower };
}
function buildFactions() {
  buildFaction(W.ENCLAVE, '#00e8ff', 'ENCLAVE 7', 'enclaveInfo');
  buildFaction(W.ROUILLE, '#ff5a2d', 'GANG ROUILLE', 'rouilleInfo');
}

/* ---------------- POI secrets ---------------- */
function buildPOI() {
  const defs = [
    { id: 'hopital', name: 'HÔPITAL KIRIN', x: -58, z: -18, color: 0x00e8ff, kind: 'hospital' },
    { id: 'tunnel', name: 'TUNNEL 9', x: 74, z: -22, color: 0xff7a3d, kind: 'tunnel' },
    { id: 'helicrash', name: 'ÉPAVE D\'HÉLICOPTÈRE', x: -30, z: 92, color: 0xffe14d, kind: 'crash' },
    { id: 'labo', name: 'LABORATOIRE NÉON-X', x: 128, z: -108, color: 0x5dff8f, kind: 'lab' },
  ];
  for (const d of defs) {
    const g = new THREE.Group();
    const poi = { ...d, m: g, looted: false };
    if (d.kind === 'hospital') {
      const bld = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 18), new THREE.MeshStandardMaterial({ map: (() => { const t = concrete('#3a4048'); t.repeat.set(3, 2); return t; })(), color: 0x99a2ae, roughness: .9 }));
      bld.position.y = 7; bld.castShadow = !!S.shadow; g.add(bld);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(3, 9, .6), new THREE.MeshBasicMaterial({ color: 0xff2d78, toneMapped: false }));
      cross.position.set(0, 10, 9.4); g.add(cross);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(9, 3, .6), new THREE.MeshBasicMaterial({ color: 0xff2d78, toneMapped: false }));
      cross2.position.set(0, 10, 9.4); g.add(cross2);
      for (let i = 0; i < 3; i++) { // ambulances
        const amb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 5.4), new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: .6, metalness: .3 }));
        amb.position.set(-12 + i * 11, 1.2, 12 + (i % 2) * 3); amb.rotation.y = r(-.4, .4); amb.castShadow = !!S.shadow; g.add(amb);
        addCollider(d.x + amb.position.x, d.z + amb.position.z, 1.4, 2.8, 2.2, 'amb');
      }
      pointLight(0xff2d78, d.x, 11, d.z + 10, 40, .8);
    } else if (d.kind === 'tunnel') {
      const mtn = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 26, 7, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x2a2620, flatShading: true }));
      mtn.rotation.z = Math.PI / 2; mtn.position.y = 2; g.add(mtn);
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), new THREE.MeshBasicMaterial({ color: 0x03040a }));
      mouth.position.set(0, 4, 1); g.add(mouth);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(13, 1, 2), new THREE.MeshLambertMaterial({ color: 0x4a4438 }));
      lip.position.set(0, 8.4, 1.4); g.add(lip);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.8), new THREE.MeshBasicMaterial({ map: neonSign('TUNNEL 9', '#ff7a3d'), transparent: true, toneMapped: false }));
      sign.position.set(0, 9.8, 2); g.add(sign);
      neonGlow(0xff7a3d, d.x, 9.8, d.z + 2, 7, .5);
      pointLight(0xff7a3d, d.x, 4, d.z + 5, 34, .8);
      for (let i = 0; i < 6; i++) { // rails
        const s = new THREE.Mesh(new THREE.BoxGeometry(30, .2, .4), new THREE.MeshStandardMaterial({ color: 0x5a5a60, metalness: .8, roughness: .4 }));
        s.position.set(r(-1, 1), .1, 2 + i * 2.5); g.add(s);
      }
    } else if (d.kind === 'crash') {
      const heli = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 3.4, 6, 10), new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: .7, metalness: .5 }));
      body.rotation.z = Math.PI / 2.6; heli.add(body);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(6, .5, .5), new THREE.MeshStandardMaterial({ color: 0x3a4a5a, metalness: .5 }));
      tail.position.set(-4, -1.5, 0); tail.rotation.z = .5; heli.add(tail);
      const rot = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, 9), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: .6 }));
      rot.position.set(1, 1.6, 0); rot.rotation.z = .5; heli.add(rot);
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(.3, .1, 4.4), new THREE.MeshLambertMaterial({ color: 0x1a1a20 }));
        blade.position.set(1, 1.9, 0); blade.rotation.y = i / 3 * TAU; heli.add(blade);
      }
      heli.position.y = 2.2; heli.rotation.y = .6; g.add(heli);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(11, 26), new THREE.MeshLambertMaterial({ color: 0x24262c }));
      pad.rotation.x = -Math.PI / 2; pad.position.y = .05; g.add(pad);
      const h = new THREE.Mesh(new THREE.RingGeometry(6, 7, 26), new THREE.MeshBasicMaterial({ color: 0xffe14d, side: THREE.DoubleSide, toneMapped: false }));
      h.rotation.x = -Math.PI / 2; h.position.y = .07; g.add(h);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2d78, toneMapped: false }));
      beacon.position.set(0, 1.2, 0); g.add(beacon);
      const bl = new THREE.PointLight(0xff2d78, 0, 30, 2); bl.position.set(0, 2, 0); g.add(bl);
      W.lights.push(bl); bl.userData.base = 1.4; bl.userData.blink = 0;
      poi.beacon = bl;
      pointLight(0xffe14d, d.x, 6, d.z, 40, .5);
    } else if (d.kind === 'lab') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 20, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a3a48, roughness: .35, metalness: .6, side: THREE.DoubleSide }));
      dome.position.y = .2; dome.castShadow = !!S.shadow; g.add(dome);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(11.4, 20, 14, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5dff8f, transparent: true, opacity: .16, side: THREE.DoubleSide, toneMapped: false }));
      glass.position.y = .2; g.add(glass);
      for (let i = 0; i < 6; i++) { // capsules de cryostase
        const tank = new THREE.Mesh(new THREE.CapsuleGeometry(.7, 2.4, 5, 10), new THREE.MeshBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: .5, toneMapped: false }));
        const a = i / 6 * TAU; tank.position.set(Math.cos(a) * 6, 1.8, Math.sin(a) * 6); g.add(tank);
        const gl = new THREE.PointLight(0x3dff9a, 0, 14, 2); gl.position.copy(tank.position); g.add(gl); W.lights.push(gl); gl.userData.base = .6;
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 12, 1.2, 20), new THREE.MeshStandardMaterial({ color: 0x333a44, map: metal(), metalness: .5, roughness: .6 }));
      base.position.y = .6; g.add(base);
      const pl = new THREE.PointLight(0x5dff8f, 0, 60, 1.8); pl.position.set(0, 5, 0); g.add(pl); W.lights.push(pl); pl.userData.base = 1.4;
      poi.dome = pl;
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.6), new THREE.MeshBasicMaterial({ map: neonSign(d.name, '#' + new THREE.Color(d.color).getHexString()), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    sign.position.set(d.x, 12, d.z + 10); g.add(sign);
    neonGlow(d.color, d.x, 12, d.z + 10, 9, .55);
    g.position.set(d.x, 0, d.z);
    W.root.add(g);
    addCollider(d.x, d.z, 12, 10, 10, 'poi');
    W.POI.push(poi);
    // points d'apparition de vagues
    W.enemiesSpawn.push({ x: d.x, z: d.z, used: 0 });
  }
  W.enemiesSpawn.push({ x: 0, z: -150, used: 0 }, { x: -150, z: 0, used: 0 }, { x: 150, z: 0, used: 0 }, { x: 0, z: 150, used: 0 });
}

/* ---------------- forêt ---------------- */
function buildForest() {
  const cx = -128, cz = 120, R = 78;
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x241a12 });
  const leafMats = [0x123018, 0x16361c, 0x0f2a20].map(c => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  const inst = [];
  for (let i = 0; i < 260; i++) {
    const a = r(0, TAU), rad = Math.sqrt(rng()) * R;
    const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
    if (Math.hypot(x, z) > WORLD.R - 6) continue;
    inst.push({ x, z, s: r(.75, 1.5), rot: r(0, TAU) });
  }
  // trunks instanciés
  const tg = new THREE.CylinderGeometry(.3, .5, 6, 6);
  const tm = new THREE.InstancedMesh(tg, trunkMat, inst.length);
  tm.castShadow = !!S.shadow;
  const d = new THREE.Object3D();
  inst.forEach((p, i) => {
    d.position.set(p.x, 3 * p.s, p.z); d.scale.set(p.s, p.s, p.s); d.rotation.set(0, p.rot, 0); d.updateMatrix();
    tm.setMatrixAt(i, d.matrix);
    addCollider(p.x, p.z, .5 * p.s, .5 * p.s, 6, 'tree');
  });
  tm.instanceMatrix.needsUpdate = true;
  W.root.add(tm);
  // frondaisons
  const fg = new THREE.ConeGeometry(2.6, 6.5, 7);
  const fm = new THREE.InstancedMesh(fg, leafMats[0], inst.length);
  const fm2 = new THREE.InstancedMesh(fg, leafMats[1], inst.length);
  fm.castShadow = fm2.castShadow = !!S.shadow;
  inst.forEach((p, i) => {
    d.position.set(p.x, 7.5 * p.s, p.z); d.scale.set(p.s * 1.15, p.s, p.s * 1.15); d.rotation.set(0, p.rot, 0); d.updateMatrix();
    fm.setMatrixAt(i, d.matrix);
    d.position.set(p.x, 10.4 * p.s, p.z); d.scale.set(p.s * .8, p.s * .75, p.s * .8); d.updateMatrix();
    fm2.setMatrixAt(i, d.matrix);
  });
  fm.instanceMatrix.needsUpdate = true; fm2.instanceMatrix.needsUpdate = true;
  W.root.add(fm); W.root.add(fm2);
  // lumière violette de la forêt
  pointLight(0x9d6bff, cx, 8, cz, 90, 1.4);
  neonGlow(0x9d6bff, cx, 6, cz, 26, .3);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: neonSign('ZONE IRRADIÉE', '#9d6bff'), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  sign.position.set(cx, 7, cz - 30); W.root.add(sign);
  W.forest = { x: cx, z: cz, R };
  // touffes d'herbe
  const grassGeo = new THREE.ConeGeometry(.18, .9, 4);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x2e5a2a, flatShading: true });
  const gInst = new THREE.InstancedMesh(grassGeo, grassMat, 700);
  for (let i = 0; i < 700; i++) {
    const a = r(0, TAU), rad = Math.sqrt(rng()) * (WORLD.R - 10);
    d.position.set(Math.cos(a) * rad, .4, Math.sin(a) * rad);
    d.scale.setScalar(r(.6, 1.4)); d.rotation.set(0, r(0, TAU), r(-.2, .2)); d.updateMatrix();
    gInst.setMatrixAt(i, d.matrix);
  }
  gInst.instanceMatrix.needsUpdate = true;
  W.root.add(gInst);
}

/* ---------------- pluie ---------------- */
function buildRain() {
  const N = 2200;
  const pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = rand(-30, 30), y = rand(0, 34), z = rand(-30, 30);
    pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x; pos[i * 6 + 4] = y - 1.1; pos[i * 6 + 5] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .35, depthWrite: false });
  W.rain = new THREE.LineSegments(geo, mat);
  W.rain.frustumCulled = false;
  W.rain.visible = false;
  W.scene.add(W.rain);
  W.rainPos = pos;
  W.rainN = N;
}

/* ---------------- update monde ---------------- */
const sunDir = V3();
export function updateWorld(dt) {
  const ph = G.phase;
  const sun = Math.sin(ph * TAU);
  sunDir.set(Math.cos(ph * TAU) * .6, sun, Math.sin(ph * TAU) * .3 + .2).normalize();
  // ciel
  const u = W.skyMat.uniforms;
  u.time.value = G.t;
  u.sunDir.value.copy(sunDir);
  const night = isNight(ph);
  u.night.value = lerp(u.night.value, night ? 1 : 0, dt * 2);
  const dusk = clamp(1 - Math.abs(sun) * 2.2, 0, 1);
  // ciel sombre permanent (dusk cyberpunk) : la lumière du jour ne « blanchit » pas
  // ciel sombre type crépuscule : violet froid sombre en haut, orange sale à l'horizon
  const dayL = clamp(sun * 1.5, 0, 1);
  u.topColor.value.setHSL(.64, .62, night ? .012 : lerp(.015, .035, dayL));
  u.midColor.value.setHSL(.70, .42, night ? .02 : lerp(.025, .055, dayL));
  u.botColor.value.setHSL(.055, .62, night ? .035 : lerp(.045, .10, dayL));
  u.sunColor.value.setHSL(lerp(.05, .09, dayL), .85, .42);
  if (W.sky) W.sky.position.copy(W.camera ? W.camera.position : V3());

  // nuit : on garde une lisibilité correcte (bleu froid) + lampadaires
  if (W.hemi) {
    W.hemi.intensity = night ? lerp(W.hemi.intensity, 1.9, dt * 2) : lerp(W.hemi.intensity, 2.2, dt * 2);
    W.hemi.color.setHSL(night ? .63 : .63, night ? .3 : .28, night ? .58 : .62);
  }
  if (W.amb) W.amb.intensity = lerp(W.amb.intensity, night ? .95 : 1.15, dt * 2);
  // lumières : la nuit tout s'allume
  const lampBoost = night ? 1.5 : .95;
  for (const l of W.lights) {
    let target = (l.userData.base || 1) * (l.userData.noNight ? 1 : lampBoost);
    if (l.userData.flicker) target *= .72 + Math.random() * .55;
    l.intensity = lerp(l.intensity, target * 9, dt * 3);
  }
  for (const s of W.neonSprites) {
    let o = s.userData.baseO !== undefined ? s.userData.baseO : s.material.opacity;
    o *= (night ? 1.15 : .8);
    if (s.userData.sway) s.position.x += Math.sin(G.t * .7 + (s.userData.ph || 0)) * .002;
    s.material.opacity = lerp(s.material.opacity, clamp(o, 0, 1), dt * 4);
  }
  for (const f of (W.fireGlow || [])) {
    const k = 1 + Math.sin(G.t * 9 + f.position.x) * .12 + Math.random() * .1;
    f.scale.setScalar(f.userData.s0 || (f.userData.s0 = f.scale.x) * k);
    f.material.opacity = clamp((f.userData.s0 ? f.scale.x / f.userData.s0 : 1) * .8, 0, 1);
  }
  // soleil directionnel : reste doux (monde en perpetual dusk cyberpunk)
  if (W.sunRef) {
    W.sunRef.intensity = night ? .55 : 1.05;
    W.sunRef.color.setHSL(night ? .63 : .12, night ? .35 : .28, night ? .7 : .75);
    W.sunRef.position.set(sunDir.x * 80, Math.max(55, sunDir.y * 80), sunDir.z * 80);
  }
  if (W.campfire) {
    const c = W.campfire;
    c.flames.scale.y = 1 + Math.sin(G.t * 11) * .18 + Math.random() * .12;
    c.flames.rotation.y += dt * 3;
    c.light.intensity = lerp(c.light.intensity, (night ? 40 : 14) * (1 + Math.sin(G.t * 13) * .18), dt * 4);
    c.sprite.material.opacity = .7 + Math.sin(G.t * 15) * .18;
  }
  for (const p of W.POI) {
    if (p.beacon) p.beacon.intensity = (Math.sin(G.t * 3) > .6 ? 40 : 2);
    if (p.dome) p.dome.intensity = 30 + Math.sin(G.t * 2) * 8;
  }
  if (W.searchlights) for (let i = 0; i < W.searchlights.length; i++) {
    const s = W.searchlights[i];
    s.angle = .3 + Math.sin(G.t * .25 + i * 2) * .25;
    s.target.position.set(W.scene.userData.cx || 0, 0, W.scene.userData.cz || 0);
  }

  // météo
  G.weatherT -= dt;
  if (G.weatherT <= 0) {
    G.weatherT = rand(45, 110);
    G.weather = night ? (Math.random() < .55 ? 'rain' : 'fog') : (Math.random() < .3 ? 'rain' : Math.random() < .5 ? 'fog' : 'clear');
  }
  const wetTarget = G.weather === 'rain' ? 1 : G.weather === 'fog' ? .55 : 0;
  G.rain = lerp(G.rain, wetTarget, dt * .35);
  if (W.rain) {
    W.rain.visible = G.rain > .02;
    W.rain.material.opacity = .3 * G.rain;
    const p = W.rainPos, n = W.rainN, spd = 34 * G.rain;
    const cx = W.camera ? W.camera.position.x : 0, cz = W.camera ? W.camera.position.z : 0, cy = W.camera ? W.camera.position.y : 0;
    const wind = 3 + Math.sin(G.t * .4) * 2;
    for (let i = 0; i < n; i++) {
      const i6 = i * 6;
      p[i6 + 1] -= spd * dt; p[i6 + 4] -= spd * dt;
      p[i6] += wind * dt; p[i6 + 3] += wind * dt;
      if (p[i6 + 4] < -3) {
        const y = cy + rand(18, 34);
        p[i6] = cx + rand(-34, 34); p[i6 + 1] = y; p[i6 + 2] = cz + rand(-34, 34);
        p[i6 + 3] = p[i6] - wind * .06; p[i6 + 4] = y - 1.1; p[i6 + 5] = p[i6 + 2];
      }
    }
    W.rain.geometry.attributes.position.needsUpdate = true;
  }
  // zones de sûreté : pulsation
  for (const m of W.safeMeshes) {
    const pulse = .26 + Math.sin(G.t * 1.6 + m.zone.x * .1) * .1;
    m.ring.material.opacity = pulse;
    m.disc.material.opacity = .02 + Math.sin(G.t * 1.1 + m.zone.z * .1) * .008;
  }

  // brouillard
  if (W.scene.fog) {
    const fogCol = new THREE.Color(night ? 0x0a0218 : 0x141a2e).lerp(new THREE.Color(0x2a1030), dusk * .4);
    W.scene.fog.color.lerp(fogCol, dt);
    const density = lerp(.0055, .011, G.rain) * (night ? 1.25 : 1);
    W.scene.fog.density = lerp(W.scene.fog.density, density, dt);
  }
}

export function buildWorld(scene, camera) {
  W.scene = scene; W.camera = camera;
  scene.userData.cx = 0; scene.userData.cz = 0;
  W.root = new THREE.Group(); scene.add(W.root);
  buildSky();
  buildGround();
  for (const z of SAFE_ZONES) buildSafeZoneVisual(z);
  buildCity();
  buildCamp();
  buildMarket();
  buildFactions();
  buildPOI();
  buildForest();
  buildRain();
  streetFurniture();
  buildStreetProps();
  return W;
}

/** où peut apparaître un ennemi (hors vue du joueur) */
export function spawnPoint(playerPos) {
  let best = null, bestScore = -1;
  for (let i = 0; i < 14; i++) {
    const s = W.enemiesSpawn[ri(0, W.enemiesSpawn.length - 1)];
    const a = rand(0, TAU), rad = rand(26, 70);
    let x = playerPos.x + Math.cos(a) * rad, z = playerPos.z + Math.sin(a) * rad;
    if (Math.hypot(x, z) > WORLD.R - 8) continue;
    const spot = freeSpot(x, z, 1);
    x = spot.x; z = spot.z;
    const d = Math.hypot(x - playerPos.x, z - playerPos.z);
    if (d < 22) continue;
    const score = d + (blocked(x, z, 1) ? -20 : 0) + rand(0, 12);
    if (score > bestScore) { bestScore = score; best = { x, z }; }
  }
  return best || { x: playerPos.x + rand(-50, 50), z: playerPos.z + rand(-50, 50) };
}