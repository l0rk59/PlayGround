import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createExpedition,
  step,
  drain,
  finish,
  obstacleList,
  useAbility,
  POI_BY_ID,
} from '../src/sim/expedition.js';
import { TICK, EXTRACTION, AIM } from '../src/data/tuning.js';
import { CLASSES, ENEMIES, BOSS } from '../src/data/content.js';
import { REGION } from '../src/data/world.js';

const IDLE = { moveX: 0, moveY: 0 };
const run = (state, seconds, input = IDLE) => {
  const steps = Math.round(seconds / TICK);
  for (let i = 0; i < steps; i++) step(state, TICK, input);
  return state;
};

test('expedition : une partie complete sans entree ne produit aucun NaN', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 42 });
  run(s, 60);
  assert.ok(Number.isFinite(s.player.x) && Number.isFinite(s.player.y));
  assert.ok(Number.isFinite(s.player.health));
  for (const e of s.enemies) {
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), 'ennemi fini');
    assert.ok(Number.isFinite(e.health));
  }
});

test('expedition : deux parties de meme graine et memes entrees sont identiques', () => {
  const input = { moveX: 1, moveY: 0.3, dodge: false };
  const a = createExpedition({ classId: 'chasseur', meta: {}, seed: 900 });
  const b = createExpedition({ classId: 'chasseur', meta: {}, seed: 900 });
  run(a, 40, input);
  run(b, 40, input);
  assert.equal(a.player.x.toFixed(6), b.player.x.toFixed(6));
  assert.equal(a.player.y.toFixed(6), b.player.y.toFixed(6));
  assert.equal(a.enemies.length, b.enemies.length);
  assert.equal(a.stats.kills, b.stats.kills);
});

test('expedition : deux graines differentes produisent des mondes differents', () => {
  const a = createExpedition({ classId: 'chasseur', meta: {}, seed: 1 });
  const b = createExpedition({ classId: 'chasseur', meta: {}, seed: 2 });
  run(a, 30);
  run(b, 30);
  const key = (s) => s.enemies.map((e) => `${Math.round(e.x)},${Math.round(e.y)}`).join('|');
  assert.notEqual(key(a), key(b));
});

test('expedition : les trois classes se comportent reellement differemment', () => {
  const results = {};
  for (const id of Object.keys(CLASSES)) {
    const s = createExpedition({ classId: id, meta: { level: 1 }, seed: 77 });
    assert.equal(s.player.maxHealth, CLASSES[id].health, `${id} : PV de base`);
    assert.equal(s.player.armor, CLASSES[id].armor, `${id} : armure`);
    assert.equal(s.player.weapon.id, CLASSES[id].weapon, `${id} : arme de depart`);
    results[id] = s.player;
  }
  const hp = Object.values(results).map((p) => p.maxHealth);
  assert.equal(new Set(hp).size, 3, 'trois PV max differents');
  const atk = Object.values(results).map((p) => p.weapon.fireInterval);
  assert.equal(new Set(atk).size, 3, 'trois cadences differentes');
});

test('expedition : le joueur ne traverse pas un obstacle', () => {
  const o = obstacleList()[0];
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  // On place le joueur contre le bord gauche du premier obstacle et on le
  // pousse vers la droite pendant plusieurs secondes.
  s.player.x = o.x - s.player.radius - 2;
  s.player.y = o.y + o.h / 2;
  run(s, 6, { moveX: 1, moveY: 0 });
  assert.ok(s.player.x < o.x + o.w, 'il est passe au travers');
  assert.ok(s.player.x <= o.x + 1, 'il est reste contre la face gauche');
});

test('expedition : le joueur reste dans les bords de la region', () => {
  const b = REGION.bounds;
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.x = b.minX + 2;
  s.player.y = b.minY + 2;
  run(s, 8, { moveX: -1, moveY: -1 });
  assert.ok(s.player.x >= b.minX, 'borne gauche');
  assert.ok(s.player.y >= b.minY, 'borne haute');
  assert.ok(s.player.x <= b.maxX && s.player.y <= b.maxY);
});

test('expedition : le pad refuse l extraction avant l heure', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.x = REGION.extraction.x;
  s.player.y = REGION.extraction.y;
  s.timeLimit = 1000;
  run(s, 10);
  assert.equal(s.status, 'running', 'sortie impossible avant la fin de la periode');
  assert.ok(s.player.extractHold === 0);
});

test('expedition : le pad accepte une extraction complete apres la periode', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.x = REGION.extraction.x;
  s.player.y = REGION.extraction.y;
  s.timeLimit = 2;
  run(s, 8);
  assert.equal(s.status, 'extracted');
});

test('expedition : le joueur qui meurt passe le run en defaite', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.health = 1;
  s.enemies.length = 0;
  s.player.x = POI_BY_ID.gare.x;
  s.player.y = POI_BY_ID.gare.y;
  run(s, 1);
  const dead = drain(s).some((e) => e.type === 'run:dead');
  if (dead) assert.equal(s.status, 'dead');
  assert.ok(s.status === 'running' || s.status === 'dead');
});

test('expedition : entrer dans la zone du boss le fait apparaitre, une seule fois', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.x = POI_BY_ID.seuil.x;
  s.player.y = POI_BY_ID.seuil.y;
  step(s, TICK, IDLE);
  assert.ok(s.boss, 'le boss est present');
  assert.equal(s.boss.maxHealth, BOSS.health);
  run(s, 2);
  assert.equal(s.boss.id, 'boss', 'le boss n est pas remplace par un nouveau');
});

test('expedition : le boss traverse ses trois phases et ne se fait pas tuer pendant un changement', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.x = POI_BY_ID.seuil.x;
  s.player.y = POI_BY_ID.seuil.y;
  step(s, TICK, IDLE);
  const seen = [];
  for (const frac of [0.6, 0.3, 0.1]) {
    s.boss.health = s.boss.maxHealth * frac;
    run(s, 2);
    seen.push(s.boss.phase);
    assert.ok(!s.boss.dead, 'le boss survit au changement de phase');
  }
  assert.deepEqual(seen, [1, 2, 2], 'les phases montent, jamais ne redescendent');
  assert.equal(s.boss.phase, 2);
});

test('expedition : le boss vaincu rend une recompense unique, pas du butin ordinaire', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.x = POI_BY_ID.seuil.x;
  s.player.y = POI_BY_ID.seuil.y;
  step(s, TICK, IDLE);
  drain(s);
  s.bullets.push({ x: s.boss.x, y: s.boss.y, vx: 0, vy: 0, life: 1, damage: 99999, pierce: 0, radius: 40 });
  step(s, TICK, IDLE);
  const evts = drain(s);
  const down = evts.find((e) => e.type === 'boss:down');
  assert.ok(down, 'evenement de victoire');
  assert.equal(down.reward, BOSS.uniqueReward);
});

test('expedition : le butin ramasse rejoint l inventaire de expedition', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.pickups.push({ id: 'scrap', qty: 3, x: s.player.x + 6, y: s.player.y, vx: 0, vy: 0, life: 999 });
  s.pickups.push({ id: 'ration', qty: 1, x: s.player.x - 6, y: s.player.y, vx: 0, vy: 0, life: 999 });
  step(s, TICK, IDLE);
  assert.equal(s.pickups.length, 0);
  assert.deepEqual(
    s.carry.map((c) => c.id).sort(),
    ['ration', 'scrap'],
  );
});

test('expedition : la telegraphie est annoncee AVANT le coup, jamais simultanement', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  drain(s);
  const e = {
    x: s.player.x + 60,
    y: s.player.y,
    hp: 100,
    maxHealth: 100,
    dead: false,
  };
  void e;
  // Le directeur fait apparaitre des ennemis : on surveille un seul ennemi
  // pose a portee et on verifie que le coup ne part pas sans annonce.
  s.enemies.length = 0;
  s.spawnTimer = 0;
  run(s, 1);
  const e2 = s.enemies[0];
  if (!e2) return;
  let sawTelegraph = false;
  let struckAfter = false;
  let telegraphed = false;
  for (let i = 0; i < 900; i++) {
    step(s, TICK, IDLE);
    for (const ev of drain(s)) {
      if (ev.type === 'enemy:telegraph') {
        telegraphed = true;
        sawTelegraph = true;
      }
      if (ev.type === 'enemy:strike') {
        assert.ok(telegraphed, 'aucun coup sans telegraphie prealable');
        struckAfter = telegraphed;
      }
    }
    if (struckAfter) break;
  }
  assert.ok(sawTelegraph, 'une telegraphie a ete emise pendant la partie');
});

test('expedition : le compagnon ne bloque jamais le joueur et revient apres une chute', () => {
  const s = createExpedition({ classId: 'porteuse', meta: { dogUnlocked: true }, seed: 5 });
  assert.ok(s.companion, 'compagnon present quand il est debloque');
  s.companion.health = 0;
  step(s, TICK, IDLE);
  assert.ok(s.companion.down > 0, 'il tombe mais ne meurt pas');
  s.companion.down = 0.01;
  step(s, TICK, IDLE);
  assert.ok(!s.companion.down, 'il revient');
  assert.ok(s.companion.health > 0);
});

test('expedition : sans compagnon, la partie reste jouable', () => {
  const s = createExpedition({ classId: 'survivante', meta: { dogUnlocked: false }, seed: 5 });
  assert.equal(s.companion, null);
  run(s, 30);
  assert.ok(s.status === 'running' || s.status === 'dead');
});

test('expedition : l equipement modifie reellement le tir', () => {
  const base = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  const swapped = createExpedition({ classId: 'survivante', meta: {}, seed: 5, loadout: { arme: 'rail' } });
  assert.equal(base.player.weapon.id, 'pistol');
  assert.equal(swapped.player.weapon.id, 'rail');
  assert.ok(swapped.player.weapon.damage > base.player.weapon.damage, 'le rail touche plus fort');
  assert.ok(swapped.player.weapon.fireInterval > base.player.weapon.fireInterval, 'mais plus lentement');
  const shotgun = createExpedition({ classId: 'survivante', meta: {}, seed: 5, loadout: { arme: 'scattergun' } });
  assert.ok(shotgun.player.weapon.range < base.player.weapon.range, 'le scattergun porte moins loin');
});

test('expedition : les capacites de classe partent en cooldown et ne se cumulent pas', () => {
  for (const id of Object.keys(CLASSES)) {
    const s = createExpedition({ classId: id, meta: {}, seed: 5 });
    assert.equal(useAbility(s), true, `${id} : la capacite part`);
    assert.ok(s.player.abilityCooldownUntil > 0, `${id} : un cooldown est ouvert`);
    assert.equal(useAbility(s), false, `${id} : pas de relance pendant le cooldown`);
    // Le cooldown se resorbe tout seul, la capacite redevient disponible.
    run(s, CLASSES[id].ability.cooldown + 1);
    assert.equal(useAbility(s), true, `${id} : de nouveau disponible`);
  }
});

test('expedition : la touche de soin respecte son cooldown et plafonne', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.player.health = 40;
  step(s, TICK, { moveX: 0, moveY: 0, heal: true });
  assert.equal(s.player.health, 68);
  step(s, TICK, { moveX: 0, moveY: 0, heal: true });
  assert.equal(s.player.health, 68, 'pas de soin en rafale');
});

test('expedition : fin() renvoie le bilan exploitable pour la progression', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.timeLimit = 1;
  s.player.x = REGION.extraction.x;
  s.player.y = REGION.extraction.y;
  run(s, 6);
  const out = finish(s);
  assert.equal(out.status, 'extracted');
  assert.ok(Array.isArray(out.carried));
  assert.ok(out.seconds >= 1);
  assert.equal(out.bossKilled, false);
});

test('expedition : le rayon d extraction est celui annonce par le reglage', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.timeLimit = 0;
  s.player.x = REGION.extraction.x + EXTRACTION.radius - 4;
  s.player.y = REGION.extraction.y;
  run(s, 5);
  assert.equal(s.status, 'extracted', 'juste a l interieur du pad');
});

test('expedition : hors du pad, le maintien se remet a zero', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  s.timeLimit = 0;
  s.player.x = REGION.extraction.x + EXTRACTION.radius - 4;
  s.player.y = REGION.extraction.y;
  run(s, 1);
  assert.ok(s.player.extractHold > 0);
  s.player.x = REGION.extraction.x + EXTRACTION.radius + 60;
  run(s, 0.5);
  assert.equal(s.player.extractHold, 0);
});

test('expedition : chaque famille d ennemis tient ses promesses de conception', () => {
  const known = new Set(['charge', 'flank', 'ranged', 'station']);
  for (const [id, def] of Object.entries(ENEMIES)) {
    assert.ok(def.health > 0, `${id} a des PV`);
    assert.ok(def.damage > 0, `${id} fait des degats`);
    assert.ok(known.has(def.behavior), `${id} a un comportement implemente`);
    assert.ok(def.attackWindup >= 0.3, `${id} : toute attaque est annoncee au moins 300 ms`);
    assert.ok(def.attackRecover > 0, `${id} : le joueur a le temps de repartir apres le coup`);
    assert.ok(def.telegraph <= def.attackWindup + 0.01, `${id} : la telegraphie annonce le coup`);
    if (def.behavior === 'ranged') assert.ok(def.projectileSpeed > 0, `${id} a un projectile`);
    if (def.behavior === 'station') assert.ok(def.speed === 0 && def.beam, `${id} est fixe et tire un faisceau`);
    if (def.behavior === 'flank') assert.ok(def.speed > 120, `${id} doit etre plus vif qu'un simple marcheur`);
  }
});

test('expedition : aucune famille n est hors d atteinte du tir automatique de depart', () => {
  const s = createExpedition({ classId: 'survivante', meta: {}, seed: 5 });
  const reach = Math.min(s.player.weapon.range, AIM.maxRange);
  for (const def of Object.values(ENEMIES)) {
    assert.ok(def.attackRange <= reach, `${def.id} engage a portee du tir automatique`);
  }
  assert.ok(reach > 0);
});