/**
 * GENERATION D'ASSETS — icones PWA, sans aucune dependance.
 *
 * Les icones sont dessinees pixel par pixel dans un tampon RGBA puis
 * encodees en PNG a la main (zlib + CRC32, tous deux fournis par Node).
 * Aucun Sharp, aucun ImageMagick, aucun binaire dans le PATH : le build
 * reste reproductible sur n'importe quelle machine.
 *
 * L'icone applique la meme discipline que le jeu : fond dans la bande de
 * valeur la plus basse, volume du batiment sur trois faces issues d'un
 * vecteur de lumiere haut-gauche, une seule fenetre chaude, un halo
 * d'anomalie froid qui traverse le cadre.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------- PNG -- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtre « None »
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------------- DESSIN -- */

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

class Canvas {
  constructor(size) {
    this.size = size;
    this.buf = Buffer.alloc(size * size * 4);
  }

  set(x, y, rgb, a = 1) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size || a <= 0) return;
    const i = (y * this.size + x) * 4;
    const prev = [this.buf[i], this.buf[i + 1], this.buf[i + 2]];
    const out = mix(prev, rgb, a);
    this.buf[i] = Math.round(out[0]);
    this.buf[i + 1] = Math.round(out[1]);
    this.buf[i + 2] = Math.round(out[2]);
    this.buf[i + 3] = Math.round(Math.max(this.buf[i + 3], a * 255));
  }

  /** Pixel avec couverture anti-alias : indispensable sur une icone 192. */
  sample(fn, u, v) {
    const n = 3;
    let acc = 0;
    for (let sy = 0; sy < n; sy++) {
      for (let sx = 0; sx < n; sx++) {
        const px = u + (sx + 0.5) / n - 0.5;
        const py = v + (sy + 0.5) / n - 0.5;
        // On compte la COUVERTURE, pas le dernier canal : ce dernier sert
        // de drapeau interne pour la fenetre, il ne vaut pas alpha.
        if (fn(px, py)) acc += 1;
      }
    }
    return acc / (n * n);
  }

  fill(fn) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const c = fn(x, y);
        if (c) this.set(x, y, c[0], c[3]);
      }
    }
  }
}

const bgTop = hex('#171d27');
const bgBottom = hex('#0a0d13');
const body = hex('#3a465e');
const lit = hex('#6f819e');
const dark = hex('#1a2130');
const window = hex('#f0b429');
const anomaly = hex('#4fd6c8');

/**
 * Le dessin. Coordonnees normalisees 0..1 pour que l'icone soit identique
 * a toutes les tailles.
 */
function drawIcon(size, { maskable = false } = {}) {
  const c = new Canvas(size);
  const pad = maskable ? 0.2 : 0.1;
  const shrink = maskable ? 0.62 : 0.82;

  /**
   * Le volume. Retourne [r, g, b, estFenetre] : le dernier canal sert de
   * drapeau, pas de couleur — la fenetre doit survivre au passage du liseré.
   */
  const house = (x, y) => {
    const u = (x / size - 0.5) / shrink + 0.5;
    const v = (y / size - 0.5) / shrink + 0.5;

    const bodyTop = 0.46;
    const bodyBottom = 0.88;
    if (u > 0.18 && u < 0.82 && v > bodyTop && v < bodyBottom) {
      if (u > 0.46 && u < 0.62 && v > 0.58 && v < 0.76) return [...window, 1];
      // Trois faces : le flanc bas-droit est la plus sombre, la facade la
      // plus claire. Meme regle que le canvas.
      const side = u > 0.66 ? 0.38 : u < 0.34 ? 0.78 : 0.62;
      return [...mix(dark, lit, side), 0];
    }
    if (v >= 0.18 && v < bodyTop) {
      const t = (v - 0.18) / (bodyTop - 0.18);
      if (Math.abs(u - 0.5) < 0.32 * t) {
        const side = u > 0.5 ? 0.3 : 0.62;
        return [...mix(dark, lit, side), 0];
      }
    }
    return null;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = y / size;
      let rgb = mix(bgTop, bgBottom, v);
      let alpha = 1;

      // Halo d'anomalie : froid, faible, derriere le batiment.
      const d = Math.hypot(x / size - 0.5, y / size - 0.46);
      const halo = Math.max(0, 1 - d / 0.62) ** 2.4;
      rgb = mix(rgb, anomaly, halo * 0.3);
      alpha = Math.max(alpha, halo * 0.85);

      c.set(x, y, rgb, alpha);
    }
  }

  // Le batiment, avec anticontour.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hit = house(x, y);
      if (!hit) continue;
      const cov = c.sample(house, x, y);
      if (cov <= 0.01) continue;

      // Le liseré froid ne concerne QUE le bord expose a la lumiere —
      // haut-gauche, comme partout dans le jeu. Il edgy la silhouette, il
      // ne repeint jamais la fenetre du seuil.
      // Vers la lumiere (haut-gauche) le volume est dehors : ce pixel est
      // donc sur l'arete exposee. Dans l'autre sens, c'est de l'ombre.
      const openToLight = !house(x - 2.1, y - 2.1);
      const onEdge = openToLight && !hit[3];
      c.set(x, y, onEdge ? anomaly : hit, cov);
    }
  }

  void pad;
  return c;
}

function write(path, canvasObj) {
  const png = encodePng(canvasObj.size, canvasObj.size, canvasObj.buf);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  return { path, bytes: png.length };
}

/**
 * Icones de lanceur Android. Meme dessin que la PWA, aux densites
 * exigees par le lanceur. L'icone adaptative (foreground) doit tenir dans
 * la zone de surete centrale de 72 dp sur 108 dp : on reduit donc le
 * motif pour qu'aucun systeme ne le rogne.
 */
const LAUNCHER = [
  ['mdpi', 48, 72],
  ['hdpi', 72, 108],
  ['xhdpi', 96, 144],
  ['xxhdpi', 144, 216],
  ['xxxhdpi', 192, 288],
];

const ANDROID_RES = join(ROOT, 'android/app/src/main/res');
const androidPresent = existsSync(ANDROID_RES);

const targets = [
  ['public/icons/icon-192.png', 192, {}],
  ['public/icons/icon-512.png', 512, {}],
  ['public/icons/icon-maskable.png', 512, { maskable: true }],
];

let total = 0;
for (const [rel, size, opts] of targets) {
  const r = write(join(ROOT, rel), drawIcon(size, opts));
  total += r.bytes;
  console.log(`  ${rel.padEnd(32)} ${size}x${size}  ${(r.bytes / 1024).toFixed(1)} Ko`);
}

if (androidPresent) {
  for (const [density, size, fg] of LAUNCHER) {
    const dir = join(ANDROID_RES, `mipmap-${density}`);
    // Arriere-plan uni : l'icone adaptative le comble avec la couleur du
    // theme, le motif reste dans le premier plan.
    const bg = new Canvas(size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        bg.set(x, y, mix(bgTop, bgBottom, y / size), 1);
      }
    }
    write(join(dir, 'ic_launcher.png'), drawIcon(size));
    write(join(dir, 'ic_launcher_round.png'), drawIcon(size));
    write(join(dir, 'ic_launcher_foreground.png'), drawIcon(fg));
    total += size * size * 3;
  }
  console.log(`  android mipmap-*                  5 densites x 3 icones`);
}

console.log(`Assets generes : ${(total / 1024).toFixed(0)} Ko au total, zero dependance.`);