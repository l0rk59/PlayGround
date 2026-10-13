/**
 * EXPEDITION — la simulation. Aucun DOM, aucun canvas, aucune horloge.
 *
 * La presentation lit l'etat et draine un tableau d'evenements ; elle ne
 * modifie jamais la simulation. C'est ce contrat qui permet de rejouer un
 * run a l'identique, de tester un boss sans moteur, et d'afficher des
 * animations sans risquer de desynchroniser les regles.
 *
 * Tout est en secondes simulees. Le temps de la partie est fixe : une
 * expedition dure `EXTRACTION.openAtSeconds`, le pad s'ouvre ensuite et le
 * joueur doit revenir. C'est la boucle qui remplace le « grind infini ».
 */

import {
  EXTRACTION, WEAPONS, AIM, PLAYER, COMPANION, PROGRESSION, BOSS as BOSS_TUNING, TICK,
} from '../data/tuning.js';
import { CLASSES, ENEMIES, BOSS } from '../data/content.js';
import { REGION, OBSTACLES, POIS } from '../data/world.js';
import { makeRng, hashString, clamp, dist, dist2, angleDelta, turnToward, TAU } from '../core/util.js';
import { createFighter, tickFighter, applyDamage, startDodge, heal, tryExtract, pickTarget, aimAt, isInvulnerable } from './rules.js';

const CLASS_TABLE = CLASSES;
/** Index des lieux par identifiant : evite de les chercher a chaque acces. */
export const POI_BY_ID = Object.fromEntries(POIS.map((p) => [p.id, p]));

/* ------------------------------------------------------------- CREATION -- */

export function createExpedition(opts) {
  const { classId, meta = {}, seed = 1, loadout = null } = opts;
  const cls = CLASS_TABLE[classId] ?? CLASS_TABLE.survivante;
  const rng = makeRng(seed >>> 0);

  const player = createFighter({
    id: 'player',
    kind: 'player',
    x: REGION.spawn.x,
    y: REGION.spawn.y,
    maxHealth: cls.health + ((meta.level ?? 1) - 1) * PROGRESSION.healthPerLevel,
    armor: cls.armor,
    speed: cls.speed,
  });
  player.health = player.maxHealth;
  player.classId = cls.id;
  player.ability = { ...cls.ability, cooldownUntil: 0 };
  player.weapon = WEAPONS[loadout?.arme ?? cls.weapon];
  player.xp = 0;
  player.level = meta.level ?? 1;
  player.marked = 0;
  player.veilUntil = 0;
  player.abilityReady = true;
  player.fireTimer = 0;
  player.healKey = false;

  const state = {
    seed: rng.state(),
    elapsed: 0,
    timeLimit: EXTRACTION.openAtSeconds,
    status: 'running',
    player,
    classDef: cls,
    companion: null,
    enemies: [],
    bullets: [],
    hostileBullets: [],
    pickups: [],
    hazards: [],
    marks: [],
    boss: null,
    bossTriggered: false,
    carry: [],
    events: [],
    visited: [],
    currentPoi: null,
    stats: { kills: 0, damageDealt: 0, damageTaken: 0, scrapCollected: 0 },
    dogUnlocked: !!meta.dogUnlocked,
    sectorDifficulty: 1,
    spawnTimer: 2,
    rng,
  };

  if (state.dogUnlocked) state.companion = createCompanion(player);

  emit(state, 'expedition:start', { classId: cls.id });
  return state;
}

/* ---------------------------------------------------------------- EVENTS -- */

export function emit(state, type, data = {}) {
  if (state.events.length < 256) state.events.push({ type, ...data });
}

/** Vide la file d'evenements. La presentation l'appelle une fois par image. */
export function drain(state) {
  const out = state.events;
  state.events = [];
  return out;
}

/* ------------------------------------------------------------ OBSTACLES -- */

const rects = [];

/**
 * Les obstacles viennent des donnees de monde. On les copie dans un
 * module-local pour que la simulation reste pure : aucun acces direct a
 * l'objet de configuration depuis le systeme de collision.
 */
function setObstacles(list) {
  rects.length = 0;
  for (const o of list) rects.push(o);
}
setObstacles(OBSTACLES);

export const obstacleList = () => rects.slice();

export function registerObstacles(list) {
  setObstacles(list);
}

function blocksSegment(x1, y1, x2, y2, o) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < o.x || minX > o.x + o.w || maxY < o.y || minY > o.y + o.h) return false;
  // Liang-Barsky : intersection segment / rectangle plein.
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [
    [-dx, x1 - o.x],
    [dx, o.x + o.w - x1],
    [-dy, y1 - o.y],
    [dy, o.y + o.h - y1],
  ]) {
    if (p === 0 && q < 0) return false;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return true;
}

const lineOfSight = (x1, y1, x2, y2) => {
  for (const o of rects) if (blocksSegment(x1, y1, x2, y2, o)) return false;
  return true;
};

/** Repousse un cercle hors des rectangles et des bords de la region. */
function resolveCollisions(f, bounds) {
  for (const o of rects) {
    const nx = clamp(f.x, o.x, o.x + o.w);
    const ny = clamp(f.y, o.y, o.y + o.h);
    const dx = f.x - nx;
    const dy = f.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < f.radius * f.radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        f.x = nx + (dx / d) * f.radius;
        f.y = ny + (dy / d) * f.radius;
      } else {
        // Centre a l'interieur du rectangle : on sort par la face la plus proche.
        const left = f.x - o.x;
        const right = o.x + o.w - f.x;
        const top = f.y - o.y;
        const bottom = o.y + o.h - f.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) f.x = o.x - f.radius;
        else if (m === right) f.x = o.x + o.w + f.radius;
        else if (m === top) f.y = o.y - f.radius;
        else f.y = o.y + o.h + f.radius;
      }
    }
  }
  f.x = clamp(f.x, bounds.minX + f.radius, bounds.maxX - f.radius);
  f.y = clamp(f.y, bounds.minY + f.radius, bounds.maxY - f.radius);
}

/* ------------------------------------------------------------- COMPAGNON -- */

function createCompanion(player) {
  const c = createFighter({
    id: 'dog',
    kind: 'companion',
    x: player.x,
    y: player.y + 40,
    maxHealth: 60,
    speed: COMPANION.catchUpSpeed,
    radius: COMPANION.radius,
  });
  c.attackTimer = 0;
  c.down = 0;
  c.healAccum = 0;
  c.wakeTimer = 0;
  c.state = 'follow';
  return c;
}

function stepCompanion(state, dt) {
  const c = state.companion;
  if (!c) return;
  tickFighter(c, dt);
  const p = state.player;

  if (c.down > 0) {
    c.down -= dt;
    c.state = 'down';
    if (c.down <= 0) {
      c.down = 0;
      c.health = c.maxHealth;
      emit(state, 'companion:back', {});
    }
    return;
  }

  const d = dist(c.x, c.y, p.x, p.y);
  if (d > COMPANION.followDistance) {
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    c.vx = Math.cos(a) * COMPANION.catchUpSpeed;
    c.vy = Math.sin(a) * COMPANION.catchUpSpeed;
    c.state = 'catchup';
  } else {
    const a = Math.atan2(p.y - c.y, p.x - c.x) + Math.PI * 0.75;
    c.vx = Math.cos(a) * 70;
    c.vy = Math.sin(a) * 70;
    c.state = 'follow';
  }

  c.x += c.vx * dt;
  c.y += c.vy * dt;

  // Attaque : la cible la plus proche dans un petit rayon. Le chien ne
  // doit pas finir la mission tout seul — il aide, il ne remplace pas.
  c.attackTimer -= dt;
  if (c.attackTimer <= 0) {
    let best = null;
    let bd = COMPANION.attackRange + 20;
    for (const e of allTargets(state)) {
      if (e.dead) continue;
      const dd = dist(c.x, c.y, e.x, e.y);
      if (dd < bd && lineOfSight(c.x, c.y, e.x, e.y)) {
        bd = dd;
        best = e;
      }
    }
    if (best) {
      c.attackTimer = COMPANION.attackInterval;
      const r = applyDamage(best, COMPANION.damage, { source: 'dog' });
      if (r.applied) emit(state, 'dog:hit', { x: best.x, y: best.y });
    } else {
      c.attackTimer = 0.2;
    }
  }

  // Soin passif, plus fort sous l'abilite de la Porteuse.
  const rate = p.veilUntil > 0 ? COMPANION.healPerSecond * state.classDef.ability.companionHeal : COMPANION.healPerSecond;
  c.healAccum += rate * dt;
  if (c.healAccum >= 1 && p.health < p.maxHealth) {
    c.healAccum = 0;
    p.health = clamp(p.health + 1, 0, p.maxHealth);
  }

  // Il peut se prendre des coups mais ne meurt jamais : le joueur ne doit
  // pas perdre une session parce que le chien a ete mal place.
  if (c.health <= 0) {
    c.down = COMPANION.downSeconds;
    emit(state, 'companion:down', {});
  }
}

/* --------------------------------------------------------------- ENNEMIS -- */

export function spawnEnemy(state, id, x, y) {
  const def = ENEMIES[id];
  if (!def) return null;
  const e = createFighter({
    id: `${id}-${state.stats.kills}-${state.enemies.length}`,
    kind: 'enemy',
    x,
    y,
    maxHealth: def.health * state.sectorDifficulty,
    speed: def.speed,
    radius: def.radius,
    armor: 0,
  });
  e.def = def;
  e.family = def.family;
  e.state = 'approach';
  e.telegraphUntil = 0;
  e.attackAt = 0;
  e.xp = def.xp;
  e.hitFlash = 0;
  state.enemies.push(e);
  return e;
}

const allTargets = (state) => (state.boss && !state.boss.dead ? [...state.enemies, state.boss] : state.enemies);

function stepEnemy(state, e, dt) {
  const def = e.def;
  const p = state.player;
  tickFighter(e, dt);
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  if (e.dead) return;

  const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
  const d = dist(e.x, e.y, p.x, p.y);
  const sees = d < 340 && lineOfSight(e.x, e.y, p.x, p.y);

  switch (e.state) {
    case 'approach': {
      if (!sees) {
        e.facing = turnToward(e.facing, toPlayer, 3.2 * dt);
        if (def.behavior === 'station') {
          e.vx = 0;
          e.vy = 0;
          return;
        }
        e.vx = Math.cos(e.facing) * def.speed * 0.6;
        e.vy = Math.sin(e.facing) * def.speed * 0.6;
        return;
      }
      if (d <= def.attackRange) {
        e.state = 'telegraph';
        e.telegraphUntil = def.attackWindup;
        e.facing = toPlayer;
        emit(state, 'enemy:telegraph', { x: e.x, y: e.y, id: def.id });
      } else {
        let dir = toPlayer;
        if (def.behavior === 'flank') {
          // Tourne autour plutot que tout droit : un loup qui charge en
          // ligne droite se lit trop facilement.
          dir = toPlayer + (hashString(e.id) % 2 ? 0.9 : -0.9);
        } else if (def.behavior === 'ranged' && d < def.attackRange * 0.5) {
          dir = toPlayer + Math.PI;
        }
        e.facing = turnToward(e.facing, dir, 5 * dt);
        const sp = def.behavior === 'flank' ? def.speed * 0.92 : def.speed;
        e.vx = Math.cos(e.facing) * sp;
        e.vy = Math.sin(e.facing) * sp;
      }
      break;
    }
    case 'telegraph': {
      // La telegraphie fixe la direction au lancement : le joueur doit
      // pouvoir lire le coup et decider, pas le subir.
      e.vx = 0;
      e.vy = 0;
      e.telegraphUntil -= dt;
      if (e.telegraphUntil <= 0) {
        e.state = 'strike';
        fireEnemyAttack(state, e);
      }
      break;
    }
    case 'strike': {
      e.vx *= 0.86;
      e.vy *= 0.86;
      e.attackAt -= dt;
      if (e.attackAt <= 0) {
        e.state = 'approach';
      }
      break;
    }
    default:
      break;
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

function fireEnemyAttack(state, e) {
  const def = e.def;
  const p = state.player;
  e.attackAt = def.attackRecover;
  emit(state, 'enemy:strike', { x: e.x, y: e.y, id: def.id });

  if (def.behavior === 'ranged') {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    state.hostileBullets.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * def.projectileSpeed,
      vy: Math.sin(a) * def.projectileSpeed,
      life: 2.4,
      damage: def.damage,
      radius: 6,
    });
    return;
  }
  if (def.beam) {
    state.hazards.push({
      kind: 'beam',
      x: e.x,
      y: e.y,
      angle: Math.atan2(p.y - e.y, p.x - e.x),
      width: 22,
      life: 0.55,
      maxLife: 0.55,
      damage: def.damage,
      origin: e,
    });
    applyDamage(p, def.damage, { source: e.id });
    return;
  }
  if (dist(e.x, e.y, p.x, p.y) <= def.attackRange + p.radius) {
    applyDamage(p, def.damage, { source: e.id });
  }
}

/* ------------------------------------------------------------------ BOSS -- */

function spawnBoss(state) {
  const b = createFighter({
    id: 'boss',
    kind: 'boss',
    x: POI_BY_ID.seuil.x,
    y: POI_BY_ID.seuil.y,
    maxHealth: BOSS.health,
    speed: BOSS.phases[0].speed,
    radius: BOSS.radius,
    armor: 0.05,
  });
  b.def = BOSS;
  b.phase = 0;
  b.telegraphUntil = 0;
  b.attackAt = 2.2;
  b.state = 'idle';
  b.invulnUntil = 0;
  b.hitFlash = 0;
  b.summons = [];
  state.boss = b;
  state.bossTriggered = true;
  emit(state, 'boss:appear', { name: BOSS.name });
  return b;
}

function bossPhaseIndex(b) {
  const ratio = b.health / b.maxHealth;
  for (let i = BOSS.phases.length - 1; i >= 0; i--) {
    if (ratio <= BOSS.phases[i].from) return i;
  }
  return 0;
}

function stepBoss(state, dt) {
  const b = state.boss;
  if (!b || b.dead) return;
  const p = state.player;
  tickFighter(b, dt);
  b.hitFlash = Math.max(0, b.hitFlash - dt);

  const next = bossPhaseIndex(b);
  if (next > b.phase) {
    b.phase = next;
    b.state = 'telegraph';
    b.telegraphUntil = BOSS_TUNING.phaseInvuln;
    b.invulnUntil = BOSS_TUNING.phaseInvuln;
    b.attackAt = 1.4;
    emit(state, 'boss:phase', { index: next, name: BOSS.phases[next].name, horror: !!BOSS.phases[next].horrorMoment });
    return;
  }

  const phase = BOSS.phases[b.phase];
  b.speed = phase.speed;
  const toPlayer = Math.atan2(p.y - b.y, p.x - b.x);
  const d = dist(b.x, b.y, p.x, p.y);

  if (b.state === 'telegraph') {
    b.vx = 0;
    b.vy = 0;
    b.telegraphUntil -= dt;
    if (b.telegraphUntil <= 0) {
      b.state = 'idle';
      b.attackAt = phase.interval;
      bossAttack(state, b, phase);
    }
    return;
  }

  b.attackAt -= dt;
  if (d > 260) {
    b.facing = turnToward(b.facing, toPlayer, 2.4 * dt);
    b.vx = Math.cos(b.facing) * b.speed;
    b.vy = Math.sin(b.facing) * b.speed;
  } else {
    b.facing = turnToward(b.facing, toPlayer + 0.8, 1.6 * dt);
    b.vx *= 0.9;
    b.vy *= 0.9;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.attackAt <= 0) {
    b.state = 'telegraph';
    b.telegraphUntil = phase.telegraph;
    emit(state, 'boss:telegraph', { pattern: phase.pattern, name: phase.name, horror: !!phase.horrorMoment });
  }
}

function bossAttack(state, b, phase) {
  const p = state.player;
  const toPlayer = Math.atan2(p.y - b.y, p.x - b.x);
  emit(state, 'boss:attack', { pattern: phase.pattern });

  if (phase.pattern === 'sweep') {
    state.hazards.push({
      kind: 'sweep',
      x: b.x,
      y: b.y,
      angle: toPlayer,
      radius: 340,
      width: 0.85,
      life: 0.9,
      maxLife: 0.9,
      damage: BOSS.damage,
      origin: b,
      rotating: 1.1,
    });
    return;
  }
  if (phase.pattern === 'summon') {
    for (const id of phase.summon) {
      const a = state.rng() * TAU;
      const r = 120 + state.rng() * 90;
      spawnEnemy(state, id, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
    }
    return;
  }
  if (phase.pattern === 'beam') {
    for (let i = 0; i < 3; i++) {
      state.hazards.push({
        kind: 'beam',
        x: b.x,
        y: b.y,
        angle: toPlayer + (i - 1) * 0.42,
        width: 30,
        life: 0.75,
        maxLife: 0.75,
        damage: BOSS.damage,
        origin: b,
      });
    }
  }
}

/* --------------------------------------------------------------- TIRAGE -- */

function stepFiring(state, dt) {
  const p = state.player;
  const w = p.weapon;
  p.fireTimer -= dt;
  p.marked = Math.max(0, p.marked - dt);
  p.veilUntil = Math.max(0, p.veilUntil - dt);

  if (p.fireTimer > 0) return;
  // Plafond global : aucune arme ne depasse la portee de visee commune.
  // Sans ce `min`, une arme a tres longue portee changerait les regles.
  const reach = Math.min(w.range, AIM.maxRange);
  const target = pickTarget(p.x, p.y, allTargets(state), reach, lineOfSight);
  if (!target) return;

  p.fireTimer = w.fireInterval;
  const pellets = w.pellets ?? 1;
  for (let i = 0; i < pellets; i++) {
    const a = aimAt(p.x, p.y, target, w.spread, state.rng);
    state.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * w.bulletSpeed,
      vy: Math.sin(a) * w.bulletSpeed,
      life: w.bulletLife,
      damage: w.damage * (p.marked > 0 ? 1 + state.classDef.ability.bonus : 1),
      pierce: w.pierce,
      radius: 4,
    });
  }
  p.facing = Math.atan2(target.y - p.y, target.x - p.x);
  emit(state, 'player:shoot', { x: p.x, y: p.y, weapon: w.id });
}

/* ---------------------------------------------------------------- BUTIN -- */

function dropLoot(state, e) {
  const def = e.def;
  // Le boss ne laisse pas de matiere ordinaire : sa recompense est unique,
  // elle est rendue a la sortie, pas au sol ou elle ramasserait par terre.
  if (!def?.scrap) return;
  const n = state.rng.int(def.scrap[0], def.scrap[1]);
  for (let i = 0; i < Math.min(n, 3); i++) {
    const a = state.rng() * TAU;
    state.pickups.push({ id: 'scrap', qty: 1, x: e.x, y: e.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 999 });
  }
  if (state.rng.chance(0.14)) {
    state.pickups.push({ id: 'ration', qty: 1, x: e.x + 6, y: e.y - 4, vx: 0, vy: 0, life: 999 });
  }
  if (state.rng.chance(0.2)) state.pickups.push({ id: 'ammo', qty: 12, x: e.x - 6, y: e.y + 4, vx: 0, vy: 0, life: 999 });
}

function stepPickups(state, dt) {
  const p = state.player;
  const magnet = 74;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const it = state.pickups[i];
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    it.vx *= 0.9;
    it.vy *= 0.9;
    const d = dist(it.x, it.y, p.x, p.y);
    if (d < magnet) {
      const a = Math.atan2(p.y - it.y, p.x - it.x);
      const pull = (1 - d / magnet) * 620 * dt;
      it.x += Math.cos(a) * pull;
      it.y += Math.sin(a) * pull;
    }
    if (d < p.radius + 12) {
      state.carry.push({ id: it.id, qty: it.qty });
      state.stats.scrapCollected += it.id === 'scrap' ? it.qty : 0;
      emit(state, 'loot:pickup', { id: it.id, qty: it.qty, x: it.x, y: it.y });
      state.pickups.splice(i, 1);
    }
  }
}

/* --------------------------------------------------------------- POINTS -- */

function stepPois(state) {
  const p = state.player;
  for (const poi of POIS) {
    const d = dist(p.x, p.y, poi.x, poi.y);
    if (d > poi.radius) continue;
    state.currentPoi = poi;
    if (!state.visited.includes(poi.id)) {
      state.visited.push(poi.id);
      emit(state, 'poi:enter', { id: poi.id, name: poi.name, kind: poi.kind, objective: poi.objective });
    }
    if (poi.kind === 'boss' && !state.bossTriggered && state.status === 'running') {
      spawnBoss(state);
    }
    return;
  }
  state.currentPoi = null;
}

/* ------------------------------------------------------------- DIRECTEUR -- */

/**
 * Le directeur de vagues. Il ne cherche pas a etre difficile, il cherche
 * a faire varier la pression : une accalmie, puis une densite, puis une
 * respiration. Sans accalmie, aucun joueur ne peut choisir sa route.
 */
function stepDirector(state, dt) {
  const t = state.elapsed;
  state.sectorDifficulty = 1 + clamp(t / 150, 0, 1.4);

  const budget = 2 + Math.floor(t / 26) + (state.visited.length > 1 ? 1 : 0);
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = 3.4 - clamp(t / 400, 0, 1.6);

  const live = state.enemies.filter((e) => !e.dead).length;
  if (live >= 14) return;

  const p = state.player;
  const pool = t < 40 ? ['rieur'] : t < 90 ? ['rieur', 'meute', 'pleureuse'] : ['rieur', 'meute', 'pleureuse', 'plethore'];
  for (let i = 0; i < budget; i++) {
    const a = state.rng() * TAU;
    const r = 320 + state.rng() * 180;
    const b = REGION.bounds;
    const x = clamp(p.x + Math.cos(a) * r, 60, b.maxX - 60);
    const y = clamp(p.y + Math.sin(a) * r, 60, b.maxY - 60);
    spawnEnemy(state, state.rng.pick(pool), x, y);
  }
}

/* -------------------------------------------------------------- PROJECTILES -- */

function stepBullets(state, dt) {
  const p = state.player;

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const e of allTargets(state)) {
        if (e.dead) continue;
        if (isInvulnerable(e)) continue;
        if (dist2(b.x, b.y, e.x, e.y) > (e.radius + b.radius) ** 2) continue;
        const r = applyDamage(e, b.damage, { source: 'player' });
        if (r.applied) {
          state.stats.damageDealt += r.damage;
          e.hitFlash = 0.12;
          emit(state, 'hit:enemy', { x: b.x, y: b.y, damage: r.damage, killed: r.killed, crit: false });
          if (r.killed) killEnemy(state, e);
          if (b.pierce-- <= 0) dead = true;
        }
        break;
      }
    }
    if (!dead) {
      for (const o of rects) {
        if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }

  for (let i = state.hostileBullets.length - 1; i >= 0; i--) {
    const b = state.hostileBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && dist2(b.x, b.y, p.x, p.y) <= (p.radius + b.radius) ** 2) {
      const r = applyDamage(p, b.damage, { source: 'projectile' });
      if (r.applied) {
        state.stats.damageTaken += r.damage;
        emit(state, 'hit:player', { x: b.x, y: b.y, damage: r.damage });
      }
      dead = true;
    }
    if (dead) state.hostileBullets.splice(i, 1);
  }

  for (let i = state.hazards.length - 1; i >= 0; i--) {
    const h = state.hazards[i];
    h.life -= dt;
    if (h.rotating) h.angle += h.rotating * dt;
    const hit = hazardHits(h, p);
    if (hit && h.hitCooldown <= 0) {
      const r = applyDamage(p, h.damage, { source: 'hazard' });
      if (r.applied) {
        state.stats.damageTaken += r.damage;
        emit(state, 'hit:player', { x: p.x, y: p.y, damage: r.damage });
      }
      h.hitCooldown = 0.5;
    }
    h.hitCooldown = Math.max(0, (h.hitCooldown ?? 0) - dt);
    if (h.life <= 0) state.hazards.splice(i, 1);
  }
}

function hazardHits(h, p) {
  if (h.kind === 'beam') {
    const ex = p.x - h.x;
    const ey = p.y - h.y;
    const len = Math.hypot(ex, ey);
    if (len > 340) return false;
    const dot = (ex * Math.cos(h.angle) + ey * Math.sin(h.angle)) / (len || 1);
    const cross = Math.abs(ex * Math.sin(h.angle) - ey * Math.cos(h.angle));
    return dot > 0 && cross < h.width * 0.5 + p.radius;
  }
  const d = dist(p.x, p.y, h.x, h.y);
  if (d > h.radius) return false;
  if (h.kind === 'sweep') {
    const a = Math.atan2(p.y - h.y, p.x - h.x);
    return Math.abs(angleDelta(h.angle, a)) < h.width;
  }
  return d < h.radius;
}

function killEnemy(state, e) {
  state.stats.kills += 1;
  emit(state, 'enemy:die', { x: e.x, y: e.y, id: e.def?.id, xp: e.xp });
  dropLoot(state, e);
  const i = state.enemies.indexOf(e);
  if (i >= 0) state.enemies.splice(i, 1);
}

/* ------------------------------------------------------------ ABILITE -- */

export function useAbility(state) {
  const p = state.player;
  const a = state.classDef.ability;
  if (p.abilityCooldownUntil > 0 || p.dead) return false;
  p.abilityCooldownUntil = a.cooldown;

  if (a.id === 'pulse') {
    emit(state, 'ability:pulse', { x: p.x, y: p.y, radius: a.radius });
    for (const e of allTargets(state)) {
      if (e.dead) continue;
      if (dist(e.x, e.y, p.x, p.y) <= a.radius) applyDamage(e, a.damage, { source: 'ability' });
    }
    state.hazards.push({ kind: 'ring', x: p.x, y: p.y, radius: a.radius, life: a.duration, maxLife: a.duration, damage: 0 });
  } else if (a.id === 'mark') {
    const t = pickTarget(p.x, p.y, allTargets(state), a.range, lineOfSight);
    if (t) {
      p.marked = a.duration;
      emit(state, 'ability:mark', { x: t.x, y: t.y, name: t.def?.name ?? t.def?.def?.name ?? 'cible' });
    }
  } else if (a.id === 'veil') {
    p.veilUntil = a.duration;
    if (state.companion) {
      state.companion.x = p.x + 30;
      state.companion.y = p.y + 20;
      state.companion.down = 0;
    }
    emit(state, 'ability:veil', { x: p.x, y: p.y });
  }
  return true;
}

/* ----------------------------------------------------------------- PAS -- */

/**
 * Un pas de simulation. `input` ne contient que des intentions :
 * { moveX, moveY, dodge, ability, heal }. Rien d'autre ne touche au joueur.
 */
export function step(state, dt, input) {
  if (state.status !== 'running') return state;
  dt = Math.min(dt, TICK * 4);
  state.elapsed += dt;
  const p = state.player;

  tickFighter(p, dt);

  if (input?.dodge) startDodge(p, input.moveX, input.moveY);
  if (input?.ability) useAbility(state);
  if (input?.heal) {
    const r = heal(p, PLAYER.healAmount);
    if (r.healed) emit(state, 'player:heal', { amount: r.healed });
  }

  // Deplacement : l'impulsion du roulade prime, puis la marche.
  if (!p.dodge.active) {
    const speed = p.speed * (input?.aim ? 0.5 : 1);
    p.vx = input.moveX * speed;
    p.vy = input.moveY * speed;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  resolveCollisions(p, REGION.bounds);

  if (p.dead && state.status === 'running') {
    state.status = 'dead';
    emit(state, 'run:dead', { carried: state.carry.slice() });
    return state;
  }

  stepFiring(state, dt);
  for (const e of state.enemies) stepEnemy(state, e, dt);
  stepBoss(state, dt);
  stepCompanion(state, dt);
  stepBullets(state, dt);
  stepPickups(state, dt);
  stepDirector(state, dt);
  stepPois(state);

  if (state.boss && state.boss.dead && !state.boss.rewarded) {
    state.boss.rewarded = true;
    emit(state, 'boss:down', { id: BOSS.id, reward: BOSS.uniqueReward });
  }

  const open = state.elapsed >= state.timeLimit;
  if (tryExtract(p, REGION.extraction, dt, { open })) {
    state.status = 'extracted';
    emit(state, 'run:extracted', { carried: state.carry.slice(), stats: { ...state.stats } });
  } else if (open && p.extractHold === 0 && state.elapsed > state.timeLimit + 45) {
    state.status = 'timeout';
    emit(state, 'run:timeout', { carried: state.carry.slice() });
  }

  return state;
}

/* ------------------------------------------------------- SORTIE D'ETAT -- */

/** Termine le run et renvoie ce qui remonte dans la progression permanente. */
export function finish(state) {
  const carried = state.carry.slice();
  return {
    status: state.status,
    carried,
    stats: state.stats,
    visited: state.visited.slice(),
    seconds: state.elapsed,
    bossKilled: !!state.boss?.dead,
  };
}