// ============================================================================
//  input.js — clavier / souris (pointer lock) / tactile / gamepad
//  Principe : un seul accumulateur d'edges par frame, lu puis vidé par pollInput.
// ============================================================================
import { S, clamp } from './state.js';

export const IN = {
  fwd: 0, side: 0, crouch: false, sprint: false,
  fire: false, firePressed: false, fireReleased: false, tapFire: false,
  aim: false, reload: false, interact: false,
  build: false, horn: false, heal: false, grenade: false,
  jump: false, brake: false,
  slot: -1, wheel: 0, lookX: 0, lookY: 0,
  touch: false, pad: null,
  locked: false,          // pointer lock actif (PC)
};

const keys = Object.create(null);
const held = Object.create(null);   // boutons « maintenus »
const edges = Object.create(null);  // fronts montants, vidé chaque frame
let el = null, enabled = false, wantLock = false;
const listeners = { lock: [], unlock: [] };

/* ------------------------------------------------------------------ init */
export function initInput(canvas) {
  el = canvas;
  IN.touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  if (IN.touch) document.body.classList.add('touch');
  bindKeyboard();
  bindMouse();
  bindTouch();
  bindGamepad();
  checkOrientation();
  addEventListener('resize', checkOrientation);
  addEventListener('orientationchange', checkOrientation);
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  // si le navigateur refuse le pointer lock (iframe / permission), on n'insiste pas
  document.addEventListener('pointerlockerror', () => { IN.locked = false; wantLock = false; });
}

export function inputEnabled(v) {
  enabled = v;
  if (!v) { releaseAll(); wantLock = false; }
  else wantLock = !IN.touch;
}

/* -------------------------------------------------------------- clavier */
const CODE = {
  KeyW: 'fwd+', ArrowUp: 'fwd+', KeyZ: 'fwd+',
  KeyS: 'fwd-', ArrowDown: 'fwd-',
  KeyA: 'side-', KeyQ: 'side-', ArrowLeft: 'side-',
  KeyD: 'side+', ArrowRight: 'side+',
};
const KEYMAP = {
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyE: 'interact', KeyF: 'horn', KeyR: 'reload', KeyB: 'build', Tab: 'build',
  KeyH: 'heal', KeyG: 'grenade', KeyC: 'crouch', KeyT: 'training', KeyV: 'gunsmith', KeyP: 'fps',
  KeyX: 'brake', KeyM: 'map',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3',
  Digit4: 'slot4', Digit5: 'slot5', Digit6: 'slot6', Digit7: 'slot7',
  Escape: 'pause',
};
const SWALLOW = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Quote']);

function bindKeyboard() {
  addEventListener('keydown', e => {
    if (e.code === 'F5' || e.code === 'F11' || e.code === 'F12') return;
    if (SWALLOW.has(e.code)) e.preventDefault();
    if (e.repeat) return;                       // pas de répétition pour les edges
    const code = e.code || e.key;
    // axes directs (AZERTY : code physique → logique)
    const ax = CODE[code];
    if (ax) held[ax] = true;
    // actions
    const act = KEYMAP[code];
    if (act === 'pause') { edges.pause = true; return; }
    if (act && act.startsWith('slot')) { edges.slot = +act.slice(4) - 1; return; }
    if (act) edges[act] = true;
    if (enabled && !IN.touch) wantLock = true;
  }, { passive: false });

  addEventListener('keyup', e => {
    const code = e.code || e.key;
    const ax = CODE[code];
    if (ax) held[ax] = false;
    const act = KEYMAP[code];
    if (act && !act.startsWith('slot')) edges['up_' + act] = true;
  });
}

/* ---------------------------------------------------------------- souris */
function bindMouse() {
  el.addEventListener('mousedown', e => {
    if (!enabled) return;
    if (e.button === 0) { held.fire = true; edges.firePressed = true; }
    if (e.button === 2) { held.aim = true; }
    if (e.button === 1) e.preventDefault();
    // clic sur le canvas = verrouiller la souris si demandé
    if (!IN.touch && !IN.locked && wantLock) requestLock();
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) { if (held.fire) edges.fireReleased = true; held.fire = false; }
    if (e.button === 2) held.aim = false;
  });
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => {
    if (!enabled) return;
    e.preventDefault();
    edges.wheel += e.deltaY > 0 ? 1 : -1;
  }, { passive: false });

  // déplacement souris : deux sources (pointer lock OU drag libre)
  addEventListener('mousemove', e => {
    if (!enabled) return;
    if (IN.locked && document.pointerLockElement === el) {
      applyLook(e.movementX || 0, e.movementY || 0);
    } else if (dragging) {
      applyLook(e.movementX || 0, e.movementY || 0);
    }
  });
  // glisser-déposer à la souris (utile si le pointer lock est indisponible)
  let dragging = false, dragId = -1;
  el.addEventListener('mousedown', e => { if (!IN.locked && e.button === 2) { dragging = true; dragId = e.button; } });
  addEventListener('mouseup', () => { dragging = false; });

  document.addEventListener('pointerlockchange', () => {
    IN.locked = document.pointerLockElement === el;
    if (IN.locked) listeners.lock.forEach(f => f());
    else { listeners.unlock.forEach(f => f()); if (enabled && wantLock && !IN.touch) setTimeout(() => { if (!IN.locked && wantLock) { wantLock = false; listeners.unlock.forEach(f => f('nolock')); } }, 60); }
  });
}
function applyLook(dx, dy) {
  const k = .0022 * S.sens * (G_aimScale());
  IN.lookX -= dx * k;
  IN.lookY -= dy * k * (S.invertY ? -1 : 1);
}
let aimScale = 1;
function G_aimScale() { return aimScale; }
export function setAimScale(v) { aimScale = v; }

export function requestLock() {
  if (!el || IN.touch) return;
  try { const p = el.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { el.requestPointerLock(); } catch (e) { /* ignore */ } }); }
  catch (e) { try { el.requestPointerLock(); } catch (e2) { /* ignore */ } }
}
export function exitLock() { wantLock = false; if (document.pointerLockElement) document.exitPointerLock(); }
export function onLock(f) { listeners.lock.push(f); }
export function onUnlock(f) { listeners.unlock.push(f); }
export function isLocked() { return IN.locked; }
export function releaseAll() {
  for (const k in keys) keys[k] = false;
  for (const k in held) held[k] = false;
  IN.fwd = 0; IN.side = 0; IN.fire = false; IN.aim = false; IN.sprint = false;
}

/* ---------------------------------------------------------------- tactile */
const stickState = { l: null };

/* ----------------stick de déplacement (gauche, flottant) ---------------- */
function moveStick(zoneId, stickId) {
  const zone = document.getElementById(zoneId), st = document.getElementById(stickId);
  if (!zone || !st) return;
  let id = null, cx = 0, cy = 0;
  const R = 58;

  const paint = (dx, dy) => {
    const pr = zone.getBoundingClientRect();
    st.style.left = (cx - pr.left + dx) + 'px';
    st.style.top = (cy - pr.top + dy) + 'px';
    const lx = clamp(cx - pr.left, 0, pr.width), ly = clamp(cy - pr.top, 0, pr.height);
    zone.style.background = `radial-gradient(circle at ${lx}px ${ly}px, rgba(0,229,255,.07) 0 ${R}px, transparent ${R}px)`;
  };
  const reset = () => {
    id = null; st.classList.remove('on'); stickState.l = null; zone.style.background = '';
  };

  zone.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (id !== null) continue;
      id = t.identifier; cx = t.clientX; cy = t.clientY;
      const pr = zone.getBoundingClientRect();
      st.style.left = (t.clientX - pr.left) + 'px';
      st.style.top = (t.clientY - pr.top) + 'px';
      st.classList.add('on');
      stickState.l = { x: 0, y: 0 };
      paint(0, 0);
    }
    e.preventDefault();
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== id) continue;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      paint(dx, dy);
      // zone morte : évite les micro-dérives
      const nx = dx / R, ny = dy / R;
      const dead = 0.12;
      const mag = Math.hypot(nx, ny);
      stickState.l = mag < dead ? { x: 0, y: 0 } : { x: nx, y: ny, mag };
    }
    e.preventDefault();
  }, { passive: false });

  zone.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === id) reset(); });
  zone.addEventListener('touchcancel', e => { for (const t of e.changedTouches) if (t.identifier === id) reset(); });
}

/* --------- zone droite : geste unifié  glisser = viser, taper = tirer ---------
   C'est le standard des FPS mobiles et cela supprime tout conflit avec les
   boutons (plus besoin d'une zone « joystick droit » qui se fait voler).      */
const LOOK = { touchId: -1, sx: 0, sy: 0, moved: 0, t0: 0, firing: false };
/** radians par pixel de glissement (identique à la souris : 0.0022) */
const LOOK_SPEED = 0.0022;

function lookZone(zoneId) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  const TAP_MS = 320, TAP_PX = 22;

  zone.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (LOOK.touchId !== -1) continue;
      if (t.target !== zone) continue;              // un bouton a été touché
      LOOK.touchId = t.identifier;
      LOOK.sx = t.clientX; LOOK.sy = t.clientY;
      LOOK.moved = 0; LOOK.t0 = performance.now();
      zone.classList.add('looking');
    }
    e.preventDefault();
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== LOOK.touchId) continue;
      // ignore les micro-mouvements (bruit du capteur) : évite le tremblement
      const rawX = t.clientX - LOOK.sx, rawY = t.clientY - LOOK.sy;
      if (Math.abs(rawX) + Math.abs(rawY) < 1.2) continue;
      const dx = rawX, dy = rawY;
      LOOK.sx = t.clientX; LOOK.sy = t.clientY;
      LOOK.moved += Math.abs(dx) + Math.abs(dy);
      // même base que la souris (par pixel) : 0.0022 * sensibilité
      // → un balayage d'écran = ~170°, indépendant de la résolution
      const k = LOOK_SPEED * S.sens * (G_aimScale());
      IN.lookX -= dx * k;
      IN.lookY -= dy * k * (S.invertY ? -1 : 1);
    }
    e.preventDefault();
  }, { passive: false });

  const release = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== LOOK.touchId) continue;
      const quick = performance.now() - LOOK.t0 < TAP_MS;
      if (quick && LOOK.moved <= TAP_PX) {
        // appui bref = un tir.
        // On pose un drapeau PEUT ÊTRE lu par la boucle de jeu (et non un
        // setTimeout) : sur un appareil lent une frame dure > 70 ms et le
        // minuteur se déclenchait AVANT que la boucle voie le tir.
        IN.tapFire = true;
      }
      LOOK.touchId = -1; LOOK.firing = false;
      zone.classList.remove('looking');
    }
  };
  zone.addEventListener('touchend', release);
  zone.addEventListener('touchcancel', release);
}

function btn(id, down, up) {
  const b = document.getElementById(id);
  if (!b) return;
  const on = e => { if (e.cancelable) e.preventDefault(); if (!enabled) return; b.classList.add('on'); down(); };
  const off = e => { if (e && e.cancelable) e.preventDefault(); b.classList.remove('on'); up && up(); };
  b.addEventListener('touchstart', on, { passive: false });
  b.addEventListener('touchend', off);
  b.addEventListener('touchcancel', off);
  b.addEventListener('mousedown', on);
  b.addEventListener('mouseup', off);
  b.addEventListener('mouseleave', off);
  b.addEventListener('click', e => e.preventDefault());
}

function bindTouch() {
  moveStick('zL', 'stickL');
  lookZone('zR');
  // tir maintenu (le tap de la zone droite donne un tir unique)
  btn('bFire', () => { held.fire = true; edges.firePressed = true; },
              () => { edges.fireReleased = true; held.fire = false; });
  btn('bAim', () => { held.aim = !held.aim; });
  btn('bJump', () => edges.jump = true);
  btn('bReload', () => edges.reload = true);
  btn('bAct', () => edges.interact = true);
  btn('bBuild', () => edges.build = true);
  btn('bHorn', () => edges.horn = true);
  btn('bPause', () => edges.pause = true);
}

/* --------------------------------------------------------------- gamepad */
function bindGamepad() {
  addEventListener('gamepadconnected', e => { IN.pad = e.gamepad.index; });
  addEventListener('gamepaddisconnected', () => { IN.pad = null; });
}
function pollPad(dt) {
  if (IN.pad === null || IN.pad === undefined) return false;
  const p = navigator.getGamepads && navigator.getGamepads()[IN.pad];
  if (!p || !p.connected) return false;
  const dz = .22, dzT = .5;
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0, rx = p.axes[2] || 0, ry = p.axes[3] || 0;
  const shaped = v => Math.abs(v) < dz ? 0 : (Math.abs(v) - dz) / (1 - dz) * Math.sign(v);
  IN.fwd += -shaped(ay);
  IN.side += shaped(ax);
  applyLook(rx * 14 * dt, ry * 14 * dt);
  IN.sprint = IN.sprint || !!pressed(p, 10) || !!pressed(p, 6);
  const fire = pressed(p, 7) || (p.buttons[0] && p.buttons[0].value > dzT);
  if (fire && !held.padFire) { edges.firePressed = true; held.padFire = true; }
  if (!fire && held.padFire) { edges.fireReleased = true; held.padFire = false; }
  IN.fire = IN.fire || fire;
  if (justPressed(p, 1)) edges.reload = true;
  if (justPressed(p, 0)) edges.jump = true;
  if (justPressed(p, 2)) held.aim = !held.aim;
  if (justPressed(p, 3)) edges.interact = true;
  if (justPressed(p, 4)) edges.horn = true;
  if (justPressed(p, 5)) edges.build = true;
  if (justPressed(p, 9)) edges.pause = true;
  if (justPressed(p, 12)) edges.slot = 0;
  if (justPressed(p, 13)) edges.slot = 1;
  if (justPressed(p, 14)) edges.slot = 2;
  if (justPressed(p, 15)) edges.slot = 3;
  if (p.buttons[8]) IN.fwd = -1;
  return true;
}
const prevBtn = {};
function pressed(p, i) { const b = p.buttons[i]; return !!(b && (b.pressed || b.value > .5)); }
function justPressed(p, i) {
  const now = pressed(p, i);
  const was = prevBtn[i]; prevBtn[i] = now;
  return now && !was;
}

/* ---------------------------------------------------------- lecture frame */
export function pollInput(dt) {
  // axes clavier
  let f = (held['fwd+'] ? 1 : 0) - (held['fwd-'] ? 1 : 0);
  let s = (held['side+'] ? 1 : 0) - (held['side-'] ? 1 : 0);
  // axes tactiles
  const L = stickState.l;
  if (L) {
    f += -L.y; s += L.x;
    // inclinaison du stick : course automatique au-delà de 92 %
    if (L.mag > .92) IN.sprintSticky = true;
  }
  // gamepad
  pollPad(dt);
  const l = Math.hypot(f, s);
  if (l > 1) { f /= l; s /= l; }
  IN.fwd = f; IN.side = s;
  IN.sprint = !!(held.sprint || (L && Math.hypot(L.x, L.y) > .88));
  IN.crouch = !!held.crouch;
  IN.brake = !!held.brake;
  IN.aim = !!held.aim;
  IN.fire = !!held.fire || IN.tapFire;
  IN.jump = !!edges.jump;
  IN.reload = !!edges.reload;
  IN.interact = !!edges.interact;
  IN.build = !!edges.build;
  IN.horn = !!edges.horn;
  IN.heal = !!edges.heal;
  IN.grenade = !!edges.grenade;
  IN.slot = typeof edges.slot === 'number' ? edges.slot : -1;
  return IN;
}

/** consomme les fronts (à appeler une fois par frame, après usage) */
export function consumeEdges() {
  const e = {
    firePressed: !!edges.firePressed, fireReleased: !!edges.fireReleased, tapFire: IN.tapFire,
    up: null,
    jump: !!edges.jump, reload: !!edges.reload, interact: !!edges.interact,
    build: !!edges.build, horn: !!edges.horn, heal: !!edges.heal, grenade: !!edges.grenade,
    training: !!edges.training, gunsmith: !!edges.gunsmith, fps: !!edges.fps, pause: !!edges.pause, map: !!edges.map,
    slot: typeof edges.slot === 'number' ? edges.slot : -1, wheel: edges.wheel | 0,
    lookX: IN.lookX, lookY: IN.lookY,
  };
  for (const k in edges) delete edges[k];
  IN.lookX = 0; IN.lookY = 0;
  IN.tapFire = false;   // consommé par la boucle : exactement un tir par tap
  return e;
}
export function resetLook() { IN.lookX = 0; IN.lookY = 0; }

/* ------------------------------------------------------------ orientation */
function checkOrientation() {
  const portrait = innerHeight > innerWidth;
  const small = Math.min(innerWidth, innerHeight) < 620;
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('locked', portrait && small);
  layoutTouch();
}

/** place les boutons tactiles : deux colonnes, sans chevauchement */
function layoutTouch() {
  const landscape = innerWidth >= innerHeight;
  const small = Math.min(innerWidth, innerHeight) < 460;
  const sc = small ? .92 : 1;
  const set = (id, right, bottom, size) => {
    const e = document.getElementById(id); if (!e) return;
    e.style.right = right + 'px'; e.style.bottom = bottom + 'px';
    e.style.left = 'auto'; e.style.width = size + 'px'; e.style.height = size + 'px';
  };
  const setL = (id, pct, bottom, size) => {
    const e = document.getElementById(id); if (!e) return;
    e.style.left = pct + '%'; e.style.right = 'auto';
    e.style.bottom = bottom + 'px'; e.style.width = size + 'px'; e.style.height = size + 'px';
  };
  if (!landscape) return; // en portrait : l'écran de rotation s'affiche
  // droite : FEU (maintenu) puis action / viser / recharger / saut
  set('bFire', 18 * sc, 18 * sc, 82 * sc);
  set('bAct', 112 * sc, 24 * sc, 56 * sc);
  set('bAim', 84 * sc, 16 * sc, 52 * sc);
  set('bReload', 82 * sc, 78 * sc, 46 * sc);
  set('bJump', 20 * sc, 88 * sc, 48 * sc);
  // centre-gauche : construire / klaxon / pause
  setL('bBuild', 46, 16 * sc, 46 * sc);
  setL('bHorn', 47, 72 * sc, 42 * sc);
  setL('bPause', 3, 12, 38);
}
export { layoutTouch };