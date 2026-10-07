// ============================================================================
//  main.js — orchestrateur : moteur, boucle, états, interactions
// ============================================================================
import * as THREE from 'three';
import {
  G, S, V3, rand, applyQuality, loadSettings, hasSave, peekSave, clearSave,
  doSave, requestSave, tickSave, restoreFrom,
} from './state.js';
import { buildWorld, updateWorld, W, collide, blocked, inSafeZone, nearestSafeZone } from './world.js';
import { initPlayer, updatePlayer, camera, playerTakeDamage, heal, respawn, setDeathHandler, PL } from './player.js';
import { initWeapons, updateWeapon, fireWeapon, reload, finishReload, selectWeapon, nextWeapon, refreshWeaponModel, applyMagSize, liveStats, Wp, WEAPONS, updateGrenades, meleeSwing } from './weapons.js';
import { initEnemies, updateEnemies, setPlayerHitHandler, updateAcids, explosionDamage, spawnEnemy, setUI, hitEnemy, E } from './enemies.js';
import { initVehicles, buildFleet, updateVehicle, nearestVehicle, enterVehicle, refuel, vehicleHorn, V } from './vehicles.js';
import { initSurvivors, buildSurvivors, updateSurvivors, nearestSurvivor, recruit, ROSTER, noteNear, collectNote, updateNotes, buildNotes, setNoteScene, factionAt } from './survivors.js';
import { initBuilding, updateBuilding, placePart, showGhost, ghostPos, setGhostOk, PARTS, DEFS, setBuildSel, buildSel } from './building.js';
import { initLoot, buildLoot, lootNear, openCrate, updateDrops } from './loot.js';
import { initDirector, updateDirector, updateWave, poiNear, discoverPOI, factionCommand, buildPOIs, statsBlock, resetForRespawn } from './director.js';
import { initAudio, resumeAudio, setVolume, SFX, engineOff, tension } from './audio.js';
import { initInput, inputEnabled, requestLock, exitLock, pollInput, onUnlock, onLock, releaseAll, IN } from './input.js';
import { LOOT, DROPS } from './loot.js';
import { NPCS } from './survivors.js';
import { mods } from './state.js';
import * as HUD from './hud.js';
import { loadStep } from './state.js';
import { initGunsmith, show as showGunsmith, close as closeGunsmith, isOpen as gunsmithOpen } from './gunsmith.js';
import { applyLayout, buildEditor } from './layout.js';
import * as FX from './fx.js';

/* ============================ moteur ============================ */
loadSettings(); // doit précéder la création du renderer (qualité, DPR)
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: S.quality !== 'low', powerPreference: 'high-performance', stencil: false });
renderer.domElement.id = 'gl';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = !!S.shadow;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
applyQuality();
renderer.setPixelRatio(S.dpr || 1.5);
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.FogExp2(0x0a0a1e, .006);
const cam = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, .05, 700);
cam.rotation.order = 'YXZ';
scene.add(cam); // requis pour que le modèle d'arme (enfant de la caméra) soit rendu

// lumières
const hemi = new THREE.HemisphereLight(0x8090e0, 0x4a4058, 2.2);
scene.add(hemi);
W.hemi = hemi;
const amb = new THREE.AmbientLight(0x50506e, 1.15);
scene.add(amb);
W.amb = amb;
const sun = new THREE.DirectionalLight(0xe0d4ff, 1.05);
sun.position.set(-60, 90, 40); sun.castShadow = !!S.shadow;
if (S.shadow) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.near = 1; sun.shadow.camera.far = 260; const sc = 90; sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc; sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc; }
scene.add(sun);
W.sunRef = sun;
const rim = new THREE.DirectionalLight(0x3a5aff, .5); rim.position.set(60, 40, -60); scene.add(rim);
// contre-jour vert-cyan : détache les silhouettes du décor la nuit
const backLight = new THREE.DirectionalLight(0x66ffcc, .35);
backLight.position.set(-40, 25, 70); scene.add(backLight);

buildWorld(scene, cam);
initPlayer(cam);
// seconde caméra (near très court) pour le modèle d'arme : jamais rogné par le décor
const wcam = new THREE.PerspectiveCamera(S.fov * .82, innerWidth / innerHeight, .01, 12);
wcam.rotation.order = 'YXZ';
scene.add(wcam);            // sinon ses enfants (l'arme) ne sont jamais rendus
initWeapons(cam, scene, wcam);
initEnemies(scene, cam);
initVehicles(scene);
initSurvivors(scene);
setNoteScene(scene);
initBuilding(scene);
initLoot(scene);
initDirector(scene);
FX.initFx(scene, cam);

// post-processing (bloom) chargé en différé
let composer = null, UnrealBloomPass = null, RenderPass = null, OutputPass = null;
async function initPost() {
  if (!S.bloomOn) return;
  try {
    const [{ EffectComposer }, pp] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      Promise.all([
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]),
    ]);
    RenderPass = pp[0].RenderPass; UnrealBloomPass = pp[1].UnrealBloomPass; OutputPass = pp[2].OutputPass;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, cam));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.62, 0.34);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setSize(innerWidth, innerHeight);
  } catch (e) { console.warn('bloom indisponible', e); }
}

addEventListener('resize', () => {
  cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  // la caméra d'arme suit le FOV du jeu : l'arme garde une taille relative correcte
  wcam.aspect = innerWidth / innerHeight; wcam.fov = Math.max(30, Math.min(85, S.fov * .82)); wcam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});

/* ============================ contenu ============================ */
loadStep('ESCOUADE', .9);
buildSurvivors();
buildNotes();
loadStep('VEHICULES', .93);
initGunsmith();
buildFleet();
loadStep('POINTS INTERET', .96);
buildPOIs();
loadStep('BUTIN', .98);
buildLoot();
loadStep('TERMINÉ', 1);

// capacité des chargeurs
for (const w of Object.values(WEAPONS)) {
  if (!w.mag || !G.ammo[w.mag]) continue;
  G.ammo[w.mag].cap = w.magSize || 30;
  G.ammo[w.mag].m = Math.min(G.ammo[w.mag].m, G.ammo[w.mag].cap);
}
selectWeapon('rifle', true);
refreshWeaponModel();

// HUD hooks pour les infectés (mort → killfeed + butin au sol)
setUI({
  kill: (t, hs) => HUD.kill(t, hs),
  levelUp: l => HUD.levelUp(l),
});

/* ============================ input principal ============================ */
initInput(renderer.domElement);
applyLayout();
setPlayerHitHandler(playerTakeDamage);
HUD.initHUD(cam, { pickWeapon: k => trySelect(k) });
HUD.initShopTabs();

addEventListener('nd:pause', () => togglePause());
addEventListener('nd:quick', e => quickAction(e.detail));
addEventListener('nd:part', e => { setBuildSel(e.detail); HUD.buildBar(true); });

document.getElementById('btnPlay').onclick = () => startGame(false);
document.getElementById('btnContinue').onclick = () => startGame(true);
document.getElementById('btnHelp').onclick = () => document.getElementById('helpTxt')?.classList.toggle('hidden');
document.getElementById('btnSet0').onclick = () => openSettings('title');
document.getElementById('btnDel').onclick = () => { if (confirm('Effacer la sauvegarde ?')) { clearSave(); location.reload(); } };
document.getElementById('btnResume').onclick = () => togglePause(false);
// le FOV s'applique immédiatement aux deux caméras
function syncFov() { wcam.fov = Math.max(30, Math.min(85, S.fov * .82)); wcam.updateProjectionMatrix(); cam.updateProjectionMatrix(); }
addEventListener('nd:fov', syncFov);
document.getElementById('btnSet1').onclick = () => openSettings('pause');
document.getElementById('btnSaveNow').onclick = () => { doSave(); HUD.toast('💾 Partie sauvegardée', 'good'); };
document.getElementById('btnQuit').onclick = () => { doSave(); location.reload(); };
document.getElementById('btnRetry').onclick = () => { G.scrap = Math.floor(G.scrap / 2); resetForRespawn(); inputEnabled(true); requestLock(); };
document.getElementById('btnMenu').onclick = () => location.reload();
document.getElementById('btnShopClose').onclick = () => { HUD.closeShop(); };
document.getElementById('btnQuestClose').onclick = () => HUD.closeQuests();
document.getElementById('btnNoteClose').onclick = () => { document.getElementById('noteScreen').classList.remove('on'); resumeAudio(); };
document.getElementById('btnSettings').onclick = () => openSettings('hud');
document.getElementById('btnPause').onclick = () => togglePause();
document.getElementById('btnQuests').onclick = () => { HUD.openQuests(); exitLock(); };
document.getElementById('btnGun').onclick = () => { showGunsmith(); exitLock(); };
document.getElementById('btnSetBack').onclick = () => closeSettings();

/* ============================ états de jeu ============================ */
let buildMode = false;
let shakeState = { x: 0, y: 0, r: 0, _dt: .016 };
const ctx = { cam, aim: false, shake: shakeState, dmgFlash: () => { }, updateVehicleHUD: updateVehicleHUD, cam3: cam };

function startGame(cont) {
  initAudio(); resumeAudio(); initPost();
  if (cont) {
    const s = peekSave();
    restoreFrom(s);
  } else {
    // nouvelle partie : apparition au camp
    G.px = W.CAMP.x + 4; G.pz = W.CAMP.z + 10; G.py = 0;
    G.yaw = Math.atan2(-(W.CAMP.x - G.px), -(W.CAMP.z - G.pz));
  }
  G.started = true; G.playing = true; G.dead = false;
  document.getElementById('titleScreen').classList.remove('on');
  document.getElementById('hud').classList.add('on');
  document.getElementById('loading').classList.remove('on');
  inputEnabled(true);
  requestLock();
  selectWeapon(G.wpn || 'rifle', true);
  refreshWeaponModel();
  HUD.refreshQuick(); HUD.refreshWeaponBar();
  HUD.toast('⚠️ Pille la ville, fortifie ton camp, recrute des survivants.', 'info');
  // l'astuce tactile s'efface d'elle-même après 6 s
  if (IN.touch) {
    const h = document.getElementById('touchHint');
    if (h) setTimeout(() => h.classList.add('hide'), 6000);
  }
  if (!IN.touch) setTimeout(() => HUD.toast('🖱 Clique pour verrouiller la souris · B construire · E interagir', 'info'), 3600);
  // quelques ennemis de départ
  spawnEnemy('walker', G.px + rand(38, 60), G.pz + rand(-25, 25), {});
  spawnEnemy('walker', G.px + rand(-55, -40), G.pz + rand(-25, 25), {});
  loop();
}
function togglePause(force) {
  if (!G.playing || G.dead) return;
  G.paused = force === undefined ? !G.paused : force;
  if (G.paused) { HUD.openPause(statsBlock()); exitLock(); releaseAll(); engineOff(); }
  else { HUD.closePause(); inputEnabled(true); requestLock(); }
}
function openSettings(from) {
  HUD.initSettingsHooks();
  document.getElementById('settingsScreen').classList.add('on');
  buildEditor(document.getElementById('layoutHost'), () => HUD.refreshQuick());
  exitLock();
}
function closeSettings() {
  document.getElementById('settingsScreen').classList.remove('on');
  if (G.playing && !G.paused) requestLock();
}

function quickAction(id) {
  if (id === 'med') { if (!heal()) { SFX.deny(); HUD.toast('Pas de medkit !', 'bad'); } }
  else if (id === 'gren') { selectWeapon('grenade'); }
  else if (id === 'fuel') { if (G.inVeh) refuel(G.inVeh); else HUD.toast('Approche-toi d\'un véhicule.', 'info'); }
  else if (id === 'build') { toggleBuildMode(); }
}
function cycleWeapon(dir) {
  const owned = ORDER_LIST.filter(k => k === 'grenade' ? G.grenades > 0 : (WEAPONS[k].melee || G.unlocked[k] === 1));
  if (!owned.length) return;
  const i = owned.indexOf(G.wpn);
  const next = owned[(i + dir + owned.length) % owned.length];
  trySelect(next);
}
function toggleTraining() {
  G.invuln = !G.invuln;
  if (G.invuln) { HUD.toast('🛡 MODE ENTRAÎNEMENT : invincible, aucune vague. [T] pour quitter', 'good'); document.body.classList.add('training'); }
  else { HUD.toast('⚔️ Mode normal réactivé', 'info'); document.body.classList.remove('training'); }
  if (G.invuln) { G.waveActive = false; for (const e of E) { e.die = 0.001; } }
}

function toggleBuildMode() {
  buildMode = !buildMode;
  window.__buildMode = () => buildMode;
  showGhost(buildMode);
  HUD.buildBar(buildMode);
  SFX.click();
  if (buildMode) HUD.toast('🛠 Choisis une pièce, vise et tire pour poser (près du camp)', 'info');
}
function trySelect(k) {
  const locked = k !== 'grenade' && !WEAPONS[k].melee && G.unlocked[k] !== 1;
  if (k === 'grenade' && G.grenades <= 0) { SFX.deny(); HUD.toast('💣 Plus de grenades — achète-les à l\'Arsenal (V).', 'bad'); return; }
  if (locked) {
    // au lieu d'un simple refus, on ouvre directement la boutique de l'arme
    SFX.deny();
    HUD.toast(`🔒 ${WEAPONS[k].name} — à acheter à l'Arsenal`, 'info');
    showGunsmith(k); exitLock();
    return;
  }
  if (!selectWeapon(k)) { SFX.deny(); return; }
  applyMagSize(k);
  refreshWeaponModel(); HUD.refreshWeaponBar();
  buildMode = false; showGhost(false); HUD.buildBar(false);
}

/* ============================ interactions ============================ */
function handleInteractions(edges) {
  const pos = V3(G.px, 0, G.pz);
  if (edges.pause) { togglePause(); return; }
  if (edges.training) { toggleTraining(); return; }
  if (edges.gunsmith) {
    if (gunsmithOpen()) { closeGunsmith(); requestLock(); }
    else { showGunsmith(); exitLock(); }
    return;
  }
  if (edges.fps) { window.dispatchEvent(new Event('nd:fps')); }
  if (edges.map) { HUD.toast(G.miniMapBig ? '🗺' : '🗺', 'info'); G.miniMapBig = !G.miniMapBig; document.body.classList.toggle('bigmap', !!G.miniMapBig); }
  // arme slot direct / molette
  if (edges.wheel) { cycleWeapon(edges.wheel > 0 ? 1 : -1); }
  else if (edges.slot >= 0) {
    if (edges.slot < ORDER_LIST.length) trySelect(ORDER_LIST[edges.slot]);
  }
  // soin
  if (edges.heal) { if (!heal()) { SFX.deny(); HUD.toast('Pas de medkit !', 'bad'); } }
  if (edges.reloadEdge) { reload(); }
  // interagir
  if (edges.interact) doInteract(pos);
  else if (edges.horn) vehicleHorn(G.inVeh);
  // construire
  if (edges.build) { toggleBuildMode(); }
  if (edges.grenade) { trySelect('grenade'); }
}
const ORDER_LIST = ['machete', 'knife', 'pistol', 'rifle', 'shotgun', 'dmr', 'grenade'];

function doInteract(pos) {
  // arsenal
  if (gunsmithOpen()) { closeGunsmith(); requestLock(); return; }
  // boutique
  if (HUD.shopOpen()) { HUD.closeShop(); requestLock(); return; }
  // marché noir
  if (Math.hypot(pos.x - W.MARKET.x, pos.z - W.MARKET.z) < 5) { showGunsmith(); exitLock(); SFX.click(); return; }
  // faction
  const fac = factionAt(pos);
  if (fac) { factionCommand(fac); return; }
  // survivant
  const n = nearestSurvivor(pos, 3.8);
  if (n) { recruit(n); return; }
  // note
  const note = noteNear(pos, 2.6);
  if (note) { collectNote(note); exitLock(); return; }
  // caisse
  const c = lootNear(pos, 2.4);
  if (c) { openCrate(c); return; }
  // véhicule
  const v = nearestVehicle(pos, 4.4);
  if (v) { enterVehicle(v); return; }
  // POI découverte
  const poi = poiNear(pos);
  if (poi) { discoverPOI(poi); }
  else HUD.toast('Rien à portée. Explore, pille, construis.', 'info');
}

const $id = id => document.getElementById(id);
function updateVehicleHUD(v) {
  if (!$id('vehHUD')) {
    const d = document.createElement('div');
    d.id = 'vehHUD';
    d.style.cssText = 'position:absolute;left:50%;top:calc(52px + env(safe-area-inset-top));transform:translateX(-50%);padding:5px 14px;font-size:12px;pointer-events:none;display:none;gap:14px;align-items:center;background:rgba(6,10,26,.72);border:1px solid rgba(0,232,255,.35);border-radius:10px';
    $id('hud').appendChild(d);
    $id('vehHUD').innerHTML = '<b id="vName"></b> ⛽<span class="mn">⛽</span><div class="bar" style="width:80px;height:8px;background:#0b1524;border-radius:4px"><i id="vFuel" style="display:block;height:100%;background:#ff9d00;border-radius:4px"></i></div> 🛡<div class="bar" style="width:80px;height:8px;background:#0b1524;border-radius:4px"><i id="vHp" style="display:block;height:100%;background:#5dff8f;border-radius:4px"></i></div> <span style="color:#5dff8f">[E] sortir · [F] klaxon</span>';
  }
  if (!$id('vehHUD')) return;
  $id('vehHUD').style.display = 'flex';
  $id('vName').textContent = v.K.name;
  $id('vFuel').style.width = (v.fuel / v.maxFuel * 100) + '%';
  $id('vHp').style.width = (v.hp / v.maxhp * 100) + '%';
}

/* ============================ boucle principale ============================ */
const clock = new THREE.Clock();
let acc = 0;
let frameLimit = 1000 / Math.max(20, S.maxFps || 60);
let sinceLast = 0;
function loop() {
  requestAnimationFrame(loop);
  // limiteur d'images configurable (batterie)
  const now = performance.now();
  if (now - sinceLast < frameLimit - 1) return;
  sinceLast = now - ((now - sinceLast) % frameLimit);
  if (!G.playing) { render(); return; }
  if (G.paused || G.dead) { render(); return; }
  const dt = Math.min(clock.getDelta(), .05);
  G.dt = dt; G.t += dt; G.frame++;
  acc += dt;
  shakeState._dt = dt;
  // joueur (mouvement, vue, edges) — pollInput est appelé dedans
  const edges = updatePlayer(dt, ctx);
  G.aiming = IN.aim;
  handleInteractions(edges);

  // tir
  if (!G.inVeh) {
    if (buildMode) { if (IN.fire) tryPlaceAt(); }
    else {
      const w = WEAPONS[G.wpn];
      const target = E.filter(e => e.die <= 0);
      // « tap » tactile : exactement un tir, quelle que soit la cadence
      if (edges.tapFire) { if (fireWeapon(target)) haptic(9); }
      else {
        const wantFire = w.auto || w.melee ? IN.fire : edges.firePressed;
        if (wantFire) { const fired = fireWeapon(target); if (fired) haptic(9); }
      }
    }
  }

  // armes : modèle + recul + rechargement
  updateWeapon(dt, Math.hypot(IN.fwd, IN.side) * (G.inVeh ? 0 : 1), IN.sprint);
  if (Wp.reloadT > 0) {
    HUD.reloadBar(1 - Wp.reloadT / Wp.reloadDur);
    if (Wp.reloadT <= dt) { finishReload(); HUD.reloadBar(0); HUD.refreshWeaponBar(); }
  }
  safe('grenades', () => updateGrenades(dt, (pos, radius, dmg) => {
    explosionDamage(pos, radius, dmg);
  }));

  // véhicule (isolé : une erreur ici ne doit pas stopper la boucle)
  try { updateVehicle(dt, IN, ctx); } catch (err) { if (!G._vehErr) { G._vehErr = 1; console.warn('vehicule:', err); } }

  // monde & systèmes (isolés un par un pour rester robuste)
  safe('world', () => updateWorld(dt));
  safe('enemies', () => updateEnemies(dt, ctx));
  safe('acid', () => updateAcids(dt));
  safe('survivors', () => updateSurvivors(dt, cam));
  safe('notes', () => updateNotes(dt));
  safe('building', () => updateBuilding(dt));
  safe('drops', () => updateDrops(dt));
  safe('director', () => updateDirector(dt, ctx));
  safe('wave', () => updateWave(dt));

  // construction ghost
  if (buildMode) {
    ghostPos(G.yaw, G.px, G.pz);
    const gp = ghostPos(G.yaw, G.px, G.pz);
    setGhostOk(G.scrap >= PARTS[buildSel()].cost && !blocked(gp.x, gp.z, 1.6) && Math.hypot(gp.x - W.CAMP.x, gp.z - W.CAMP.z) < 34);
  }

  // ramassage auto esquive
  autoInteractHints();

  // HUD
  safe('hud', () => HUD.updateHUD(dt));
  updateSafeBadge();
  HUD.refreshQuick();
  if (G.frame % 30 === 0) { HUD.renderQuests(); }

  // effets
  safe('fx', () => FX.updateFx(dt));
  trackFps(dt);
  // secousse caméra appliquée
  shakeState = FX.shakeOffset(shakeState);
  // mort
  if (G.hp <= 0 && !G.dead) die();
  // sauvegarde auto
  tickSave(dt);
  if (G.t % 20 < dt) requestSave();

  render();
}
const safe = (() => { const seen = {}; return (name, fn) => { try { fn(); } catch (err) { if (!seen[name]) { seen[name] = 1; console.warn('système ' + name + ':', err); } } }; })();
let safeT = 0;
function updateSafeBadge() {
  safeT -= G.dt; if (safeT > 0) return; safeT = .2;
  const z = G.invuln ? { name: 'MODE ENTRAÎNEMENT', color: '#5dff8f' } : inSafeZone(G.px, G.pz);
  HUD.safeZone(z);
}

let lastTri = 0, lastCalls = 0;
function render() {
  renderer.info.reset();
  if (composer) { composer.render(); lastTri = renderer.info.render.triangles; lastCalls = renderer.info.render.calls; return; }
  renderer.autoClear = true;
  renderer.render(scene, cam);
  // l'arme est rendue par-dessus, sans être occultée par le décor
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(scene, wcam);
  renderer.autoClear = true;
  lastTri = renderer.info.render.triangles; lastCalls = renderer.info.render.calls;
}

/* ============================ construction placement ============================ */
function tryPlaceAt() {
  const p = placePart(G.px, G.pz, G.yaw);
  if (p) HUD.refreshQuick();
}

/* ============================ hints / prompts ============================ */
let promptT = 0;
function autoInteractHints() {
  promptT -= G.dt; if (promptT > 0) return; promptT = .12;
  const pos = V3(G.px, 0, G.pz);
  if (G.inVeh) { HUD.prompt('E', 'Sortir · F klaxon · ⛽ '+Math.round(G.inVeh.fuel)+'%'); return; }
  if (HUD.shopOpen() || HUD.anyOverlay() || gunsmithOpen()) { HUD.prompt('', ''); return; }
  if (Math.hypot(pos.x - W.MARKET.x, pos.z - W.MARKET.z) < 5) { HUD.prompt('E', 'Marché noir'); return; }
  const fac = factionAt(pos);
  if (fac) { HUD.prompt('E', (fac === 'enclave' ? 'Enclave 7' : 'Gang Rouille') + ` — échange (rép ${G.rep[fac]}/3)`); return; }
  const n = nearestSurvivor(pos, 3.8);
  if (n) { HUD.prompt('E', `Recruter ${n.name}`); return; }
  const note = noteNear(pos, 2.6);
  if (note) { HUD.prompt('E', 'Lire la note'); return; }
  const c = lootNear(pos, 2.4);
  if (c) { HUD.prompt('E', 'Piller la caisse'); return; }
  const v = nearestVehicle(pos, 4.4);
  if (v) { HUD.prompt('E', `Monter ${v.K.name}`); return; }
  const poi = poiNear(pos);
  if (poi) { HUD.prompt('E', `Scouting : ${poi.name}`); return; }
  HUD.prompt('', '');
}

// perte de verrouillage souris (Échap navigateur, Alt-Tab) → pause auto
onUnlock(() => { if (G.playing && !G.paused && !G.dead && !HUD.anyOverlay() && !G.invuln) togglePause(true); });
onLock(() => { /* le jeu reprend le focus souris */ });

/* ============================ mort / respawn ============================ */
setDeathHandler(() => { });
function die() {
  G.dead = true; G.playing = true;
  engineOff(); tension(false);
  exitLock();
  HUD.openDeath(statsBlock());
}

/* ============================ sauvegarde auto ============================ */
setInterval(() => { if (G.playing && !G.paused) requestSave(); }, 30000);

/* ============================ bouton continuer ============================ */
if (hasSave()) {
  const s = peekSave();
  document.getElementById('btnContinue').style.display = 'block';
  document.getElementById('contDay').textContent = s.day || 1;
}

document.getElementById('loading').style.display = 'none';
window.__ndBoot.done = true;
render();

/* ---------- FPS / stats de performance ---------- */
let fpsAcc = 0, fpsN = 0, fpsT = 0, showFps = false;
function trackFps(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= .5) {
    fpsT = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (showFps) HUD.perf(fpsT, lastTri, lastCalls, E.length);
  }
}
let N_TRI = () => 0;
addEventListener('nd:fps', () => { showFps = !showFps; if (!showFps) HUD.perf(null); });
N_TRI = () => renderer.info.render.triangles;

/* ============================ Intégration Android ============================ */
//后退 bouton retour Android : ferme l'overlay ouvert, sinon pause
window.__ndBack = () => {
  if (HUD.anyOverlay()) {
    if (document.getElementById('shopScreen').classList.contains('on')) { HUD.closeShop(); requestLock(); return; }
    if (document.getElementById('noteScreen').classList.contains('on')) { document.getElementById('noteScreen').classList.remove('on'); requestLock(); return; }
    if (document.getElementById('questScreen').classList.contains('on')) { HUD.closeQuests(); requestLock(); return; }
    if (document.getElementById('settingsScreen').classList.contains('on')) { closeSettings(); return; }
    if (document.getElementById('pauseScreen').classList.contains('on')) { togglePause(false); return; }
    return;
  }
  if (G.playing && !G.dead) { togglePause(true); return; }
  if (!G.playing) return;
};
// pause automatique quand Android met l'app en arrière-plan
window.__ndPause = () => {
  if (G.playing && !G.paused && !G.dead) { togglePause(true); }
  requestSave(); doSave();
};
// retour visuel (vibration) sur Android
function haptic(ms = 12) {
  if (!S.haptic) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
window.__ndHaptic = haptic;
// vibrations sur les retourRyazanov de gameplay
function haptics() {
  haptic(9);  // tir
}
window.__ndHaptic = haptic;
// bandeau sûr Android (encoche / barre de gestes)
function applyAndroidSafeArea() {
  if (!/Android/i.test(navigator.userAgent)) return;
  document.body.classList.add('android');
  // le WebView Android n'expose pas toujours env() : on lit l'inset via un element test
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0, bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  const r = document.documentElement.style;
  r.setProperty('--sat', top + 'px');
  r.setProperty('--sab', bottom + 'px');
  document.body.classList.add('safe-measured');
}
applyAndroidSafeArea();

/* ============================ API debug ============================ */
window.__ND = {
  G, W, E, V, DEFS, LOOT, DROPS, NPCS: ROSTER, PL, Wp, cam, renderer, scene, IN,
  isBuild: () => buildMode, placeAt: () => tryPlaceAt(),
  fireWeapon, updatePlayer, weapons: WEAPONS, selectWeapon, spawnEnemy, updateEnemies, hitEnemy, liveStats,
  fx: FX, hud: HUD, world: W, mods,
};