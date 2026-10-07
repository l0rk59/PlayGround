// ============================================================================
//  textures.js — textures procédurales (canvas) : asphalte, béton, métal, etc.
// ============================================================================
import * as THREE from 'three';

const cache = new Map();
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function fin(c, rep = 1, aniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}
function grain(ctx, w, h, n, a, col = '0,0,0') {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 2.4 + .4;
    ctx.fillStyle = `rgba(${col},${Math.random() * a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}

/** asphalte : fissures, taches, gravier */
export function asphalt() {
  if (cache.has('asphalt')) return cache.get('asphalt');
  const c = cv(256), x = c.getContext('2d');
  x.fillStyle = '#2a2b34'; x.fillRect(0, 0, 256, 256);
  grain(x, 256, 256, 2600, .5, '190,200,215');
  grain(x, 256, 256, 900, .35, '0,0,0');
  x.strokeStyle = 'rgba(8,8,12,.75)';
  for (let i = 0; i < 16; i++) {
    x.lineWidth = Math.random() * 1.8 + .3; x.beginPath();
    let px = Math.random() * 256, py = Math.random() * 256; x.moveTo(px, py);
    for (let j = 0; j < 7; j++) { px += rand2() * 40; py += rand2() * 40; x.lineTo(px, py); }
    x.stroke();
  }
  for (let i = 0; i < 5; i++) { // flaques
    const px = Math.random() * 256, py = Math.random() * 256, r = 10 + Math.random() * 30;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(20,40,60,.5)'); g.addColorStop(1, 'rgba(20,40,60,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const t = fin(c, 1); cache.set('asphalt', t); return t;
}
const rand2 = () => Math.random() * 2 - 1;

/** béton éraflé */
export function concrete(tint = '#454b58') {
  const k = 'con' + tint;
  if (cache.has(k)) return cache.get(k);
  const c = cv(256), x = c.getContext('2d');
  x.fillStyle = tint; x.fillRect(0, 0, 256, 256);
  grain(x, 256, 256, 1800, .3, '255,255,255');
  grain(x, 256, 256, 1200, .35, '0,0,0');
  for (let i = 0; i < 26; i++) { // fissures longues
    x.strokeStyle = `rgba(0,0,0,${.1 + Math.random() * .25})`; x.lineWidth = Math.random() * 2 + .4;
    x.beginPath(); x.moveTo(Math.random() * 256, Math.random() * 256);
    x.lineTo(Math.random() * 256, Math.random() * 256); x.stroke();
  }
  for (let i = 0; i < 9; i++) { // traînées d'écoulement
    const px = Math.random() * 256, w = 4 + Math.random() * 14;
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px, 0, w, 256);
  }
  const t = fin(c, 1); cache.set(k, t); return t;
}

/** tôle / panneau métallique */
export function metal() {
  if (cache.has('metal')) return cache.get('metal');
  const c = cv(128), x = c.getContext('2d');
  x.fillStyle = '#565f70'; x.fillRect(0, 0, 128, 128);
  grain(x, 128, 128, 700, .3, '255,255,255'); grain(x, 128, 128, 700, .4, '0,0,0');
  x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1;
  for (let i = 0; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 128; i += 16) for (let j = 0; j < 128; j += 16) x.fillRect(i, j, 16, 2);
  // traces de rouille
  for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(${120 + Math.random() * 60},60,30,${.06 + Math.random() * .12})`;
    x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 9, 0, 7); x.fill(); }
  const t = fin(c, 1); cache.set('metal', t); return t;
}

/** sol béton/rubble */
export function ground() {
  if (cache.has('ground')) return cache.get('ground');
  const c = cv(512), x = c.getContext('2d');
  x.fillStyle = '#3a3a3c'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { // traces d'usure / fissures
    x.fillStyle = `rgba(${58 + Math.random() * 38},${62 + Math.random() * 40},${58 + Math.random() * 36},${.1 + Math.random() * .2})`;
    x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 26, 5 + Math.random() * 16, Math.random() * 3, 0, 7); x.fill();
  }
  for (let i = 0; i < 240; i++) { // gravats
    x.fillStyle = `rgba(${70 + Math.random() * 60},${70 + Math.random() * 55},${75 + Math.random() * 50},${.1 + Math.random() * .35})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 6, 1 + Math.random() * 5);
  }
  grain(x, 512, 512, 3000, .35, '0,0,0');
  const t = fin(c, 1); t.repeat.set(40, 40); cache.set('ground', t); return t;
}

/** façade d'immeuble : fenêtres, clim, rouille, néons */
export function facade(seed = 1, glowColor = null) {
  const k = 'fac' + seed + (glowColor || '');
  if (cache.has(k)) return cache.get(k);
  const W = 256, H = 512, c = cv(W, H), x = c.getContext('2d');
  x.fillStyle = '#3a4048'; x.fillRect(0, 0, W, H);
  grain(x, W, H, 2200, .22, '255,255,255'); grain(x, W, H, 1600, .3, '0,0,0');
  const cols = 5, rows = 12;
  for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
    const wx = 12 + cI * 47, wy = 12 + r * 42, ww = 34, wh = 28;
    const lit = Math.random();
    if (lit < .88) { // éteinte
      x.fillStyle = `rgba(${10 + Math.random() * 12},${12 + Math.random() * 14},${20 + Math.random() * 20},1)`;
      x.fillRect(wx, wy, ww, wh);
    } else if (lit < .96) { // allumée chaude
      x.fillStyle = `rgba(${120 + Math.random() * 60},${95 + Math.random() * 45},${48 + Math.random() * 30},1)`;
      x.fillRect(wx, wy, ww, wh);
    } else { // néon coloré
      const cols2 = ['#00e8ff', '#ff2d78', '#ffe14d', '#9d6bff', '#5dff8f'];
      x.fillStyle = cols2[Math.floor(Math.random() * cols2.length)]; x.globalAlpha = .18 + Math.random() * .22;
      x.fillRect(wx, wy, ww, wh); x.globalAlpha = 1;
    }
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 2; x.strokeRect(wx, wy, ww, wh);
    if (Math.random() < .25) { x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(wx, wy + wh * .45, ww, 3); } // barre
    if (Math.random() < .14) { // clim extérieure
      x.fillStyle = '#4b5364'; x.fillRect(wx + 4, wy + wh + 2, 14, 9); x.fillStyle = '#2a3040'; x.fillRect(wx + 6, wy + wh + 4, 10, 5);
    }
  }
  // traces de ruissellement
  for (let i = 0; i < 22; i++) {
    const px = Math.random() * W, g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px, 0, 2 + Math.random() * 7, H);
  }
  const t = fin(c, 1); t.repeat.set(1, 1);
  if (glowColor) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(k, t); return t;
}

/** panneau / enseigne néon : texte lumineux avec halo */
export function neonSign(text, color = '#00e8ff', w = 512, h = 128) {
  const c = cv(w, h), x = c.getContext('2d');
  x.fillStyle = 'rgba(4,6,14,.9)'; x.fillRect(0, 0, w, h);
  x.strokeStyle = color; x.lineWidth = 4; x.globalAlpha = .55; x.strokeRect(6, 6, w - 12, h - 12); x.globalAlpha = 1;
  x.font = `900 ${Math.floor(h * .52)}px "Rajdhani",monospace`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 26; x.fillStyle = color; x.fillText(text, w / 2, h / 2 + 2);
  x.shadowBlur = 12; x.fillStyle = '#fff'; x.globalAlpha = .85; x.fillText(text, w / 2, h / 2 + 2); x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}

/** icône de projectile / élément de HUD */
export function roundSprite(color = '#fff', soft = .5) {
  const c = cv(64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color); g.addColorStop(soft, color.replace(')', ',.5)').replace('rgb', 'rgba').replace('#', '#'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** bruit pour shaders simples */
export function noiseTex(size = 64) {
  if (cache.has('noise')) return cache.get('noise');
  const c = cv(size), x = c.getContext('2d'), d = x.createImageData(size, size);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; cache.set('noise', t); return t;
}

/** halo additif pour néons / flashs */
let haloTex = null;
export function halo() {
  if (haloTex) return haloTex;
  const c = cv(128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)');
  g.addColorStop(.6, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c); haloTex.colorSpace = THREE.SRGBColorSpace; return haloTex;
}

/** décalcomanie d'impact (trou de balle) */
export function decal() {
  if (cache.has('decal')) return cache.get('decal');
  const c = cv(64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(.45, 'rgba(10,8,8,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 22; i++) { const a = Math.random() * 7, r = 8 + Math.random() * 20;
    x.strokeStyle = `rgba(0,0,0,${.2 + Math.random() * .5})`; x.lineWidth = Math.random() * 2;
    x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set('decal', t); return t;
}