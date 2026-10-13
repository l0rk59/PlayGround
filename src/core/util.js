/**
 * Noyau deterministe : RNG, vecteurs, hash spatial, bus d'evenements.
 * Aucun acces DOM : ce module est chargeable sous node:test.
 */

/* ------------------------------------------------------------------ RNG -- */

/** Generateur mulberry32 : rapide, 32 bits d'etat, reproductible. */
export function makeRng(seed = 0x9e3779b9) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (min, max) => min + rng() * (max - min);
  rng.int = (min, max) => Math.floor(min + rng() * (max - min + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  rng.shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  rng.state = () => a >>> 0;
  return rng;
}

/** Hachage de chaine -> entier 32 bits (mulberry32 sur le hash FNV-1a). */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* ----------------------------------------------------------------- MATH -- */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

/** Ramene un vecteur a une longueur max, sans changer sa direction. */
export function limitLen(x, y, max) {
  const m = Math.hypot(x, y);
  if (m <= max || m === 0) return { x, y };
  return { x: (x / m) * max, y: (y / m) * max };
}

export function normalize(x, y) {
  const m = Math.hypot(x, y);
  return m === 0 ? { x: 0, y: 0 } : { x: x / m, y: y / m };
}

/** Angle le plus court entre deux angles, dans [-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Fait tourner `from` vers `to` d'au plus `maxStep` radians. */
export function turnToward(from, to, maxStep) {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}

export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/** Intersection segment/cercle. Sert aux faisceaux de telegraphie. */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist2(x1, y1, cx, cy) <= r * r;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return dist2(px, py, cx, cy) <= r * r;
}

/** Le point du secteur (centre, angle, demi-angle, rayon) le plus proche. */
export function closestPointInSector(cx, cy, facing, halfAngle, radius, px, py) {
  const v = normalize(px - cx, py - cy);
  const d = dist(px, py, cx, cy);
  if (d > radius) return { x: cx + v.x * radius, y: cy + v.y * radius };
  const dot = clamp(v.x * Math.cos(facing) + v.y * Math.sin(facing), -1, 1);
  const a = Math.acos(dot);
  if (a <= halfAngle) return { x: px, y: py };
  const s = facing + Math.sign(angleDelta(facing, Math.atan2(v.y, v.x))) * halfAngle;
  return { x: cx + Math.cos(s) * d, y: cy + Math.sin(s) * d };
}

/* ------------------------------------------------------- HASH SPATIAL -- */

/**
 * Grille de dispersion pour le phase large. Evite les balayages O(n^2)
 * quand plusieurs centaines d'entites se trouvent a l'ecran.
 */
export class SpatialHash {
  constructor(cellSize = 96) {
    this.cell = cellSize;
    this.map = new Map();
  }

  clear() {
    this.map.clear();
  }

  _key(cx, cy) {
    return cx * 73856093 ^ cy * 19349663;
  }

  insert(entity) {
    const cx = Math.floor(entity.x / this.cell);
    const cy = Math.floor(entity.y / this.cell);
    const k = this._key(cx, cy);
    let bucket = this.map.get(k);
    if (!bucket) this.map.set(k, (bucket = []));
    bucket.push(entity);
  }

  rebuild(entities) {
    this.clear();
    for (const e of entities) this.insert(e);
  }

  /** Remplit `out` avec les entites dans le rectangle. */
  queryRect(x, y, w, h, out = []) {
    out.length = 0;
    const x0 = Math.floor(x / this.cell);
    const y0 = Math.floor(y / this.cell);
    const x1 = Math.floor((x + w) / this.cell);
    const y1 = Math.floor((y + h) / this.cell);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.map.get(this._key(cx, cy));
        if (bucket) for (const e of bucket) out.push(e);
      }
    }
    return out;
  }

  queryRadius(x, y, r, out = []) {
    this.queryRect(x - r, y - r, r * 2, r * 2, out);
    return out;
  }
}

/* ------------------------------------------------------ BUS EVENEMENTS -- */

/**
 * Emission synchrone le plus simple possible. La simulation publie,
 * l'interface et l'audio ecoutent. Aucune dependance de sens inverse.
 */
export class Emitter {
  constructor() {
    this.handlers = new Map();
  }

  on(type, fn) {
    let list = this.handlers.get(type);
    if (!list) this.handlers.set(type, (list = []));
    list.push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const list = this.handlers.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  emit(type, payload) {
    const list = this.handlers.get(type);
    if (!list) return;
    for (const fn of list.slice()) fn(payload);
  }
}