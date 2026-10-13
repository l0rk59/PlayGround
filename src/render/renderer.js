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
import { actorSheet } from './anim.js';
import { groundTile, anomalyTile, Motes } from './texture.js';

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
    /**
     * Zoom camera. Un acteur de 42 unites dans une vue de 900 haut fait
     * 4 % de l'ecran : on ne lit ni ses membres ni son orientation. On
     * zoome donc la PRESENTATION, pas la simulation — aucune regle de
     * jeu ne depend de l'echelle.
     */
    this.zoom = 1.45;
    /** Poussieres en suspension : une couche, recyclee, jamais allouee par image. */
    this.motes = new Motes(150);
    this.motesReady = false;
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
    const halfW = this.view.w / (2 * this.zoom);
    const halfH = this.view.h / (2 * this.zoom);
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

    // 1. Le sol, c'est une MATIERE. On peint une tuile raccordable, puis on
    //    la repete sur toute la region. Un aplat uni donne immediatement
    //    l'impression d'une maquette, meme avec de beaux personnages.
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');

    const tile = zoneKey === 'anomaly' ? anomalyTile(zone, 256) : groundTile(zone, 256);
    const pattern = g.createPattern(tile, 'repeat');
    g.fillStyle = pattern;
    g.fillRect(0, 0, w, h);

    // 2. Deux passes de valeur grande echelle : des zones plus claires et
    //    plus sombres. C'est ce qui arrete la repetition de se voir.
    let seed = zone.seed ^ 0x5f3759df;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (const [count, radius, color, alpha] of [
      [26, 340, zone.detail, 0.1],
      [22, 420, zone.sky, 0.16],
    ]) {
      for (let i = 0; i < count; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = radius * (0.6 + rnd() * 0.8);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, hexAlpha(color, alpha));
        rg.addColorStop(1, hexAlpha(color, 0));
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }

    // 3. Routes : plus SOMBRES, en troncons, avec un point de depart decale
    //    par route. Sans ces trois details, on lit un asterisque, pas un chemin.
    // Pistes de poussiere CLAIRES. Une route qui assombrit le sol devient
    // une salete a l'ecran : le regard y va au lieu de suivre le joueur.
    g.globalAlpha = 0.13;
    g.strokeStyle = zone.detail;
    g.lineWidth = 54;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const poi of POIS) {
      const sx = REGION.spawn.x + (rnd() - 0.5) * 80;
      const sy = REGION.spawn.y + (rnd() - 0.5) * 80;
      const mx = (sx + poi.x) / 2 + (rnd() - 0.5) * 300;
      const my = (sy + poi.y) / 2 + (rnd() - 0.5) * 300;
      for (let k = 0; k < 10; k++) {
        const t0 = k / 10 + rnd() * 0.02;
        const t1 = Math.min(1, t0 + 0.05 + rnd() * 0.05);
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
    g.globalAlpha = 1;

    // 4. Habillage : des props qui portent les extremes de la scene. Sans
    //    eux, le sol est une page et la profondeur n'existe pas.
    this.paintProps(g, zone, rnd);

    // 5. Limite du monde.
    const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.6);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    this.ground = c;
    this.groundKey = zoneKey;
    this.zone = zone;
  }

  /** Rochers, arbres morts, souches : chacun sur les trois faces. */
  paintProps(g, zone, rnd) {
    const w = REGION.bounds.maxX;
    const h = REGION.bounds.maxY;

    const shadowOf = (x, y, rx, ry, a) => {
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.beginPath();
      g.ellipse(x + rx * 0.34, y + ry * 0.42, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    };

    const rock = (x, y, rw, rh) => {
      // Contour irregulier : une ellipse parfaite se lit comme un galet
      // de billard, pas comme une roche.
      const pts = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const k = 0.74 + rnd() * 0.5;
        pts.push([Math.cos(a) * rw * k, Math.sin(a) * rh * k * 0.92]);
      }
      const path = (ox, oy) => {
        g.beginPath();
        g.moveTo(x + pts[0][0] + ox, y + pts[0][1] + oy);
        for (let i = 1; i < n; i++) {
          const p = pts[i];
          const q = pts[(i + 1) % n];
          g.quadraticCurveTo(x + p[0] + ox, y + p[1] + oy, x + (p[0] + q[0]) / 2 + ox, y + (p[1] + q[1]) / 2 + oy);
        }
        g.closePath();
      };
      shadowOf(x, y + rh * 0.4, rw * 1.05, rh * 0.55, 0.3);
      path(0, rh * 0.18);
      g.fillStyle = 'hsl(214 10% 11%)';
      g.fill();
      path(0, 0);
      g.fillStyle = 'hsl(214 11% 22%)';
      g.fill();
      path(0, -rh * 0.22);
      g.fillStyle = 'hsl(210 13% 38%)';
      g.fill();
      // Facette d'aération : le meme vecteur de lumiere, en une valeur de plus.
      path(-rw * 0.24, -rh * 0.4);
      g.fillStyle = 'hsl(206 16% 52%)';
      g.fill();
    };

    const trunk = (x, y, th) => {
      shadowOf(x, y, th * 0.2, th * 0.07, 0.34);
      const branch = (bx, by, len, ang, wdt, depth) => {
        const ex = bx + Math.cos(ang) * len;
        const ey = by + Math.sin(ang) * len;
        g.strokeStyle = depth > 1 ? 'hsl(24 10% 15%)' : 'hsl(24 12% 24%)';
        g.lineWidth = wdt;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(bx + Math.cos(ang - 0.2) * len * 0.6, by + Math.sin(ang - 0.2) * len * 0.6, ex, ey);
        g.stroke();
        // Liseré clair cote lumiere.
        g.strokeStyle = 'rgba(226,240,255,0.16)';
        g.lineWidth = Math.max(0.8, wdt * 0.28);
        g.beginPath();
        g.moveTo(bx - wdt * 0.22, by);
        g.lineTo(ex - wdt * 0.2, ey);
        g.stroke();
        if (depth <= 0) return;
        const forks = depth > 2 ? 2 : 3;
        for (let i = 0; i < forks; i++) {
          branch(ex, ey, len * (0.52 + rnd() * 0.2), ang + (rnd() - 0.5) * 1.5 + (i - 1) * 0.5, wdt * 0.58, depth - 1);
        }
      };
      branch(x, y, th * 0.42, -Math.PI / 2 + (rnd() - 0.5) * 0.22, th * 0.2, 3);
    };

    const stump = (x, y, r) => {
      shadowOf(x, y + r * 0.3, r * 1.1, r * 0.4, 0.3);
      g.fillStyle = 'hsl(24 12% 17%)';
      g.beginPath();
      g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'hsl(26 16% 34%)';
      g.beginPath();
      g.ellipse(x, y - r * 0.22, r * 0.92, r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'hsl(26 18% 46%)';
      g.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        g.beginPath();
        g.ellipse(x, y - r * 0.22, r * 0.92 * (i / 3), r * 0.5 * (i / 3), 0, 0, Math.PI * 2);
        g.stroke();
      }
    };

    const clear = (x, y, pad) => {
      if (Math.hypot(x - REGION.spawn.x, y - REGION.spawn.y) < 240) return true;
      for (const o of OBSTACLES) {
        if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return true;
      }
      for (const poi of POIS) {
        if (Math.hypot(x - poi.x, y - poi.y) < poi.radius * 0.75) return true;
      }
      return false;
    };

    for (let i = 0; i < 460; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      if (clear(x, y, 60)) continue;
      const roll = rnd();
      if (roll < 0.4) rock(x, y, 8 + rnd() * 30, 5 + rnd() * 16);
      else if (roll < 0.62) trunk(x, y, 52 + rnd() * 120);
      else if (roll < 0.82) stump(x, y, 7 + rnd() * 15);
      else {
        // Touffe d'herbe morte : trois courbes, rien de plus.
        g.strokeStyle = `hsl(${28 + rnd() * 14} 12% ${18 + rnd() * 8}%)`;
        g.lineWidth = 1.2;
        for (let b = 0; b < 4; b++) {
          const lean = (rnd() - 0.5) * 8;
          g.beginPath();
          g.moveTo(x + b * 2, y);
          g.quadraticCurveTo(x + b * 2 + lean * 0.5, y - 7, x + b * 2 + lean, y - 12 - rnd() * 6);
          g.stroke();
        }
      }
    }
    void zone;
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

    // Zoom porte par la transformee elle-meme : un seul point de depart
    // pour le monde, et un reset net avant l'interface en espace ecran.
    const z = this.zoom;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(z, z);
    ctx.translate(-camX, -camY);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.ground, 0, 0);

    this.drawObstacles(ctx);
    this.drawMotes(ctx, state);
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
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

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

  /**
   * TELEGRAPHIES.
   *
   * La forme dit QUEL coup, la pulsation dit QUAND. Un cercle plein pour
   * tout le monde ne donne aucune information : le joueur ne peut ni se
   * placer ni choisir une esquive, il peut seulement courir.
   *
   *   disc  — frappe au corps a corps, zone ronde centree sur l'ennemi
   *   burst — explosion, cercle large a double anneau
   *   line  — tir rapide, cône très étroit dans la direction visée
   *   beam  — faisceau, rectangle long et étroit
   *   sweep — balayage du boss, secteur très large
   *
   * La couleur reste identique partout : elle signifie « danger », pas
   * « quel coup ». C'est la forme qui porte la difference.
   */
  drawTelegraphs(ctx, state) {
    const frame = (shape, x, y, facing, size, progress, strong) => {
      const charge = progress * progress;
      ctx.save();
      // Remplissage volontairement faible : cinq zones superposees
      // masqueraient completement le joueur, qui est justement ce qu'on
      // doit voir au moment de la telegraphie.
      const base = 0.1 + charge * 0.24;
      ctx.fillStyle = SEMANTIC.DANGER;
      ctx.strokeStyle = SEMANTIC.DANGER_SOFT;

      if (shape === 'disc' || shape === 'burst') {
        const r = size;
        ctx.globalAlpha = base * (strong ? 1.15 : 1);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + charge * 0.5;
        ctx.lineWidth = shape === 'burst' ? 5 : 3;
        ctx.setLineDash(shape === 'burst' ? [12, 8] : []);
        ctx.stroke();
        if (shape === 'burst') {
          // Double anneau : l'explosion est plus large et plus lente.
          ctx.globalAlpha = 0.35 + charge * 0.45;
          ctx.beginPath();
          ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Remplissage qui se remplit : la charge se lit meme sans couleur.
        ctx.globalAlpha = 0.14 + charge * 0.24;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else if (shape === 'line' || shape === 'beam') {
        const len = size;
        const half = shape === 'beam' ? 15 : size * 0.09;
        ctx.translate(x, y);
        ctx.rotate(facing);
        ctx.globalAlpha = base * 0.9;
        ctx.fillRect(0, -half, len, half * 2);
        ctx.globalAlpha = 0.55 + charge * 0.45;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -half);
        ctx.lineTo(len, -half);
        ctx.moveTo(0, half);
        ctx.lineTo(len, half);
        ctx.stroke();
        if (shape === 'beam') {
          // Traits de charge le long du faisceau : on voit venir.
          ctx.globalAlpha = 0.3 + charge * 0.5;
          ctx.lineWidth = 3;
          const seg = 26;
          for (let d = 30; d < len; d += seg) {
            if ((d / seg) % 2) continue;
            ctx.beginPath();
            ctx.moveTo(d, -half);
            ctx.lineTo(d + seg * 0.6, -half);
            ctx.moveTo(d, half);
            ctx.lineTo(d + seg * 0.6, half);
            ctx.stroke();
          }
        }
      } else if (shape === 'sweep') {
        ctx.globalAlpha = base * 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, size, facing - half, facing + half);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.5 + charge * 0.5;
        ctx.lineWidth = 4;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -progress * 60;
        ctx.stroke();
      }
      ctx.restore();
    };

    for (const e of state.enemies) {
      if (e.state !== 'telegraph') continue;
      const def = e.def;
      const p = 1 - clamp(e.telegraphUntil / def.attackWindup, 0, 1);
      const shape = def.tell ?? 'disc';
      const size = shape === 'disc' ? def.attackRange + e.radius : shape === 'burst' ? def.attackRange * 2.2 : shape === 'beam' ? 340 : 320;
      frame(shape, e.x, e.y, e.facing, size, p, def.tell === 'burst');
    }

    const b = state.boss;
    if (b && b.state === 'telegraph') {
      const phase = b.def.phases[b.phase];
      const p = 1 - clamp(b.telegraphUntil / Math.max(0.01, phase.telegraph), 0, 1);
      const aim = Math.atan2(state.player.y - b.y, state.player.x - b.x);
      if (phase.pattern === 'sweep') frame('sweep', b.x, b.y, b.facing, phase.radius ?? 340, p);
      else if (phase.pattern === 'beam') for (let i = -1; i <= 1; i++) frame('beam', b.x, b.y, aim + i * 0.42, 340, p);
      else frame('burst', b.x, b.y, aim, 190, p);
    }
  }

  /**
   * Poussières en suspension. Une seule couche, pool fixe, recyclé : c'est
   * ce qui donne de la profondeur à une scène sans nulla sur le budget.
   *
   * Elles vivent dans l'espace ÉCRAN, pas dans le monde : si elles suivaient
   * la caméra exactement, on lirait le décalage au lieu du décor. Le vent
   * leur donne une vitesse propre.
   */
  drawMotes(ctx, state) {
    if (!this.motesReady) {
      this.motes.reset(Math.random, this.view.w, this.view.h);
      this.motesReady = true;
    }
    this.motes.step(1 / 60, this.view.w, this.view.h, state.elapsed);
    const wind = state.elapsed * 9;
    this.motes.draw(
      ctx,
      glow(10, '#dfe7f2', 0.9),
      this.view,
      this.reducedEffects ? 0.16 : 0.32,
      -((this.cam.x * this.zoom) % this.view.w) - wind * 0.4,
      -((this.cam.y * this.zoom) % this.view.h) + wind * 0.25,
    );
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

  /**
   * Dessine un acteur anime.
   *
   * La phase du cycle est derivee de la POSITION, pas d'un compteur : le
   * personnage marche exactement a la vitesse a laquelle il se deplace,
   * sans qu'aucun etat d'animation ne soit stocke par entite. Le pied
   * glisse donc exactement autant que le corps.
   */
  drawActor(ctx, e, spec, color, opts = {}) {
    const kind = spec.shape;
    const sheet = actorSheet(kind, spec, color);
    const t = opts.t ?? 0;

    // Phase : la distance parcourue pilote le cycle. La graine par acteur
    // evite que toute une vague marche enperfectionsynchronisee.
    const seed = ((e.id?.length ?? 0) * 7 + Math.round(e.x * 0.001)) % sheet.framesCount;
    const phase = ((e.x * 0.055 + e.y * 0.031 + seed * 1.7) / sheet.w + 1) % 1;
    const frame = Math.floor(phase * sheet.framesCount);

    // Facing : on retourne la feuille plutot que de redessiner une pose.
    const flip = Math.cos(e.facing ?? -Math.PI / 2) < 0;

    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow(120, '#ffffff', 0.6), e.x - 60, e.y - 90);
      ctx.restore();
    }

    ctx.save();
    if (e.invulnerable && e.kind === 'player') {
      // Les i-frames sont VISIBLES. Une invulnerabilite invisible apprend
      // au joueur qu'il perd des PV au hasard.
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(ring(spec.w * 2.4, SEMANTIC.ANOMALY, 5), e.x - spec.w * 1.2, e.y - spec.h * 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = opts.alpha ?? 1;
    if (flip) {
      ctx.translate(e.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-e.x, 0);
    }
    sheet.draw(ctx, frame, e.x, e.y, 1);
    ctx.restore();
    void t;
  }

  drawActors(ctx, state) {
    this.drawTelegraphs(ctx, state);
    // Tri par profondeur : les grands derriere, les petits devant. Sans
    // cela deux ennemis qui se croisent se recouvrent dans le vide.
    const sorted = [...state.enemies].sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      const spec = SILHOUETTE[e.def.id] ?? SILHOUETTE.player;
      this.drawActor(ctx, e, spec, e.def.color, { t: state.elapsed });
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