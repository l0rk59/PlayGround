/**
 * ECRANS — interface DOM au-dessus du canvas.
 *
 * Choix d'architecture : le jeu est dessine au canvas, l'interface est en
 * DOM. Cela donne du texte net a toute densite, un vrai focus clavier, des
 * lecteurs d'ecran qui fonctionneront, et des boutons d'une taille cible
 * correcte sans redessiner un bouton image par image.
 */

import { CLASSES, REWARDS, EQUIPMENT } from '../data/content.js';
import { DISCOVERIES, QUEST_DEFS, LINES, CANON } from '../data/world.js';
import { upgradeCost } from '../sim/rules.js';
import { ECONOMY, LOOT } from '../data/tuning.js';

const $ = (id) => document.getElementById(id);

/** Gestionnaire d'ecrans mutually exclusifs : un seul visible a la fois. */
export class Screens {
  constructor(on) {
    this.ids = [
      'screenLoading', 'screenTitle', 'screenClass', 'screenBrief', 'screenRefuge',
      'screenJournal', 'screenPause', 'screenSettings', 'screenHowto', 'screenResult', 'screenRotate',
    ];
    this.current = 'screenLoading';
    this.on = on;
    this.nodes = new Map(this.ids.map((id) => [id, $(id)]));
  }

  show(name) {
    for (const [id, node] of this.nodes) node.hidden = id !== name;
    this.current = name;
    const node = this.nodes.get(name);
    const focusable = node?.querySelector('button:not([disabled])');
    // Le focus va au premier controle : un joueur au clavier ne doit pas
    //riever dans le document.
    if (focusable && !('ontouchstart' in globalThis)) focusable.focus({ preventScroll: true });
  }

  hideAll() {
    for (const node of this.nodes.values()) node.hidden = true;
    this.current = null;
  }

  toggle(name, visible) {
    const node = this.nodes.get(name);
    if (node) node.hidden = !visible;
  }

  get active() {
    return this.current;
  }
}

/* ------------------------------------------------------------ TITRE -- */

export function paintTitle(save) {
  const btn = $('btnContinue');
  const state = $('saveState');
  if (save?.classId) {
    btn.hidden = false;
    const name = CLASSES[save.classId]?.name ?? 'Survivant';
    state.textContent = `Partie en cours — ${name}, niveau ${save.level}, refuge ${save.refugeLevel}.`;
  } else {
    btn.hidden = true;
    state.textContent = 'Aucune sauvegarde. La première partie commence au refuge.';
  }
}

/* ---------------------------------------------------------- CLASSES -- */

export function paintClasses(onPick) {
  const list = $('classList');
  list.textContent = '';
  for (const cls of Object.values(CLASSES)) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'class-card';
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `
      <span class="class-role">${cls.role}</span>
      <h3>${cls.name}</h3>
      <div class="class-stats">
        <span>${cls.health} PV</span>
        <span>${Math.round(cls.armor * 100)} % armure</span>
        <span>${EQUIPMENT[cls.weapon]?.name ?? cls.weapon}</span>
      </div>
      <p class="class-ability"><b>${cls.ability.name}</b> — ${cls.ability.desc}</p>
      <p class="class-note">${cls.strength}<br /><span style="opacity:.7">${cls.weakness}</span></p>
    `;
    card.addEventListener('click', () => onPick(cls.id));
    list.append(card);
  }
}

/* -------------------------------------------------------- BRIEFING -- */

export function paintBrief(cls, meta) {
  $('briefTitle').textContent = `${cls.name} — première sortie`;
  $('briefText').textContent = LINES.intro[0].text;
  const list = $('briefList');
  list.textContent = '';
  const items = [
    `${CLASSES[cls.id].role} : ${cls.ability.name} (${cls.ability.cooldown} s).`,
    `Arme de départ : ${EQUIPMENT[cls.weapon].name}. Tir automatique, aucune visée.`,
    'Esquiver coûte de la vigueur. Trois roulades, pas quatre d’affilée.',
    'Le pad d’extraction s’ouvre à la fin de la période. Reviens avant qu’il se ferme.',
  ];
  if (meta?.dogUnlocked) items.push('Rouffe t’accompagne. Il ne peut pas te faire gagner, seulement te consulter.');
  if (meta?.refugeLevel > 1) items.push(`Le seuil te reconnaît (refuge niveau ${meta.refugeLevel}).`);
  for (const it of items) {
    const li = document.createElement('li');
    li.textContent = it;
    list.append(li);
  }
}

/* ---------------------------------------------------------- REFUGE -- */

const UPGRADE_DEFS = [
  { id: 'forge', name: 'Forge', max: 4, desc: 'Transmute la ferraille en pièces de réparation.' },
  { id: 'infirmary', name: 'Infirmerie', max: 3, desc: 'Soins plus efficaces et moins fréquents.' },
  { id: 'ward', name: 'Garde du seuil', max: 1, desc: REWARDS.ward_of_the_house.desc, unique: true },
  { id: 'lampes', name: 'Lampes', max: 3, desc: 'Voit plus loin dans la vallée.' },
  { id: 'radio', name: 'Radio', max: 2, desc: 'Signale les lieux avant d’y entrer.' },
  { id: 'couchage', name: 'Couchage', max: 3, desc: 'Chaque nuit commence moins lourdement.' },
];

export function paintRefuge(meta, handlers) {
  $('refugeLevel').textContent = `Niveau ${meta.refugeLevel}`;
  $('refugeScrap').textContent = meta.scrap;

  const status = $('refugeStatus');
  const activeQuest = QUEST_DEFS.filter((q) => meta.quests?.[q.id] === 'active').pop();
  const parts = [];
  if (activeQuest) {
    parts.push(`<strong>${activeQuest.title}</strong> — ${activeQuest.hint}`);
    if (activeQuest.objective) parts.push(`Objectif : ${activeQuest.objective}`);
  } else {
    parts.push('Rien en cours. Explore, ouInactive l’atelier.');
  }
  parts.push(`<br />${meta.stats.runs} expédition${meta.stats.runs > 1 ? 's' : ''} · ${meta.stats.extracted} sortie${meta.stats.extracted > 1 ? 's' : ''} réussie${meta.stats.extracted > 1 ? 's' : ''} · ${meta.stats.deaths} défaite${meta.stats.deaths > 1 ? 's' : ''}`);
  status.innerHTML = parts.join(' ');

  const list = $('refugeUpgrades');
  list.textContent = '';
  for (const def of UPGRADE_DEFS) {
    const level = meta.upgrades[def.id] ?? 0;
    const maxed = level >= def.max;
    const cost = maxed ? 0 : upgradeCost(level, { freeLevels: ECONOMY.softCapFree });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade';
    btn.disabled = maxed || meta.scrap < cost || !!def.unique;
    btn.innerHTML = `
      <b>${def.name} ${maxed ? '— terminé' : `${level}/${def.max}`}</b>
      <span>${def.desc}</span>
      <span class="cost">${maxed || def.unique ? '' : cost <= 0 ? 'offert' : `${cost} ferraille`}</span>
    `;
    btn.addEventListener('click', () => handlers.upgrade(def.id, cost));
    list.append(btn);
  }

  const surv = $('refugeSurvivors');
  surv.textContent = '';
  if (meta.survivors.includes('irma')) {
    surv.innerHTML = `<div class="survivor survivor--here"><strong>Irma</strong> est là. Elle ne part pas en expédition.</div>`;
  } else {
    surv.innerHTML = `<div class="survivor">Personne d’autre dans la maison. Pour l’instant.</div>`;
  }

  const medkit = $('btnMedkit');
  const medkitCost = ECONOMY.medkitCost;
  medkit.textContent = `Soin — ${medkitCost} ferraille`;
  medkit.disabled = meta.scrap < medkitCost || meta.rations <= 0;
  $('btnReforge').disabled = meta.scrap < ECONOMY.medkitCost * 2;
}

/* --------------------------------------------------------- JOURNAL -- */

export function paintJournal(meta) {
  const list = $('journalList');
  list.textContent = '';
  if (!meta.discoveries.length) {
    list.innerHTML = `<p class="muted">Rien de note pour l’instant. Les lieux parlent si on les écoute.</p>`;
    return;
  }
  for (const id of meta.discoveries) {
    const d = DISCOVERIES[id];
    if (!d) continue;
    const el = document.createElement('div');
    el.className = 'entry';
    const layer = { etabli: 'établi', hypotheses: 'hypothèse', secrets: 'secret' }[d.contradicts] ?? '';
    el.innerHTML = `<h3>${d.title}</h3><p>${d.text}</p><span class="tag">contredit : ${layer}</span>`;
    list.append(el);
  }
  const canon = document.createElement('div');
  canon.className = 'entry';
  canon.innerHTML = `<h3>Ce qu'on sait</h3><p>${CANON.etabli.map((e) => `• ${e}`).join('<br />')}</p>`;
  list.append(canon);
}

/* --------------------------------------------------------- REGLAGES -- */

const SETTINGS_DEFS = [
  { key: 'master', label: 'Volume général', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'music', label: 'Musique', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'sfx', label: 'Effets', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'sensitivity', label: 'Sensibilité du stick', type: 'range', min: 0.6, max: 1.6, step: 0.05 },
  {
    key: 'reducedEffects',
    label: 'Réduire les effets',
    type: 'toggle',
    hint: 'Secousses, flashes et particules réduits. Les télégraphies restent : elles portent l’information.',
  },
  { key: 'screenShake', label: 'Secousses d’écran', type: 'range', min: 0, max: 1, step: 0.1 },
  { key: 'showDamage', label: 'Chiffres de dégâts', type: 'toggle', hint: 'Désactive si tu préfères lire ta vie sans nombres flottants.' },
  { key: 'haptics', label: 'Vibrations', type: 'toggle', hint: 'Courtes impulsions sur les impacts.' },
];

export function paintSettings(settings, onChange) {
  const list = $('settingsList');
  list.textContent = '';
  for (const def of SETTINGS_DEFS) {
    const wrap = document.createElement('div');
    wrap.className = 'setting';
    if (def.type === 'range') {
      wrap.innerHTML = `
        <label for="set-${def.key}">${def.label}<span data-out="${def.key}">${settings[def.key]}</span></label>
        <input id="set-${def.key}" type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${settings[def.key]}" />
      `;
      const input = wrap.querySelector('input');
      const out = wrap.querySelector(`[data-out="${def.key}"]`);
      input.addEventListener('input', () => {
        out.textContent = Number(input.value).toFixed(2);
        onChange(def.key, Number(input.value));
      });
    } else {
      wrap.innerHTML = `<div class="setting-row"><label for="set-${def.key}">${def.label}</label>
        <button id="set-${def.key}" class="switch" type="button" aria-pressed="${!!settings[def.key]}">
          ${settings[def.key] ? 'Activé' : 'Désactivé'}
        </button></div>
        ${def.hint ? `<small>${def.hint}</small>` : ''}`;
      const btn = wrap.querySelector('button');
      btn.addEventListener('click', () => {
        const next = !settings[def.key];
        btn.setAttribute('aria-pressed', String(next));
        btn.textContent = next ? 'Activé' : 'Désactivé';
        onChange(def.key, next);
      });
    }
    list.append(wrap);
  }
}

/* ---------------------------------------------------------- RESULTAT -- */

export function paintResult(outcome, meta, rewardText) {
  const kinds = {
    extracted: { kind: 'Expédition', title: 'Rentré', cls: '' },
    dead: { kind: 'Expédition', title: 'Mort sur place', cls: 'banner--danger' },
    timeout: { kind: 'Expédition', title: 'Trop tard', cls: 'banner--danger' },
  };
  const o = kinds[outcome.status] ?? kinds.dead;
  $('resultKind').textContent = o.kind;
  $('resultTitle').textContent = o.title;
  $('resultText').textContent =
    outcome.status === 'extracted'
      ? 'Le seuil s’ouvre. Tu poses ce que tu as rapporté sur la table.'
      : outcome.status === 'timeout'
        ? 'La période est passée. La vallée s’est refermée.'
        : 'Tu es tombé. La maison t’attend quand même.';

  const kept = outcome.carried.filter((c) => !LOOT.TEMPORARY.includes(c.id));
  const lost = outcome.carried.filter((c) => LOOT.TEMPORARY.includes(c.id));
  const scrap = outcome.carried.filter((c) => c.id === 'scrap').reduce((s, c) => s + c.qty, 0);
  const keptText = kept.length
    ? `Gardé : ${kept.map((k) => `${k.qty}× ${k.id}`).join(', ')}`
    : 'Rien de nouveau ce coup.';

  $('resultStats').innerHTML = `
    <div class="stat"><b>${scrap}</b><span>${outcome.status === 'extracted' ? 'ferraille' : 'ferraille perdue'}</span></div>
    <div class="stat"><b>${outcome.stats.kills}</b><span>abattus</span></div>
    <div class="stat"><b>${Math.round(outcome.seconds)} s</b><span>dehors</span></div>
    <div class="stat"><b>${outcome.visited.length}</b><span>lieux vus</span></div>
    <div class="stat"><b>${outcome.bossKilled ? 'oui' : 'non'}</b><span>gardien</span></div>
  `;

  const lines = [`${keptText}`];
  if (lost.length) lines.push(`Perdu : ${lost.map((l) => `${l.qty}× ${l.id}`).join(', ')}. Rien de ce qui est une découverte.`);
  if (rewardText) lines.push(rewardText);
  $('resultReward').textContent = '';
  if (rewardText) {
    $('resultReward').innerHTML = `<h3>Le refuge a changé</h3><p>${lines.join('<br />')}</p>`;
  } else {
    $('resultText').textContent += ` ${lines.join(' ')}`;
  }
}

export { $, UPGRADE_DEFS };