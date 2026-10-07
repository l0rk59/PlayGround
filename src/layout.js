// ============================================================================
//  layout.js — disposition des boutons tactiles entièrement configurable
//  L'utilisateur peut repositionner/redimensionner chaque bouton, et choisir
//  le一只手 / deux mains pour les zones de stick.
// ============================================================================
import { S, saveSettings, clamp } from './state.js';
import { layoutTouch as defaultLayout } from './input.js';

export const BTN = [
  { id: 'bFire', label: 'FEU', kind: 'round', def: { r: 18, b: 18, s: 82 } },
  { id: 'bAct', label: 'ACTION', kind: 'round', def: { r: 112, b: 24, s: 56 } },
  { id: 'bAim', label: 'VISER', kind: 'round', def: { r: 84, b: 16, s: 52 } },
  { id: 'bReload', label: 'RECHARG.', kind: 'round', def: { r: 82, b: 78, s: 46 } },
  { id: 'bJump', label: 'SAUT', kind: 'round', def: { r: 20, b: 88, s: 48 } },
  { id: 'bBuild', label: 'CONSTRUIRE', kind: 'round', def: { l: 47, b: 16, s: 46 } },
  { id: 'bHorn', label: 'KL AXON', kind: 'round', def: { l: 48, b: 72, s: 42 } },
  { id: 'bPause', label: 'PAUSE', kind: 'round', def: { l: 3, b: 12, s: 38 } },
];
export const ZONES = [
  { id: 'zL', label: 'DÉPLACEMENT', def: { l: 0, t: 30, w: 44, h: 70 } },
  { id: 'zR', label: 'VISER / TIRER', def: { l: 50, t: 0, w: 50, h: 100 } },
];

/** appliqués au CSS : chaque bouton devient position:fixed avec left/top en % */
export function applyLayout() {
  const cfg = S.layout || {};
  for (const b of BTN) {
    const el = document.getElementById(b.id); if (!el) continue;
    const p = cfg[b.id] || b.def;
    el.style.width = p.s + 'px'; el.style.height = p.s + 'px';
    el.style.left = ''; el.style.right = ''; el.style.top = ''; el.style.bottom = '';
    if (p.l !== undefined) {
      // ancre gauche en % de la largeur
      el.style.left = `calc(${p.l}% + ${p.r * 0 || 0}px)`;
      // conversion : l = distance depuis la gauche ; on garde une marge
      el.style.left = `calc(${p.l}% + 8px)`;
      el.style.bottom = p.b + 'px';
    } else {
      el.style.right = p.r + 'px'; el.style.bottom = p.b + 'px';
    }
  }
  for (const z of ZONES) {
    const el = document.getElementById(z.id); if (!el) continue;
    const p = cfg[z.id] || z.def;
    el.style.left = p.l + '%'; el.style.top = p.t + '%';
    el.style.width = p.w + '%'; el.style.height = p.h + '%';
  }
  applyHudLayout(cfg);
}

/** décale le HUD pour éviter les zones occupées */
function applyHudLayout(cfg) {
  const L = cfg['zL'] || ZONES[0].def;
  const R = cfg['zR'] || ZONES[1].def;
  const doc = document.documentElement.style;
  doc.setProperty('--stickL-right', Math.max(0, 100 - (L.l + L.w)) + '%');
  doc.setProperty('--stickR-left', R.l + '%');
}

/** interface d'édition (dans les réglages) */
export function buildEditor(container, onChange) {
  const cfg = S.layout || {};
  const save = () => { S.layout = JSON.parse(JSON.stringify(cfg)); saveSettings(); applyLayout(); onChange && onChange(); };
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'layout-editor';

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.style.margin = '0 0 10px';
  hint.textContent = 'Glisse les boutons sur l\u2019aperçu, ou utilise les curseurs. « Réinitialiser » restaure la disposition par défaut.';
  wrap.appendChild(hint);

  // ---- aperçu
  const stage = document.createElement('div');
  stage.className = 'lay-stage';
  const ratio = () => Math.min(2.2, Math.max(1.2, innerWidth / Math.max(1, innerHeight)));
  const H = 210;
  stage.style.height = H + 'px';

  const ghost = document.createElement('div');
  ghost.className = 'lay-ghost';
  ghost.textContent = 'APERÇU';
  stage.appendChild(ghost);

  for (const b of BTN) {
    const p = cfg[b.id] || b.def;
    const d = document.createElement('div');
    d.className = 'lay-btn';
    d.textContent = b.label;
    d.dataset.id = b.id;
    const place = () => {
      const scale = H / Math.max(1, innerHeight);
      if (p.l !== undefined) {
        d.style.left = (p.l / 100 * ratio() * 100) + '%';
        d.style.top = 'calc(100% - ' + (p.b * scale) + 'px - ' + (p.s * scale) + 'px)';
      } else {
        d.style.right = 'calc(' + (p.r * scale) + 'px)';
        d.style.top = 'calc(100% - ' + (p.b * scale) + 'px - ' + (p.s * scale) + 'px)';
      }
      d.style.width = (p.s * scale) + 'px'; d.style.height = (p.s * scale) + 'px';
      d.style.fontSize = Math.max(6, 8 * scale) + 'px';
    };
    place();
    // glisser
    d.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      d.setPointerCapture(ev.pointerId);
      const stageRect = stage.getBoundingClientRect();
      const scale = H / Math.max(1, innerHeight);
      const move = e2 => {
        const dx = (e2.clientX - ev.clientX) / scale;
        const dy = (e2.clientY - ev.clientY) / scale;
        ev.clientX = e2.clientX; ev.clientY = e2.clientY;
        if (p.l !== undefined) {
          p.l = clamp(p.l + dx / (stageRect.width / 100) * 100, 2, 96);
          p.b = Math.max(0, p.b - dy);
        } else {
          p.r = Math.max(0, p.r - dx);
          p.b = Math.max(0, p.b - dy);
        }
        place(); save();
      };
      const up = () => { d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); };
      d.addEventListener('pointermove', move);
      d.addEventListener('pointerup', up);
    });
    // double-clic : recentrer
    d.addEventListener('dblclick', () => {
      if (p.l !== undefined) { p.l = 50; p.b = b.def.b; } else { p.r = b.def.r; p.b = b.def.b; }
      place(); save();
    });
    stage.appendChild(d);
  }

  // zones
  for (const z of ZONES) {
    const p = cfg[z.id] || z.def;
    const d = document.createElement('div');
    d.className = 'lay-zone';
    d.textContent = z.label;
    d.style.left = p.l + '%'; d.style.top = p.t + '%';
    d.style.width = p.w + '%'; d.style.height = p.h + '%';
    stage.appendChild(d);
  }

  wrap.appendChild(stage);

  // ---- curseur taille pour le bouton sélectionné
  const sel = document.createElement('select');
  sel.className = 'lay-select';
  sel.innerHTML = BTN.map(b => `<option value="${b.id}">${b.label}</option>`).join('');
  const sizeRow = document.createElement('div');
  sizeRow.className = 'set';
  const lbl = document.createElement('label'); lbl.textContent = 'Taille du bouton';
  const rng = document.createElement('input');
  rng.type = 'range'; rng.min = 34; rng.max = 110; rng.value = (cfg[sel.value] || BTN[0].def).s;
  const val = document.createElement('span'); val.className = 'v'; val.textContent = rng.value;
  rng.oninput = () => {
    const p = cfg[sel.value] || BTN.find(b => b.id === sel.value).def;
    p.s = +rng.value; val.textContent = rng.value; save();
    const el = stage.querySelector(`[data-id="${sel.value}"]`);
    if (el) {
      const scale = H / Math.max(1, innerHeight);
      el.style.width = (p.s * scale) + 'px'; el.style.height = (p.s * scale) + 'px';
    }
  };
  sel.onchange = () => {
    const p = cfg[sel.value] || BTN.find(b => b.id === sel.value).def;
    rng.value = p.s; val.textContent = p.s;
  };
  sizeRow.append(lbl, rng, val);
  wrap.appendChild(sizeRow);

  // ---- mainulations
  const row = document.createElement('div');
  row.className = 'row';
  const mk = (txt, fn, cls = '') => {
    const b = document.createElement('button');
    b.className = 'btn ghost sm ' + cls; b.textContent = txt; b.onclick = fn;
    return b;
  };
  const handBtn = mk('🤝 Basculer main', () => {
    for (const b of BTN) {
      const p = cfg[b.id] || b.def;
      if (b.id === 'bPause') continue;
      if (p.l === undefined) { p.l = clamp(100 - p.r - p.s, 2, 96); delete p.r; }
      else { p.r = Math.max(4, 100 - p.l - p.s); delete p.l; }
    }
    save(); buildEditor(container, onChange);
  });
  const resetBtn = mk('↺ Réinitialiser', () => {
    S.layout = {}; saveSettings(); applyLayout(); buildEditor(container, onChange);
  }, 'danger');
  row.append(handBtn, resetBtn);
  wrap.appendChild(row);

  container.appendChild(wrap);
}