/**
 * ANIMATION — poses et cycles, pré-rendus une fois.
 *
 * Un personnage qui glisse sur le sol en oscillant de deux pixels n'est pas
 * un personnage animé : c'est une image qui dérive. Ce qui fait la
 * différence à ce budget, c'est le **contact des pieds** — une silhouette
 * qui décolle du sol à chaque demi-cycle n'est plus crédible, quel que soit
 * le reste.
 *
 * Tout est pré-rendu dans des canvas hors écran au premier appel, puis
 * blitté. Une frame = un `drawImage`.
 */

import { shade } from '../art/palette.js';

const cache = new Map();

/**
 * Profil de marche. Renvoie, pour une phase dans [0,1), la position de
 * chaque jambe et le.Teinte du buste.
 *
 * Quatre temps : contact, passage, contact oppose, passage. Le buste
 * monte de deux fois plus vite que les jambes — c'est ce micro-rebond qui donne
 * la impression qu'il y a du poids dans le personnage.
 */
export function walkPose(phase, opts = {}) {
  const amp = opts.amp ?? 1;
  const p = phase % 1;
  const a = Math.sin(p * Math.PI * 2);
  const b = Math.sin(p * Math.PI * 2 + Math.PI);
  // La foulée ne doit JAMAIS depasser la longueur de la jambe : sinon le
  // personnage se retrouve en fente et la silhouette lit « pantin »
  // au lieu de « marcheur ».
  return {
    front: a * 3.4 * amp,
    back: b * 3.4 * amp,
    lift: (Math.max(0, b) * 2.2 + Math.max(0, a) * 0.7) * amp,
    bob: -Math.abs(a) * 1.5 * amp - 0.6 * amp,
    lean: a * 0.028 * amp,
    armSwing: -a * 2.6 * amp,
    squash: 1 + Math.sin(p * Math.PI * 4) * 0.018 * amp,
  };
}

/**
 * Wobble de masse informe (blobs) : le corps se comprime et s'etire, c'est
 * la seule animation lisible pour une forme sans membres.
 */
export function blobPose(phase) {
  const p = phase % 1;
  const s = Math.sin(p * Math.PI * 2);
  const c = Math.cos(p * Math.PI * 4);
  return {
    squash: 1 + c * 0.07,
    stretch: 1 - c * 0.05,
    lean: s * 0.06,
    bob: -Math.abs(s) * 2.2,
    front: s * 3,
    back: -s * 3,
    lift: 0,
    armSwing: 0,
  };
}

/** Galop : quatre membres en deux phases opposees. */
export function quadPose(phase) {
  const p = phase % 1;
  const a = Math.sin(p * Math.PI * 2);
  const b = Math.sin(p * Math.PI * 2 + Math.PI);
  return {
    frontA: a * 4.5,
    frontB: -a * 4.5,
    backA: b * 4.5,
    backB: -b * 4.5,
    bob: -Math.abs(a) * 2.4,
    lean: 0.02 + Math.abs(a) * 0.02,
    squash: 1 + Math.sin(p * Math.PI * 4) * 0.02,
  };
}

/**
 * Feuille de sprites : N frames rendues en une seule image, pour un seul
 * `drawImage` avec un sous-rectangle. C'est ce qui permet de faire tourner
 * quarante actors animés sans jamais hanger le budget d'image.
 */
export class FrameSheet {
  constructor(frames, w, h, ax, ay) {
    this.frames = frames;
    this.w = w;
    this.h = h;
    this.ax = ax;
    this.ay = ay;
    this.count = frames.length;
    const sheet = document.createElement('canvas');
    // `frames.length`, pas `frames` : multiplier par un tableau donne NaN,
    // et un canvas de largeur NaN devient un canvas de largeur zero — le
    // sprite entier disparait sans lever la moindre erreur lisible.
    sheet.width = Math.max(1, Math.round(w * frames.length));
    sheet.height = Math.max(1, Math.round(h));
    const ctx = sheet.getContext('2d');
    for (let i = 0; i < frames.length; i++) {
      ctx.drawImage(frames[i], i * w, 0);
    }
    this.canvas = sheet;
  }

  draw(ctx, index, x, y, scale = 1) {
    const i = ((index % this.count) + this.count) % this.count;
    ctx.drawImage(
      this.canvas,
      i * this.w,
      0,
      this.w,
      this.h,
      x - this.ax * scale,
      y - this.ay * scale,
      this.w * scale,
      this.h * scale,
    );
  }
}

/* ------------------------------------------------- ACTEUR HUMANOIDE -- */

/**
 * Dessine un humanoïde sur un frame donné.
 *
 * Ordre de lecture : jambe arriere, torse, bras arriere, tete, bras avant,
 * jambe avant. L'entrelacement des membres est ce qui donne la profondeur —
 * un membre devant Cache par-dessus le torse, un membre derrière dessous.
 */
export function drawHumanoid(ctx, w, h, ax, ay, spec, color, pose, opts = {}) {
  const cx = ax;
  const baseY = ay;
  const tall = spec.shape === 'tall';
  const top = shade(color, 1.0);
  const right = shade(color, 0.66);
  const left = shade(color, 0.42);
  const outline = 'rgba(0,0,0,0.62)';

  // Proportions : le buste doit etre la masse dominante de la silhouette.
  // Un buste etroit avec de longues jambes et de bras ecartes se lit comme
  // un pantin ; un buste large, des jambes courtes et des bras gums donne
  // un personnage qui tient debout a 40 pixels.
  const bodyW = spec.w * (tall ? 0.62 : 0.78);
  const legH = spec.h * (tall ? 0.4 : 0.34);
  const torsoH = spec.h * (tall ? 0.34 : 0.36);
  const headR = spec.w * 0.27;

  ctx.save();
  ctx.translate(cx, baseY + (pose.bob ?? 0));
  ctx.rotate(pose.lean ?? 0);

  // Jambes : deux segments (cuisse + tibia) pour que le pli existe.
  const leg = (dir, side, back) => {
    const hipX = side * bodyW * 0.2;
    const lift = back ? 0 : pose.lift * 0.6;
    const footX = hipX + dir * 1.5;
    const kneeX = hipX + dir * 0.8;
    ctx.strokeStyle = back ? left : shade(color, 0.5);
    ctx.lineWidth = bodyW * 0.19;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, -legH);
    ctx.lineTo(kneeX, -legH * 0.5);
    ctx.lineTo(footX, -lift);
    ctx.stroke();
    // Pied : un petit bloc, marque pour la lecture du contact.
    ctx.fillStyle = back ? shade(color, 0.36) : shade(color, 0.46);
    ctx.fillRect(footX - bodyW * 0.13, -lift - bodyW * 0.07, bodyW * 0.28, bodyW * 0.09);
  };

  leg(pose.back ?? 0, -1, true);
  leg(pose.front ?? 0, 1, false);

  // Torse : epaule → taille → hanche, avec le pan de manteau.
  // Le manteau s'arrete au-dessus du genou : sinon il masque les jambes et
  // la silhouette perd son appui au sol.
  const hemY = -legH * 1.16;
  const shoulderY = hemY - torsoH;
  const shoulderW = bodyW * 1.0;
  const hemW = bodyW * 1.08;

  ctx.beginPath();
  ctx.moveTo(-shoulderW / 2, shoulderY + torsoH * 0.2);
  ctx.lineTo(-shoulderW * 0.36, shoulderY);
  ctx.lineTo(shoulderW * 0.36, shoulderY);
  ctx.lineTo(shoulderW / 2, shoulderY + torsoH * 0.2);
  ctx.lineTo(bodyW * 0.5, -legH * 0.78);
  ctx.lineTo(hemW / 2, hemY);
  ctx.lineTo(-hemW / 2, hemY);
  ctx.lineTo(-bodyW * 0.5, -legH * 0.78);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Modele interne : la couture du manteau, cote ombre.
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(shoulderW * 0.1, shoulderY);
  ctx.lineTo(shoulderW / 2, shoulderY + torsoH * 0.2);
  ctx.lineTo(bodyW * 0.5, -legH * 0.78);
  ctx.lineTo(hemW / 2, hemY);
  ctx.lineTo(hemW * 0.16, hemY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(shoulderW * 0.06, shoulderY + torsoH * 0.16);
  ctx.lineTo(bodyW * 0.06, -legH * 0.8);
  ctx.stroke();

  // Bras : ils TOMBENT le long du buste et balancent. Un bras trace de
  // l'epaule vers le dehors a l'horizontale donne une silhouette
  // d'epouvantail — la pose par defaut de la majorite des acteurs de
  // cette taille. Le coude est le point de lecture du mouvement.
  const arm = (side, back) => {
    const sw = pose.armSwing ?? 0;
    const sx = side * shoulderW * 0.4;
    const sy = shoulderY + torsoH * 0.16;
    const elbowX = sx + side * (1.4 + sw * 0.18);
    const elbowY = sy + torsoH * 0.42;
    const handX = sx + side * (0.9 + sw * 0.42);
    const handY = sy + torsoH * 0.88;
    ctx.strokeStyle = back ? left : shade(color, 0.54);
    ctx.lineWidth = bodyW * 0.15;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(elbowX, elbowY, handX, handY);
    ctx.stroke();
    ctx.fillStyle = back ? left : shade(color, 0.62);
    ctx.beginPath();
    ctx.arc(handX, handY, bodyW * 0.085, 0, Math.PI * 2);
    ctx.fill();
    return { handX, handY };
  };

  if (tall) {
    // La Pleureuse : bras trop longs, c'est sa signature.
    arm(-1, true);
    arm(1, true);
  } else {
    arm(-1, true);
  }

  // Cou + tete.
  ctx.fillStyle = left;
  ctx.fillRect(-bodyW * 0.1, shoulderY - headR * 0.34, bodyW * 0.2, headR * 0.4);
  const headY = shoulderY - headR * 0.86;
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(0, headY, headR * 0.92, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Ombre du crane, cote oppose a la lumiere.
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.ellipse(headR * 0.3, headY + headR * 0.08, headR * 0.6, headR * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bras avant. Le joueur tient son arme dans cette main : c'est la seule
  // information de posture qui distingue sa classe a l'ecran.
  const front = tall ? null : arm(1, false);
  if (front && opts.weapon) {
    ctx.save();
    ctx.translate(front.handX, front.handY);
    ctx.rotate(-0.5 + (pose.armSwing ?? 0) * 0.012);
    ctx.fillStyle = '#1b1f28';
    ctx.fillRect(-bodyW * 0.07, 0, bodyW * 0.14, bodyW * 0.95);
    ctx.fillStyle = '#3a4354';
    ctx.fillRect(-bodyW * 0.07, 0, bodyW * 0.05, bodyW * 0.95);
    ctx.restore();
  }

  // Liseré de lumiere sur l'arete exposee (haut-gauche).
  ctx.strokeStyle = 'rgba(226,240,255,0.5)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-shoulderW * 0.36, shoulderY + 1);
  ctx.lineTo(-shoulderW * 0.5, shoulderY + torsoH * 0.22);
  ctx.lineTo(-bodyW * 0.5, -legH * 0.78);
  ctx.lineTo(-hemW / 2, hemY);
  ctx.stroke();

  ctx.restore();
  void opts;
  void w;
  void h;
  void outline;
}

/* ------------------------------------------------------------- GLOBE -- */

export function drawBlob(ctx, ax, ay, spec, color, pose, opts = {}) {
  const cx = ax;
  const baseY = ay + (pose.bob ?? 0);
  const rx = (spec.w / 2) * pose.squash;
  const ry = (spec.h / 2) * pose.stretch;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(pose.lean ?? 0);

  const g = ctx.createRadialGradient(-rx * 0.4, -ry * 0.8, rx * 0.1, 0, 0, rx * 1.2);
  g.addColorStop(0, shade(color, 1.18));
  g.addColorStop(0.5, shade(color, 0.85));
  g.addColorStop(1, shade(color, 0.36));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -ry, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Bubbles / pustules : elles suivent la deformation, sinon le corps
  // parait translate au lieu de respirer.
  const t = opts.t ?? 0;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const px = Math.cos(a) * rx * 0.46 * pose.squash;
    const py = -ry + Math.sin(a) * ry * 0.46 * pose.stretch;
    const pr = rx * (0.13 + 0.05 * Math.sin(t * 2 + i));
    ctx.fillStyle = shade(color, 1.3);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(color, 0.4);
    ctx.beginPath();
    ctx.arc(px + pr * 0.35, py + pr * 0.4, pr * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------------------------------------------- QUADRUPEDE -- */

export function drawQuad(ctx, ax, ay, spec, color, pose, opts = {}) {
  const cx = ax;
  const baseY = ay + (pose.bob ?? 0);
  const bodyLen = spec.w * 0.52;
  const bodyH = spec.h * 0.52;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(pose.lean ?? 0);

  const legs = [
    [pose.frontA, -bodyLen * 0.5, true],
    [pose.backA, -bodyLen * 0.28, true],
    [pose.frontB, bodyLen * 0.28, false],
    [pose.backB, bodyLen * 0.5, false],
  ];
  ctx.strokeStyle = shade(color, 0.44);
  ctx.lineWidth = spec.h * 0.13;
  ctx.lineCap = 'round';
  for (const [off, x, back] of legs) {
    ctx.beginPath();
    ctx.moveTo(x, -bodyH * 0.55);
    ctx.lineTo(x + off * 0.4, 0);
    ctx.stroke();
    ctx.fillStyle = shade(color, 0.5);
    ctx.fillRect(x + off * 0.4 - spec.h * 0.08, -spec.h * 0.05, spec.h * 0.16, spec.h * 0.06);
    void back;
  }

  const g = ctx.createLinearGradient(0, -bodyH * 1.3, 0, -bodyH * 0.2);
  g.addColorStop(0, shade(color, 1.14));
  g.addColorStop(1, shade(color, 0.42));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -bodyH * 0.85, bodyLen, bodyH * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Museau : la direction se lit sans animation.
  ctx.fillStyle = shade(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.72, -bodyH * 1.05);
  ctx.lineTo(bodyLen * 1.22, -bodyH * 0.78);
  ctx.lineTo(bodyLen * 0.72, -bodyH * 0.5);
  ctx.closePath();
  ctx.fill();

  // Yeux : deux points clairs. Un ennemi sans regard n'est pas une menace.
  ctx.fillStyle = 'rgba(255,236,200,0.92)';
  const eye = opts.angry ? 1.6 : 1.2;
  ctx.beginPath();
  ctx.arc(bodyLen * 0.5, -bodyH * 1.02, eye, 0, Math.PI * 2);
  ctx.arc(bodyLen * 0.3, -bodyH * 1.0, eye, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,6,6,0.9)';
  ctx.beginPath();
  ctx.arc(bodyLen * 0.55, -bodyH * 1.0, eye * 0.5, 0, Math.PI * 2);
  ctx.arc(bodyLen * 0.33, -bodyH * 0.99, eye * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ------------------------------------------------------ CONSTRUCTION -- */

const FRAMES = 8;

/**
 * Construit (et met en cache) la feuille de marche d'un acteur.
 * `kind` : 'humanoid' | 'tall' | 'blob' | 'quad'.
 */
export function actorSheet(kind, spec, color) {
  const key = `sheet:${kind}:${color}:${spec.w}:${spec.h}`;
  if (cache.has(key)) return cache.get(key);

  const w = Math.max(16, Math.round(spec.w + 28));
  const h = Math.max(24, Math.round(spec.h + 34));
  const ax = w / 2;
  const ay = h - 10;
  const frames = [];

  for (let i = 0; i < FRAMES; i++) {
    const phase = i / FRAMES;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.lineJoin = 'round';
    if (kind === 'blob') drawBlob(g, ax, ay, spec, color, blobPose(phase));
    else if (kind === 'quad') drawQuad(g, ax, ay, spec, color, quadPose(phase), { angry: true });
    else drawHumanoid(g, w, h, ax, ay, { ...spec, shape: kind }, color, walkPose(phase), {
      weapon: kind === 'humanoid' && spec.w < 40,
    });
    frames.push(c);
  }

  const sheet = new FrameSheet(frames, w, h, ax, ay);
  sheet.framesCount = FRAMES;
  cache.set(key, sheet);
  return sheet;
}

export function clearAnimCache() {
  cache.clear();
}