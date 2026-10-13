/**
 * Dernier Refuge — orchestration.
 *
 * Responsabilites de ce fichier, et rien d'autre :
 *  charger la sauvegarde, tenir la boucle a pas fixe, cabler les evenements
 *  de la simulation vers l'ecran, l'audio et le rendu, et appliquer le
 *  bilan d'une expedition a la progression permanente.
 *
 * Aucune regle de jeu ici. Si une regle apparait dans ce fichier, elle est
 * au mauvais endroit.
 */

import './style.css';

import { SaveStore } from './persist/store.js';
import { defaultSettings } from './persist/schema.js';
import { createExpedition, step as simStep, drain as drainEvents, finish as finishRun } from './sim/expedition.js';
import { lostOnDeath, upgradeCost } from './sim/rules.js';
import { Renderer } from './render/renderer.js';
import { actorSprite } from './render/sprites.js';
import { Input } from './ui/input.js';
import { Screens, paintTitle, paintClasses, paintBrief, paintRefuge, paintJournal, paintSettings, paintResult, $ } from './ui/screens.js';
import { Audio, requestWakeLock, haptic } from './audio/audio.js';
import { CLASSES, REWARDS, ITEMS } from './data/content.js';
import { QUEST_DEFS, DISCOVERIES } from './data/world.js';
import { TICK, MAX_CATCHUP_TICKS, ECONOMY } from './data/tuning.js';
import { SEMANTIC } from './art/palette.js';

const canvas = $('stage');
const renderer = new Renderer(canvas);
const audio = new Audio();
const saveStore = new SaveStore(
  (() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorageAdapter() : memoryAdapter();
    } catch {
      return memoryAdapter();
    }
  })(),
  () => Date.now(),
);

function localStorageAdapter() {
  const probe = '__dr_probe__';
  localStorage.setItem(probe, '1');
  localStorage.removeItem(probe);
  return {
    kind: 'localStorage',
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    del: (k) => localStorage.removeItem(k),
    keys: () => Object.keys(localStorage),
  };
}
function memoryAdapter() {
  const m = new Map();
  return { kind: 'memory', get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: (k) => m.delete(k), keys: () => [...m.keys()] };
}

/* ------------------------------------------------------------- ETAT -- */

const game = {
  meta: null,
  run: null,
  mode: 'title',
  paused: false,
  accumulator: 0,
  last: 0,
  wakeLock: null,
  fx: [],
  selectedClass: null,
  autosaveAt: 0,
};

const screens = new Screens();
/** Ecran statique courant : celui a restaurer apres une rotation. */
let previousScreen = 'screenTitle';
let input = new Input(canvas, { sensitivity: 1, side: 'left' });

/* --------------------------------------------------------- UTILITAIRES -- */

function toast(text, kind = '') {
  const host = $('toasts');
  const el = document.createElement('div');
  el.className = `toast${kind ? ` toast--${kind}` : ''}`;
  el.textContent = text;
  host.append(el);
  while (host.children.length > 5) host.firstChild.remove();
  setTimeout(() => el.remove(), 3200);
}

function banner(text, kind = '') {
  const el = $('banner');
  el.textContent = text;
  el.className = `banner${kind ? ` ${kind}` : ''}`;
  el.hidden = false;
  clearTimeout(banner.timer);
  banner.timer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

/** Les effets de presentation vivent sur l'etat de run : ils sont jetes a la fin. */
function pushFx(f) {
  if (game.run) game.run.fx.push(f);
}

/* --------------------------------------------------------- PROGRESSION -- */

async function persist() {
  const res = await saveStore.save({ meta: game.meta });
  if (!res.ok) toast('Sauvegarde impossible (stockage plein). La session continue.', 'bad');
  return res;
}

/**
 * Applique le bilan d'une expedition. C'est la seule fonction qui touche a
 * la progression permanente, et elle est appelee UNE fois par run.
 */
async function commitRun(outcome) {
  const meta = game.meta;
  meta.stats.runs += 1;
  meta.stats.playSeconds += Math.round(outcome.seconds);

  if (outcome.status === 'extracted') {
    meta.stats.extracted += 1;
    for (const item of outcome.carried) {
      if (item.id === 'scrap') meta.scrap += item.qty;
      else if (item.id === 'ration') meta.rations += item.qty;
      else if (item.id === 'ammo') meta.ammo += item.qty;
      else if (item.id === 'core') meta.cores += item.qty;
      else if (!meta.discoveries.includes(item.id)) meta.discoveries.push(item.id);
    }
  } else {
    meta.stats.deaths += 1;
    // Regle de confiance : seule la matiere se perd. Tout ce qui est
    // lie a une decouverte reste acquis.
    const lost = lostOnDeath(outcome.carried);
    const scrap = lost.filter((l) => l.id === 'scrap').reduce((s, l) => s + l.qty, 0);
    meta.scrap = Math.max(0, meta.scrap - scrap);
    for (const l of lost) {
      if (l.id === 'ration') meta.rations = Math.max(0, meta.rations - l.qty);
    }
  }

  let rewardText = '';
  if (outcome.bossKilled) {
    if (!meta.bosses.includes('gardien')) meta.bosses.push('gardien');
    meta.stats.bossKills += 1;
    if (!meta.uniques.includes(REWARDS.ward_of_the_house.id)) {
      meta.uniques.push(REWARDS.ward_of_the_house.id);
      meta.upgrades.ward = 1;
      rewardText = `${REWARDS.ward_of_the_house.name} — ${REWARDS.ward_of_the_house.effect}`;
    }
  }

  // Decouvertes par lieu visite : le reward est porte par la visite, pas
  // par un jet de hasard.
  for (const id of outcome.visited) {
    const poi = { gare: 'record_gare', puits: 'note_puits', halle: 'banniere_veilleurs', camp: 'note_pile' }[id];
    if (poi && !meta.discoveries.includes(poi)) {
      meta.discoveries.push(poi);
      toast(`Découverte : ${DISCOVERIES[poi].title}`, 'story');
    }
  }

  advanceQuests(meta);
  await persist();
  return rewardText;
}

function advanceQuests(meta) {
  meta.quests ??= {};
  for (const q of QUEST_DEFS) {
    const current = meta.quests[q.id] ?? (q.start === 'auto' ? 'active' : null);
    if (current === 'active') {
      const ok = q.check ? q.check(meta) : true;
      if (ok) meta.quests[q.id] = 'done';
    }
  }
  for (const q of QUEST_DEFS) {
    if (meta.quests[q.id] === 'active') break;
    const [dep, state] = q.start.split(':');
    if (dep === 'auto') {
      meta.quests[q.id] = 'active';
      break;
    }
    if (state === 'done' && meta.quests[dep] === 'done') {
      meta.quests[q.id] = 'active';
      break;
    }
  }
}

/* --------------------------------------------------------- DEBUT DE RUN -- */

function deploy() {
  audio.unlock();
  audio.setTheme('valley');
  audio.drone(55);
  requestWakeLock().then((l) => (game.wakeLock = l));

  const meta = game.meta;
  game.run = createExpedition({
    classId: meta.classId,
    meta,
    seed: (Date.now() ^ (meta.stats.runs * 2654435761)) >>> 0,
    loadout: meta.equipment,
  });
  game.run.fx = [];
  game.fx = [];
  game.mode = 'run';
  game.paused = false;
  game.accumulator = 0;
  game.autosaveAt = 0;
  $('hud').hidden = false;
  $('pauseBtn').hidden = false;
  screens.hideAll();
  $('objective').hidden = true;
  canvas.focus?.();
  haptic(30, meta.settings.haptics);
}

async function endRun() {
  const outcome = finishRun(game.run);
  const rewardText = await commitRun(outcome);
  audio.setTheme(null);
  audio.stopDrone();
  game.mode = 'result';
  paintResult(outcome, game.meta, rewardText);
  screens.show('screenResult');
  $('pauseBtn').hidden = true;
  $('objective').hidden = true;
  input.releaseAll();
}

/* ------------------------------------------------- EVENEMENTS DE SIMU -- */

function handleEvents(run, dt) {
  for (const ev of drainEvents(run)) {
    switch (ev.type) {
      case 'player:shoot':
        audio.play('shoot');
        break;
      case 'hit:enemy':
        audio.play('hit');
        renderer.addShake(1.4);
        haptic(8, game.meta.settings.haptics);
        if (game.meta.settings.showDamage) {
          pushFx({ kind: 'text', x: ev.x, y: ev.y, text: `${ev.damage}`, color: SEMANTIC.INTERACT_SOFT, life: 0.6, maxLife: 0.6, size: 15 });
        }
        pushFx({ kind: 'spark', x: ev.x, y: ev.y, color: SEMANTIC.INTERACT, size: 26, life: 0.18, maxLife: 0.18 });
        break;
      case 'hit:player':
        audio.play('hit:player');
        renderer.addShake(6);
        renderer.hitStop = 0.055;
        haptic([16, 30, 16], game.meta.settings.haptics);
        pushFx({ kind: 'text', x: ev.x, y: ev.y, text: `-${ev.damage}`, color: SEMANTIC.DANGER, life: 0.7, maxLife: 0.7, size: 17 });
        break;
      case 'enemy:strike':
        renderer.addShake(2);
        break;
      case 'enemy:die':
        audio.play('enemy:die');
        for (let i = 0; i < 7; i++) {
          pushFx({
            kind: 'spark',
            x: ev.x + (Math.random() - 0.5) * 24,
            y: ev.y - Math.random() * 24,
            color: i % 3 === 0 ? SEMANTIC.DANGER : SEMANTIC.DANGER_SOFT,
            size: 14 + Math.random() * 12,
            life: 0.34,
            maxLife: 0.34,
          });
        }
        break;
      case 'enemy:telegraph':
        audio.play('telegraph');
        break;
      case 'loot:pickup': {
        audio.play('loot');
        const name = ITEMS[ev.id]?.name ?? ev.id;
        toast(`${name} ×${ev.qty}`, 'loot');
        break;
      }
      case 'player:heal':
        audio.play('heal');
        toast(`+${ev.amount} PV`, 'good');
        break;
      case 'ability:pulse':
      case 'ability:mark':
      case 'ability:veil':
        audio.play('ability');
        renderer.addShake(3);
        break;
      case 'poi:enter':
        banner(ev.name, ev.kind === 'boss' ? 'banner--boss' : '');
        audio.play('poi');
        $('objective').hidden = false;
        $('objectiveName').textContent = ev.name;
        $('objectiveText').textContent = ev.objective;
        pushFx({ kind: 'spark', x: game.run.player.x, y: game.run.player.y, color: SEMANTIC.INTERACT, size: 40, life: 0.4, maxLife: 0.4 });
        break;
      case 'boss:appear':
        banner(ev.name, 'banner--boss');
        audio.play('boss:appear');
        renderer.addShake(9);
        haptic([40, 60, 40], game.meta.settings.haptics);
        break;
      case 'boss:telegraph':
        audio.play('telegraph');
        if (ev.horror) {
          renderer.flash = 0.35;
          renderer.addShake(5);
        }
        break;
      case 'boss:phase':
        banner(`Phase ${ev.index + 1} — ${ev.name}`, 'banner--boss');
        audio.play('boss:phase');
        renderer.addShake(8);
        break;
      case 'boss:down':
        audio.play('boss:down');
        banner('Le seuil s\'est tu.', 'banner--boss');
        renderer.flash = 0.5;
        haptic([60, 40, 60, 40, 90], game.meta.settings.haptics);
        break;
      case 'boss:attack':
        renderer.addShake(4);
        break;
      case 'companion:down':
        toast('Rouffe est à terre. Il reviendra.', 'bad');
        break;
      case 'run:dead':
        banner('Tu es tombé.', 'banner--danger');
        audio.play('boss:phase');
        break;
      default:
        break;
    }
  }
}

function stepFx(run, dt) {
  for (let i = run.fx.length - 1; i >= 0; i--) {
    const f = run.fx[i];
    f.life -= dt;
    if (f.life <= 0) run.fx.splice(i, 1);
  }
}

/* ---------------------------------------------------------- BOUCLE -- */

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - game.last) / 1000 || 0);
  game.last = now;

  checkOrientation();
  if (screens.active === 'screenRotate') {
    if (game.run) renderer.draw(game.run, null);
    return;
  }
  if (game.paused) {
    // Le decor continue de respirer sous la pause : ca rassure, et ca evite
    // l'impression que l'application a plante.
    if (game.run) {
      renderer.updateCamera(game.run.player, dt * 0.4);
      renderer.draw(game.run, null);
    }
    return;
  }

  if (game.mode === 'run' && game.run) {
    const run = game.run;

    // Arret sur image : 55 ms au moment de l'impact. C'est gratuit et
    // c'est ce qui donne du poids au coup.
    if (renderer.hitStop > 0) {
      renderer.hitStop -= dt;
    } else {
      const cmd = input.sample();
      game.accumulator += dt;
      let ticks = 0;
      while (game.accumulator >= TICK && ticks < MAX_CATCHUP_TICKS) {
        simStep(run, TICK, cmd);
        game.accumulator -= TICK;
        ticks += 1;
        // Une seule image peut declencher plusieurs fois la meme entree ;
        // on la consomme donc apres le premier pas.
        cmd.dodge = false;
        cmd.ability = false;
        cmd.heal = false;
      }
      if (ticks >= MAX_CATCHUP_TICKS) game.accumulator = 0;
      handleEvents(run, dt);
      stepFx(run, dt);
      renderer.updateCamera(run.player, dt);
    }

    renderer.reducedEffects = game.meta.settings.reducedEffects;
    renderer.shakeScale = game.meta.settings.screenShake;
    renderer.draw(run, input);
    renderer.drawWorldHud(renderer.ctx, run, renderer.view.w, renderer.view.h);
    updateButtonCooldowns(run);

    // Sauvegarde periodique de l'etat de run : si le telephone meurt,
    // on perd l'expedition, jamais la progression.
    if (run.elapsed - game.autosaveAt > 30) {
      game.autosaveAt = run.elapsed;
      persist();
    }

    if (run.status !== 'running') endRun();
  }
}

function updateButtonCooldowns(run) {
  const p = run.player;
  input.setCooldowns(
    p.dodge.cooldownUntil, 0.72,
    p.abilityCooldownUntil, run.classDef.ability.cooldown,
    p.healCooldownUntil, 18,
  );
}

/* ---------------------------------------------------- ORIENTATION -- */

/**
 * Porte d'orientation. Le jeu se joue en paysage : sur un ecran tactile
 * vertical on ne peut pas tenir le stick et viser en meme temps. La porte
 * est une pause franche, pas un avertissement au passage.
 */
function checkOrientation() {
  const portrait = globalThis.innerHeight > globalThis.innerWidth;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const needRotate = portrait && coarse;
  const showing = screens.active === 'screenRotate';

  if (needRotate && !showing) {
    game.blockedByOrientation = true;
    game.paused = true;
    screens.show('screenRotate');
  } else if (!needRotate && showing) {
    game.blockedByOrientation = false;
    game.paused = false;
    // On rend l'ecran qui avait ete interrompu.
    if (game.mode === 'run') screens.hideAll();
    else screens.show(previousScreen ?? 'screenTitle');
  }
}

/* ------------------------------------------------------------ ECRANS -- */

function toRefuge() {
  game.mode = 'refuge';
  previousScreen = 'screenRefuge';
  lastStaticScreenName = 'screenRefuge';
  paintRefuge(game.meta, { upgrade: onUpgrade });
  screens.show('screenRefuge');
  $('pauseBtn').hidden = true;
  $('hud').hidden = true;
  audio.unlock();
  audio.setTheme('refuge');
  audio.drone(62);
}

function onUpgrade(id, cost) {
  const meta = game.meta;
  if (meta.scrap < cost) return;
  meta.scrap -= cost;
  meta.upgrades[id] = (meta.upgrades[id] ?? 0) + 1;
  meta.refugeLevel = 1 + Object.values(meta.upgrades).reduce((s, v) => s + v, 0);
  audio.play('ui');
  audio.play('heal');
  advanceQuests(meta);
  persist();
  paintRefuge(meta, { upgrade: onUpgrade });
}

function openSettings(back) {
  if (screens.active && screens.active !== 'screenRotate') previousScreen = screens.active;
  paintSettings(game.meta.settings, async (key, value) => {
    game.meta.settings[key] = value;
    audio.applySettings({ master: game.meta.settings.master, sfx: game.meta.settings.sfx, music: game.meta.settings.music });
    input.sensitivity = game.meta.settings.sensitivity;
    input.side = game.meta.settings.stickSide ?? 'left';
    renderer.reducedEffects = game.meta.settings.reducedEffects;
    await persist();
  });
  screens.show('screenSettings');
  $('btnSettingsBack').onclick = () => (back ? back() : toRefuge());
}

function openJournal() {
  if (game.mode === 'run') openPause();
  else {
    paintJournal(game.meta);
    previousScreen = 'screenJournal';
    screens.show('screenJournal');
  }
}

function openPause() {
  game.paused = true;
  input.releaseAll();
  previousScreen = 'screenPause';
  screens.show('screenPause');
}

function resume() {
  game.paused = false;
  screens.hideAll();
  game.last = performance.now();
}

/* --------------------------------------------------------- CABLAGE -- */

function wire() {
  $('btnNew').onclick = async () => {
    audio.unlock();
    await saveStore.reset();
    game.meta = { ...(await saveStore.load()).save.meta, settings: { ...defaultSettings() } };
    screens.show('screenClass');
  };
  $('btnContinue').onclick = () => (game.meta.classId ? toRefuge() : screens.show('screenClass'));
  $('btnSettings').onclick = () => openSettings(() => screens.show('screenTitle'));
  $('btnHowto').onclick = () => {
    previousScreen = 'screenHowto';
    screens.show('screenHowto');
  };
  $('btnHowtoBack').onclick = () => screens.show(previousScreen === 'screenHowto' ? 'screenTitle' : previousScreen);
  $('btnJournalTitle').onclick = () => openJournal();
  $('btnClassBack').onclick = () => screens.show('screenTitle');

  $('btnDeploy').onclick = () => deploy();
  $('btnDeploy2').onclick = () => {
    paintBrief(game.meta.classId ? CLASSES[game.meta.classId] : CLASSES.survivante, game.meta);
    screens.show('screenBrief');
  };
  $('btnBriefBack').onclick = () => toRefuge();
  $('btnTitle').onclick = () => {
    previousScreen = 'screenTitle';
    paintTitle(game.meta);
    screens.show('screenTitle');
  };
  $('btnMedkit').onclick = () => {
    if (game.meta.scrap < ECONOMY.medkitCost || game.meta.rations <= 0) return;
    game.meta.scrap -= ECONOMY.medkitCost;
    game.meta.rations -= 1;
    toast('Soin appliqué au refuge.', 'good');
    audio.play('heal');
    persist();
    paintRefuge(game.meta, { upgrade: onUpgrade });
  };
  $('btnReforge').onclick = () => {
    const cost = ECONOMY.medkitCost * 2;
    if (game.meta.scrap < cost) return;
    game.meta.scrap -= cost;
    game.meta.ammo += 40;
    toast('Armes refondues. +40 munitions', 'loot');
    audio.play('ui');
    persist();
    paintRefuge(game.meta, { upgrade: onUpgrade });
  };

  $('btnResume').onclick = resume;
  $('btnPauseSettings').onclick = () => openSettings(() => openPause());
  $('btnAbort').onclick = async () => {
    if (game.run) game.run.status = 'dead';
    await endRun();
    toRefuge();
  };
  $('btnResultNext').onclick = () => toRefuge();
  $('btnJournalBack').onclick = () => toRefuge();

  // Le bouton de la barre d'eteau fait deux choses selon l'etat : ouvrir le
  // jeu en pause, ou consulter le journal quand on est au titre. Jamais rien
  // d'autre, jamais de raccourci clavier comme seule option tactile.
  $('pauseBtn').onclick = () => (game.mode === 'run' ? openPause() : openJournal());

  paintClasses((id) => {
    game.selectedClass = id;
    game.meta.classId = id;
    advanceQuests(game.meta);
    persist();
    paintBrief(CLASSES[id], game.meta);
    screens.show('screenBrief');
  });

  // Any gesture unlocks audio on mobile.
  const unlock = () => audio.unlock();
  globalThis.addEventListener('pointerdown', unlock, { once: true });

  globalThis.addEventListener('resize', () => {
    renderer.resize();
    input.layout();
  });
  globalThis.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (game.mode === 'run' && !game.paused) openPause();
      else if (game.paused && screens.active === 'screenPause') resume();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'run') openPause();
    else if (!document.hidden) game.last = performance.now();
  });
  globalThis.addEventListener('pagehide', () => {
    if (game.mode === 'run' && game.run) game.run.status = 'dead';
    persist();
  });
}

/* ---------------------------------------------------------- LANCEMENT -- */

async function boot() {
  wire();
  const loaded = await saveStore.load();
  game.meta = loaded.save.meta;
  game.meta.settings = { ...defaultSettings(), ...game.meta.settings };
  if (loaded.problems.length) console.warn('[Dernier Refuge] sauvegarde', loaded.problems);
  if (loaded.migratedFrom) console.info(`[Dernier Refuge] sauvegarde migrée depuis v${loaded.migratedFrom}`);

  input = new Input(canvas, { sensitivity: game.meta.settings.sensitivity, side: game.meta.settings.stickSide ?? 'left' });
  renderer.reducedEffects = game.meta.settings.reducedEffects;
  renderer.shakeScale = game.meta.settings.screenShake;

  paintTitle(game.meta);
  previousScreen = 'screenTitle';
  screens.show('screenTitle');
  $('hud').hidden = true;
  $('pauseBtn').hidden = false;

  game.last = performance.now();
  requestAnimationFrame(frame);

  // Poignee d'inspection : le harnais de captures et les tests de fumée ont
  // besoin de lire l'etat sans passer par l'interface.
  globalThis.__refuge = { game, renderer, screens, audio, sprites: { actorSprite } };

  registerServiceWorker();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  import.meta.env?.PROD
    ? navigator.serviceWorker.register('/sw.js').catch(() => {})
    : null;
}

boot().catch((err) => {
  console.error(err);
  screens.show('screenTitle');
  $('saveState').textContent = `Erreur au démarrage : ${err.message}`;
});