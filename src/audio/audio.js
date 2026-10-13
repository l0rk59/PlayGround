/**
 * AUDIO — synthese temps reel, zero fichier.
 *
 * Aucun asset audio ne se perd, rien ne se casse a l'instalation, et le
 * poids du build reste nul. Pour une vertical slice, c'est le bon rapport
 * qualite/cout : on entend le jeu, on ne facture pas d'asset.
 *
 * Regles :
 *  - un bus principal, avec separate musique et effets ;
 *  - la musique n'est jamais coupee au sharpness : on fait un fondu de bus
 *    avant de changer de theme ;
 *  - le contexte audio ne demarre qu'au premier geste : les navigateurs
 *    mobile refusent de le demarrer autrement.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Audio {
  constructor(settings = {}) {
    this.ctx = null;
    this.settings = { master: 0.8, music: 0.5, sfx: 0.9, ...settings };
    this.ready = false;
    this.currentTheme = null;
    this.lastSfx = 0;
  }

  /** Appele au premier geste utilisateur. Idempotent. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.settings.master;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfx;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);

    // Un peu de reverb bon marche : deux retards courts en boucle.
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.6, 2.6);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.18;
    this.reverb.connect(wet);
    wet.connect(this.master);

    this.ready = true;
    if (this.currentTheme) this.setTheme(this.currentTheme, true);
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  applySettings(s) {
    this.settings = { ...this.settings, ...s };
    if (!this.ready) return;
    this.master.gain.value = this.settings.master;
    this.sfxBus.gain.value = this.settings.sfx;
  }

  /** Bruit blanc court, reutilise : evite d'allouer a chaque son. */
  noiseBuffer() {
    if (this._noise) return this._noise;
    const len = Math.floor(this.ctx.sampleRate * 0.4);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  tone(freq, { duration = 0.12, type = 'sine', gain = 0.3, slide = 0, bus = 'sfx', reverb = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    if (reverb > 0) {
      const rg = this.ctx.createGain();
      rg.gain.value = reverb;
      g.connect(rg);
      rg.connect(this.reverb);
    }
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise({ duration = 0.16, gain = 0.25, filter = 900, bus = 'sfx' } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const bq = this.ctx.createBiquadFilter();
    bq.type = 'bandpass';
    bq.frequency.value = filter;
    bq.Q.value = 1.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bq);
    bq.connect(g);
    g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  /* --------------------------------------------------------- EFFETS -- */

  play(name) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    // Anti-enchevetrement : dix evenements de degats par image ne
    // doivent pas produire dix fois le meme son.
    if (now - this.lastSfx < 0.035) return;
    this.lastSfx = now;

    switch (name) {
      case 'shoot':
        this.noise({ duration: 0.07, gain: 0.13, filter: 1800 });
        this.tone(180, { duration: 0.06, type: 'square', gain: 0.08, slide: -120 });
        break;
      case 'hit':
        this.noise({ duration: 0.1, gain: 0.2, filter: 520 });
        this.tone(90, { duration: 0.1, type: 'triangle', gain: 0.14, slide: -40 });
        break;
      case 'hit:player':
        this.tone(140, { duration: 0.22, type: 'sawtooth', gain: 0.2, slide: -70 });
        this.noise({ duration: 0.18, gain: 0.18, filter: 320 });
        break;
      case 'dodge':
        this.noise({ duration: 0.14, gain: 0.11, filter: 2400, });
        this.tone(520, { duration: 0.12, type: 'sine', gain: 0.07, slide: 260 });
        break;
      case 'loot':
        this.tone(880, { duration: 0.08, type: 'triangle', gain: 0.1 });
        this.tone(1320, { duration: 0.1, type: 'sine', gain: 0.07 });
        break;
      case 'ability':
        this.tone(220, { duration: 0.5, type: 'sine', gain: 0.18, slide: 440, reverb: 0.5 });
        break;
      case 'telegraph':
        this.tone(110, { duration: 0.4, type: 'sawtooth', gain: 0.09, slide: 40, reverb: 0.3 });
        break;
      case 'enemy:die':
        this.noise({ duration: 0.3, gain: 0.16, filter: 260 });
        this.tone(70, { duration: 0.3, type: 'sine', gain: 0.1, slide: -30 });
        break;
      case 'boss:appear':
        this.tone(58, { duration: 1.8, type: 'sawtooth', gain: 0.22, slide: 18, reverb: 0.8 });
        this.tone(87, { duration: 1.8, type: 'sine', gain: 0.14, reverb: 0.8 });
        break;
      case 'boss:phase':
        this.tone(120, { duration: 1.1, type: 'square', gain: 0.16, slide: -60, reverb: 0.7 });
        break;
      case 'boss:down':
        this.tone(160, { duration: 2.2, type: 'sine', gain: 0.2, slide: -110, reverb: 0.9 });
        this.noise({ duration: 1.4, gain: 0.14, filter: 200 });
        break;
      case 'poi':
        this.tone(523, { duration: 0.5, type: 'sine', gain: 0.12, reverb: 0.6 });
        this.tone(784, { duration: 0.7, type: 'sine', gain: 0.09, reverb: 0.6 });
        break;
      case 'heal':
        this.tone(440, { duration: 0.3, type: 'sine', gain: 0.13, slide: 180, reverb: 0.3 });
        break;
      case 'ui':
        this.tone(660, { duration: 0.05, type: 'sine', gain: 0.07 });
        break;
      default:
        break;
    }
  }

  /* -------------------------------------------------------- MUSIQUE -- */

  /**
   * Trois themes. Le changement passe par un court fondu du bus musical :
   * un arpège qui s'arrete net est le signe d'un jeu amateur.
   */
  setTheme(name, immediate = false) {
    this.currentTheme = name;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const target = name ? this.settings.music * 0.4 : 0;
    this.musicBus.gain.cancelScheduledValues(t);
    if (immediate) {
      this.musicBus.gain.setValueAtTime(target, t);
    } else {
      this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
      this.musicBus.gain.linearRampToValueAtTime(target, t + 1.2);
    }
  }

  /** Nappe continue : deux oscillateurs legerement desaccordes. */
  drone(root = 55, { gain = 0.06, detune = 6 } = {}) {
    if (!this.ready || this._drone) return;
    this._drone = [];
    for (const [mult, det] of [[1, -detune], [1, detune], [2.002, 3]]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = root * mult;
      osc.detune.value = det;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(this.musicBus);
      const rg = this.ctx.createGain();
      rg.gain.value = 0.5;
      g.connect(rg);
      rg.connect(this.reverb);
      osc.start();
      this._drone.push({ osc, g });
    }
  }

  stopDrone() {
    if (!this._drone) return;
    for (const d of this._drone) {
      d.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
      d.osc.stop(this.ctx.currentTime + 0.9);
    }
    this._drone = null;
  }
}

/** Eveil de l'ecran : evite que le telephone se verrouille en plein combat. */
export async function requestWakeLock() {
  try {
    if (navigator.wakeLock?.request) return await navigator.wakeLock.request('screen');
  } catch {
    /* refus navigateur : sans consequence pour la partie */
  }
  return null;
}

/** Vibration courte : uniquement si le joueur l'a demandee. */
export function haptic(pattern, enabled = true) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* API absente : on ignore */
  }
}

export { clamp01 };