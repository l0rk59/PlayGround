/**
 * SPRITES — art procedural, pre-rendu une fois dans des canvas hors ecran.
 *
 * Deux raisons, non negociables sur un telephone d'entree de gamme :
 *
 *  - `ctx.shadowBlur` est interdit. C'est dix fois plus lent que
 *    composer un degrade pre-calcule en `lighter`. Une:\\
 *  - Tout ce qui change doit etre dans un sprite, pas dans l'etat par
 *    image. Une entite = un `drawImage`.
 *
 * Chaque volume est construit sur TROIS faces derivees du vecteur de
 * lumiere declare (haut-gauche, 40 degres). C'est ce qui donne aux
 * objets leur poids et les fait soaring du sol au lieu d'y etre colles.
 */

import { LIGHT, FACE_VALUE, SEMANTIC, VALUE, shade } from '../art/palette.js';

const cache = new Map();
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

/** Ombre portee : ellipse ecrassee, decalee vers l oppose a la lumiere. */
export function blobShadow(size = 40, alpha = 0.42) {
  const key = `shadow:${size}:${alpha}`;
  if (cache.has(key)) return cache.get(key);
  const r = size / 2;
  const c = canvas(size, size * 0.55);
  const ctx = c.getContext('2d');
  const cy = r * 0.6;
  const g = ctx.createRadialGradient(r, cy, 1, r, cy, r);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.62})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(r, cy, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  cache.set(key, c);
  return c;
}

/** Halo doux. Utilise en `lighter`, jamais avec shadowBlur. */
export function glow(size, color, strength = 0.8) {
  const key = `glow:${size}:${color}:${strength}`;
  if (cache.has(key)) return cache.get(key);
  const r = size / 2;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, hexAlpha(color, strength));
  g.addColorStop(0.35, hexAlpha(color, strength * 0.45));
  g.addColorStop(1, hexAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
}

/** Anneau d'onde (pulsation d'abilite, extraction, onde de choc). */
export function ring(size, color, width = 6) {
  const key = `ring:${size}:${color}:${width}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - width, 0, Math.PI * 2);
  ctx.stroke();
  cache.set(key, c);
  return c;
}

/* ------------------------------------------------------------- VOLUMES -- */

/**
 * Dessine un volume stylise sur trois faces.
 *
 * Convention : sommet clair, face opposee a la lumiere sombre. On travaille
 * en coordonnees « hauteur apparente » plutot qu'en 3D reelle, ce qui suffit
 * pour un decor 2.5D et evite tout moteur.
 */
/**
 * Silhouette d'acteur. Les formes sont deliberement distinctes : un joueur
 * doit identifier la menace au contour, avant la couleur et avant l'effet.
 */
export function actorSprite(spec) {
  // La forme vient de `shape` (table SILHOUETTE) — pas de `silhouette`.
  // Confondre les deux produisait un sprite vide : aucune branche ne
  // s'execute, seul le liseré de fin était dessiné.
  const key = `actor:${spec.shape}:${spec.color}:${spec.trim ?? ''}:${spec.w}:${spec.h}`;
  if (!spec.shape) throw new Error(`actorSprite: forme manquante pour ${spec.color} (${spec.w}x${spec.h})`);
  if (cache.has(key)) return cache.get(key);
  const pad = 10;
  const w = spec.w + pad * 2;
  const h = spec.h + pad * 2;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const cx = w / 2;
  const baseY = h - pad;
  const color = spec.color;
  const top = shade(color, FACE_VALUE.top);
  const right = shade(color, FACE_VALUE.right);
  const left = shade(color, FACE_VALUE.left);

  ctx.lineJoin = 'round';

  const solid = (fill, stroke = true) => {
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = `rgba(0,0,0,0.55)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  if (spec.shape === 'humanoid' || spec.shape === 'tall') {
    const tall = spec.shape === 'tall';
    const bodyW = spec.w * (tall ? 0.62 : 0.78);
    const bodyH = spec.h * (tall ? 0.72 : 0.6);
    // Jambes : deux blocs marques pour donner une lecture de marche.
    const legW = bodyW * 0.36;
    const legH = spec.h - bodyH - spec.h * 0.22;
    solid(left, false);
    ctx.fillRect(cx - bodyW / 2, baseY - legH, legW, legH);
    ctx.fillRect(cx + bodyW / 2 - legW, baseY - legH, legW, legH);
    // Torse : epaules en pente et pan de manteau evase. Un simple
    // rectangle se lit comme une boite posee sur le sol — exactement le
    // defaut « sticker » qu'on veut eviter.
    const shoulderW = bodyW * 0.5;
    const hipW = bodyW * 0.56;
    const hemW = bodyW * (tall ? 0.5 : 0.72);
    const topY = baseY - legH - bodyH;
    const hipY = baseY - legH - bodyH * 0.34;

    ctx.beginPath();
    ctx.moveTo(cx - shoulderW / 2, topY + bodyH * 0.16);
    ctx.lineTo(cx - shoulderW * 0.34, topY);
    ctx.lineTo(cx + shoulderW * 0.34, topY);
    ctx.lineTo(cx + shoulderW / 2, topY + bodyH * 0.16);
    ctx.lineTo(cx + hipW / 2, hipY);
    ctx.lineTo(cx + hemW / 2, baseY - legH);
    ctx.lineTo(cx - hemW / 2, baseY - legH);
    ctx.lineTo(cx - hipW / 2, hipY);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Flanc oppose a la lumiere : meme matiere, une valeur plus basse.
    // C'est ce pan qui donne l'epaisseur, pas une ombre portee.
    ctx.fillStyle = right;
    ctx.beginPath();
    ctx.moveTo(cx + shoulderW * 0.14, topY);
    ctx.lineTo(cx + shoulderW / 2, topY + bodyH * 0.16);
    ctx.lineTo(cx + hipW / 2, hipY);
    ctx.lineTo(cx + hemW / 2, baseY - legH);
    ctx.lineTo(cx + hemW * 0.12, baseY - legH);
    ctx.closePath();
    ctx.fill();

    // Bras : un seul bloc, cote lumiere. Il donne la posture.
    ctx.fillStyle = left;
    ctx.fillRect(cx - shoulderW / 2 - bodyW * 0.07, topY + bodyH * 0.2, bodyW * 0.12, bodyH * 0.62);
    ctx.fillStyle = right;
    ctx.fillRect(cx + shoulderW / 2 - bodyW * 0.04, topY + bodyH * 0.2, bodyW * 0.12, bodyH * 0.62);

    // Tete : calée sur les epaules, avec un cou. Le cou evite que la tete
    // « flotte » au-dessus du buste.
    const headR = bodyW * 0.3;
    const headY = topY - headR * 0.55;
    ctx.fillStyle = left;
    ctx.fillRect(cx - bodyW * 0.08, topY - bodyH * 0.06, bodyW * 0.16, bodyH * 0.1);
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (tall) {
      // Bras longs : la Pleureuse doit se lire comme etirée de haut.
      ctx.strokeStyle = left;
      ctx.lineWidth = bodyW * 0.24;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - bodyW / 2, baseY - legH - bodyH * 0.86);
      ctx.lineTo(cx - bodyW * 0.86, baseY - legH - bodyH * 1.5);
      ctx.moveTo(cx + bodyW / 2, baseY - legH - bodyH * 0.86);
      ctx.lineTo(cx + bodyW * 0.86, baseY - legH - bodyH * 1.5);
      ctx.stroke();
    }
  } else if (spec.shape === 'blob') {
    const rx = spec.w / 2;
    const ry = spec.h / 2;
    // Corps spherique : trois bandes horizontales du meme degrade.
    const g = ctx.createLinearGradient(cx - rx, baseY - spec.h, cx + rx, baseY);
    g.addColorStop(0, top);
    g.addColorStop(0.5, color);
    g.addColorStop(1, left);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - ry, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.rect(cx - rx, baseY - ry, rx * 2, ry);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - ry, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Pustules : rupture de surface, signature de la Plethore.
    if (spec.bubbles) {
      ctx.fillStyle = shade(color, 1.25);
      for (const [bx, by, br] of spec.bubbles) {
        ctx.beginPath();
        ctx.arc(cx + bx * rx, baseY - ry + by * ry, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (spec.shape === 'quad') {
    const bodyH = spec.h * 0.62;
    const legH = spec.h - bodyH;
    // Corps allonge horizontal : lecture « quadrupede » sans dessin.
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - legH - bodyH / 2, spec.w / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = left;
    ctx.beginPath();
    ctx.ellipse(cx + spec.w * 0.18, baseY - legH - bodyH / 2 + bodyH * 0.22, spec.w / 2, bodyH / 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = right;
    for (const off of [-0.34, -0.1, 0.16, 0.36]) {
      ctx.fillRect(cx + spec.w * off, baseY - legH, spec.w * 0.1, legH);
    }
    // Museau : donne la direction sans animation.
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(cx + spec.w * 0.42, baseY - legH - bodyH * 0.7);
    ctx.lineTo(cx + spec.w * 0.62, baseY - legH - bodyH * 0.4);
    ctx.lineTo(cx + spec.w * 0.42, baseY - legH - bodyH * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  // Liseré directionnel : la seule lumiere du jeu, rappelee sur chaque
  // volume. C'est ce qui « colle » l'objet a l'espace et pas au decalque.
  // Il est franc : c'est l'information de profondeur la moins ambigue.
  ctx.strokeStyle = `rgba(226,240,255,0.62)`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - spec.w * 0.34, baseY - spec.h * 0.94);
  ctx.lineTo(cx - spec.w * 0.34, baseY - spec.h * 0.3);
  ctx.stroke();

  // Contour sombre sur le reste du contour : sans lui, un volume clair
  // sur un sol clair se « decoupe » en pieces decollées.
  ctx.strokeStyle = 'rgba(0,0,0,0.62)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx + spec.w * 0.46, baseY - spec.h * 0.94);
  ctx.lineTo(cx + spec.w * 0.46, baseY - spec.h * 0.3);
  ctx.stroke();

  const out = { canvas: c, ax: cx, ay: baseY, w, h };
  cache.set(key, out);
  return out;
}

/** Decoupe de particule : simple, un seul degrade. */
export function mote(color = SEMANTIC.ANOMALY, size = 12) {
  return glow(size, color, 0.85);
}

export function hexAlpha(css, a) {
  if (css.startsWith('#')) {
    const n = parseInt(css.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return css.replace('hsl(', 'hsla(').replace(')', ` / ${a})`);
}

export function clearSpriteCache() {
  cache.clear();
}

export const ART_CONSTANTS = { LIGHT, FACE_VALUE, VALUE };