import {
  CLASSES, createPlayer, addXp, effectiveDamage, addItem, equipWeapon,
  bossDrops, saveGame, loadGame, wipeSave, SAVE_KEY
} from './game.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let player = null;
let selectedClass = 'warrior';
let running = false;
let lastTs = 0;
let enemies = [];
let shots = [];
let parts = [];
let atkTimer = 0;
let dogTimer = 0;
let specialCd = 0;
let spawnTimer = 0;
let target = null; // {x,y} finger target
let playerPos = { x: W / 2, y: H / 2 };
let wave = 1;
let waveKills = 0;
let waveGoal = 6;
let bossAlive = false;
let regenAcc = 0;

// ---------- UI : choix classe ----------
function renderClasses() {
  const grid = $('#class-grid');
  grid.innerHTML = '';
  for (const c of Object.values(CLASSES)) {
    const d = document.createElement('div');
    d.className = 'class-card' + (selectedClass === c.id ? ' selected' : '');
    d.innerHTML = `<div style="font-size:28px">${c.emoji}</div><h3>${c.name}</h3><p>${c.desc}</p>
      <p class="muted small">PV ${c.hp} · Dégâts ${c.dmg} · Portée ${c.range}</p>
      <p class="muted small">Spécial : <b>${c.special.name}</b> (${c.special.cooldown}s)</p>`;
    d.onclick = () => { selectedClass = c.id; renderClasses(); };
    grid.appendChild(d);
  }
  const saved = loadGame();
  $('#save-note').textContent = saved
    ? `Sauvegarde trouvée : ${CLASSES[saved.classId]?.name || '?'} niv. ${saved.level}, vague ${saved.wave}, ${saved.kills} kills.`
    : 'Aucune sauvegarde locale pour le moment.';
}

function show(id) {
  for (const s of ['#screen-class', '#screen-game', '#screen-refuge']) $(s).classList.add('hidden');
  $(id).classList.remove('hidden');
}

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.style.display = 'none'), ms);
}

function modal(title, bodyHtml) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal').classList.remove('hidden');
}
$('#modal-close').onclick = () => $('#modal').classList.add('hidden');

// ---------- Démarrage ----------
function startRun(p, startWave = 1) {
  player = p;
  wave = startWave || p.wave || 1;
  playerPos = { x: W / 2, y: H / 2 };
  enemies = []; shots = []; parts = [];
  atkTimer = 0; dogTimer = 0; specialCd = 0;
  waveKills = 0; waveGoal = 5 + wave * 2; bossAlive = false;
  running = true;
  show('#screen-game');
  toast(`Vague ${wave} — glisse pour bouger !`);
  lastTs = performance.now();
  requestAnimationFrame(loop);
}

$('#btn-start').onclick = () => {
  const withDog = $('#opt-dog').checked;
  startRun(createPlayer(selectedClass, withDog), 1);
};
$('#btn-continue').onclick = () => {
  const s = loadGame();
  if (!s) return modal('Aucune sauvegarde', '<p>Pas encore de partie sauvegardée.</p>');
  selectedClass = s.classId;
  startRun(s, s.wave || 1);
};
$('#btn-wipe').onclick = () => { wipeSave(); renderClasses(); toast('Sauvegarde effacée'); };
$('#btn-save').onclick = () => {
  if (player) { player.wave = wave; saveGame(player); toast('💾 Partie sauvegardée'); }
  else toast('Rien à sauvegarder');
};
$('#btn-refuge').onclick = () => { if (player) openRefuge(); else { show('#screen-refuge'); renderRefuge(); } };
$('#btn-help').onclick = () => modal('Aide', `<p>Glisse sur la zone de jeu pour te déplacer. Ton arme tire <b>automatiquement</b> sur l'ennemi le plus proche.</p><p>Le <b>boss arrive vague 5</b> (puis toutes les 5 vagues). Il donne la <b>Lame de Braise</b> et le <b>Cœur de Braise</b>.</p><p>Tu peux rentrer au <b>refuge 🏕️ à tout moment</b> via le bouton en haut.</p><p>Installe le jeu : Chrome → ⋮ → Ajouter à l'écran d'accueil.</p>`);
$('#btn-go').onclick = () => { if (!player) return; show('#screen-game'); lastTs = performance.now(); };
$('#btn-heal').onclick = () => { if (!player) return; player.hp = player.maxHp; saveGame(player); renderRefuge(); toast('💚 Soigné !'); };
$('#btn-dog-toggle').onclick = () => { if (!player) return; player.dog.active = !player.dog.active; renderRefuge(); };
$('#btn-dog-up').onclick = () => {
  if (!player || !player.dog.active) return;
  player.dog.level += 1; player.dog.dmg += 3;
  saveGame(player); renderRefuge(); toast(`🐕 Chien niv. ${player.dog.level}`);
};
$('#btn-special').onclick = useSpecial;

// ---------- Refuge / inventaire ----------
function openRefuge() {
  running = false;
  player.wave = wave;
  saveGame(player);
  renderRefuge();
  show('#screen-refuge');
}

function renderRefuge() {
  if (!player) { $('#refuge-stats').innerHTML = '<p class="muted">Aucune partie en cours.</p>'; $('#inventory-list').innerHTML = ''; $('#dog-panel').innerHTML = ''; return; }
  $('#refuge-stats').innerHTML = `<p>${CLASSES[player.classId].emoji} <b>${CLASSES[player.classId].name}</b> — Niv. ${player.level} · Vague ${wave}</p>
    <p>❤️ ${Math.round(player.hp)} / ${player.maxHp} · ⚔️ ${effectiveDamage(player)} dégâts · ☠️ ${player.kills} kills · 👹 ${player.bossKills} boss</p>`;
  const inv = $('#inventory-list');
  inv.innerHTML = '';
  for (const it of player.inventory) {
    const row = document.createElement('div');
    row.className = 'inv-item';
    row.innerHTML = `<span>🗡️ <b>${it.name}</b> <span class="muted small">${it.desc}</span></span>`;
    const b = document.createElement('button');
    b.className = 'btn small' + (it.equipped ? '' : '');
    b.textContent = it.equipped ? 'Équipé ✓' : 'Équiper';
    b.disabled = !!it.equipped;
    b.onclick = () => { equipWeapon(player, it.id); saveGame(player); renderRefuge(); toast(`Équipé : ${it.name}`); };
    row.appendChild(b);
    inv.appendChild(row);
  }
  for (const r of player.relics || []) {
    const row = document.createElement('div');
    row.className = 'inv-item';
    row.innerHTML = `<span>✨ <b>${r.name}</b> <span class="muted small">${r.desc}</span></span><span>✓</span>`;
    inv.appendChild(row);
  }
  if (!player.inventory.length && !(player.relics || []).length) inv.innerHTML = '<p class="muted">Inventaire vide.</p>';
  $('#dog-panel').innerHTML = player.dog.active
    ? `<p>🐕 Actif — Niv. ${player.dog.level} · Dégâts ${player.dog.dmg}</p>`
    : `<p class="muted">🐕 En pause (ou non adopté).</p>`;
}

// ---------- Spawns ----------
function spawnWave() {
  const isBossWave = wave % 5 === 0 && !bossAlive;
  if (isBossWave) {
    enemies.push({ x: W / 2, y: 90, hp: 220 + wave * 40, maxHp: 220 + wave * 40, r: 26, speed: 45, dmg: 14 + wave, boss: true, xp: 80, t: 0 });
    bossAlive = true;
    toast(`👹 BOSS vague ${wave} : Ghor Mâchefer !`);
    return;
  }
  const n = 2 + Math.min(6, wave);
  for (let i = 0; i < n; i++) {
    const edge = Math.floor(Math.random() * 4);
    let x = W / 2, y = 60;
    if (edge === 0) { x = 20 + Math.random() * (W - 40); y = 20; }
    if (edge === 1) { x = 20 + Math.random() * (W - 40); y = H - 20; }
    if (edge === 2) { x = 20; y = 40 + Math.random() * (H - 80); }
    if (edge === 3) { x = W - 20; y = 40 + Math.random() * (H - 80); }
    const hp = 22 + wave * 9;
    enemies.push({ x, y, hp, maxHp: hp, r: 11 + Math.min(6, wave * 0.4), speed: 55 + Math.min(60, wave * 5) + Math.random() * 20, dmg: 6 + wave, boss: false, xp: 8 + wave * 2, t: Math.random() * 9 });
  }
}

function nearestEnemy(from, maxDist) {
  let best = null, bd = maxDist;
  for (const e of enemies) {
    const d = Math.hypot(e.x - from.x, e.y - from.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- Combat ----------
function fireAt(e) {
  const cls = CLASSES[player.classId];
  const dmg = effectiveDamage(player);
  const dx = e.x - playerPos.x, dy = e.y - playerPos.y;
  const d = Math.hypot(dx, dy) || 1;
  shots.push({ x: playerPos.x, y: playerPos.y, vx: (dx / d) * 380, vy: (dy / d) * 380, dmg, life: 1.2, friendly: true, color: cls.id === 'mage' ? '#c084fc' : '#fde047' });
}

function useSpecial() {
  if (!player || !running || specialCd > 0) return;
  const cls = CLASSES[player.classId];
  specialCd = cls.special.cooldown;
  const dmg = Math.round(effectiveDamage(player) * cls.special.mult);
  if (player.classId === 'warrior') {
    for (const e of enemies) {
      if (Math.hypot(e.x - playerPos.x, e.y - playerPos.y) < cls.special.radius) { e.hp -= dmg; burst(e.x, e.y, '#4ade80'); }
    }
    toast(`🌀 ${cls.special.name} !`);
  } else if (player.classId === 'archer') {
    const base = nearestEnemy(playerPos, 9999);
    const ang0 = base ? Math.atan2(base.y - playerPos.y, base.x - playerPos.x) : -Math.PI / 2;
    for (let i = -2; i <= 2; i++) {
      const a = ang0 + i * 0.22;
      shots.push({ x: playerPos.x, y: playerPos.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg, life: 1.2, friendly: true, color: '#fdba74' });
    }
    toast(`🏹 ${cls.special.name} !`);
  } else {
    const tgt = nearestEnemy(playerPos, 9999) || { x: W / 2, y: H / 2 };
    for (const e of enemies) {
      if (Math.hypot(e.x - tgt.x, e.y - tgt.y) < cls.special.radius) { e.hp -= dmg; burst(e.x, e.y, '#c084fc'); }
    }
    burst(tgt.x, tgt.y, '#e879f9', 22);
    toast(`☄️ ${cls.special.name} !`);
  }
  cleanupDead();
}

function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    parts.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, life: 0.5, color });
  }
}

function killEnemy(e) {
  e.dead = true;
  player.kills += 1; waveKills += 1;
  burst(e.x, e.y, e.boss ? '#f97316' : '#f87171');
  const ups = addXp(player, e.xp);
  if (ups > 0) { toast(`⬆️ Niveau ${player.level} !`); burst(playerPos.x, playerPos.y, '#22c55e', 16); }
  if (e.boss) {
    bossAlive = false;
    player.bossKills += 1;
    for (const item of bossDrops()) {
      addItem(player, item);
      if (item.type === 'weapon') equipWeapon(player, item.id);
    }
    player.wave = wave;
    saveGame(player);
    modal('👹 Boss vaincu !', `<p>Ghor Mâchefer a lâché :</p><ul><li>🗡️ <b>Lame de Braise</b> (+34 dégâts, équipée)</li><li>✨ <b>Cœur de Braise</b> (régén +10% dégâts)</li></ul><p>Retourne au refuge pour te soigner ou continue !</p>`);
  }
  if (waveKills >= waveGoal) {
    wave += 1; waveKills = 0; waveGoal = 5 + wave * 2;
    player.wave = wave; saveGame(player);
    toast(`🌊 Vague ${wave}${wave % 5 === 0 ? ' — BOSS !' : ''}`);
  }
}

function cleanupDead() {
  for (const e of enemies) if (!e.dead && e.hp <= 0) killEnemy(e);
  enemies = enemies.filter((e) => !e.dead);
}

// ---------- Boucle ----------
function loop(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

let dogPos = { x: W / 2 + 30, y: H / 2 + 30 };

function update(dt) {
  const cls = CLASSES[player.classId];
  // mouvement vers doigt
  if (target) {
    const dx = target.x - playerPos.x, dy = target.y - playerPos.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      const step = Math.min(d, cls.speed * dt);
      playerPos.x += (dx / d) * step;
      playerPos.y += (dy / d) * step;
    }
  }
  playerPos.x = Math.max(14, Math.min(W - 14, playerPos.x));
  playerPos.y = Math.max(14, Math.min(H - 14, playerPos.y));

  // regen relique
  const regen = (player.relics || []).reduce((a, r) => a + (r.regen || 0), 0);
  if (regen > 0) player.hp = Math.min(player.maxHp, player.hp + regen * dt);

  // spawn
  spawnTimer -= dt;
  if (enemies.length < 2 + wave && spawnTimer <= 0) { spawnWave(); spawnTimer = 2.2; }

  // attaque auto joueur
  atkTimer -= dt;
  if (atkTimer <= 0) {
    const e = nearestEnemy(playerPos, cls.range);
    if (e) { fireAt(e); atkTimer = cls.cooldown; }
    else atkTimer = 0.1;
  }
  // chien
  if (player.dog.active) {
    const gx = playerPos.x + 34, gy = playerPos.y + 30;
    dogPos.x += (gx - dogPos.x) * Math.min(1, dt * 5);
    dogPos.y += (gy - dogPos.y) * Math.min(1, dt * 5);
    dogTimer -= dt;
    if (dogTimer <= 0) {
      const e = nearestEnemy(dogPos, 130);
      if (e) {
        e.hp -= player.dog.dmg;
        shots.push({ x: dogPos.x, y: dogPos.y, vx: (e.x - dogPos.x) * 4, vy: (e.y - dogPos.y) * 4, dmg: 0, life: 0.12, friendly: true, color: '#fdba74', spark: true });
        if (e.hp <= 0) killEnemy(e);
        cleanupDead();
        dogTimer = player.dog.cooldown;
      } else dogTimer = 0.15;
    }
  }

  specialCd = Math.max(0, specialCd - dt);

  // projectiles
  for (const s of shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  shots = shots.filter((s) => s.life > 0 && s.x > 0 && s.x < W && s.y > 0 && s.y < H && !s.spark);
  // collisions tirs
  for (const s of shots) {
    if (!s.friendly || s.dmg <= 0) continue;
    for (const e of enemies) {
      if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 5) {
        e.hp -= s.dmg; s.life = 0; burst(s.x, s.y, s.color, 4);
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }
  cleanupDead();
  shots = shots.filter((s) => s.life > 0);

  // ennemis -> joueur
  for (const e of enemies) {
    e.t = (e.t || 0) + dt;
    const dx = playerPos.x - e.x, dy = playerPos.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;
    if (d < e.r + 13) {
      player.hp -= e.dmg * dt;
      if (Math.random() < dt * 6) burst(playerPos.x, playerPos.y, '#ef4444', 3);
    }
  }

  // particules
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  parts = parts.filter((p) => p.life > 0);

  // mort
  if (player.hp <= 0) {
    player.hp = 0; running = false;
    player.wave = wave; saveGame(player);
    modal('💀 Tu es tombé...', `<p>Mais le refuge te relève. Vague ${wave}, ${player.kills} kills, niv. ${player.level}.</p><p>Tu repars soigné à la vague ${wave}.</p>`);
    player.hp = player.maxHp;
    setTimeout(() => { $('#modal').classList.add('hidden'); running = true; lastTs = performance.now(); requestAnimationFrame(loop); }, 2500);
  }

  // HUD
  const pct = Math.max(0, (player.hp / player.maxHp) * 100);
  $('#hud-hp-fill').style.width = pct + '%';
  $('#hud-hp-text').textContent = `❤️ ${Math.ceil(player.hp)}/${player.maxHp} · Niv ${player.level} · Vague ${wave} (${waveKills}/${waveGoal})`;
  $('#hud-info').textContent = `${cls.emoji} ${cls.name} · ⚔️ ${effectiveDamage(player)} · 🐕 ${player.dog.active ? 'oui niv.' + player.dog.level : 'non'} · ☠️ ${player.kills}`;
  const sb = $('#btn-special');
  sb.textContent = specialCd > 0 ? `⏳ ${Math.ceil(specialCd)}s` : `✨ ${cls.special.name}`;
  sb.disabled = specialCd > 0;
  regenAcc += dt;
  if (regenAcc > 5) { regenAcc = 0; player.wave = wave; saveGame(player); }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // fond grille
  ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // cible doigt
  if (target) { ctx.strokeStyle = '#334155'; ctx.beginPath(); ctx.arc(target.x, target.y, 10, 0, 7); ctx.stroke(); }

  const colors = { warrior: '#22c55e', archer: '#38bdf8', mage: '#c084fc' };
  // projectiles
  for (const s of shots) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill(); }
  // ennemis
  for (const e of enemies) {
    ctx.fillStyle = e.boss ? '#f97316' : '#ef4444';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = e.boss ? '20px serif' : '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.boss ? '👹' : '👾', e.x, e.y);
    // barre vie
    ctx.fillStyle = '#000'; ctx.fillRect(e.x - 20, e.y - e.r - 10, 40, 5);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(e.x - 20, e.y - e.r - 10, 40 * Math.max(0, e.hp / e.maxHp), 5);
    if (e.boss) { ctx.fillStyle = '#fdba74'; ctx.font = '12px sans-serif'; ctx.fillText('Ghor Mâchefer', e.x, e.y - e.r - 18); }
  }
  // chien
  if (player.dog.active) {
    ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.arc(dogPos.x, dogPos.y, 9, 0, 7); ctx.fill();
    ctx.font = '12px serif'; ctx.fillText('🐕', dogPos.x, dogPos.y);
  }
  // joueur
  ctx.fillStyle = colors[player.classId] || '#fff';
  ctx.beginPath(); ctx.arc(playerPos.x, playerPos.y, 13, 0, 7); ctx.fill();
  ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(CLASSES[player.classId].emoji, playerPos.x, playerPos.y);
  // cercle portée (léger)
  ctx.strokeStyle = '#ffffff18'; ctx.beginPath(); ctx.arc(playerPos.x, playerPos.y, CLASSES[player.classId].range, 0, 7); ctx.stroke();
  // particules
  for (const p of parts) { ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1; }
}

// ---------- Tactile : glisser pour bouger ----------
function toGame(e) {
  const r = canvas.getBoundingClientRect();
  const cx = (e.clientX - r.left) * (W / r.width);
  const cy = (e.clientY - r.top) * (H / r.height);
  return { x: cx, y: cy };
}
canvas.addEventListener('pointerdown', (e) => { target = toGame(e); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (e.buttons) target = toGame(e); });
canvas.addEventListener('pointerup', () => { /* on garde la cible */ });
$('#stage-wrap').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// ---------- Init ----------
renderClasses();
show('#screen-class');
$('#wave-bar').innerHTML = `<span>Tranche 1 : classes · auto-attaque · spécial · chien · boss vagues 5/10 · refuge · inventaire · sauvegarde locale.</span>`;

// PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
