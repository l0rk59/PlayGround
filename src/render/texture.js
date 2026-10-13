/**
 * TEXTURE — generateur procedural de surfaces, sans dependance.
 *
 * Le sol d'un jeu 2D n'est pas une couleur : c'est une matiere. Un aplat
 * plat donne immediatement l'impression d'une maquette, meme avec des
 * personnages bien dessines. Ce module produit des tuiles **sans couture**
 * (le motif se repete sans ligne visible) a partir de bruit a valeurs.
 *
 * Tout est calcule UNE fois au demarrage et mis en cache. Une texture
 * regenerée par image serait le meilleur moyen de perdre le budget d'image
 * sur un telephone.
 */

const tileCache = new Map();

/** PRNG rapide et reproductible. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Bruit de valeur periodique.
 *
 * `x` et `y` arrivent deja exprimes en cellules de grille : c'est
 * l'appelant (fbm) qui fait la mise a l'echelle. Diviser ici par `period`
 * annulerait cette echelle et la tuile ne bouclerait plus — le bruit
 * sauterait de `g[0]` a `g[1]` au passage d'une colonne a l'autre, ce qui
 * se voit comme une ligne claire tous les 256 pixels.
 */
function valueNoise(seed, period) {
  const rnd = prng(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (fx, fy) => {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const xa = ((x0 % period) + period) % period;
    const ya = ((y0 % period) + period) % period;
    const xb = (xa + 1) % period;
    const yb = (ya + 1) % period;
    const v00 = g[ya * period + xa];
    const v10 = g[ya * period + xb];
    const v01 = g[yb * period + xa];
    const v11 = g[yb * period + xb];
    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
  };
}

/** Somme d'octaves : chaque octave ajoute un detail plus fin. */
function fbm(seed, octaves = 5, base = 8) {
  const layers = [];
  let period = base;
  for (let o = 0; o < octaves; o++) {
    layers.push({ n: valueNoise(seed + o * 7919, period), period, amp: 1 / 2 ** o });
    period *= 2;
  }
  const total = layers.reduce((s, l) => s + l.amp, 0);
  return (u, v) => {
    let sum = 0;
    for (const l of layers) sum += l.n(u * l.period, v * l.period) * l.amp;
    return sum / total;
  };
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function hexToRgb(css) {
  if (css.startsWith('#')) {
    const n = parseInt(css.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = css.match(/hsl\(\s*([-\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return [40, 44, 52];
  const h = ((Number(m[1]) % 360) + 360) % 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m2 = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  return [(t[0] + m2) * 255, (t[1] + m2) * 255, (t[2] + m2) * 255];
}

/** Positions de repli pour qu'une forme debordant la tuile soit rendue aussi. */
function wrapOffsets(size, x, y, pad = 10) {
  const out = [];
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      if (x + ox > -pad && x + ox < size + pad && y + oy > -pad && y + oy < size + pad) out.push([ox, oy]);
    }
  }
  return out;
}

function wrapStroke(ctx, size, pts, width, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [ox, oy] of [
    [0, 0], [-size, 0], [size, 0], [0, -size], [0, size],
    [-size, -size], [size, -size], [-size, size], [size, size],
  ]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Sol de la vallée : cendres tassées, gravier, fissures sèches, traînées
 * de vent. Le contraste reste faible — la bande de valeur du sol doit
 * pouvoir être ennuyeuse, sinon les props cessent de se détacher.
 */
export function groundTile(zone, size = 256) {
  const key = `ground:${zone.id}:${size}`;
  if (tileCache.has(key)) return tileCache.get(key);

  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rnd = prng(zone.seed);

  const coarse = fbm(zone.seed, 4, 4);
  const fine = fbm(zone.seed + 131, 5, 16);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const base = hexToRgb(zone.ground);
  const light = hexToRgb(zone.detail);
  const dark = hexToRgb(zone.groundAlt);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = coarse(u, v) * 0.62 + fine(u, v) * 0.38;
      const t = n - 0.5;
      const target = t > 0 ? light : dark;
      const k = Math.abs(t) * 1.45;
      const i = (y * size + x) * 4;
      d[i] = lerp(base[0], target[0], k);
      d[i + 1] = lerp(base[1], target[1], k);
      d[i + 2] = lerp(base[2], target[2], k);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Gravier : cailloux avec un dessus clair et une ombre dans le meme axe
  // de lumiere que le reste de la scene.
  for (let i = 0; i < 300; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 0.7 + rnd() * 2.6;
    for (const [ox, oy] of wrapOffsets(size, x, y)) {
      ctx.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(ox + r * 0.5, oy + r * 0.55, r * 1.6, r * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(226,240,255,${0.05 + rnd() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(ox - r * 0.3, oy - r * 0.35, r, r * 0.8, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Fissures : c'est ce qui dit « sol dur » et non « dessin ».
  for (let i = 0; i < 10; i++) {
    const pts = [];
    let x = rnd() * size;
    let y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    const steps = 5 + Math.floor(rnd() * 7);
    for (let s = 0; s < steps; s++) {
      pts.push([x, y]);
      a += (rnd() - 0.5) * 1.3;
      x += Math.cos(a) * (size / 13);
      y += Math.sin(a) * (size / 13);
    }
    wrapStroke(ctx, size, pts, 0.7 + rnd() * 1.2, '#000000', 0.14 + rnd() * 0.1);
    wrapStroke(ctx, size, pts.map(([px, py]) => [px, py - 0.9]), 0.55, '#dfe7f2', 0.045);
  }

  // Traînées de cendre : fines, dans un sens, comme si le vent les avait
  // posées. C'est ce qui casse l'aspect « bruit uniforme ».
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.lineCap = 'round';
  for (let i = 0; i < 80; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 4 + rnd() * 16;
    ctx.strokeStyle = rnd() > 0.45 ? '#e6edf7' : '#000000';
    ctx.lineWidth = 0.5 + rnd();
    for (const [ox, oy] of wrapOffsets(size, x, y)) {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + len * 0.95, oy + len * 0.32);
      ctx.stroke();
    }
  }
  ctx.restore();

  tileCache.set(key, c);
  return c;
}

/** Sol de la faille : la même méthode, mais des veines lumineuses. */
export function anomalyTile(zone, size = 256) {
  const key = `anomaly:${zone.id}:${size}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const coarse = fbm(zone.seed + 3, 5, 4);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const base = hexToRgb(zone.ground);
  const hi = hexToRgb(zone.detail);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = coarse(x / size, y / size);
      const veins = Math.pow(Math.abs(Math.sin(n * 14)), 18);
      const i = (y * size + x) * 4;
      d[i] = lerp(base[0], hi[0], veins);
      d[i + 1] = lerp(base[1], hi[1], veins);
      d[i + 2] = lerp(base[2], hi[2], veins);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tileCache.set(key, c);
  return c;
}

/**
 * Poussières en suspension. Un pool de taille fixe, recyclé : allouer un
 * objet par particule et par image est la fuite mémoire la plus facile.
 */
export class Motes {
  constructor(count = 140) {
    this.count = count;
    this.items = [];
  }

  reset(rng, w, h) {
    this.items.length = 0;
    for (let i = 0; i < this.count; i++) {
      this.items.push({
        x: rng() * w,
        y: rng() * h,
        z: 0.35 + rng() * 0.9,
        r: 0.6 + rng() * 1.9,
        phase: rng() * Math.PI * 2,
        drift: 6 + rng() * 22,
        fall: 8 + rng() * 26,
      });
    }
  }

  step(dt, w, h, t) {
    for (const p of this.items) {
      p.y += p.fall * p.z * dt;
      p.x += Math.sin(t * 0.6 + p.phase) * p.drift * dt;
      if (p.y > h + 8) {
        p.y = -8;
        p.x = ((p.x * 7919) % w + w) % w;
      }
      if (p.x < -8) p.x = w + 8;
      if (p.x > w + 8) p.x = -8;
    }
  }

  /** Coordonnees ecran : les particules vivent dans l'ecran, pas dans le monde. */
  draw(ctx, sprite, view, alpha, scrollX, scrollY) {
    if (this.items.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    for (const p of this.items) {
      const sx = p.x + scrollX;
      const sy = p.y + scrollY;
      if (sx < -20 || sy < -20 || sx > view.w + 20 || sy > view.h + 20) continue;
      const s = p.r * 5 * p.z;
      ctx.drawImage(sprite, sx - s / 2, sy - s / 2, s, s);
    }
    ctx.restore();
  }
}

export function clearTextureCache() {
  tileCache.clear();
}