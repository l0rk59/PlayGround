// ============================================================================
//  player.js — contrôle du survivant : mouvement, collisions, bruit, vie, vue
// ============================================================================
import * as THREE from 'three';
import { G, S, clamp, lerp, damp, V3 } from './state.js';
import { collide, inSafeZone } from './world.js';
import * as FX from './fx.js';
import { SFX } from './audio.js';
import { IN, pollInput, consumeEdges, setAimScale } from './input.js';

export const PL = {
  cam: null, yawS: 0, pitchS: 0, bobPhase: 0, bobAmt: 0, lean: 0,
  eye: 1.66, crouchEye: 1.05, landT: 0, stepT: 0, lastY: 0, hurtDir: 0,
  buildMode: false, buildSel: 0, throwT: 0, medicCd: 0,
};
let cam = null;
export function initPlayer(camera) {
  cam = camera;
  cam.rotation.order = 'YXZ';
  PL.eye = G.crouch > .5 ? PL.crouchEye : 1.66;
}
export function camera() { return cam; }

/** déplacement + caméra à chaque frame */
export function updatePlayer(dt, ctx) {
  const IN2 = pollInput(dt);
  const edges = consumeEdges();
  // vue (le zoom de visée ralentit la rotation)
  setAimScale(G.aiming ? .55 : 1);
  G.yaw -= edges.lookX;
  G.pitch = clamp(G.pitch - edges.lookY, -1.45, 1.45);
  // FOV (sprint + visée)
  const targetFov = S.fov + (IN2.sprint && IN2.fwd > .2 ? 6 : 0) - (ctx.aim ? 0 : 0);
  if (Math.abs(cam.fov - targetFov) > .05) { cam.fov = lerp(cam.fov, targetFov, dt * 9); cam.updateProjectionMatrix(); }

  if (G.inVeh) { updateInVeh(dt, IN2); return edges; }
  

  // --- stance
  const wantCrouch = (IN2.crouch || (IN2.fwd < -.3 && !IN2.fire)) && !G.inVeh;
  G.crouch = damp(G.crouch, wantCrouch ? 1 : 0, 10, dt);
  const eye = lerp(PL.eye, PL.crouchEye, G.crouch);

  // --- vitesse
  let spd = 0;
  const canSprint = IN2.sprint && IN2.fwd > .1 && !G.aiming && G.stam > 2 && !wantCrouch;
  G.sprint = canSprint;
  if (canSprint) spd = 9.2; else if (wantCrouch) spd = 2.4; else spd = IN2.aiming ? 3.4 : 5.7;
  // endurance
  if (canSprint) { G.stam = clamp(G.stam - 20 * dt, 0, 100); if (G.stam <= 0) G.sprint = false; }
  else G.stam = clamp(G.stam + (14 * dt) * (wantCrouch ? 1.3 : 1), 0, 100);

  // --- direction
  let mx = IN2.side, mz = IN2.fwd;
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const sy = Math.sin(G.yaw), cy = Math.cos(G.yaw);
  const dirX = mx * cy - mz * sy;   // forward = (-sin, -cos)
  const dirZ = -mx * sy - mz * cy;
  const moving = l > .08;
  // footsteps & bruit
  if (moving && G.grounded) {
    PL.stepT -= dt * (canSprint ? 1.6 : 1);
    if (PL.stepT <= 0) { SFX.step(); PL.stepT = wantCrouch ? .9 : .48; G.noise += wantCrouch ? 3 : canSprint ? 22 : 9; }
  }
  G.noise = Math.max(0, G.noise - dt * 12);

  // --- saut / gravité
  if (edges.jump && G.grounded && !wantCrouch) { G.vy = 5.8; G.grounded = false; }
  G.vy -= 17 * dt;
  G.py += G.vy * dt;
  if (G.py <= 0) {
    if (!G.grounded) { const f = Math.abs(G.vy); if (f > 9) { G.hp -= (f - 9) * 4; hurtFlash(); } PL.landT = .18; }
    G.py = 0; G.vy = 0; G.grounded = true;
  } else G.grounded = false;

  // --- collisions
  const nx = G.px + dirX * spd * dt, nz = G.pz + dirZ * spd * dt;
  const pos = V3(nx, 0, nz);
  collide(pos, .45);
  // ne pas entrer dans les véhicules garés
  G.px = pos.x; G.pz = pos.z;
  G.runDist += moving ? spd * dt : 0;
  // caméra
  const camShake = ctx.shake;
  cam.position.set(G.px, G.py + eye + PL.bobAmt + camShake.y, G.pz + camShake.x);
  // balancement de marche
  PL.bobPhase += dt * (canSprint ? 14 : 9) * (moving ? 1 : 0);
  const bobTarget = moving ? (G.grounded ? (canSprint ? .055 : .028) : 0) : 0;
  PL.bobAmt = damp(PL.bobAmt, bobTarget * Math.abs(Math.sin(PL.bobPhase)), 12, dt);
  PL.landT = Math.max(0, PL.landT - dt);
  const landDip = Math.sin(PL.landT * 17) * PL.landT * .5;
  cam.position.y -= landDip;
  // rotation vue (tir slightly off-axis handled by weapon rig)
  cam.rotation.set(G.pitch + camShake.r, G.yaw, 0);
  // vie : régénération lente après un délai + fenêtre d'invincibilité
  if (G.iframeT > 0) G.iframeT -= dt;
  if (G.regenT > 0) G.regenT -= dt;
  if (G.regenT <= 0 && G.hp < G.maxHp) {
    G.hp = Math.min(G.maxHp, G.hp + dt * .9 * G.healBoost);
  }
  return edges;
}

function updateInVeh(dt, IN2) {
  // en véhicule : la caméra est pilotée par vehicles.js (vue arrière)
  cam.rotation.set(G.pitch, G.yaw, 0);
}

/* ---------------- dégâts reçus ---------------- */
export function playerTakeDamage(dmg, fromPos) {
  if (G.dead || G.paused) return;
  if (G.invuln) return;
  if (inSafeZone(G.px, G.pz, -0.5)) return; // zone franche : aucun dégât
  // fenêtre d'invincibilité courte : évite d'être vidé par un groupe
  if (G.iframeT > 0) return;
  G.iframeT = .42;
  G.hp -= dmg;
  G.regenT = 4;
  G.hurtT = .5;
  SFX.playerHurt();
  FX.shake(.4 + dmg * .012, .28);
  hurtFlash();
  if (fromPos) {
    const a = Math.atan2(fromPos.x - G.px, fromPos.z - G.pz);
    const rel = a - G.yaw;
    FX.dmgDir(rel);
  }
  if (G.hp <= 0) { G.hp = 0; onDeath(); }
}
let deathCb = null;
export function setDeathHandler(fn) { deathCb = fn; }
function onDeath() { if (deathCb) deathCb(); }

export function heal(n) {
  if (G.meds <= 0) return false;
  G.meds--; G.hp = clamp(G.hp + 42 * G.healBoost, 0, G.maxHp); SFX.heal(); FX.dmgNumber(V3(G.px, G.py + 1.8, G.pz), 42 * G.healBoost, 'heal'); return true;
}
function hurtFlash() {
  const v = document.getElementById('dmgV');
  if (v) { v.style.opacity = .8; setTimeout(() => v.style.opacity = 0, 160); }
  FX.hurtPulse(.85);
}

/* ---------------- reprise / mort ---------------- */
export function respawn() {
  G.dead = false; G.hp = G.maxHp; G.py = 0; G.stam = 100; G.regenT = 2;
  G.vy = 0;
}
export { IN };