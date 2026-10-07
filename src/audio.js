// ============================================================================
//  audio.js — son 100% procédural (WebAudio) : armes, zombies, moteur, ambiance
// ============================================================================
import { S, clamp, rand } from './state.js';

let AC = null, master = null, busSfx = null, busMusic = null, comp = null, limiter = null, sfxTone = null;
let engine = null, amb = null;

export function initAudio() {
  if (AC) return AC;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return null; }
  // --- chaîne de sortie : compresseur + limiteur dur (évite la saturation)
  comp = AC.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 12;
  comp.attack.value = .003; comp.release.value = .18;
  limiter = AC.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = .001; limiter.release.value = .06;
  master = AC.createGain(); master.gain.value = S.vol;
  busSfx = AC.createGain(); busSfx.gain.value = .8;
  busMusic = AC.createGain(); busMusic.gain.value = .22;   // ambiance discrete
  // filtre « Passe-bas » doux sur les SFX : enlève l'agressivité des hautes fréquences
  sfxTone = AC.createBiquadFilter();
  sfxTone.type = 'lowpass'; sfxTone.frequency.value = 7200; sfxTone.Q.value = .5;
  busSfx.connect(sfxTone); sfxTone.connect(comp);
  busMusic.connect(comp); comp.connect(limiter); limiter.connect(master); master.connect(AC.destination);
  startAmbience();
  return AC;
}
export function resumeAudio() { if (AC && AC.state === 'suspended') AC.resume(); }
export function setVolume(v) { S.vol = v; if (master) master.gain.setTargetAtTime(v, AC.currentTime, .05); }
const now = () => (AC ? AC.currentTime : 0);
const ok = () => AC && AC.state === 'running';

/** évite d'empiler 30 fois le même son (gargouillis, pas, impacts) */
const _last = Object.create(null);
function gate(key, ms) {
  const t = performance.now();
  if (_last[key] && t - _last[key] < ms) return false;
  _last[key] = t; return true;
}

function env(g, t, a, d, peak = 1) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }

/** note simple */
export function tone(f, dur = .1, type = 'square', gain = .15, slide = 0, delay = 0) {
  if (!ok()) return;
  if (delay === 0 && !gate('t' + Math.round(f), 35)) return;   // anti-empilement
  const t = now() + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(24, f + slide), t + dur);
  env(g, t, .006, dur, gain); o.connect(g).connect(busSfx); o.start(t); o.stop(t + dur + .05);
}
/** salve de bruit filtré (impacts, tirs, pas) */
export function noise(dur = .15, gain = .3, freq = 1200, type = 'lowpass', q = 1, delay = 0) {
  if (!ok()) return;
  if (delay === 0 && !gate('n' + Math.round(freq), 28)) return;
  const t = now() + delay;
  const n = Math.max(1, Math.floor(AC.sampleRate * dur));
  const buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 1.4;
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  const g = AC.createGain(); env(g, t, .004, dur, gain);
  s.connect(f).connect(g).connect(busSfx); s.start(t);
}
/** bruit blanc en boucle (vent, pluie, horde) */
function loopNoise(freq, gain, type = 'bandpass') {
  const n = AC.sampleRate * 2, buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = buf; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = .7;
  const g = AC.createGain(); g.gain.value = gain;
  s.connect(f).connect(g).connect(busMusic); s.start();
  return { s, g, f };
}

/* ---------------- ambiance + musique ---------------- */
function startAmbience() {
  // vent lointain : très discret, filtré
  amb = loopNoise(340, .012, 'lowpass');
  // drone grave, filtré (soundscape cyberpunk)
  const droneF = AC.createBiquadFilter();
  droneF.type = 'lowpass'; droneF.frequency.value = 240; droneF.Q.value = .8;
  const drone = AC.createOscillator(), dg = AC.createGain();
  drone.type = 'sawtooth'; drone.frequency.value = 55; dg.gain.value = .022;
  drone.connect(droneF).connect(dg).connect(busMusic); drone.start();
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.frequency.value = .05; lg.gain.value = 8; lfo.connect(lg).connect(drone.frequency); lfo.start();
  drone._lfo = lfo;
}
export function setAmbience(night, rain) {
  if (!amb || !ok()) return;
  amb.f.frequency.setTargetAtTime(night ? 200 : 420, now(), 1.5);
  amb.g.gain.setTargetAtTime(night ? .04 : .022 + rain * .05, now(), 1.2);
}
/** tension musicale pendant les vagues */
export function tension(on) {
  if (!ok()) return;
  if (on && !tensionOsc) {
    tensionOsc = { o: AC.createOscillator(), o2: AC.createOscillator(), g: AC.createGain(), f: AC.createBiquadFilter() };
    tensionOsc.o.type = 'sawtooth'; tensionOsc.o.frequency.value = 73.4;
    tensionOsc.o2.type = 'sawtooth'; tensionOsc.o2.frequency.value = 77.8;
    tensionOsc.f.type = 'lowpass'; tensionOsc.f.frequency.value = 420;
    tensionOsc.g.gain.value = .0001;
    tensionOsc.o.connect(tensionOsc.f); tensionOsc.o2.connect(tensionOsc.f);
    tensionOsc.f.connect(tensionOsc.g).connect(busMusic);
    tensionOsc.o.start(); tensionOsc.o2.start();
    tensionOsc.g.gain.setTargetAtTime(.022, now(), 1.2);
  } else if (!on && tensionOsc) {
    const t = tensionOsc; tensionOsc = null;
    t.g.gain.setTargetAtTime(.0001, now(), .8);
    setTimeout(() => { try { t.o.stop(); t.o2.stop(); } catch (e) { /* ignore */ } }, 2200);
  }
}
let tensionOsc = null;

/* ---------------- moteur de véhicule ---------------- */
export function engineOff() {
  if (!engine) return;
  const e = engine; engine = null;
  e.g.gain.setTargetAtTime(.0001, now(), .25);
  setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch (err) { /* ignore */ } }, 900);
}
export function engineOn(on, kind = 'buggy') {
  if (!ok()) return;
  if (on && !engine) {
    const o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square';
    const base = kind === 'truck' ? 46 : kind === 'van' ? 58 : 74;
    o.frequency.value = base; o2.frequency.value = base * 1.51;
    f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = .0001;
    o.connect(f); o2.connect(f); f.connect(g).connect(busSfx); o.start(); o2.start();
    engine = { o, o2, g, f, base };
    g.gain.setTargetAtTime(.06, now(), .3);
  } else if (!on && engine) {
    const e = engine; engine = null;
    e.g.gain.setTargetAtTime(.0001, now(), .25);
    setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch (err) { /* ignore */ } }, 900);
  }
}
export function engineUpdate(speed, maxSpeed, kind = 'buggy') {
  if (!engine || !ok()) return;
  const base = kind === 'truck' ? 46 : kind === 'van' ? 58 : 74;
  const rpm = base + clamp(speed / maxSpeed, 0, 1.25) * base * 2.1;
  engine.o.frequency.setTargetAtTime(rpm, now(), .08);
  engine.o2.frequency.setTargetAtTime(rpm * 1.51, now(), .08);
  engine.f.frequency.setTargetAtTime(500 + clamp(speed / maxSpeed, 0, 1) * 1400, now(), .12);
  engine.g.gain.setTargetAtTime(.045 + clamp(speed / maxSpeed, 0, 1) * .05, now(), .15);
}

/* ---------------- banque de sons ---------------- */
export const SFX = {
  pistol: () => { noise(.12, .34, 1200); tone(200, .09, 'square', .15, -120); },
  rifle: () => { noise(.16, .38, 780, 'lowpass'); tone(120, .13, 'sawtooth', .17, -70); },
  shotgun: () => { noise(.28, .48, 520); tone(85, .24, 'sawtooth', .2, -45); },
  dmr: () => { noise(.22, .42, 560); tone(100, .2, 'sawtooth', .2, -60); },
  silenced: () => { noise(.08, .16, 1800, 'lowpass'); tone(400, .06, 'square', .07, -160); },
  melee: () => { noise(.12, .28, 3200); tone(180, .1, 'triangle', .12, -60); },
  swing: () => { noise(.16, .12, 900); },
  hitFlesh: () => { noise(.09, .24, 520); tone(140, .06, 'square', .1, -60); },
  hitArmor: () => { noise(.06, .2, 2200, 'bandpass', 6); tone(820, .05, 'square', .08, -380); },
  crit: () => { tone(1400, .09, 'triangle', .16, -400); noise(.07, .2, 3000); },
  zDie: () => { tone(92, .34, 'sawtooth', .16, -40); noise(.18, .12, 420); },
  zGrowl: (dist) => { const g = clamp(1 - dist / 45, .02, 1); tone(rand(58, 96), .5, 'sawtooth', .04 * g, -16); },
  zShriek: () => { tone(rand(420, 620), .22, 'sawtooth', .1, -260); },
  spit: () => { noise(.24, .24, 1400); tone(320, .2, 'sawtooth', .1, -140); },
  playerHurt: () => { tone(110, .24, 'sawtooth', .2, -38); noise(.16, .18, 420); },
  step: () => { if (!gate('step', 90)) return; noise(.07, .045 + Math.random() * .025, 240 + Math.random() * 100); },
  pickup: () => { tone(760, .08, 'sine', .2, 380); tone(1140, .1, 'sine', .14, 0, .06); },
  heal: () => { tone(540, .18, 'sine', .18, 260); tone(810, .22, 'sine', .12, 0, .1); },
  levelUp: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, .16, 'triangle', .2, 0, i * .085)); },
  quest: () => { [784, 1046].forEach((f, i) => tone(f, .18, 'sine', .2, 0, i * .12)); },
  buy: () => { tone(880, .08, 'square', .16); tone(1320, .12, 'square', .13, 0, .07); },
  deny: () => { tone(150, .18, 'square', .18, -50); },
  build: () => { tone(300, .1, 'triangle', .22); tone(460, .14, 'triangle', .18, 0, .07); noise(.1, .16, 700); },
  horn: () => { tone(420, .5, 'square', .2); tone(317, .55, 'square', .18, 0, .02); },
  recruit: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, .16, 'triangle', .18, 0, i * .1)); },
  explode: () => { noise(.55, .55, 220); tone(58, .45, 'sawtooth', .24, -22); },
  glass: () => { noise(.3, .3, 5000, 'bandpass', 3); },
  night: () => { tone(56, 1.4, 'sawtooth', .18, 22); tone(84, 1.2, 'sine', .09, -18, .2); },
  dawn: () => { [392, 523, 659].forEach((f, i) => tone(f, .3, 'sine', .16, 0, i * .16)); },
  click: () => tone(660, .04, 'square', .1),
  reload: () => { noise(.07, .18, 1800); tone(240, .07, 'square', .12, 120, .12); },
  sp: () => noise(.05, .12, 2400),
  rain: () => { noise(.05, .05, 3000); },
};