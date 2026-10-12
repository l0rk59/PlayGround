export const SAVE_KEY = 'refuge-du-loup-save-v1';

export const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Guerrier', emoji: '🛡️',
    desc: 'PV élevés, épée de près. Spécial : Tourbillon.',
    hp: 140, speed: 165, dmg: 16, range: 110, cooldown: 0.55,
    special: { name: 'Tourbillon', desc: 'Dégâts à tous les ennemis proches', cooldown: 12, radius: 130, mult: 2.2 }
  },
  archer: {
    id: 'archer', name: 'Archère', emoji: '🏹',
    desc: 'Rapide, arc à longue portée. Spécial : Pluie de flèches.',
    hp: 95, speed: 215, dmg: 12, range: 240, cooldown: 0.42,
    special: { name: 'Pluie de flèches', desc: '5 projectiles en éventail', cooldown: 10, mult: 1.6 }
  },
  mage: {
    id: 'mage', name: 'Mage', emoji: '🔮',
    desc: 'Dégâts de zone. Spécial : Météore.',
    hp: 80, speed: 180, dmg: 18, range: 200, cooldown: 0.7,
    special: { name: 'Météore', desc: 'Gros dégâts de zone ciblés', cooldown: 14, radius: 120, mult: 3.0 }
  }
};

export const STARTER_WEAPONS = {
  warrior: { id: 'epee-bois', name: 'Épée en bois', type: 'weapon', dmg: 16, desc: '+16 dégâts' },
  archer: { id: 'arc-bois', name: 'Arc en bois', type: 'weapon', dmg: 12, desc: '+12 dégâts' },
  mage: { id: 'baton-bois', name: 'Bâton en bois', type: 'weapon', dmg: 18, desc: '+18 dégâts' }
};

export const BOSS_WEAPON = { id: 'lame-braise', name: 'Lame de Braise 🔥', type: 'weapon', dmg: 34, desc: 'Arme unique du boss : +34 dégâts' };
export const BOSS_RELIC = { id: 'coeur-braise', name: 'Cœur de Braise ❤️‍🔥', type: 'relic', bonus: 'regen+1 PV/s, +10% dégâts', regen: 1, dmgMult: 1.1, desc: 'Relique unique : régénère 1 PV/s, +10% dégâts' };

export function createPlayer(classId, withDog = true) {
  const c = CLASSES[classId] || CLASSES.warrior;
  return {
    classId: c.id,
    hp: c.hp, maxHp: c.hp,
    level: 1, xp: 0,
    dmg: c.dmg,
    wave: 1, kills: 0, bossKills: 0,
    dog: withDog ? { active: true, level: 1, dmg: 6, cooldown: 0.8 } : { active: false, level: 1, dmg: 6, cooldown: 0.8 },
    inventory: [{ ...STARTER_WEAPONS[c.id], equipped: true }],
    equippedWeaponId: STARTER_WEAPONS[c.id].id,
    relics: [],
    specialReadyAt: 0
  };
}

export function applyDamage(hp, dmg) {
  return Math.max(0, hp - dmg);
}

export function xpForLevel(level) {
  return 40 + level * 30;
}

export function addXp(player, amount) {
  player.xp += amount;
  let ups = 0;
  while (player.xp >= xpForLevel(player.level)) {
    player.xp -= xpForLevel(player.level);
    player.level += 1;
    player.maxHp += 12;
    player.hp = Math.min(player.maxHp, player.hp + 25);
    player.dmg += 2;
    ups += 1;
  }
  return ups;
}

export function effectiveDamage(player) {
  let mult = 1;
  for (const r of player.relics || []) {
    if (r.dmgMult) mult *= r.dmgMult;
  }
  return Math.round(player.dmg * mult);
}

export function addItem(player, item) {
  if (item.type === 'relic') {
    if (!player.relics.find((r) => r.id === item.id)) player.relics.push({ ...item });
    return 'relic';
  }
  if (!player.inventory.find((i) => i.id === item.id)) {
    player.inventory.push({ ...item, equipped: false });
  }
  return 'weapon';
}

export function equipWeapon(player, weaponId) {
  const w = player.inventory.find((i) => i.id === weaponId);
  if (!w) return false;
  player.inventory.forEach((i) => { i.equipped = i.id === weaponId; });
  player.equippedWeaponId = weaponId;
  player.dmg = w.dmg + (player.level - 1) * 2;
  return true;
}

export function bossDrops() {
  return [{ ...BOSS_WEAPON }, { ...BOSS_RELIC }];
}

export function saveGame(player) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ player, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.player || null;
  } catch { return null; }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}
