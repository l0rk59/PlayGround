import test from 'node:test';
import assert from 'node:assert/strict';

import { DODGE, PLAYER, ECONOMY, LOOT, EXTRACTION, WEAPONS } from '../src/data/tuning.js';
import {
  createFighter,
  startDodge,
  tickFighter,
  applyDamage,
  heal,
  canAct,
  lostOnDeath,
  tryExtract,
  upgradeCost,
} from '../src/sim/rules.js';
import { LIGHT, FACE_VALUE, BAND, SILHOUETTE, READABILITY } from '../src/art/palette.js';
import { ENEMIES } from '../src/data/content.js';
import { makeRng, SpatialHash, closestPointInSector, segmentHitsCircle } from '../src/core/util.js';

const fighter = (over = {}) => createFighter({ maxHealth: 100, ...over });

test('esquive : la fenetre d invulnerabilite est bornee, pas la duree entiere', () => {
  const f = fighter();
  startDodge(f, 1, 0);
  assert.equal(f.dodge.active, true);
  assert.equal(f.invulnerable, false, 'pas d i-frame a l instant exact du depart');

  tickFighter(f, DODGE.iFramesStart + 0.01);
  assert.equal(f.invulnerable, true, 'i-frame active pendant la fenetre');

  tickFighter(f, DODGE.iFramesEnd);
  assert.equal(f.invulnerable, false, 'l i-frame se referme avant la fin du roulade');

  const before = f.vx;
  tickFighter(f, 0.02);
  assert.ok(f.vx < before, 'la vitesse decroit par friction');
});

test('esquive : direction opposee a l attaque traverse, meme direction reste exposee', () => {
  const attackerX = 0;
  const attackerY = 0;
  const fwd = fighter({ x: attackerX + 120, y: attackerY, armor: 0 });
  startDodge(fwd, -1, 0);
  tickFighter(fwd, DODGE.iFramesStart + 0.005);
  const through = applyDamage(fwd, 20, { type: 'test' });
  assert.equal(through.blockedByIFrame, true);
  assert.equal(fwd.health, 100, 'aucun degat traverse si l esquive est bien placee');

  const away = fighter({ x: attackerX - 120, y: attackerY, armor: 0 });
  startDodge(away, -1, 0);
  tickFighter(away, DODGE.iFramesEnd + 0.01);
  const caught = applyDamage(away, 20, { type: 'test' });
  assert.equal(caught.blockedByIFrame, false);
  assert.equal(away.health, 80);
});

test('esquive : cout de vigueur puis regeneration, jamais de depassement du maximum', () => {
  const f = fighter({ staminaMax: 2 });

  assert.equal(startDodge(f, 0, 1), true);
  tickFighter(f, DODGE.duration + 0.01);
  assert.equal(f.stamina, 1, 'un roulade coute une vigueur');

  tickFighter(f, DODGE.staminaRegenDelay * 0.9);
  assert.equal(f.stamina, 1, 'pas de regeneration avant le delai');
  tickFighter(f, DODGE.staminaRegenDelay * 0.2);
  assert.ok(f.stamina > 1, 'la vigueur revient apres le delai');

  tickFighter(f, 5);
  assert.equal(f.stamina, 2, 'regen plafonnee au maximum');

  f.stamina = 0;
  assert.equal(startDodge(f, 0, 1), false, 'pas de roulade sans vigueur');
  assert.equal(f.stamina, 0, 'un refus ne consomme pas de vigueur');
});

test('esquive : verrou de controle interdit de casser l impulsion tot', () => {
  const f = fighter();
  startDodge(f, 1, 0);
  tickFighter(f, 0.05);
  assert.equal(canAct(f), false, 'verrou de controle actif');
  tickFighter(f, DODGE.controlLockEnd);
  assert.equal(canAct(f), true);
});

test('degats : les i-frame post-hit evitent le stunlock en rafale', () => {
  const f = fighter();
  const first = applyDamage(f, 30, { type: 'test' });
  assert.equal(first.applied, true);
  assert.equal(f.health, 70);
  assert.equal(f.invulnerable, true, 'i-frame post-hit active');

  const second = applyDamage(f, 30, { type: 'test' });
  assert.equal(second.applied, false);
  assert.equal(f.health, 70, 'la rafale ne peut pas enchainer');

  tickFighter(f, PLAYER.hurtIFrames + 0.02);
  assert.equal(f.invulnerable, false);
  const third = applyDamage(f, 30, { type: 'test' });
  assert.equal(third.applied, true);
  assert.equal(f.health, 40);
});

test('degats : l armure reduit proportionnellement et se plafonne', () => {
  const soft = fighter({ armor: 0.5 });
  applyDamage(soft, 40, { type: 'test' });
  assert.equal(soft.health, 80, 'armure 50 % -> moitie des degats');

  const hard = fighter({ armor: 4 });
  applyDamage(hard, 40, { type: 'test' });
  assert.ok(hard.health > 90, 'l armure ne peut pas rendre invulnérable');
  assert.ok(hard.health <= 100);
});

test('degats : le coup fatal marque la mort et n applique pas de PV negatifs', () => {
  const f = fighter({ maxHealth: 10, health: 10 });
  const r = applyDamage(f, 999, { type: 'test' });
  assert.equal(r.killed, true);
  assert.equal(f.dead, true);
  assert.equal(f.health, 0);
});

test('soin : plafonne a la vie max et respecte le cooldown', () => {
  const f = fighter({ health: 50 });
  assert.equal(heal(f, 20).healed, 20);
  assert.equal(heal(f, 20).healed, 0, 'deuxieme soin refuse par cooldown');
  assert.equal(f.health, 70);
  f.healCooldownUntil = 0;
  heal(f, 999);
  assert.equal(f.health, 100, 'jamais au-dela du maximum');
  assert.equal(heal(f, 10).healed, 0, 'rien a soigner quand on est plein');
});

test('butin : la mort ne prend que le temporaire, le permanent est lie a une decouverte', () => {
  const carried = [
    { id: 'scrap', qty: 30 },
    { id: 'relic', qty: 1 },
    { id: 'record', qty: 2 },
  ];
  const lost = lostOnDeath(carried);
  const ids = lost.map((e) => e.id);
  assert.ok(ids.includes('scrap'), 'les communs se perdent');
  assert.ok(!ids.includes('relic'), 'un relique est un secret, il ne se perd pas');
  assert.ok(!ids.includes('record'), 'un enregistrement est une decouverte');
  for (const id of ids) assert.ok(LOOT.TEMPORARY.includes(id));
});

test('extraction : il faut tenir le pad assez longtemps, un simple passage ne suffit pas', () => {
  const f = fighter();
  const pad = { x: 0, y: 0 };
  const step = EXTRACTION.holdSeconds / 10;
  let done = null;
  for (let i = 0; i < 9; i++) done = tryExtract(f, pad, step);
  assert.equal(done, false, 'un passage rapide ne suffit pas');
  done = tryExtract(f, pad, step);
  assert.equal(done, true, 'sortie valide une fois le temps de maintien atteint');
});

test('extraction : le pad ouvre a l heure prevue, jamais avant', () => {
  assert.ok(EXTRACTION.openAtSeconds > 0);
  const f = fighter();
  assert.equal(tryExtract(f, { x: 0, y: 0 }, 10, { open: false }), false, 'pad ferme');
  assert.equal(tryExtract(f, { x: 0, y: 0 }, 10, { open: true }), true, 'pad ouvert');
});

test('extraction : rester sur le pad se mesure en temps continu', () => {
  const f = fighter();
  f.x = 40;
  tryExtract(f, { x: 0, y: 0 }, 1);
  assert.ok(f.extractHold > 0, 'progression partielle comptee');
  f.x = EXTRACTION.radius + 30;
  tryExtract(f, { x: 0, y: 0 }, 1);
  assert.equal(f.extractHold, 0, 'quitter le pad remet a zero');
});

test('economie : le cout d amelioration croit mais reste atteignable', () => {
  const costs = [1, 2, 3, 4, 5].map((lvl) => upgradeCost(lvl));
  for (let i = 1; i < costs.length; i++) assert.ok(costs[i] > costs[i - 1], 'cout croissant');
  assert.equal(costs[0], ECONOMY.upgradeBase);
  assert.ok(costs[4] < 200, 'pas de mur de ressources a la vertical slice');
});

test('economie : les niveaux gratuits depassent le plafond doux', () => {
  for (let i = 0; i <= ECONOMY.softCapFree; i++) {
    assert.equal(upgradeCost(i, { freeLevels: ECONOMY.softCapFree }), 0);
  }
  assert.ok(upgradeCost(ECONOMY.softCapFree + 1, { freeLevels: ECONOMY.softCapFree }) > 0);
});

test('armes : chaque arme declare un intervalle de tir strictement positif', () => {
  for (const w of Object.values(WEAPONS)) {
    assert.ok(w.fireInterval > 0);
    assert.ok(w.damage > 0);
    assert.ok(w.bulletSpeed > 0);
  }
});

test('coherence du RNG : meme graine, meme suite, aucune derive', () => {
  const a = makeRng(1234);
  const b = makeRng(1234);
  const seqA = Array.from({ length: 50 }, () => a());
  const seqB = Array.from({ length: 50 }, () => b());
  assert.deepEqual(seqA, seqB);
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test('hash spatial : une requete ne perd pas d entite proche et ignore les eloignees', () => {
  const hash = new SpatialHash(100);
  const entities = [
    { x: 0, y: 0 },
    { x: 250, y: 0 },
    { x: 5000, y: 5000 },
  ];
  hash.rebuild(entities);
  const out = hash.queryRadius(0, 0, 60);
  assert.equal(out.length, 1);
  assert.equal(out[0], entities[0]);
  assert.equal(hash.queryRadius(0, 0, 400).length, 2);
});

test('geometrie : un faisceau ne touche pas une cible hors cône', () => {
  const hit = closestPointInSector(0, 0, 0, 0.5, 300, 200, 0);
  assert.ok(Math.hypot(hit.x, hit.y) > 0, 'le point ramene est sur le bord du faisceau');

  assert.equal(segmentHitsCircle(0, 0, 100, 0, 50, 0, 5), true);
  assert.equal(segmentHitsCircle(0, 0, 100, 0, 50, 90, 5), false);
});

test('direction artistique : un vecteur de lumiere unique donne trois faces ordonnees', () => {
  assert.ok(LIGHT.x < 0 && LIGHT.y < 0, 'lumiere haut-gauche');
  assert.ok(FACE_VALUE.top > FACE_VALUE.right, 'sommet plus clair');
  assert.ok(FACE_VALUE.right > FACE_VALUE.left, 'cote droit plus clair que le gauche');
});

test('direction artistique : les bandes de valeur ne se recouvrent jamais', () => {
  assert.ok(BAND.GROUND[1] < BAND.DETAIL[0], 'sol sous detail');
  assert.ok(BAND.DETAIL[1] < BAND.PROP[1], 'detail sous prop');
  assert.ok(BAND.PROP[0] > 0 && BAND.PROP[1] < 1);
});

test('direction artistique : chaque silhouette d acteur est assez large pour etre lue', () => {
  const shapes = new Set(['humanoid', 'tall', 'blob', 'quad']);
  for (const [id, s] of Object.entries(SILHOUETTE)) {
    assert.ok(s.w >= 18 && s.h >= 18, `${id} lisible a petite echelle`);
    assert.ok(s.r >= 6, `${id} a un rayon de collision credible`);
    assert.ok(s.r <= s.w / 2 + 1, `${id} : le rayon ne depasse pas la silhouette`);
    // Sans cette coherence, le rendu retombe sur la silhouette du joueur et
    // l'ennemi devient invisible ou identique au joueur.
    assert.ok(shapes.has(s.shape), `${id} : forme implementee dans le rendu`);
    assert.ok(s.silhouette === undefined, `${id} : une seule cle de forme`);
  }
});

test('direction artistique : tout ennemi declare a une silhouette propre', () => {
  for (const [id, def] of Object.entries(ENEMIES)) {
    assert.ok(SILHOUETTE[id], `${id} n a pas de silhouette dediee`);
    assert.equal(SILHOUETTE[id].shape, def.silhouette, `${id} : forme du contenu et du rendu`);
  }
});

test('direction artistique : la fenetre de telegraphie depasse le seuil de lisibilite', () => {
  assert.ok(READABILITY.TELEGRAPH_MIN_MS >= 400, 'un joueur peut anticiper');
  assert.ok(READABILITY.HIT_STOP_MS > 0, 'impact sent');
});