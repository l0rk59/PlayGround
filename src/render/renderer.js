/**
 * RENDU — camera, terrain, entites, effets.
 *
 * Regles de lisibilite appliquees a chaque image :
 *  - Le sol est dessine une fois dans un tampon, puis blitte. Un `fillRect`
 *    par tuile a 60 fps sur un telephone est ce qui tue le budget d'image.
 *  - Le decor ne depasse jamais la bande de valeur du sol : sinon les props
 *    « collent » et le joueur ne lit plus la profondeur.
 *  - La couleur ne porte jamais seule une information de gameplay. Chaque
 *    telegraphie a une forme, une pulsation et un son.
 */

import { ZONES, SEMANTIC, LIGHT, VALUE, READABILITY } from '../art/palette.js';
import { SILHOUETTE } from '../art/palette.js';
import { REGION, OBSTACLES, POIS } from '../data/world.js';
import { CAMERA, EXTRACTION } from '../data/tuning.js';
import { clamp, lerp } from '../core/util.js';
import { actorSprite, blobShadow, glow, ring, hexAlpha } from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cam = { x: REGION.spawn.x, y: REGION.spawn.y };
    this.shake = 0;
    this.shakeScale = 1;
    this.reducedEffects = false;
    this.zone = ZONES.valley;
    this.ground = null;
    this.groundKey = '';
    this.dpr = 1;
    this.view = { w: 0, h: 0 };
    this.flash = 0;
    this.hitStop = 0;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(200, Math.round(rect.height));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.view = { w, h };
    this.ground = null;
  }

  /* ------------------------------------------------------------- CAMERA -- */

  updateCamera(target, dt) {
    const k = 1 - Math.exp(-CAMERA.followLerp * dt);
    this.cam.x = lerp(this.cam.x, target.x + Math.cos(target.facing) * CAMERA.lookAhead, k);
    this.cam.y = lerp(this.cam.y, target.y + Math.sin(target.facing) * CAMERA.lookAhead, k);
    const b = REGION.bounds;
    const halfW = this.view.w / 2;
    const halfH = this.view.h / 2;
    this.cam.x = clamp(this.cam.x, b.minX + halfW, b.maxX - halfW);
    this.cam.y = clamp(this.cam.y, b.minY + halfH, b.maxY - halfH);
  }

  addShake(amount) {
    if (this.reducedEffects) amount *= 0.25;
    this.shake = Math.min(18, this.shake + amount * this.shakeScale);
  }

  /* -------------------------------------------------------------- SOL -- */

  /**
   * Le sol est un tampon unique de la taille du monde, rendu une fois par
   * zone. On ne repeint jamais 1024x1024 par image.
   */
  buildGround(zoneKey) {
    const b = REGION.bounds;
    const zone = ZONES[zoneKey] ?? ZONES.valley;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const tile = 128;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');

    // 1. LE SOL EST LA PAGE. Il doit pouvoir etre ennuyeux : c'est la
    //    bande de valeur qui occupe le plus de surface, sans contraste
    //    interne. Toute tache plus claire qu'un cran est une erreur.
    g.fillStyle = zone.ground;
    g.fillRect(0, 0, w, h);

    let seed = 20251012;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // 2. Grain de cendre, minuscule et tres bas contraste. Il donne la
    //    matiere sans creer de motif que l'oeil pourrait lire comme un objet.
    g.globalAlpha = 0.22;
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 1.5 + rnd() * 5;
      g.fillStyle = rnd() > 0.5 ? zone.groundAlt : zone.detail;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
      g.fill();
    }

    // 3. Routes : des chemins de terre plus SOMBRES, jamais plus clairs.
    //    Ce sont des lignes de conduite du regard, pas des decors.
    g.globalAlpha = 0.28;
    g.strokeStyle = zone.groundAlt;
    g.lineWidth = 44;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const poi of POIS) {
      // Chaque route part d'un point LEGEREMENT different du pad : sinon
      // toutes se reunissent en un asterisque qui se lit comme un motif,
      // pas comme un chemin.
      const jitter = 70;
      const sx = REGION.spawn.x + (rnd() - 0.5) * jitter;
      const sy = REGION.spawn.y + (rnd() - 0.5) * jitter;
      const mx = (sx + poi.x) / 2 + (rnd() - 0.5) * 300;
      const my = (sy + poi.y) / 2 + (rnd() - 0.5) * 300;
      // Route en troncons : les trous evitent le « rai » continu.
      for (let k = 0; k < 9; k++) {
        const t0 = k / 9 + rnd() * 0.02;
        const t1 = Math.min(1, t0 + 0.055 + rnd() * 0.045);
        g.beginPath();
        for (let t = t0; t <= t1; t += 0.02) {
          const it = 1 - t;
          const px = it * it * sx + 2 * it * t * mx + t * t * poi.x;
          const py = it * it * sy + 2 * it * t * my + t * t * poi.y;
          if (t === t0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.stroke();
      }
    }

    // 4. Habillage. Des props Parsemes, construits sur les trois faces du
    //    meme vecteur de lumiere. Ils occupent les extremes de la scene :
    //    c'est ce qui donne l'echelle et empeche le sol d'etre une page
    //    vide. Aucun n'est un obstacle de gameplay — ils sont hors du
    //    systeme de collision, sinon ils casseraient la lisibilite du combat.
    const rock = (x, y, rw, rh) => {
      g.globalAlpha = 0.9;
      g.fillStyle = `hsl(214 10% 12%)`;
      g.beginPath();
      g.ellipse(x + rw * 0.28, y + rh * 0.5, rw * 1.05, rh * 0.72, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `hsl(214 12% 33%)`;
      g.beginPath();
      g.ellipse(x, y, rw, rh, 0, Math.PI, Math.PI * 2);
      g.rect(x - rw, y, rw * 2, rh);
      g.fill();
      g.fillStyle = `hsl(210 14% 52%)`;
      g.beginPath();
      g.ellipse(x - rw * 0.22, y - rh * 0.28, rw * 0.5, rh * 0.4, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    };
    const trunk = (x, y, h) => {
      g.globalAlpha = 0.95;
      g.strokeStyle = `hsl(24 12% 11%)`;
      g.lineWidth = h * 0.16;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + h * 0.09, y);
      g.quadraticCurveTo(x + h * 0.06, y - h * 0.6, x - h * 0.04, y - h);
      g.stroke();
      g.strokeStyle = `hsl(24 14% 34%)`;
      g.lineWidth = h * 0.08;
      g.beginPath();
      g.moveTo(x + h * 0.03, y);
      g.quadraticCurveTo(x + h * 0.02, y - h * 0.6, x - h * 0.05, y - h * 0.96);
      g.stroke();
      g.lineWidth = h * 0.05;
      for (const a of [-0.7, 0.5, 1.2]) {
        g.beginPath();
        g.moveTo(x - h * 0.02, y - h * (0.72 + rnd() * 0.16));
        g.lineTo(x - h * 0.02 + Math.cos(a) * h * 0.3, y - h * (0.86 + rnd() * 0.2));
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    const mound = (x, y, r) => {
      g.globalAlpha = 0.55;
      g.fillStyle = zone.groundAlt;
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    };

    const clear = (x, y, pad) => {
      if (Math.hypot(x - REGION.spawn.x, y - REGION.spawn.y) < 260) return true;
      for (const o of OBSTACLES) {
        if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return true;
      }
      for (const poi of POIS) {
        if (Math.hypot(x - poi.x, y - poi.y) < poi.radius * 0.8) return true;
      }
      return false;
    };

    for (let i = 0; i < 340; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      if (clear(x, y, 70)) continue;
      const roll = rnd();
      if (roll < 0.5) rock(x, y, 9 + rnd() * 26, 5 + rnd() * 13);
      else if (roll < 0.74) trunk(x, y, 60 + rnd() * 110);
      else mound(x, y, 20 + rnd() * 46);
    }

    // 5. Bords du monde : un degrade sombre donne la limite sans mur invisible.
    g.globalAlpha = 1;
    const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.6);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    this.ground = c;
    this.groundKey = zoneKey;
    this.zone = zone;
  }

  /* ------------------------------------------------------------- DESSIN -- */

  draw(state, input) {
    const ctx = this.ctx;
    const { w, h } = this.view;
    const zoneKey = state.currentPoi?.kind === 'boss' ? 'anomaly' : 'valley';
    if (!this.ground || this.groundKey !== zoneKey) this.buildGround(zoneKey);

    if (this.shake > 0.2) this.shake *= 0.86;
    else this.shake = 0;

    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    const camX = Math.round(this.cam.x + sx);
    const camY = Math.round(this.cam.y + sy);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.zone.sky;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 - camX, h / 2 - camY);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.ground, 0, 0);

    this.drawObstacles(ctx);
    this.drawExtraction(ctx, state);
    this.drawPoiMarkers(ctx, state);
    this.drawHazards(ctx, state);
    this.drawShadows(ctx, state);
    this.drawPickups(ctx, state);
    this.drawActors(ctx, state);
    this.drawBoss(ctx, state);
    this.drawPlayer(ctx, state);
    this.drawCompanion(ctx, state);
    this.drawBullets(ctx, state);
    this.drawFx(ctx, state);

    ctx.restore();

    this.drawAtmosphere(ctx, w, h);
    if (input) this.drawTouchControls(ctx, input, w, h);
  }

  /* ------------------------------------------------------------ OBJETS -- */

  drawObstacles(ctx) {
    const zone = this.zone;
    for (const o of OBSTACLES) {
      // Ombre projetee dans le sens oppose a la lumiere, proportionnelle
      // a la hauteur apparente de l'objet.
      const off = o.h * 0.35;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(o.x - off * 0.5, o.y - off * 0.5 + off, o.w + off, o.h);

      // Volume a trois faces : face avant sombre, toit clair. Un obstacle
      // est un PROP, donc il doit porter les extremes de la scene.
      ctx.fillStyle = `hsl(28 14% 15%)`;
      ctx.fillRect(o.x, o.y - 16, o.w, o.h + 16);
      ctx.fillStyle = `hsl(28 12% 34%)`;
      ctx.fillRect(o.x, o.y - 16, o.w, 16);
      // Edge lumiere haut-gauche, toujours.
      ctx.strokeStyle = 'rgba(226,240,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(o.x - 1.5, o.y + o.h);
      ctx.lineTo(o.x - 1.5, o.y - 16);
      ctx.lineTo(o.x + o.w, o.y - 16);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w + 1.5, o.y + o.h);
      ctx.lineTo(o.x + o.w + 1.5, o.y - 16);
      ctx.stroke();
    }
  }

  drawExtraction(ctx, state) {
    const pad = REGION.extraction;
    const open = state.elapsed >= state.timeLimit;
    const pulse = 0.55 + 0.45 * Math.sin(state.elapsed * (open ? 5 : 1.6));
    const color = open ? SEMANTIC.HEAL : SEMANTIC.INTERACT;

    ctx.save();
    ctx.globalAlpha = open ? 0.85 : 0.3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glow(EXTRACTION.radius * 5, color, 0.5 * pulse), pad.x - EXTRACTION.radius * 2.5, pad.y - EXTRACTION.radius * 2.5);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.lineDashOffset = -state.elapsed * 30;
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, EXTRACTION.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (state.player.extractHold > 0) {
      const t = clamp(state.player.extractHold / EXTRACTION.holdSeconds, 0, 1);
      ctx.strokeStyle = SEMANTIC.HEAL;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, EXTRACTION.radius + 12, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
      ctx.stroke();
    }
  }

  drawPoiMarkers(ctx, state) {
    for (const poi of POIS) {
      const visited = state.visited.includes(poi.id);
      const isBoss = poi.kind === 'boss';
      // Un lieu visited ne disparait pas : il reste un point de retour
      // identifiable, sinon le joueur ne memorise pas la carte.
      const alpha = visited ? 0.28 : 0.62;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = isBoss ? SEMANTIC.BOSS : SEMANTIC.INTERACT;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.arc(poi.x, poi.y, poi.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = visited ? 0.5 : 0.95;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow(150, isBoss ? SEMANTIC.BOSS : SEMANTIC.INTERACT, visited ? 0.2 : 0.5), poi.x - 75, poi.y - 75);
      ctx.restore();

      // Un pictogramme par type : l'icone porte le sens, la couleur ne
      // le porte jamais seule.
      ctx.save();
      ctx.translate(poi.x, poi.y);
      ctx.strokeStyle = visited ? 'rgba(232,234,240,0.55)' : SEMANTIC.INTERACT_SOFT;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 3;
      const iconSize = isBoss ? 26 : 18;
      if (isBoss) {
        ctx.beginPath();
        ctx.moveTo(-iconSize, iconSize);
        ctx.lineTo(-iconSize, -iconSize * 0.4);
        ctx.lineTo(0, -iconSize);
        ctx.lineTo(iconSize, -iconSize * 0.4);
        ctx.lineTo(iconSize, iconSize);
        ctx.closePath();
        ctx.stroke();
      } else if (poi.kind === 'narrative') {
        ctx.beginPath();
        ctx.arc(0, 0, iconSize * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (poi.kind === 'optional') {
        ctx.beginPath();
        ctx.moveTo(0, -iconSize);
        ctx.lineTo(iconSize * 0.8, 0);
        ctx.lineTo(0, iconSize);
        ctx.lineTo(-iconSize * 0.8, 0);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(-iconSize * 0.7, -iconSize * 0.7, iconSize * 1.4, iconSize * 1.4);
      }
      ctx.restore();
    }
  }

  drawHazards(ctx, state) {
    for (const h of state.hazards) {
      const t = clamp(h.life / h.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.6 * t;
      ctx.fillStyle = SEMANTIC.DANGER;
      if (h.kind === 'beam') {
        ctx.translate(h.x, h.y);
        ctx.rotate(h.angle);
        ctx.fillRect(0, -h.width / 2, 340, h.width);
      } else if (h.kind === 'sweep') {
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.arc(h.x, h.y, h.radius, h.angle - h.width, h.angle + h.width);
        ctx.closePath();
        ctx.fill();
      } else if (h.kind === 'ring') {
        ctx.strokeStyle = SEMANTIC.ANOMALY;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * (1 - t), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------------------------------------------- TELEGRAPHIES -- */

  drawTelegraphs(ctx, state) {
    const drawCone = (x, y, facing, range, halfAngle, progress) => {
      const a = progress * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = 0.2 + a * 0.5;
      ctx.fillStyle = SEMANTIC.DANGER;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = SEMANTIC.DANGER_SOFT;
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -progress * 40;
      ctx.stroke();
      ctx.restore();
    };

    const drawCircle = (x, y, radius, progress) => {
      ctx.save();
      ctx.globalAlpha = 0.22 + progress * 0.45;
      ctx.strokeStyle = SEMANTIC.DANGER;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Remplissage progressif : la charge se lit meme sans couleur.
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = SEMANTIC.DANGER;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    for (const e of state.enemies) {
      if (e.state !== 'telegraph') continue;
      const def = e.def;
      const p = 1 - clamp(e.telegraphUntil / def.attackWindup, 0, 1);
      if (def.behavior === 'ranged') drawCone(e.x, e.y, e.facing, 320, 0.14, p);
      else if (def.behavior === 'station') drawCone(e.x, e.y, e.facing, 340, 0.1, p);
      else drawCircle(e.x, e.y, def.attackRange + e.radius, p);
    }

    const b = state.boss;
    if (b && b.state === 'telegraph') {
      const phase = b.def.phases[b.phase];
      const p = 1 - clamp(b.telegraphUntil / Math.max(0.01, phase.telegraph), 0, 1);
      if (phase.pattern === 'sweep') drawCone(b.x, b.y, b.facing, phase.radius ?? 340, 0.42, p);
      else if (phase.pattern === 'beam') {
        for (let i = -1; i <= 1; i++) drawCone(b.x, b.y, Math.atan2(state.player.y - b.y, state.player.x - b.x) + i * 0.42, 340, 0.055, p);
      } else drawCircle(b.x, b.y, 190, p);
    }
  }

  /* ------------------------------------------------------------ OMBRES -- */

  drawShadows(ctx, state) {
    const all = [...state.enemies, state.boss, state.companion].filter(Boolean);
    const s = blobShadow(56, 0.45);
    for (const e of all) {
      const spec = SILHOUETTE[e.def?.id] ?? SILHOUETTE.player;
      const off = spec.h * 0.18;
      ctx.globalAlpha = e.dead ? 0 : 1;
      ctx.drawImage(s, e.x - 28 - LIGHT.x * off * 0.5, e.y - 15 - LIGHT.y * off * 0.5);
    }
    const ps = blobShadow(48, 0.5);
    ctx.drawImage(ps, state.player.x - 24, state.player.y - 13);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glow(96, SEMANTIC.PLAYER, 0.22), state.player.x - 48, state.player.y - 48);
    ctx.restore();
  }

  /* ------------------------------------------------------------ ACTEURS -- */

  drawActor(ctx, e, spec, color, opts = {}) {
    const sprite = actorSprite({ ...spec, color, trim: opts.trim });
    // Le bob est derive du temps de partie : une phase stable, jamais un
    // Math.random par image qui ferait vibrer tout le monde.
    const t = opts.t ?? 0;
    const bob = e.dead || e.down > 0 ? 0 : Math.sin(t * 6 + (e.x | 0) * 0.01) * 1.6;
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow(110, '#ffffff', 0.55), e.x - 55, e.y - 80);
      ctx.restore();
    }
    ctx.save();
    if (e.invulnerable && e.kind === 'player') {
      // Les i-frames sont VISIBLES. Une invulnerabilite invisible teach
      // au joueur qu'il a perdu des PV au hasard.
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(ring(spec.w * 2.4, SEMANTIC.ANOMALY, 5), e.x - spec.w * 1.2, e.y - spec.h * 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.drawImage(sprite.canvas, e.x - sprite.ax, e.y - sprite.ay + bob);
    ctx.restore();
  }

  drawActors(ctx, state) {
    this.drawTelegraphs(ctx, state);
    for (const e of state.enemies) {
      const spec = SILHOUETTE[e.def.id] ?? SILHOUETTE.player;
      this.drawActor(ctx, e, spec, e.def.color, {
        t: state.elapsed,
        bubbles: e.family === 'errant' && e.def.id === 'plethore',
      });
    }
  }

  drawBoss(ctx, state) {
    const b = state.boss;
    if (!b) return;
    const phase = b.def.phases[b.phase];
    this.drawActor(ctx, b, SILHOUETTE.boss, b.def.color, { t: state.elapsed });
    // Barre de vie du boss : au-dessus de lui, jamais dans le HUD, pour
    // que l'information reste la ou l'oeil regarde.
    const w = 220;
    const x = b.x - w / 2;
    const y = b.y - SILHOUETTE.boss.h - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 3, y - 3, w + 6, 16);
    ctx.fillStyle = SEMANTIC.BOSS;
    ctx.fillRect(x, y, w * clamp(b.health / b.maxHealth, 0, 1), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    for (const th of b.def.phases.slice(1)) {
      ctx.beginPath();
      ctx.moveTo(x + w * th.from, y - 4);
      ctx.lineTo(x + w * th.from, y + 14);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232,234,240,0.85)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${b.def.name} — ${phase.name}`, b.x, y - 10);
    ctx.textAlign = 'left';
  }

  drawCompanion(ctx, state) {
    const c = state.companion;
    if (!c) return;
    const spec = SILHOUETTE.dog;
    if (c.down > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(actorSprite({ ...spec, color: SEMANTIC.COMPANION }).canvas, c.x - spec.w, c.y - spec.h * 0.6);
      ctx.restore();
      return;
    }
    this.drawActor(ctx, c, spec, SEMANTIC.COMPANION, { t: state.elapsed });
  }

  drawPlayer(ctx, state) {
    const p = state.player;
    const spec = SILHOUETTE.player;
    const tint = state.classDef.palette.body;
    this.drawActor(ctx, p, spec, tint, { trim: state.classDef.palette.trim, t: state.elapsed });
    if (p.marked > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(ring(70, SEMANTIC.INTERACT, 3), p.x - 35, p.y - 70);
      ctx.restore();
    }
  }

  drawPickups(ctx, state) {
    for (const it of state.pickups) {
      const rare = it.id !== 'scrap' && it.id !== 'ammo';
      const color = it.id === 'scrap' ? SEMANTIC.INTERACT : it.id === 'ration' ? SEMANTIC.HEAL : SEMANTIC.ANOMALY;
      const size = rare ? 22 : 15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow(size * 3, color, 0.4), it.x - size * 1.5, it.y - size * 1.5 - 6);
      ctx.restore();
      ctx.fillStyle = color;
      if (it.id === 'scrap') {
        ctx.translate(it.x, it.y - 6);
        ctx.rotate(0.6);
        ctx.fillRect(-size / 2, -size / 4, size, size / 2);
        ctx.rotate(-0.6);
        ctx.translate(-it.x, -(it.y - 6));
      } else {
        ctx.beginPath();
        ctx.arc(it.x, it.y - 6, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawBullets(ctx, state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bullets) {
      ctx.drawImage(glow(22, SEMANTIC.INTERACT_SOFT, 0.85), b.x - 11, b.y - 11);
      ctx.fillStyle = '#fff';
      ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    }
    for (const b of state.hostileBullets) {
      ctx.drawImage(glow(26, SEMANTIC.DANGER, 0.9), b.x - 13, b.y - 13);
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- FX -- */

  drawFx(ctx, state) {
    const fx = state.fx ?? [];
    ctx.save();
    for (const f of fx) {
      const t = 1 - f.life / f.maxLife;
      ctx.globalAlpha = 1 - t;
      if (f.kind === 'text') {
        ctx.font = `700 ${f.size ?? 16}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(f.text, f.x, f.y - t * 34);
        ctx.fillStyle = f.color ?? SEMANTIC.DANGER_SOFT;
        ctx.fillText(f.text, f.x, f.y - t * 34);
      } else if (f.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glow(f.size ?? 20, f.color ?? SEMANTIC.DANGER, 0.8), f.x - (f.size ?? 20) / 2, f.y - (f.size ?? 20) / 2);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------- ATMOSPHERE -- */

  drawAtmosphere(ctx, w, h) {
    // Brouillard de zone : deux couches, une froide et une chaude, pour que
    // la profondeur se lise meme sans ombres.
    const zone = this.zone;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, hexAlpha(zone.keyLight, 0.14 * zone.contrast + 0.05));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, this.flash);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      this.flash *= 0.82;
    }
  }

  /* ------------------------------------------------------- COMMANDES -- */

  drawTouchControls(ctx, input, w, h) {
    const st = input.stick;
    ctx.save();
    if (st.active) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = SEMANTIC.PLAYER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(st.originX, st.originY, st.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(232,234,240,0.22)';
      ctx.beginPath();
      ctx.arc(st.knobX, st.knobY, st.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    const drawBtn = (b, color, label) => {
      ctx.globalAlpha = b.pressed ? 1 : 0.72;
      ctx.fillStyle = b.pressed ? color : 'rgba(16,20,28,0.55)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = b.pressed ? '#0d1016' : color;
      ctx.font = `700 ${Math.round(b.r * 0.46)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, b.x, b.y + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      // Anneau de cooldown : l'information est dans l'anneau, pas dans une
      // icone qui disparait.
      if (b.cooldown > 0 && b.cooldownMax > 0) {
        const t = clamp(1 - b.cooldown / b.cooldownMax, 0, 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 6, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
        ctx.stroke();
      }
    };
    if (input.buttons.dodge) drawBtn(input.buttons.dodge, SEMANTIC.ANOMALY, '↷');
    if (input.buttons.ability) drawBtn(input.buttons.ability, SEMANTIC.INTERACT, '✦');
    if (input.buttons.heal) drawBtn(input.buttons.heal, SEMANTIC.HEAL, '+');
    ctx.restore();
  }

  /* ----------------------------------------------------- HUD MONDE -- */

  drawWorldHud(ctx, state, w, h) {
    const p = state.player;
    const pad = 18;
    const barW = Math.min(260, w * 0.42);
    const barH = 14;

    ctx.save();
    ctx.fillStyle = 'rgba(6,8,12,0.62)';
    roundRect(ctx, pad, pad, barW, barH + 16, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, pad + 3, pad + 3, barW - 6, barH - 6, 5);
    ctx.fill();
    const hpRatio = clamp(p.health / p.maxHealth, 0, 1);
    ctx.fillStyle = hpRatio > 0.5 ? SEMANTIC.HEAL : hpRatio > 0.22 ? SEMANTIC.INTERACT : SEMANTIC.DANGER;
    roundRect(ctx, pad + 3, pad + 3, (barW - 6) * hpRatio, barH - 6, 5);
    ctx.fill();

    // Vigueur : trois segments,lus sans couleur.
    const segW = (barW - 6) / p.staminaMax;
    for (let i = 0; i < p.staminaMax; i++) {
      ctx.fillStyle = i < Math.floor(p.stamina) ? SEMANTIC.ANOMALY : 'rgba(79,214,200,0.16)';
      ctx.fillRect(pad + 3 + i * segW + 2, pad + barH + 1, segW - 4, 4);
    }

    // Temps avant ouverture du pad : une barre, pas un chiffre.
    const remain = clamp(1 - state.elapsed / state.timeLimit, 0, 1);
    ctx.fillStyle = 'rgba(6,8,12,0.55)';
    roundRect(ctx, pad, pad + barH + 22, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = remain < 0.2 ? SEMANTIC.INTERACT : 'rgba(240,180,41,0.55)';
    roundRect(ctx, pad + 2, pad + barH + 24, (barW - 4) * remain, 4, 2);
    ctx.fill();

    ctx.restore();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export { READABILITY };