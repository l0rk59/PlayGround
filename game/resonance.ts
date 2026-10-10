const SCALE = [0, 3, 5, 7, 10, 12]
const BASE_FREQ = 261.63

export class Resonance {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false

  get available(): boolean {
    return this.ctx !== null
  }

  get isMuted(): boolean {
    return this.muted
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.16
      this.master.connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.16, this.ctx.currentTime, 0.02)
    }
  }

  note(step: number, chain: number, accent: boolean): void {
    if (!this.ctx || !this.master || this.muted) return
    const degree = SCALE[Math.min(step, SCALE.length - 1)] ?? 0
    const freq = BASE_FREQ * Math.pow(2, degree / 12) * Math.pow(1.0293, Math.min(chain, 8))
    this.blip(freq, accent ? 0.42 : 0.24, accent ? 'triangle' : 'sine')
    if (accent) this.blip(freq * 2, 0.14, 'sine', 0.04)
  }

  chord(chain: number): void {
    if (!this.ctx || !this.master || this.muted) return
    const root = SCALE[Math.min(chain, SCALE.length - 1)] ?? 0
    const base = BASE_FREQ * Math.pow(2, root / 12)
    this.blip(base, 0.3, 'triangle', 0.34)
    this.blip(base * 1.5, 0.22, 'sine', 0.36)
    this.blip(base * 2, 0.16, 'sine', 0.38)
  }

  thud(): void {
    if (!this.ctx || !this.master || this.muted) return
    this.blip(98, 0.4, 'sawtooth', 0.22)
  }

  private blip(freq: number, gain: number, type: OscillatorType, delay = 0): void {
    if (!this.ctx || !this.master) return
    const start = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.34)
    osc.connect(env)
    env.connect(this.master)
    osc.start(start)
    osc.stop(start + 0.4)
  }
}

export const SCALE_NOTES = SCALE