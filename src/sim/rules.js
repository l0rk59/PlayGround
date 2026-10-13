/**
 * REGLES PURES — combat, soin, butin, extraction, economie.
 *
 * Ces fonctions ne touchent ni au DOM, ni au canvas, ni a l'horloge.
 * Elles operent sur des objets simples et deterministes : c'est ce qui
 * permet de tester des scenarios de mort, d economy ou de boss sans
 * demarrer le jeu. L'interface, le rendu et l'audio n'entrent jamais ici.
 */

import { clamp, limitLen, dist, TAU } from '../core/util.js';
import { DODGE, PLAYER, ECONOMY, LOOT, EXTRACTION } from '../data/tuning.js';

/* ------------------------------------------------------------- FABRICANT -- */

/**
 * Etat de base d'un combattant. Utilise tel quel par le joueur et,
 * avec quelques champs en plus, par les ennemis et le boss.
 */
export function createFighter(opts = {}) {
  const maxHealth = opts.maxHealth ?? PLAYER.maxHealth;
  const f = {
    id: opts.id ?? 'f0',
    kind: opts.kind ?? 'player',
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    vx: 0,
    vy: 0,
    facing: opts.facing ?? -Math.PI / 2,
    radius: opts.radius ?? PLAYER.radius,
    health: opts.health ?? maxHealth,
    maxHealth,
    armor: opts.armor ?? 0,
    speed: opts.speed ?? PLAYER.speed,
    dead: false,
    /** En-tete d'i-frame en cours, en secondes de temps simule. */
    invulnUntil: 0,
    invulnerable: false,
    invulnDuringRoll: false,
    /** Temps simule ecoule depuis le dernier coup. */
    sinceHit: 999,
    dodge: { active: false, t: 0, dirX: 0, dirY: 0, cooldownUntil: 0 },
    stamina: opts.staminaMax ?? DODGE.staminaMax,
    staminaMax: opts.staminaMax ?? DODGE.staminaMax,
    staminaSince: 99,
    abilityCooldownUntil: 0,
    healCooldownUntil: 0,
    extractHold: 0,
    /** Multiplicateur de degats recu, 1 = normal. */
    vulnerability: 1,
  };
  updateInvuln(f);
  return f;
}

export const isInvulnerable = (f) => !!f.invulnerable;

/** Le joueur peut-il agir normalement (pas de verrou, pas de mort) ? */
export function canAct(f) {
  if (f.dead) return false;
  if (f.dodge.active && f.dodge.t < DODGE.controlLockEnd) return false;
  return true;
}

/* --------------------------------------------------------------- ESQUIVE -- */

/**
 * Lance un roulade. Refuse si : mort, en cooldown, ou sans vigueur.
 * On ne consomme la vigueur qu'a la validation, pour ne pas punir
 * un joueur qui spamme le bouton.
 */
export function startDodge(f, dirX, dirY) {
  if (f.dead) return false;
  if (f.dodge.active) return false;
  if (f.dodge.cooldownUntil > 0) return false;
  if (f.stamina < DODGE.stamina) return false;

  const d = limitLen(dirX, dirY, 1);
  if (d.x === 0 && d.y === 0) d.x = Math.cos(f.facing), (d.y = Math.sin(f.facing));

  f.stamina -= DODGE.stamina;
  f.staminaSince = 0;
  f.dodge.active = true;
  f.dodge.t = 0;
  f.dodge.dirX = d.x;
  f.dodge.dirY = d.y;
  f.vx = d.x * DODGE.impulse;
  f.vy = d.y * DODGE.impulse;
  updateInvuln(f);
  return true;
}

/**
 * Etat d'invulnerabilite, source unique de verite. Les i-frames de
 * roulade et les i-frames post-hit partagent ce meme drapeau : une seule
 * source, donc aucune fenetre ou les deux systemes se desynchronisent.
 */
export function updateInvuln(f) {
  const roll = f.dodge.active && f.dodge.t >= DODGE.iFramesStart && f.dodge.t <= DODGE.iFramesEnd;
  f.invulnDuringRoll = roll;
  f.invulnerable = roll || f.invulnUntil > 0;
  return f.invulnerable;
}

/**
 * Avance l'horloge interne d'un combattant : roulade, i-frames,
 * cooldowns. Appele une fois par pas de simulation.
 */
export function tickFighter(f, dt) {
  f.sinceHit += dt;
  f.staminaSince += dt;

  // Toutes les durees residuelles se decrementent au meme endroit. Si on
  // oublie l'une d'elles, une capacite devient durablement inutilisable.
  f.dodge.cooldownUntil = Math.max(0, f.dodge.cooldownUntil - dt);
  f.abilityCooldownUntil = Math.max(0, f.abilityCooldownUntil - dt);
  f.healCooldownUntil = Math.max(0, f.healCooldownUntil - dt);

  if (f.dodge.active) {
    f.dodge.t += dt;
    // Friction exponentielle : le roulade s'arrete net, sans tremblement.
    const damp = Math.exp(-DODGE.friction * dt);
    f.vx *= damp;
    f.vy *= damp;
    if (f.dodge.t >= DODGE.duration) {
      f.dodge.active = false;
      f.dodge.cooldownUntil = DODGE.cooldown;
      // Le delai de regen court depuis la FIN du roulade. Le joueur doit
      // sentir le cout une fois l'action terminee, pas pendant qu'elle a
      // lieu — sinon les deux horloges se chevauchent.
      f.staminaSince = 0;
    }
  }

  f.invulnUntil = Math.max(0, f.invulnUntil - dt);
  regenStamina(f, dt);
  updateInvuln(f);
}

/** L'invulnerabilite d'un roulade, lue par le systeme de degats. */
export function rollingInvulnerable(f) {
  return !!f.dodge.active && f.dodge.t >= DODGE.iFramesStart && f.dodge.t <= DODGE.iFramesEnd;
}

/**
 * Regeneration de vigueur. Volontairement dans le meme tick que le reste :
 * une horloge de moins, donc un systeme de moins a oublier.
 */
function regenStamina(f, dt) {
  if (f.staminaSince >= DODGE.staminaRegenDelay && f.stamina < f.staminaMax) {
    f.stamina = clamp(f.stamina + DODGE.staminaRegen * dt, 0, f.staminaMax);
  }
}

/* ---------------------------------------------------------------- DEGATS -- */

/**
 * Applique un coup. Retourne un rapport complet : la simulation s'en
 * sert pour le scoreur, l'ecran de chiffres et le son.
 */
export function applyDamage(f, amount, source = {}) {
  if (f.dead) {
    return { applied: false, blockedByIFrame: false, damage: 0, killed: false, overkill: false };
  }
  if (isInvulnerable(f) || rollingInvulnerable(f)) {
    f.lastDodgeBlock = true;
    return { applied: false, blockedByIFrame: true, damage: 0, killed: false, overkill: false };
  }

  // Fenetre d'i-frame post-hit : on l'installe AVANT d'appliquer, sinon
  // deux enemies frappant dans la meme image percent la garantie.
  const raw = Math.max(0, amount) * f.vulnerability;
  const damage = Math.max(1, Math.round(raw * (1 - clamp(f.armor, 0, 0.85))));
  f.health = clamp(f.health - damage, 0, f.maxHealth);
  f.sinceHit = 0;
  if (f.kind === 'player') f.invulnUntil = PLAYER.hurtIFrames;
  updateInvuln(f);

  const killed = f.health <= 0;
  if (killed) f.dead = true;

  return { applied: true, blockedByIFrame: false, damage, killed, overkill: damage > f.health };
}

/** Soin plafonne a la vie max, soumis a un cooldown. */
export function heal(f, amount) {
  if (f.dead || f.health >= f.maxHealth) return { healed: 0 };
  if (f.healCooldownUntil > 0) return { healed: 0 };
  const healed = Math.min(amount, f.maxHealth - f.health);
  f.health += healed;
  f.healCooldownUntil = PLAYER.healCooldown;
  return { healed };
}

export function revive(f) {
  f.dead = false;
  f.health = Math.round(f.maxHealth * 0.35);
  f.vx = 0;
  f.vy = 0;
  f.invulnUntil = PLAYER.hurtIFrames * 2;
  f.dodge.active = false;
  f.dodge.cooldownUntil = 0;
}

/* ----------------------------------------------------------------- BUTIN -- */

/**
 * Ce que la mort emporte. Regle de confiance fondatrice du jeu :
 * on ne perd jamais une decouverte, seulement la matiere.
 */
export function lostOnDeath(carry) {
  return carry.filter((entry) => LOOT.TEMPORARY.includes(entry.id));
}

export function keptOnDeath(carry) {
  return carry.filter((entry) => !LOOT.TEMPORARY.includes(entry.id));
}

/** Consequence d'une defaite, appliquee a la progression permanente. */
export function deathPenalty(meta, lost = []) {
  const lostScrap = lost
    .filter((e) => e.id === 'scrap')
    .reduce((s, e) => s + e.qty, 0);
  return {
    lostScrap,
    keptScrap: Math.max(0, meta.scrap - lostScrap),
    worldSeed: meta.worldSeed,
    discoveries: meta.discoveries.slice(),
  };
}

/* ------------------------------------------------------------- ECONOMIE -- */

/**
 * Cout d'amelioration du refuge. La fonction calcule un cout BRUT ;
 * c'est l'appelant qui decide combien de niveaux sont offerts. On ne
 * melange pas les deux responsabilites, sinon le test de cout ne veut
 * plus rien dire.
 */
export function upgradeCost(level, opts = {}) {
  const free = opts.freeLevels ?? 0;
  if (level <= free) return 0;
  return Math.round(ECONOMY.upgradeBase * Math.pow(ECONOMY.upgradeStep, level - free - 1));
}

export function canAfford(meta, cost) {
  return meta.scrap >= cost;
}

export function spend(meta, cost) {
  if (!canAfford(meta, cost)) return false;
  meta.scrap -= cost;
  return true;
}

/* ------------------------------------------------------------ EXTRACTION -- */

/**
 * Tente une sortie. Cette fonction ne repond qu'a UNE question :
 * le joueur a-t-il tenu le pad assez longtemps ?
 * L'ouverture du pad (fin de periode) est une regle de MISSION, pas de
 * combat : elle est passee en `opts.open` par l'appelant. Quitter le
 * pad remet le maintien a zero — pas de sortie « collee » au joueur.
 */
export function tryExtract(f, pad, dt, opts = {}) {
  if (f.dead) return false;
  if (opts.open === false) return false;
  const onPad = dist(f.x, f.y, pad.x, pad.y) <= EXTRACTION.radius;
  if (!onPad) {
    f.extractHold = 0;
    return false;
  }
  f.extractHold += dt;
  return f.extractHold >= EXTRACTION.holdSeconds;
}

/* ----------------------------------------------------------------- VISEE -- */

/**
 * Choisit une cible pour le tir automatique. Critere unique : la plus
 * proche visible. Le joueur n'a qu'un pouce, on ne lui demande pas de viser.
 */
export function pickTarget(originX, originY, candidates, range, hasLineOfSight) {
  let best = null;
  let bestD = range;
  for (const e of candidates) {
    if (e.dead) continue;
    const d = dist(originX, originY, e.x, e.y);
    if (d > bestD) continue;
    if (hasLineOfSight && !hasLineOfSight(e.x, e.y)) continue;
    bestD = d;
    best = e;
  }
  return best;
}

/** Angle de visee, avec dispersion appliquee. */
export function aimAt(fromX, fromY, target, spread, rng) {
  const base = Math.atan2(target.y - fromY, target.x - fromX);
  if (!spread) return base;
  return base + (rng() * 2 - 1) * spread;
}

/**
 * Angle de depart du roulade : vers ou l'on va, pas d'ou l'on vient.
 * On fige la direction au moment du declenchement, sinon le joueur
 * ne maitrise plus son esquive.
 */
export function dodgeDirection(inputX, inputY, fallbackFacing) {
  const v = limitLen(inputX, inputY, 1);
  if (v.x === 0 && v.y === 0) return { x: Math.cos(fallbackFacing), y: Math.sin(fallbackFacing) };
  return v;
}

export const angleTo = (fromX, fromY, toX, toY) => Math.atan2(toY - fromY, toX - fromX);
export { TAU };