// ============================================================================
//  hud.js — HUD, menus, boutique, carte, quêtes, toasts (DOM)
// ============================================================================
import * as THREE from 'three';
import { G, S, mods, clamp, xpForLevel, saveSettings as saveS, applyQuality } from './state.js';
import { WEAPONS, ORDER, Wp, hasAmmo, selectWeapon } from './weapons.js';
import { PARTS } from './building.js';
import { QUESTS, POIs } from './director.js';
import { ROSTER, NPCS } from './survivors.js';
import { TYPES } from './enemies.js';
import { W } from './world.js';
import { V } from './vehicles.js';
import { E } from './enemies.js';
import { LOOT, DROPS } from './loot.js';
import { DEFS, defenseCount } from './building.js';
import { SFX } from './audio.js';
import * as FX from './fx.js';
import { setVolume } from './audio.js';

const $ = id => document.getElementById(id);
let cam = null, showShopCb = null, weaponPickCb = null;
export function initHUD(camera, hooks) {
  cam = camera;
  showShopCb = hooks?.showShop; weaponPickCb = hooks?.pickWeapon;
  buildWeaponBar(); buildQuickItems(); buildCompass();
}
export function setHUDHooks(h) { showShopCb = h.showShop; weaponPickCb = h.pickWeapon; }

/* ---------------- HUD: barre d'armes ---------------- */
function buildWeaponBar() {
  const list = $('wpnList'); list.innerHTML = '';
  const show = ORDER.filter(k => k === 'grenade' ? true : true);
  for (const k of show) {
    const w = WEAPONS[k];
    const slot = document.createElement('div');
    slot.className = 'wslot'; slot.dataset.k = k;
    slot.innerHTML = `<div class="ic">${w.ic}</div><div class="nm">${w.name.split(' ')[0]}</div><div class="kk">${w.slot < 6 ? (w.slot + 1) : 'G'}</div>`;
    slot.onclick = () => { if (weaponPickCb) weaponPickCb(k); };
    list.appendChild(slot);
  }
  refreshWeaponBar();
}
export function refreshWeaponBar() {
  const list = $('wpnList');
  for (const s of list.children) {
    const k = s.dataset.k, w = WEAPONS[k];
    const owned = k === 'grenade' ? G.grenades > 0 : (w.melee || G.unlocked[k] === 1);
    s.classList.toggle('sel', G.wpn === k);
    s.classList.toggle('empty', !owned);
  }
  // munitions
  const w = WEAPONS[G.wpn];
  $('wname').textContent = w.name + (mods.silencer && (G.wpn === 'pistol' || G.wpn === 'rifle') ? ' +SIL' : '');
  if (w.melee) $('ammoTxt').innerHTML = '∞';
  else if (w.throwable) $('ammoTxt').innerHTML = `${G.grenades} <small> grenades</small>`;
  else {
    const a = G.ammo[w.mag];
    $('ammoTxt').innerHTML = `${a.m} <small>/ ${a.r}</small>`;
  }
}
export function reloadBar(k) {
  const b = $('reloadBar');
  b.classList.toggle('on', k > 0);
  b.firstElementChild.style.width = (k * 100) + '%';
}

/* ---------------- HUD: items rapides ---------------- */
function buildQuickItems() { // (references defenseCount via refreshQuick)
  const q = $('quick'); q.innerHTML = '';
  const items = [
    { id: 'med', ic: '💊', kb: 'H', n: () => G.meds, act: () => { /* géré par main */ } },
    { id: 'gren', ic: '💣', kb: 'G', n: () => G.grenades, act: () => { } },
    { id: 'fuel', ic: '⛽', kb: '', n: () => G.fuel, act: () => { } },
    { id: 'build', ic: '🛠', kb: 'B', n: () => defenseCount(), act: () => { } },
  ];
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'qi'; d.id = 'qi_' + it.id;
    d.innerHTML = `<span class="kb">${it.kb}</span><span class="ic">${it.ic}</span><span class="n">${it.n()}</span>`;
    d.onclick = () => window.dispatchEvent(new CustomEvent('nd:quick', { detail: it.id }));
    q.appendChild(d);
  }
}
export function refreshQuick() {
  const set = (id, v) => { const e = $('qi_' + id); if (e) { e.querySelector('.n').textContent = v; e.style.opacity = v > 0 ? 1 : .4; } };
  set('med', G.meds); set('gren', G.grenades); set('fuel', G.fuel); set('build', defenseCount());
}

/* ---------------- HUD: boussole ---------------- */
const CARD = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
function buildCompass() {
  const strip = $('compassStrip');
  let html = '';
  // deux copies pour défilement continu
  for (let rep = 0; rep < 2; rep++) {
    for (let deg = 0; deg < 360; deg += 15) {
      const lbl = CARD[deg];
      html += `<span class="${lbl ? 'card' : ''}" data-deg="${deg}">${lbl || '·'}</span>`;
    }
  }
  strip.innerHTML = html;
}

/* ---------------- HUD: mise à jour ---------------- */
export function updateHUD(dt) {
  // vitals
  $('hpFill').style.transform = `scaleX(${clamp(G.hp / G.maxHp, 0, 1)})`;
  $('hpTxt').textContent = `${Math.ceil(G.hp)}/${G.maxHp}`;
  $('stFill').style.transform = `scaleX(${G.stam / 100})`;
  $('lvlTxt').textContent = `NIV. ${G.lvl}`;
  $('xpTxt').textContent = `${Math.floor(G.xp)}/${xpForLevel(G.lvl)} XP`;
  $('xpFill').style.transform = `scaleX(${G.xp / xpForLevel(G.lvl)})`;
  $('sScrap').textContent = G.scrap; $('sMed').textContent = G.meds; $('sFuel').textContent = G.fuel;
  // temps
  const night = G.phase < .22 || G.phase > .82;
  $('dayTxt').textContent = (night ? '🌙 NUIT ' : '☀ JOUR ') + G.day;
  $('dayTxt').style.color = night ? '#c9a6ff' : '#ffe14d';
  $('clockFill').style.width = (G.phase * 100) + '%';
  // vague
  const wp = $('wavePanel');
  if (G.waveActive) { wp.classList.add('on'); wp.textContent = `⚠ VAGUE ${G.wave} · ${G.waveSpawns} restants`; }
  else wp.classList.remove('on');
  // low hp
  $('lowHp').classList.toggle('on', G.hp / G.maxHp < .3 && !G.dead);
  // quad crosshair dynamique (spread)
  const w = WEAPONS[G.wpn];
  if (w.melee || w.throwable) { hideCross(); }
  else {
    const sp = (w.spread || .02) * (1 - (Wp.aim || 0) * .6) * (G.sprint ? 2 : 1) * (G.grounded ? 1 : 2) * 26;
    const gap = clamp(4 + sp, 3, 22);
    $('chT').style.transform = `translateY(${-gap}px)`;
    $('chB').style.transform = `translateY(${gap}px)`;
    $('chL').style.transform = `translateX(${-gap}px)`;
    $('chR').style.transform = `translateX(${gap}px)`;
    showCross();
  }
  // boussole
  updateCompass();
  drawMap();
}
function showCross() { for (const id of ['chT', 'chB', 'chL', 'chR']) $(id).style.opacity = ''; }
function hideCross() { for (const id of ['chT', 'chB', 'chL', 'chR']) $(id).style.opacity = '0'; }
function updateCompass() {
  const strip = $('compassStrip');
  // yaw : 0 = nord (-z). degrés = yawDeg
  let deg = ((G.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const span = 52 * 24; // 24 labels de 15°
  const off = -(deg / 15) * 52 + ($('compass').clientWidth / 2) - 26;
  strip.style.transform = `translateX(${off}px)`;
  // highlight point d'intérêt le plus proche
}

/* ---------------- minimap ---------------- */
const mm = $('mm').getContext('2d');
let mmT = 0;
function drawMap() {
  const S = 300, C = S / 2, RANGE = 150, K = S / (RANGE * 2);
  mmT -= 1;
  mm.fillStyle = 'rgba(4,8,18,.92)'; mm.fillRect(0, 0, S, S);
  // grille
  mm.strokeStyle = 'rgba(0,232,255,.08)'; mm.lineWidth = 1;
  for (let i = 0; i <= 6; i++) { const p = i / 6 * S; mm.beginPath(); mm.moveTo(p, 0); mm.lineTo(p, S); mm.moveTo(0, p); mm.lineTo(S, p); mm.stroke(); }
  const px = G.px, pz = G.pz;
  const rot = -G.yaw;
  function pt(x, z) {
    const dx = x - px, dz = z - pz;
    const c = Math.cos(rot), s = Math.sin(rot);
    return [C + (dx * c - dz * s) * K, C + (dx * s + dz * c) * K];
  }
  function dot(x, z, color, size = 3, glow = false) {
    const [sx, sy] = pt(x, z);
    if (sx < -8 || sx > S + 8 || sy < -8 || sy > S + 8) return;
    mm.fillStyle = color;
    mm.beginPath(); mm.arc(sx, sy, size, 0, TAU2); mm.fill();
  }
  const TAU2 = Math.PI * 2;
  // bâtiments
  mm.fillStyle = 'rgba(80,110,150,.5)';
  for (const b of (W.blocks || [])) {
    const [sx, sy] = pt(b.x, b.z);
    if (sx < 0 || sx > S || sy < 0 || sy > S) continue;
    mm.fillRect(sx - 2, sy - 2, 4, 4);
  }
  // POI
  for (const p of POIs) {
    dot(p.x, p.z, p.kind === 'market' ? '#ff2d78' : p.kind === 'camp' ? '#5dff8f' : '#00e8ff', 5);
  }
  // forêt
  if (W.forest) { const [fx, fy] = pt(W.forest.x, W.forest.z); mm.strokeStyle = 'rgba(157,107,255,.4)'; mm.beginPath(); mm.arc(fx, fy, W.forest.R * K, 0, TAU2); mm.stroke(); }
  // véhicules
  for (const v of V) dot(v.m.position.x, v.m.position.z, '#00e8ff', 4);
  // PNJ
  for (const n of NPCS) dot(n.m.position.x, n.m.position.z, n.recruited ? '#5dff8f' : '#ffffff', 4);
  // ennemis
  for (const e of E) if (e.die <= 0) dot(e.m.position.x, e.m.position.z, '#ff3355', 3);
  // butin
  for (const c of LOOT) if (!c.looted) dot(c.x, c.z, '#ffe14d', 2);
  // joueur (flèche)
  mm.save(); mm.translate(C, C); mm.rotate(-rot);
  mm.fillStyle = '#fff'; mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(0, 3); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
  mm.restore();
}

/* ---------------- toasts / killfeed ---------------- */
const toastQueue = [];
export function toast(txt, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = txt;
  $('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 2600);
  while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
}
export function kf(txt, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'kf ' + kind; el.textContent = txt;
  $('killfeed').appendChild(el);
  setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600); }, 3200);
  while ($('killfeed').children.length > 6) $('killfeed').firstChild.remove();
}
export function kill(type, headshot) {
  const t = TYPES[type]?.name || type;
  hitmarker(headshot);
  kf(`☠ ${t}${headshot ? ' ⌖' : ''}`, 'info');
}
export function levelUp(lvl) {
  toast(`⭐ NIVEAU ${lvl} ! +PV max, +dégâts`, 'gold');
  SFX.levelUp();
  FX.flash(.5);
}
export function hitmarker(kill_) {
  const h = $('hit');
  h.classList.toggle('kill', !!kill_);
  h.classList.remove('hitAnim'); void h.offsetWidth; h.classList.add('hitAnim');
}

/* ---------------- prompts & interactions ---------------- */
export function prompt(key, txt) {
  const p = $('prompt');
  if (!txt) { p.classList.remove('on'); return; }
  $('promptKey').textContent = key; $('promptTxt').textContent = txt;
  p.classList.add('on');
}
/* ---------------- badge zone franche ---------------- */
export function safeZone(z) {
  const b = $('safeBadge');
  if (!b) return;
  if (!z) { b.classList.remove('on'); return; }
  b.classList.add('on');
  $('safeName').textContent = '🛡 ' + z.name;
  b.style.borderColor = z.color || '#5dff8f';
  b.style.color = z.color || '#5dff8f';
}

export function flash(a = .6) { const f = $('flash'); f.style.opacity = a; setTimeout(() => f.style.opacity = 0, 120); }

/* ---------------- barre de construction ---------------- */
export function buildBar(show) {
  const b = $('build');
  if (!show) { b.classList.remove('on'); $('buildHint').classList.remove('on'); return; }
  b.classList.add('on'); $('buildHint').classList.add('on');
  b.innerHTML = '';
  PARTS.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'bI' + (i === (window.__bsel || 0) ? ' sel' : '');
    btn.innerHTML = `${p.name}<b>${p.cost}⚙️ · ${p.desc}</b>`;
    btn.onclick = () => { window.dispatchEvent(new CustomEvent('nd:part', { detail: i })); };
    b.appendChild(btn);
  });
}

/* ---------------- boutique ---------------- */
const SHOP_TABS = ['all', 'ammo', 'heal', 'gun', 'acc', 'base'];
let shopTab = 'all';
const ITEMS = () => [
  { c: 'ammo', n: '🔫 Munitions pistolet +40', d: 'rechargePrecision', p: 20, f: () => { G.ammo.pistol.r += 40; } },
  { c: 'ammo', n: '🔥 Munitions fusil +80', d: 'precision pour fusil', p: 30, f: () => { G.ammo.rifle.r += 80; } },
  { c: 'ammo', n: '💥 Pompes +16', d: 'anti-horde', p: 25, f: () => { G.ammo.shotgun.r += 16; } },
  { c: 'ammo', n: '🎯 DMR +20', d: 'tir de précision', p: 30, f: () => { G.ammo.dmr.r += 20; } },
  { c: 'heal', n: '💊 Medkit +1', d: 'soin 42 PV', p: 22, f: () => { G.meds++; } },
  { c: 'heal', n: '💉 Cellule d\'énergie +1', d: 'boost (vendable)', p: 30, f: () => { G.cells++; } },
  { c: 'heal', n: '⛽ Carburant +1', d: 'ravitaille un véhicule', p: 18, f: () => { G.fuel++; } },
  { c: 'gun', n: '🔪 Débloquer couteau tactique', d: 'légère, rapide', p: 60, f: () => { G.unlocked.knife = 1; } },
  { c: 'gun', n: '💥 Fusil à pompes', d: '8 projectiles, wrecking', p: 320, f: () => { G.unlocked.shotgun = 1; } },
  { c: 'gun', n: '🎯 DMR de précision', d: 'haute précision, 88 dégâts', p: 520, f: () => { G.unlocked.dmr = 1; } },
  { c: 'acc', n: '🔇 Silencieux', d: 'moins de bruit', p: 140, f: () => { mods.silencer = true; } },
  { c: 'acc', n: '🔭 Lunette', d: 'réduit dispersion', p: 160, f: () => { mods.scope = true; } },
  { c: 'acc', n: '✊ Poignée stabilisée', d: 'moins de recul', p: 120, f: () => { mods.grip = true; } },
  { c: 'base', n: '🔧 Réparer TOUT le camp', d: 'remet les pièces à 100%', p: 80, f: () => { for (const d of DEFS) d.hp = d.maxhp; } },
  { c: 'base', n: '🔧 Réparer le véhicule conduit', d: 'pleine santé', p: 60, f: () => { if (G.inVeh) G.inVeh.hp = G.inVeh.maxhp; } },
  { c: 'base', n: '⚡ Améliorer PV max +10', d: 'permanente', p: 250, f: () => { G.maxHp += 10; G.hp = G.maxHp; } },
  { c: 'base', n: '📦 Lot survieur +1', d: 'aléatoire', p: 200, f: () => { G.meds += 2; G.grenades += 2; G.fuel += 1; } },
];
export function renderShop() {
  $('wallet').innerHTML = `<span>⚙️ <b>${G.scrap}</b></span><span>💊 <b>${G.meds}</b></span><span>💣 <b>${G.grenades}</b></span><span>⛽ <b>${G.fuel}</b></span>`;
  const box = $('shopItems'); box.innerHTML = '';
  for (const it of ITEMS()) {
    if (shopTab !== 'all' && it.c !== shopTab) continue;
    const row = document.createElement('div'); row.className = 'shopI';
    const can = G.scrap >= it.p;
    row.innerHTML = `<div><div class="n">${it.n}</div><div class="d">${it.d}</div></div>`;
    const btn = document.createElement('button');
    btn.textContent = `${it.p} ⚙️`; btn.className = can ? '' : 'no';
    btn.onclick = () => {
      if (G.scrap < it.p) { SFX.deny(); return; }
      G.scrap -= it.p; it.f(); SFX.buy(); renderShop(); refreshQuick();
    };
    row.appendChild(btn); box.appendChild(row);
  }
}
export function initShopTabs() {
  $('shopTabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    shopTab = b.dataset.t;
    for (const x of $('shopTabs').children) x.classList.toggle('sel', x === b);
    renderShop();
  });
}
export function openShop() { $('shopScreen').classList.add('on'); renderShop(); }
export function closeShop() { $('shopScreen').classList.remove('on'); }
export const shopOpen = () => $('shopScreen').classList.contains('on');

/* ---------------- quêtes ---------------- */
export function renderQuests() {
  const box = $('questFull'); if (!box) return;
  box.innerHTML = QUESTS.map(q => {
    const d = q.done();
    return `<div class="statGrid" style="grid-template-columns:1fr"><div><b style="color:${d ? '#5dff8f' : '#ffe14d'}">${d ? '✔' : '○'} ${q.title}</b><div style="margin-top:3px;color:#9fc4d8">${q.txt()}</div></div></div>`;
  }).join('');
  // mini objectives en jeu
  const track = $('questTrack');
  const active = QUESTS.filter(q => !G.questDone[q.id]).slice(0, 3);
  track.innerHTML = active.map(q => {
    const t = q.txt().match(/\((\d+)\/(\d+)\)/);
    const prog = t ? clamp(t[1] / t[2], 0, 1) : 0;
    return `<div class="qb"><i style="width:${prog * 100}%"></i></div><div class="qt"><span>${q.title}</span><b>${t ? t[1] + '/' + t[2] : ''}</b></div>`;
  }).join('') || '<div class="qt">Toutes les quêtes Accomplies !</div>';
}
export function openQuests() { $('questScreen').classList.add('on'); renderQuests(); }
export function closeQuests() { $('questScreen').classList.remove('on'); }

/* ---------------- note ---------------- */
export function showNote(n) {
  $('noteTitle').textContent = n.title; $('noteAuthor').textContent = '— ' + n.author;
  $('noteTxt').textContent = n.txt;
  $('noteScreen').classList.add('on');
  document.body.classList.add('noting');
}

/* ---------------- pause / mort / settings ---------------- */
export function openPause(info) {
  $('pSub').textContent = `JOUR ${G.day} · ${G.phase < .22 || G.phase > .82 ? 'NUIT' : 'JOUR'} · NIV ${G.lvl}`;
  const st = info || [];
  $('pStats').innerHTML = st.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  renderQuests();
  $('pauseScreen').classList.add('on');
}
export function closePause() { $('pauseScreen').classList.remove('on'); }
export function openDeath(info) {
  $('dSub').textContent = `JOUR ${G.day} · NIV ${G.lvl} · ☠ ${G.kills}`;
  $('dStats').innerHTML = (info || []).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('deathScreen').classList.add('on');
}
export function closeDeath() { $('deathScreen').classList.remove('on'); }
export const anyOverlay = () => ['shopScreen', 'pauseScreen', 'deathScreen', 'questScreen', 'noteScreen', 'settingsScreen', 'titleScreen']
  .some(id => $(id).classList.contains('on'));
export function hideAll() {
  for (const id of ['shopScreen', 'pauseScreen', 'deathScreen', 'questScreen', 'noteScreen', 'settingsScreen', 'titleScreen']) $(id).classList.remove('on');
  document.body.classList.remove('noting');
}

export function initSettingsHooks() {
  const bindRange = (id, vid, key, fromVal, toVal, fmt, set) => {
    const s = $(id), v = $(vid);
    if (!s) return;
    s.value = Math.round(fromVal(S[key]));
    if (s.value < +s.min) s.value = +s.min;
    if (s.value > +s.max) s.value = +s.max;
    v.textContent = fmt(s.value);
    s.oninput = () => { v.textContent = fmt(s.value); set(+s.value); };
  };
  bindRange('sSens', 'vSens', 'sens', v => v * 100, v => v, x => (x / 100).toFixed(2), x => { S.sens = x / 100; saveS(); });
  bindRange('sFov', 'vFov', 'fov', v => v, v => v, x => x, x => { S.fov = x; saveS(); });
  bindRange('sVol', 'vVol', 'vol', v => v * 100, v => v, x => x, x => { S.vol = x / 100; setVolume(x / 100); saveS(); });
  const seg = (id, attr, key, after) => {
    const box = $(id);
    for (const b of box.children) b.classList.toggle('sel', String(S[key]) === b.dataset[attr] || (key === 'bloom' && S.bloom === (b.dataset[attr] === '1')) || (key === 'shake' && S.shake === (b.dataset[attr] === '1')) || (key === 'invertY' && S.invertY === (b.dataset[attr] === '1')));
    box.onclick = e => { const b = e.target.closest('button'); if (!b) return; S[key] = b.dataset[attr] === '1'; for (const x of box.children) x.classList.toggle('sel', x === b); saveS(); after && after(); };
  };
  seg('sBloom', 'b', 'bloom', () => { saveS(); });
  seg('sShake', 'k', 'shake', saveS);
  seg('sInv', 'i', 'invertY', saveS);
  // qualité
  const qb = $('sQual');
  for (const b of qb.children) b.classList.toggle('sel', b.dataset.q === S.quality);
  qb.onclick = e => { const b = e.target.closest('button'); if (!b) return; S.quality = b.dataset.q; for (const x of qb.children) x.classList.toggle('sel', x === b); saveS(); applyQuality(); location.reload(); };
}


/* UI stub global accessible depuis enemies/building/loot/survivors */
import { dropsFromEnemy } from './loot.js';
window.UI = {
  toast: (t, k) => toast(t, k),
  kf: (t, k) => kf(t, k),
  kill: (t, hs) => kill(t, hs),
  levelUp: l => levelUp(l),
  showNote: n => showNote(n),
  drop: e => dropsFromEnemy(e),
};