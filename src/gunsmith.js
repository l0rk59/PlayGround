// ============================================================================
//  gunsmith.js — Atelier d'armes : achat, améliorations, accessoires, munitions
//  Ouvert au marché noir (E) ou via l'onglet "Arsenal" du Fixer.
// ============================================================================
import { G, S, UPGRADES, ACCS, upgradeCost, accCost, weaponPower } from './state.js';
import { WEAPONS, liveStats, applyMagSize, selectWeapon, refreshWeaponModel } from './weapons.js';
import { SFX } from './audio.js';

let open = false;
let tab = 'armes';       // armes | accessoires | munitions
let root = null;

export function initGunsmith() { build(); }
export const isOpen = () => open;

const $ = id => document.getElementById(id);

function build() {
  root = document.createElement('div');
  root.id = 'gunsmith';
  root.className = 'screen';
  root.innerHTML = `
    <div class="card gun-card">
      <h1 style="font-size:24px">ARSENAL <span class="tag yl">FIXER</span></h1>
      <h2>FORGE &amp; AMÉLIORATION — chaque élimination vous rapporte des yens</h2>
      <div id="gunWallet" class="gun-wallet"></div>
      <div class="tabs" id="gunTabs">
        <button data-t="armes" class="sel">🔫 Armes</button>
        <button data-t="acc">⚙ Accessoires</button>
        <button data-t="mun">📦 Munitions</button>
      </div>
      <div id="gunList" class="gun-list"></div>
      <div class="gun-foot">
        <span class="hint">Les améliorations sont permanentes et cumulables avec les niveaux de personnage.</span>
        <button class="btn ghost" id="gunClose" style="width:auto;padding:11px 26px">Fermer [E]</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  $('gunTabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.t;
    for (const x of $('gunTabs').children) x.classList.toggle('sel', x === b);
    render();
  });
  $('gunClose').onclick = close;
  root.addEventListener('click', e => { if (e.target === root) close(); });
}

let focusKey = null;
export function show(key) {
  open = true; root.classList.add('on');
  if (key) { focusKey = key; tab = 'armes'; for (const x of $('gunTabs').children) x.classList.toggle('sel', x.dataset.t === 'armes'); }
  render();
  if (focusKey) {
    const rows = root.querySelectorAll('.gun-row');
    rows.forEach(r => { if (r.textContent.includes(WEAPONS[focusKey].name.split(' ')[0])) r.scrollIntoView({ block: 'center' }); });
  }
}
export function close() { open = false; root.classList.remove('on'); }

const yen = n => '¥' + Math.round(n || 0).toLocaleString('fr-FR');

function render() {
  const w = $('gunWallet');
  w.innerHTML = `<span>💴 <b>${yen(G.yen)}</b></span><span>⚙️ <b>${G.scrap}</b></span><span>🔋 <b>${G.cells}</b></span>`;
  const list = $('gunList');
  list.innerHTML = '';
  if (tab === 'armes') renderWeapons(list);
  else if (tab === 'acc') renderAccs(list);
  else renderAmmo(list);
}

/* ------------------------------- armes ------------------------------- */
function renderWeapons(list) {
  for (const key of ['machete', 'knife', 'pistol', 'rifle', 'shotgun', 'dmr', 'grenade']) {
    const W = WEAPONS[key];
    const lv = G.levels[key] || 1;
    const owned = key === 'grenade' ? true : (W.melee || G.unlocked[key] === 1);
    const cost = upgradeCost(key, lv);
    const st = weaponPower(key, lv);
    const maxed = !cost;
    // prix d'achat : dans UPGRADES (0 = arme de départ)
    const price = UPGRADES[key].price || 0;
    const buyScrap = Math.round(price * .5);
    const canBuy = !owned && price > 0 && G.yen >= price && G.scrap >= buyScrap;
    const canUp = owned && cost && G.yen >= cost.yen && G.scrap >= cost.scrap;

    const row = document.createElement('div');
    row.className = 'gun-row' + (owned ? '' : ' locked') + (G.wpn === key ? ' sel' : '');
    row.innerHTML = `
      <div class="gun-ic">${W.ic}</div>
      <div class="gun-main">
        <div class="gun-name">${W.name} ${owned ? '' : '<span class="tag mg">VERROUILLÉ</span>'}</div>
        <div class="gun-stats">
          <span>⚔ ${st.dmg}</span><span>⚡ ${st.rate.toFixed(1)}/s</span>
          ${W.mag ? `<span>📦 ${liveStats(key).magSize}</span>` : ''}
        </div>
        <div class="gun-bar">${Array.from({ length: UPGRADES[key].max }, (_, i) =>
        `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}<span>NIV ${lv}/${UPGRADES[key].max}</span></div>
      </div>
      <div class="gun-act"></div>`;

    const act = row.querySelector('.gun-act');
    if (!owned) {
      const b = document.createElement('button');
      b.className = 'gb' + (canBuy ? '' : ' no');
      b.innerHTML = `Acheter<br><b>${yen(price)}</b> + ${buyScrap}⚙`;
      b.onclick = () => {
        if (G.yen < price || G.scrap < buyScrap) { SFX.deny(); return; }
        G.yen -= price; G.scrap -= buyScrap; G.unlocked[key] = 1;
        SFX.buy(); render();
        if (G.wpn === key) applyMagSize(key);
        SFX.levelUp();
      };
      act.appendChild(b);
    } else if (maxed) {
      const b = document.createElement('button');
      b.className = 'gb max'; b.innerHTML = 'MAXIMUM<br><b>✦</b>';
      b.disabled = true; act.appendChild(b);
    } else {
      const b = document.createElement('button');
      b.className = 'gb' + (canUp ? '' : ' no');
      b.innerHTML = `Améliorer<br><b>${yen(cost.yen)}</b> + ${cost.scrap}⚙`;
      b.onclick = () => {
        if (G.yen < cost.yen || G.scrap < cost.scrap) { SFX.deny(); return; }
        G.yen -= cost.yen; G.scrap -= cost.scrap;
        G.levels[key] = lv + 1;
        applyMagSize(key);
        SFX.levelUp(); render();
      };
      act.appendChild(b);
    }
    // cliquer la ligne = équiper
    row.addEventListener('click', ev => {
      if (ev.target.closest('button')) return;
      if (owned) { selectWeapon(key); applyMagSize(key); SFX.click(); render(); }
    });
    list.appendChild(row);
  }
}

/* --------------------------- accessoires --------------------------- */
function renderAccs(list) {
  for (const key of Object.keys(ACCS)) {
    const A = ACCS[key];
    const lv = G.accLv[key] || 0;
    const maxed = lv >= A.levels.length;
    const cost = accCost(key, lv);
    const can = !maxed && G.yen >= cost.yen;

    const row = document.createElement('div');
    row.className = 'gun-row' + (lv > 0 ? '' : ' locked');
    row.innerHTML = `
      <div class="gun-ic">${lv > 0 ? '⚙' : '🔒'}</div>
      <div class="gun-main">
        <div class="gun-name">${A.name} ${lv > 0 ? '<span class="tag cy">ÉQUIPÉ</span>' : ''}</div>
        <div class="gun-desc">${A.desc}</div>
        <div class="gun-bar">${A.levels.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}<span>NIV ${lv}/${A.levels.length}</span></div>
      </div>
      <div class="gun-act"></div>`;
    const act = row.querySelector('.gun-act');
    if (maxed) {
      const b = document.createElement('button');
      b.className = 'gb max'; b.innerHTML = 'MAXIMUM<br><b>✦</b>'; b.disabled = true; act.appendChild(b);
    } else {
      const b = document.createElement('button');
      b.className = 'gb' + (can ? '' : ' no');
      b.innerHTML = lv === 0 ? `Installer<br><b>${yen(cost.yen)}</b>` : `Améliorer<br><b>${yen(cost.yen)}</b>`;
      b.onclick = () => {
        if (G.yen < cost.yen) { SFX.deny(); return; }
        G.yen -= cost.yen; G.accLv[key] = lv + 1;
        SFX.levelUp(); refreshWeaponModel(); render();
      };
      act.appendChild(b);
    }
    list.appendChild(row);
  }
  const tip = document.createElement('div');
  tip.className = 'gun-tip';
  tip.innerHTML = `<b>💡</b> Le silencieux réduit le bruit (moins d'infectés attirés). La lunette resserre la dispersion. La poignée stabilise le recul. Le chargeur étendu augmente la capacité — à <b>toutes</b> les armes à feu.`;
  list.appendChild(tip);
}

/* ----------------------------- munitions ----------------------------- */
const AMMO = [
  { k: 'pistol', name: 'Pistolet K-9', ic: '🔫' },
  { k: 'rifle', name: 'Fusil V-9', ic: '🔥' },
  { k: 'shotgun', name: 'Pompes', ic: '💥' },
  { k: 'dmr', name: 'DMR', ic: '🎯' },
];
function renderAmmo(list) {
  for (const a of AMMO) {
    const owned = G.unlocked[a.k] === 1;
    const st = G.ammo[a.k];
    const packs = { pistol: [30, 90], rifle: [60, 180], shotgun: [12, 36], dmr: [16, 48] }[a.k];
    const p1 = Math.round(packs[0] * 1.6), p2 = Math.round(packs[1] * 1.7);
    for (const [n, price] of [[packs[0], p1], [packs[1], p2]]) {
      const row = document.createElement('div');
      row.className = 'gun-row' + (owned ? '' : ' locked');
      row.innerHTML = `
        <div class="gun-ic">${a.ic}</div>
        <div class="gun-main">
          <div class="gun-name">${a.name} — ${n} munitions</div>
          <div class="gun-desc">Stock actuel : <b>${st.r}</b> dans la réserve${owned ? '' : ' (arme non achetée)'}</div>
        </div>
        <div class="gun-act"></div>`;
      const b = document.createElement('button');
      b.className = 'gb' + (owned && G.yen >= price ? '' : ' no');
      b.innerHTML = `Acheter<br><b>${yen(price)}</b>`;
      b.onclick = () => {
        if (!owned) { SFX.deny(); return; }
        if (G.yen < price) { SFX.deny(); return; }
        G.yen -= price; st.r += n; SFX.buy(); render();
      };
      row.querySelector('.gun-act').appendChild(b);
      list.appendChild(row);
    }
  }
  // consommables
  const CONS = [
    { n: 'Medkit', ic: '💊', d: '+42 PV', p: 220, f: () => G.meds++ },
    { n: 'Grenade a bruit', ic: '💣', d: 'attire la horde', p: 260, f: () => G.grenades++ },
    { n: 'Jerrican', ic: '⛽', d: 'ravitaille un vehicule', p: 200, f: () => G.fuel++ },
    { n: 'Cellule d\u2019energie', ic: '🔋', d: 'monnaie de faction', p: 380, f: () => G.cells++ },
  ];
  const t = document.createElement('div');
  t.className = 'gun-sub'; t.textContent = 'CONSOMMABLES';
  list.appendChild(t);
  for (const c of CONS) {
    const row = document.createElement('div');
    row.className = 'gun-row';
    row.innerHTML = `<div class="gun-ic">${c.ic}</div><div class="gun-main"><div class="gun-name">${c.n}</div><div class="gun-desc">${c.d} — en stock : ${c.f.toString().includes('meds') ? G.meds : c.f.toString().includes('grenades') ? G.grenades : c.f.toString().includes('fuel') ? G.fuel : G.cells}</div></div><div class="gun-act"></div>`;
    const b = document.createElement('button');
    b.className = 'gb' + (G.yen >= c.p ? '' : ' no');
    b.innerHTML = `Acheter<br><b>${yen(c.p)}</b>`;
    b.onclick = () => { if (G.yen < c.p) { SFX.deny(); return; } G.yen -= c.p; c.f(); SFX.buy(); render(); };
    row.querySelector('.gun-act').appendChild(b);
    list.appendChild(row);
  }
}