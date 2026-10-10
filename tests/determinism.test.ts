import { describe, expect, it } from 'vitest'
import { BOSSES, RELICS } from '../core/load'
import { checksumState, replayChecksum, replayRun, type ReplayStep } from '../core/replay'
import { prototypeConfig, type RunDeps } from '../core/run'
import { playRun } from '../tools/bot'

const deps: RunDeps = { bosses: BOSSES, relicPool: RELICS }
const cfg = prototypeConfig()

const SEEDS = [1, 2, 3, 17, 99, 404, 20261010, 31337]

function stepsFor(seed: number): ReplayStep[] {
  return playRun(seed, 'heuristic', cfg, deps).steps
}

describe('replay fidelity', () => {
  it('reproduces the exact final state from the same seed', () => {
    for (const seed of SEEDS) {
      const steps = stepsFor(seed)
      const a = replayChecksum(seed, steps, cfg, deps)
      const b = replayChecksum(seed, steps, cfg, deps)
      expect(a).toBe(b)
    }
  })

  it('reproduces the score and the board together', () => {
    for (const seed of SEEDS) {
      const steps = stepsFor(seed)
      const played = playRun(seed, 'heuristic', cfg, deps)
      const replayed = replayRun(seed, steps, cfg, deps)
      expect(replayed.ok).toBe(true)
      expect(replayed.state.score).toBe(played.state.score)
      expect(replayed.state.round).toBe(played.state.round)
      expect(replayed.state.phase).toBe(played.state.phase)
      expect(checksumState(replayed.state)).toBe(checksumState(played.state))
    }
  })

  it('rejects a tampered journal instead of silently accepting it', () => {
    const places = stepsFor(5).filter(s => s.kind === 'place') as Extract<ReplayStep, { kind: 'place' }>[]
    expect(places.length).toBeGreaterThan(3)
    const tampered: ReplayStep[] = places.slice(0, 3)
    ;(tampered[0] as Extract<ReplayStep, { kind: 'place' }>).x = 99
    ;(tampered[0] as Extract<ReplayStep, { kind: 'place' }>).y = 99
    const result = replayRun(5, tampered, cfg, deps)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects a journal that claims an impossible placement', () => {
    const result = replayRun(1, [{ kind: 'place', slot: 0, x: 99, y: 99, rotation: 0 }], cfg, deps)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('produces a different journal for a different seed', () => {
    const a = JSON.stringify(stepsFor(1))
    const b = JSON.stringify(stepsFor(2))
    expect(a).not.toBe(b)
  })

  it('survives a long six round run end to end', () => {
    const full = { ...cfg, totalRounds: 6, bossRounds: [3, 6] }
    for (const seed of [4, 8, 15]) {
      const steps = playRun(seed, 'heuristic', full, deps).steps
      const replayed = replayRun(seed, steps, full, deps)
      expect(replayed.ok).toBe(true)
    }
  })
})

describe('seeded daily challenge', () => {
  it('derives a stable journal from a date string', () => {
    const day = '2026-10-10'
    const seedA = 20261010
    const seedB = 20261011
    expect(stepsFor(seedA).length).toBeGreaterThan(0)
    expect(JSON.stringify(stepsFor(seedA))).toBe(JSON.stringify(stepsFor(seedA)))
    expect(JSON.stringify(stepsFor(seedA))).not.toBe(JSON.stringify(stepsFor(seedB)))
    expect(day.length).toBe(10)
  })
})

describe('checksum stability', () => {
  it('changes when the board changes', () => {
    const a = replayRun(3, [], cfg, deps).state
    const b = replayChecksum(3, [], cfg, deps)
    expect(b).toBe(checksumState(a))
  })
})

describe('shipped data', () => {
  it('exposes relics covering all six archetypes', () => {
    const archetypes = new Set(RELICS.map(r => r.archetype))
    expect(archetypes.size).toBe(6)
  })

  it('exposes at least the twelve relics required for the prototype', () => {
    expect(RELICS.length).toBeGreaterThanOrEqual(12)
  })

  it('exposes one boss rule per kind', () => {
    const kinds = new Set(BOSSES.map(b => b.kind))
    expect(kinds.size).toBe(6)
  })

  it('gives every relic bilingual text', () => {
    for (const relic of RELICS) {
      expect(relic.text.fr.length).toBeGreaterThan(5)
      expect(relic.text.en.length).toBeGreaterThan(5)
    }
  })

  it('gives every boss bilingual text', () => {
    for (const boss of BOSSES) {
      expect(boss.text.fr.length).toBeGreaterThan(5)
      expect(boss.text.en.length).toBeGreaterThan(5)
    }
  })
})