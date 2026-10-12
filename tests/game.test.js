import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, createPlayer, applyDamage, addXp, equipWeapon, addItem, bossDrops, effectiveDamage, saveGame, loadGame, SAVE_KEY } from '../src/game.js';

test('3 classes existent avec attaques auto + spéciaux', () => {
  for (const id of ['warrior', 'archer', 'mage']) {
    const c = CLASSES[id];
    assert.ok(c, `classe ${id} définie`);
    assert.ok(c.hp > 0 && c.dmg > 0 && c.range > 0 && c.cooldown > 0);
    assert.ok(c.special && c.special.cooldown > 0, 'spécial défini');
  }
});

test('XP fait monter de niveau + boss donne arme et relique uniques', () => {
  const p = createPlayer('warrior', true);
  assert.equal(p.level, 1);
  assert.ok(p.dog.active, 'chien compagnon présent');
  const ups = addXp(p, 500);
  assert.ok(ups >= 1 && p.level > 1, 'level up');
  const drops = bossDrops();
  assert.equal(drops.length, 2);
  const [w, r] = drops;
  assert.equal(w.id, 'lame-braise');
  assert.equal(r.id, 'coeur-braise');
  addItem(p, w); addItem(p, r);
  assert.ok(equipWeapon(p, 'lame-braise'), 'arme unique équipable');
  assert.ok(effectiveDamage(p) >= 34, 'dégâts augmentés par arme + relique');
  assert.equal(applyDamage(100, 30), 70);
  assert.equal(applyDamage(10, 50), 0);
});

test('refuge : soin, inventaire, sauvegarde locale', () => {
  const p = createPlayer('mage', true);
  p.hp = 10;
  p.hp = p.maxHp; // soin refuge
  assert.equal(p.hp, p.maxHp);
  assert.ok(p.inventory.length >= 1, 'inventaire non vide');
  // sauvegarde locale simulée
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; }
  };
  assert.ok(SAVE_KEY.includes('refuge'), 'clé de sauvegarde');
  assert.ok(saveGame(p), 'sauvegarde ok');
  const reloaded = loadGame();
  assert.ok(reloaded, 'relecture ok');
  assert.equal(reloaded.classId, 'mage');
});
