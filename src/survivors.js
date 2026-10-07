// ============================================================================
//  survivors.js — escouade (4 rôles), factions,(builder),同伴 跟随 + notes lore
// ============================================================================
import * as THREE from 'three';
import { G, clamp, lerp, rand, V3, TAU } from './state.js';
import { W, freeSpot, collide } from './world.js';
import { nearestEnemy, hitEnemy, enemiesInRadius } from './enemies.js';
import * as FX from './fx.js';
import { SFX } from './audio.js';
import { neonSign, halo as haloTex, metal } from './textures.js';

export const NPCS = [];

/* --------- roster --------- */
export const ROSTER = [
  { id: 'lena', name: 'DOC LENA', role: 'medic', roleTxt: 'Te soigne à 13 m', color: 0x2e8e6e, x: W.CAMP.x - 8, z: W.CAMP.z + 9, hist: 'Ancienne chirurgienne de Neo-Kyoto. Elle a maintenu 40 survivants en vie pendant l\'évacuation du secteur 7.' },
  { id: 'volt', name: 'VOLT', role: 'sniper', roleTxt: 'Dégage les infectés à distance', color: 0x2e5e8e, x: 62, z: 26, hist: 'Ex-technicien des tourelles orbitales. Il entend encore le sifflement des serveurs dans ses rêves.' },
  { id: 'rouille', name: 'ROUILLE', role: 'engineer', roleTxt: 'Répare défenses & véhicules', color: 0x9e6e2e, x: -78, z: -30, hist: 'Mécanicienne des Garages Rive-Sud. Elle parle aux moteurs comme à des vieux amis.' },
  { id: 'kaede', name: 'KAEDE', role: 'scout', roleTxt: 'Repère les points d\'approche', color: 0x9d6bff, x: 118, z: -96, hist: 'Chasseuse de l\'Enclave 7. Elle entend les infectés venir — et sait toujours où sont les sorties.' },
];

/* --------- modèle --------- */
function buildPerson(color, role) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .72, 5, 10), new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: .15 }));
  body.position.y = 1.05; g.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(.62, .4, .38), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, map: metal(), roughness: .7, metalness: .4 }));
  vest.position.y = 1.12; g.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd9a77c, roughness: .8 }));
  head.position.y = 1.86; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.34, .1, .1), new THREE.MeshBasicMaterial({ color: role === 'sniper' ? 0xff2d78 : 0x00e8ff, toneMapped: false }));
  visor.position.set(0, 1.9, .18); g.add(visor);
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .5, 4, 7), new THREE.MeshStandardMaterial({ color, roughness: .7 }));
    a.position.set(s * .36, 1.15, 0); g.add(a); arms.push(a);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .55, 4, 7), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: .85 }));
    l.position.set(s * .14, .42, 0); g.add(l); legs.push(l);
  }
  // arme par rôle
  const gun = new THREE.Group();
  if (role === 'sniper') { const b = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, 1.3), new THREE.MeshStandardMaterial({ color: 0x1a1a20, metalness: .6 })); gun.add(b); }
  else if (role === 'engineer') { const b = new THREE.Mesh(new THREE.BoxGeometry(.3, .22, .4), new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: .5 })); gun.add(b); }
  else if (role === 'medic') { const b = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .08), new THREE.MeshBasicMaterial({ color: 0xff2d78, toneMapped: false })); gun.add(b); }
  else { const b = new THREE.Mesh(new THREE.BoxGeometry(.06, .08, .8), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: .5 })); gun.add(b); }
  gun.position.set(.34, 1.2, .3); g.add(gun);
  return { m: g, arms, legs, head };
}

export function buildSurvivors() {
  for (const r of ROSTER) {
    const b = buildPerson(r.color, r.role);
    const spot = freeSpot(r.x, r.z, 1.4);
    b.m.position.set(spot.x, 0, spot.z);
    scene_add(b.m);
    // étiquetteBillboard
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .85), new THREE.MeshBasicMaterial({ map: neonSign(r.name, '#5dff8f', 512, 128), transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    tag.position.y = 2.6; b.m.add(tag);
    const roleTag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65), new THREE.MeshBasicMaterial({ map: neonSign(r.role.toUpperCase(), '#00e8ff', 512, 128), transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    roleTag.position.y = 2.2; b.m.add(roleTag);
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0x5dff8f, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowS.position.y = 1.2; glowS.scale.setScalar(2.6); b.m.add(glowS);
    b.hx = spot.x; b.hz = spot.z;
    NPCS.push({ ...r, ...b, recruited: false, bob: rand(0, TAU), cd: 0, wanderA: rand(0, TAU), recoilT: 0 });
  }
}
let SCENE = null;
export function initSurvivors(scene) { SCENE = scene; }
function scene_add(m) { if (SCENE) SCENE.add(m); }

export function nearestSurvivor(pos, maxD = 3.8) {
  let best = null, bd = maxD;
  for (const n of NPCS) {
    if (n.recruited) continue;
    const d = Math.hypot(n.m.position.x - pos.x, n.m.position.z - pos.z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
export function recruit(n) {
  if (!n || n.recruited) return false;
  n.recruited = true; G.recruits++;
  SFX.recruit();
  UI.toast(`🤝 ${n.name} rejoint ton groupe — ${n.roleTxt}`, 'good');
  UI.kf(`${n.name} recruté`, 'good');
  return true;
}
export function recruitCount() { return NPCS.filter(n => n.recruited).length; }

/* --------- mise à jour --------- */
export function updateSurvivors(dt, cam) {
  const px = G.inVeh ? G.inVeh.m.position.x : G.px;
  const pz = G.inVeh ? G.inVeh.m.position.z : G.pz;
  for (const n of NPCS) {
    n.bob += dt * 3;
    // billboard étiquettes
    for (const c of n.m.children) {
      if (c.isMesh && c.geometry.type === 'PlaneGeometry') {
        const wp = c.getWorldPosition(V3()); c.lookAt(cam.position);
      }
    }
    if (!n.recruited) {
      // idle proche du camp
      n.m.position.x = n.hx + Math.sin(n.bob * .4) * 1.2;
      n.m.position.z = n.hz + Math.cos(n.bob * .3) * 1.2;
      n.m.rotation.y += dt * .4;
      for (let a = 0; a < 2; a++) { n.arms[a].rotation.x = Math.sin(n.bob + a) * .1; n.legs[a].rotation.x = 0; }
      continue;
    }
    // suit le joueur
    const dist = Math.hypot(px - n.m.position.x, pz - n.m.position.z);
    const follow = G.inVeh ? 9 : 3.4;
    if (dist > follow) {
      const dx = px - n.m.position.x, dz = pz - n.m.position.z, d = Math.hypot(dx, dz) || 1;
      const sp = G.inVeh ? Math.min(dist * 1.6, 15) : Math.min(dist * 1.4, 7);
      const nx = n.m.position.x + (dx / d) * sp * dt;
      const nz = n.m.position.z + (dz / d) * sp * dt;
      const p = V3(nx, 0, nz); collide(p, .4); n.m.position.x = p.x; n.m.position.z = p.z;
      n.m.rotation.y = lerpAngle(n.m.rotation.y, Math.atan2(dx, dz), dt * 8);
      const sw = Math.sin(n.bob * 2);
      for (let a = 0; a < 2; a++) { n.legs[a].rotation.x = sw * a === a ? sw * .6 : -sw * .6; n.arms[a].rotation.x = -sw * .5; }
    } else {
      for (let a = 0; a < 2; a++) { n.legs[a].rotation.x = 0; n.arms[a].rotation.x = 0; }
    }
    // rôle
    n.cd -= dt;
    if (n.role === 'medic' && dist < 13) { G.hp = Math.min(G.maxHp, G.hp + 3 * dt * G.healBoost); if (Math.random() < .02) FX.particle(n.m.position.clone().add(V3(0, 2, 0)), 0x5dff8f, { size: .3, life: .6, add: true }); }
    if (n.role === 'sniper' && n.cd <= 0) {
      const tgt = nearestEnemy(V3(px, 0, pz), 55);
      if (tgt) {
        n.cd = 1.8; n.recoilT = .2;
        FX.beam(n.m.position.clone().add(V3(0, 1.8, 0)), tgt.m.position.clone().add(V3(0, 1.2, 0)), 0x9d6bff, .1, .02);
        SFX.silenced();
        hitEnemy(tgt, 70, { dir: tgt.m.position.clone().sub(n.m.position).normalize(), crit: Math.random() < .3 });
      }
    }
    if (n.role === 'engineer' && n.cd <= 0) {
      // répare le véhicule conduit
      if (G.inVeh) { G.inVeh.hp = Math.min(G.inVeh.maxhp, G.inVeh.hp + 3 * dt * 2); }
      n.cd = .5;
    }
    if (n.role === 'scout' && n.cd <= 0) {
      // signale une horde qui approche
      const near = enemiesInRadius(V3(px, 0, pz), 60);
      if (near.length > 6) { n.cd = 8; UI.kf(`Kaede: ${near.length} infectés au sud !`, 'info'); }
      else n.cd = 2;
    }
  }
}
function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * t; }

/* --------- factions --------- */
export function factionAt(pos) {
  if (Math.hypot(pos.x - W.ENCLAVE.x, pos.z - W.ENCLAVE.z) < 9) return 'enclave';
  if (Math.hypot(pos.x - W.ROUILLE.x, pos.z - W.ROUILLE.z) < 9) return 'rouille';
  return null;
}
export function giveRep(fac, amount) {
  G.rep[fac] = (G.rep[fac] || 0) + amount;
  if (fac === 'enclave') UI.toast(`⚡ Enclave 7 : +${amount} réputation`, 'info');
  else UI.toast(`🔧 Gang Rouille : +${amount} réputation`, 'info');
}

/* --------- notes lore --------- */
export const NOTES = [
  { id: 'n1', x: W.CAMP.x + 3, z: W.CAMP.z - 2, title: 'Note 1 — Premier jour', author: 'Docteur Lena', txt: "Jour 1. Les sirènes n'ont jamais arrêté. On a cru que c'était une panne du réseau.\nQuand les premiers sont tombés, on a compris que le réseau n'était pas en panne.\nC'est nous qui l'avions contaminé." },
  { id: 'n2', x: 84, z: -20, title: 'Note 2 — Conduit 9', author: 'Anonyme', txt: "Si tu lis ça, le tunnel est encore ouvert.\nJ'ai laissé des bidons au troisième embranchement. Prends-en. Le conspicuous ne mange pas de carburant." },
  { id: 'n3', x: -56, z: -6, title: 'Note 3 — Hôpital Kirin', author: 'Dr. Sato', txt: "Le НÉON-X ne se propage pas par l'air. Il entre par les implants.\nCoupe l'implant avant l'injection, pas après. J'aurais aimé comprendre ça plus tôt.\nBon courage à celui qui me lit." },
  { id: 'n4', x: -27, z: 88, title: 'Note 4 — Épave', author: 'Volt', txt: "Le rotor tournait encore. Puis plus rien.\nTrente-trois personnes à bord. Onze sont sortis. Le reste est... parti en courant.\nJe cherche pas de pardon. Je cherche des munitions." },
  { id: 'n5', x: 124, z: -104, title: 'Note 5 — Laboratoire', author: 'Chercheuse anonyme', txt: "Voici la vérité : НÉON-X est un arme. Quelqu'un l'a larguée.\nLes capsules contenaient les sujets d'essai. Le labo n'a pas servi à créer le virus — à le diffuser.\nDésactive le relais au centre, Coordinates inside. Reset. Reset." },
  { id: 'n6', x: -125, z: 118, title: 'Note 6 — Forêt', author: 'Rouille', txt: "La zone irradiée attire le pire. Les infectés y sont plus fous, plus rapides.\nJ'ai perdu un bras là-dedans. Alors restez sur les routes, les gars.\nEncore un jour sans睡觉. Encore un café." },
  { id: 'n7', x: 34, z: 74, title: 'Note 7 — Radio', author: 'Capitaine Ito', txt: "Émetteur réactivé. Si vous entendez ceci : n'allez pas au marché noir de la Rive-Nord. Ils vendent du virus dilué.\nL'Enclave 7 tient encore. Rejoignez-nous. Nous avons un générateur et beaucoup trop de murs." },
  { id: 'n8', x: -140, z: -60, title: 'Note 8 — Le Silence', author: 'Inconnu', txt: "J'ai marché trois jours sans voir un seul infecté.\nPuis la ville est tombée silencieuse. Completement.\nLe silence, c'est pire que les cris. Parce que ça veut dire qu'ils apprennent." },
  { id: 'n9', x: 150, z: 78, title: 'Note 9 — Fuite', author: 'Kaede', txt: "Fuite est un grand mot. Disons que j'ai fui.\nJ'ai vu l'Enclave 7自動化 leur wall门户 le temps d'une respiration, et les horde sont entrées par le toit.\nIls construisent mieux que nous. C'est tout." },
  { id: 'n10', x: 46, z: -18, title: 'Note 10 — Pour celui qui reste', author: 'Lena', txt: "Si tu lis ça, tu es vivant. C'est déjà beaucoup.\nLe feu du camp doit brûler cette nuit. Les autres.nodes tiendront sans moi.\nJe vais dormir. Pour la première fois en trois semaines.\nBonne chance, samouraï." },
];
// corrige les glissés cyrilliques/chaînes douteuses
NOTES[2].txt = NOTES[2].txt.replace('НÉON-X', 'NÉON-X');
NOTES[4].txt = NOTES[4].txt.replace('Coordinates inside. Reset. Reset.', 'Les coordonnées sont à l\'intérieur. Réinitialise le relais, réinitialise le monde.');
NOTES[5].txt = NOTES[5].txt.replace('Encore un jour sans睡觉. Encore un café.', 'Encore un jour sans sommeil. Encore un café.');
NOTES[6].txt = NOTES[6].txt.replace('这时', '');
NOTES[8].txt = NOTES[8].txt.replace('自動化 leur wall门户 le temps', 'ont refermé leur mur le temps');

/* --------- objets de note (collectibles) --------- */
export const notesList = [];
let sceneRef = null;
export function setNoteScene(s) { sceneRef = s; }
export function buildNotes() {
  if (!sceneRef) return;
  for (const n of NOTES) {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(.42, .56), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: .95, side: THREE.DoubleSide, emissive: 0x555544, emissiveIntensity: .3 }));
    g.add(paper);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffe14d, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.6); g.add(glow);
    g.position.set(n.x, 1.1, n.z);
    sceneRef.add(g);
    n.m = g; n.found = false;
    notesList.push(n);
  }
}
export function noteNear(pos, maxD = 2.6) {
  for (const n of notesList) {
    if (n.found) continue;
    if (Math.hypot(n.m.position.x - pos.x, n.m.position.z - pos.z) < maxD) return n;
  }
  return null;
}
export function collectNote(n) {
  if (!n || n.found) return;
  n.found = true; G.notesFound[n.id] = 1;
  n.m.visible = false;
  SFX.pickup();
  UI.showNote(n);
}
export function updateNotes(dt) {
  for (const n of notesList) {
    if (n.found) continue;
    n.m.rotation.y += dt * .8;
    n.m.position.y = 1.1 + Math.sin(G.t * 2 + n.x) * .12;
  }
}