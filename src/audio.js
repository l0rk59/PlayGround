// ============================================================================
//  audio.js — son 100% procédural (WebAudio) : armes, zombies, moteur, ambiance
// ============================================================================
import { S, clamp, rand } from './state.js';

let AC = null, master = null, busSfx = null, busMusic = null, comp = null;
let engine = null, amb = null;

export function initAudio() {
  if (AC) return AC;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return null; }
  comp = AC.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 9;
  comp.attack.value = .004; comp.release.value = .25;
  master = AC.createGain(); master.gain.value = S.vol;
  busSfx = AC.createGain(); busSfx.gain.value = 1;
  busMusic = AC.createGain(); busMusic.gain.value = .5;
  busSfx.connect(comp); busMusic.connect(comp); comp.connect(master); master.connect(AC.destination);
  startAmbience();
  return AC;
}
export function resumeAudio() { if (AC && AC.state === 'suspended') AC.resume(); }
export function setVolume(v) { S.vol = v; if (master) master.gain.setTargetAtTime(v, AC.currentTime, .05); }
const now = () => (AC ? AC.currentTime : 0);
const ok = () => AC && AC.state === 'running';

function env(g, t, a, d, peak = 1) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }

/** note simple */
export function tone(f, dur = .1, type = 'square', gain = .15, slide = 0, delay = 0) {
  if (!ok()) return; const t = now() + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(24, f + slide), t + dur);
  env(g, t, .006, dur, gain); o.connect(g).connect(busSfx); o.start(t); o.stop(t + dur + .05);
}
/** salve de bruit filtré (impacts, tirs, pas) */
export function noise(dur = .15, gain = .3, freq = 1200, type = 'lowpass', q = 1, delay = 0) {
  if (!ok()) return; const t = now() + delay;
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
  amb = loopNoise(420, .03, 'bandpass'); // vent
  const drone = AC.createOscillator(), dg = AC.createGain(), dl = AC.createOscillator(), dlg = AC.createGain();
  drone.type = 'sawtooth'; drone.frequency.value = 55; dg.gain.value = .05;
  dl.type = 'sine'; dl.frequency.value = 82.5; dlg.gain.value = .04;
  drone.connect(dg).connect(busMusic); dl.connect(dlg).connect(busMusic); drone.start(); dl.start();
  const lfo = AC.createOscillator(), lg = AC.createGain();
  lfo.frequency.value = .07; lg.gain.value = 55; lfo.connect(lg).connect(drone.frequency); lfo.start();
  drone._lfo = lfo;
}
export function setAmbience(night, rain) {
  if (!amb || !ok()) return;
  amb.f.frequency.setTargetAtTime(night ? 260 : 620, now(), 1.5);
  amb.g.gain.setTargetAtTime(night ? .075 : .035 + rain * .09, now(), 1.2);
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
    tensionOsc.g.gain.setTargetAtTime(.05, now(), 1.2);
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
  pistol: () => { noise(.13, .5, 1500); tone(220, .1, 'square', .22, -140); },
  rifle: () => { noise(.17, .55, 950, 'lowpass'); tone(130, .14, 'sawtooth', .26, -80); },
  shotgun: () => { noise(.3, .7, 700); tone(90, .26, 'sawtooth', .3, -50); },
  dmr: () => { noise(.24, .6, 700); tone(105, .22, 'sawtooth', .3, -70); },
  silenced: () => { noise(.09, .22, 2400, 'lowpass'); tone(420, .06, 'square', .1, -180); },
  melee: () => { noise(.12, .28, 3200); tone(180, .1, 'triangle', .12, -60); },
  swing: () => { noise(.16, .12, 900); },
  hitFlesh: () => { noise(.09, .32, 600); tone(150, .07, 'square', .14, -70); },
  hitArmor: () => { noise(.06, .3, 3200, 'bandpass', 6); tone(900, .05, 'square', .12, -400); },
  crit: () => { tone(1400, .09, 'triangle', .16, -400); noise(.07, .2, 3000); },
  zDie: () => { tone(95, .38, 'sawtooth', .24, -45); noise(.2, .18, 500); },
  zGrowl: (dist) => { const g = clamp(1 - dist / 45, .05, 1); tone(rand(58, 96), .55, 'sawtooth', .07 * g, -18); },
  zShriek: () => { tone(rand(420, 620), .22, 'sawtooth', .1, -260); },
  spit: () => { noise(.24, .24, 1400); tone(320, .2, 'sawtooth', .1, -140); },
  playerHurt: () => { tone(115, .26, 'sawtooth', .3, -40); noise(.18, .26, 480); },
  step: () => { noise(.07, .07 + Math.random() * .04, 260 + Math.random() * 120); },
  pickup: () => { tone(760, .08, 'sine', .2, 380); tone(1140, .1, 'sine', .14, 0, .06); },
  heal: () => { tone(540, .18, 'sine', .18, 260); tone(810, .22, 'sine', .12, 0, .1); },
  levelUp: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, .16, 'triangle', .2, 0, i * .085)); },
  quest: () => { [784, 1046].forEach((f, i) => tone(f, .18, 'sine', .2, 0, i * .12)); },
  buy: () => { tone(880, .08, 'square', .16); tone(1320, .12, 'square', .13, 0, .07); },
  deny: () => { tone(150, .18, 'square', .18, -50); },
  build: () => { tone(300, .1, 'triangle', .22); tone(460, .14, 'triangle', .18, 0, .07); noise(.1, .16, 700); },
  horn: () => { tone(420, .5, 'square', .2); tone(317, .55, 'square', .18, 0, .02); },
  recruit: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, .16, 'triangle', .18, 0, i * .1)); },
  explode: () => { noise(.55, .8, 260); tone(60, .5, 'sawtooth', .35, -25); },
  glass: () => { noise(.3, .3, 5000, 'bandpass', 3); },
  night: () => { tone(58, 1.4, 'sawtooth', .28, 26); tone(87, 1.2, 'sine', .14, -20, .2); },
  dawn: () => { [392, 523, 659].forEach((f, i) => tone(f, .3, 'sine', .16, 0, i * .16)); },
  click: () => tone(660, .04, 'square', .1),
  reload: () => { noise(.07, .18, 1800); tone(240, .07, 'square', .12, 120, .12); },
  sp: () => noise(.05, .12, 2400),
  rain: () => { noise(.05, .05, 3000); },
};