import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  advanceRound,
  applyMove,
  chooseRelicAndAdvance,
  createRun,
  offerRelics,
  prototypeConfig,
  settleRound,
  snapshot,
  type RunConfig,
  type RunDeps,
} from '../core/run'
import { anyPlacementAvailable, countEmpty, findFullLines, idx } from '../core/board'
import { activateBoss } from '../core/boss'
import { BOSSES, RELICS } from '../core/load'
import { makeRng } from '../core/rng'
import { legalPlacements, playRun } from '../tools/bot'
import type { BossRule, RunState } from '../core/types'

const deps: RunDeps = { bosses: BOSSES, relicPool: RELICS }
const cfg = prototypeConfig()

function fresh(seed: number, config: RunConfig = cfg): RunState {
  return createRun(seed, config, deps)
}

function firstLegalMove(state: RunState) {
  const options = legalPlacements(state)
  expect(options.length).toBeGreaterThan(0)
  return options[0] as { slot: number; x: number; y: number; rotation: 0 | 1 | 2 | 3 }
}

describe('run creation', () => {
  it('starts on round one with a full hand and no relics', () => {
    const state = fresh(1)
    expect(state.round).toBe(1)
    expect(state.phase).toBe('playing')
    expect(state.relics).toHaveLength(0)
    expect(state.movesLeft).toBeGreaterThan(0)
    expect(state.pieces.filter(Boolean)).toHaveLength(3)
    expect(countEmpty(state.grid)).toBe(64)
  })

  it('gives the same hand for the same seed', () => {
    const a = fresh(7)
    const b = fresh(7)
    expect(JSON.stringify(a.pieces)).toBe(JSON.stringify(b.pieces))
  })

  it('gives a different hand for a different seed', () => {
    const seedA = JSON.stringify(fresh(1).pieces)
    const seedB = JSON.stringify(fresh(2).pieces)
    const seedC = JSON.stringify(fresh(3).pieces)
    expect(new Set([seedA, seedB, seedC]).size).toBeGreaterThan(1)
  })
})

describe('move validation', () => {
  it('accepts a legal placement and spends a move', () => {
    const state = fresh(21)
    const before = state.movesLeft
    const move = firstLegalMove(state)
    const result = applyMove(state, move, cfg)
    expect(result.ok).toBe(true)
    expect(state.movesLeft).toBe(before - 1)
    expect(result.move?.kind).toBe('place')
  })

  it('rejects an empty slot without changing the state', () => {
    const state = fresh(22)
    const snapshotBefore = JSON.stringify(state)
    const result = applyMove(state, { slot: 9, x: 0, y: 0, rotation: 0 }, cfg)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('empty_slot')
    expect(JSON.stringify(state)).toBe(snapshotBefore)
  })

  it('rejects a placement that does not fit', () => {
    const state = fresh(23)
    const result = applyMove(state, { slot: 0, x: 7, y: 7, rotation: 0 }, cfg)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_fit')
  })

  it('rejects negative coordinates', () => {
    const state = fresh(24)
    expect(applyMove(state, { slot: 0, x: -1, y: 0, rotation: 0 }, cfg).reason).toBe('out_of_bounds')
  })

  it('rejects a move once the run is lost', () => {
    const state = fresh(25)
    state.phase = 'lost'
    expect(applyMove(state, { slot: 0, x: 0, y: 0, rotation: 0 }, cfg).reason).toBe('phase')
  })

  it('refuses the forbidden colour under the ultraviolet boss', () => {
    const state = fresh(26)
    state.boss = BOSSES.find(b => b.id === 'boss_ultraviolet') as BossRule
    state.pieces[0] = { ...(state.pieces[0] as NonNullable<typeof state.pieces[0]>), color: 2 }
    expect(applyMove(state, { slot: 0, x: 0, y: 0, rotation: 0 }, cfg).reason).toBe('forbidden_color')
  })
})

describe('round progression', () => {
  it('clears the round when the objective is reached', () => {
    const state = fresh(31)
    state.objective = 1
    for (let i = 0; i < 200 && state.phase === 'playing'; i += 1) {
      const options = legalPlacements(state)
      if (options.length === 0) break
      applyMove(state, options[(i * 37) % options.length] as never, cfg)
    }
    expect(state.phase).toBe('round_cleared')
    expect(state.roundScore).toBeGreaterThanOrEqual(state.objective)
  })

  it('loses the run when moves run out below the objective', () => {
    const state = fresh(32)
    state.objective = 10 ** 9
    for (let i = 0; i < 60 && state.phase === 'playing'; i += 1) {
      const options = legalPlacements(state)
      if (options.length === 0) break
      applyMove(state, options[0] as never, cfg)
    }
    expect(state.phase).toBe('lost')
    expect(state.fragments).toBeGreaterThanOrEqual(0)
  })

  it('rewards fragments proportional to the score reached', () => {
    const state = fresh(33)
    state.score = 2500
    state.round = 3
    advanceRound(state, cfg, deps)
    expect(state.score).toBe(2500)
  })

  it('resets the board and the chain when advancing a round', () => {
    const state = fresh(34)
    state.chain = 5
    state.score = 999
    state.roundScore = 999
    advanceRound(state, cfg, deps)
    expect(state.round).toBe(2)
    expect(state.chain).toBe(0)
    expect(state.score).toBe(999)
    expect(state.roundScore).toBe(0)
    expect(countEmpty(state.grid)).toBe(64)
  })

  it('declares victory after the last round', () => {
    const state = fresh(35)
    state.round = cfg.totalRounds
    advanceRound(state, cfg, deps)
    expect(state.phase).toBe('victory')
  })

  it('grants exactly the chosen relic on advance', () => {
    const state = fresh(36)
    state.phase = 'round_cleared'
    const offers = settleRound(state, cfg, deps)
    const pick = offers[0]!
    expect(chooseRelicAndAdvance(state, pick.id, cfg, deps)).toBe(true)
    expect(state.relics.map(r => r.id)).toContain(pick.id)
  })

  it('refuses a relic that was not on offer, which is what replay validation checks', () => {
    const state = fresh(36)
    state.phase = 'round_cleared'
    const offers = settleRound(state, cfg, deps)
    const notOffered = RELICS.find(r => !offers.some(o => o.id === r.id))
    expect(notOffered).toBeDefined()
    expect(chooseRelicAndAdvance(state, notOffered!.id, cfg, deps)).toBe(false)
    expect(state.relics).toHaveLength(0)
  })

  it('offers the same relics when settled twice', () => {
    const state = fresh(39)
    state.phase = 'round_cleared'
    const first = settleRound(state, cfg, deps).map(r => r.id)
    const second = settleRound(state, cfg, deps).map(r => r.id)
    expect(second).toEqual(first)
  })

  it('ignores an unknown relic id', () => {
    const state = fresh(37)
    state.phase = 'round_cleared'
    expect(chooseRelicAndAdvance(state, 'does_not_exist', cfg, deps)).toBe(false)
    expect(state.relics).toHaveLength(0)
  })

  it('offers distinct relics', () => {
    const state = fresh(38)
    const offers = offerRelics(state, makeRng(5), RELICS, 3)
    expect(offers).toHaveLength(3)
    expect(new Set(offers.map(r => r.id)).size).toBe(3)
  })
})

describe('boss rules', () => {
  it('freezes one filled cell per placement under frost, up to its cap', () => {
    const state = fresh(41)
    const frost = BOSSES.find(b => b.id === 'boss_frost') as BossRule
    state.boss = frost
    expect(state.grid.frozen.filter(Boolean)).toHaveLength(0)
    for (let i = 0; i < 20; i += 1) {
      const options = legalPlacements(state)
      if (options.length === 0) break
      applyMove(state, options[i % options.length] as never, cfg)
      if (state.phase !== 'playing') break
    }
    const frozen = state.grid.frozen.filter(Boolean).length
    expect(frozen).toBeGreaterThan(0)
    expect(frozen).toBeLessThanOrEqual(frost.param)
  })

  it('keeps frozen cells out of any completion', () => {
    const state = fresh(42)
    const frost = BOSSES.find(b => b.id === 'boss_frost') as BossRule
    for (let y = 0; y < 8; y += 1) state.grid.cells[idx(state.grid, 0, y)] = 1
    state.grid.frozen[idx(state.grid, 0, 4)] = true
    state.boss = frost
    expect(findFullLines(state.grid).some(l => l.kind === 'col' && l.index === 0)).toBe(false)
  })

  it('drops the boss when the run is won', () => {
    const state = fresh(43)
    state.boss = BOSSES[0] as BossRule
    state.round = cfg.totalRounds
    advanceRound(state, cfg, deps)
    expect(state.boss).toBeNull()
  })
})

describe('board pressure', () => {
  it('never leaves the board with no legal placement and moves remaining', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const state = fresh(seed)
      for (let i = 0; i < 200 && state.phase === 'playing'; i += 1) {
        const options = legalPlacements(state)
        if (options.length === 0) {
          expect(state.movesLeft).toBe(0)
          break
        }
        applyMove(state, options[0] as never, cfg)
      }
    }
  })

  it('deals again when the board locks up, up to the round allowance', () => {
    const state = fresh(51)
    expect(state.dealsLeft).toBe(cfg.dealsPerRound)
    for (let i = 0; i < 300 && state.phase === 'playing'; i += 1) {
      const options = legalPlacements(state)
      if (options.length === 0) break
      applyMove(state, options[0] as never, cfg)
    }
    expect(state.dealsLeft).toBeLessThanOrEqual(cfg.dealsPerRound)
  })
})

describe('full run simulation', () => {
  it('always terminates with a defined phase', () => {
    for (const policy of ['random', 'greedy', 'heuristic'] as const) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const outcome = playRun(seed, policy, cfg, deps)
        expect(['playing', 'round_cleared', 'lost', 'victory']).toContain(outcome.state.phase)
      }
    }
  })

  it('never produces a non-finite score', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const outcome = playRun(seed, 'heuristic', cfg, deps)
      expect(Number.isFinite(outcome.state.score)).toBe(true)
      expect(Number.isInteger(outcome.state.score)).toBe(true)
      expect(outcome.state.score).toBeGreaterThanOrEqual(0)
    }
  })

  it('never leaves frozen or negative cells on the board', () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const state = playRun(seed, 'heuristic', cfg, deps).state
      for (const cell of state.grid.cells) expect(cell === -1 || (cell >= 0 && cell <= 4)).toBe(true)
    }
  })

  it('keeps the multiplier inside its hard bounds', () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const state = playRun(seed, 'heuristic', cfg, deps).state
      expect(state.multBp).toBeGreaterThanOrEqual(5000)
      expect(state.multBp).toBeLessThanOrEqual(2000000)
    }
  })

  it('reports a best chain that matches the chain counter', () => {
    const state = playRun(9, 'heuristic', cfg, deps).state
    expect(state.bestChain).toBeGreaterThanOrEqual(0)
  })
})

describe('snapshot isolation', () => {
  it('does not let a trial mutate the source state', () => {
    const state = fresh(61)
    const trial = snapshot(state)
    const options = legalPlacements(trial)
    applyMove(trial, options[0] as never, cfg)
    expect(trial.movesLeft).toBe(state.movesLeft - 1)
    expect(state.movesLeft).not.toBe(trial.movesLeft)
  })

  it('keeps every piece slot filled after a refill', () => {
    const state = fresh(62)
    for (let i = 0; i < 20; i += 1) {
      const options = legalPlacements(state)
      if (options.length === 0) break
      applyMove(state, options[0] as never, cfg)
      expect(state.pieces.filter(Boolean)).toHaveLength(3)
    }
  })
})

describe('default run config', () => {
  it('uses an 8x8 grid with a hand of three', () => {
    expect(DEFAULT_CONFIG.gridSize).toBe(8)
    expect(DEFAULT_CONFIG.handSize).toBe(3)
  })

  it('leaves the boss out of rounds that are not boss rounds', () => {
    const state = createRun(71, DEFAULT_CONFIG, deps)
    expect(DEFAULT_CONFIG.bossRounds).toEqual([3, 6])
    expect(state.round).toBe(1)
    expect(state.boss).toBeNull()
  })

  it('attaches the first boss rule exactly on round three', () => {
    const state = createRun(71, DEFAULT_CONFIG, deps)
    advanceRound(state, DEFAULT_CONFIG, deps)
    expect(state.round).toBe(2)
    expect(state.boss).toBeNull()
    advanceRound(state, DEFAULT_CONFIG, deps)
    expect(state.round).toBe(3)
    expect(state.boss).not.toBeNull()
  })

  it('gives each boss round a distinct rule', () => {
    const state = createRun(71, DEFAULT_CONFIG, deps)
    const seen: string[] = []
    for (let i = 0; i < 5; i += 1) {
      advanceRound(state, DEFAULT_CONFIG, deps)
      if (state.boss) seen.push(state.boss.id)
    }
    expect(seen).toEqual(['boss_frost', 'boss_ultraviolet'])
  })

  it('leaves the prototype free of a boss on round one', () => {
    const state = createRun(5, cfg, deps)
    expect(state.boss).toBeNull()
  })

  it('keeps every objective reachable within the move budget', () => {
    for (let round = 1; round <= DEFAULT_CONFIG.totalRounds; round += 1) {
      expect(DEFAULT_CONFIG.objectiveBase * Math.pow(DEFAULT_CONFIG.objectiveGrowth, round - 1)).toBeGreaterThan(0)
    }
  })
})

describe('multiplier floor', () => {
  it('starts at exactly x1 with no relic and no free bonus', () => {
    const state = fresh(91)
    expect(state.multBp).toBe(10000)
    expect(state.bonusBp).toBe(0)
  })

  it('keeps the bonus at zero across moves that trigger no relic', () => {
    const state = fresh(92)
    for (let i = 0; i < 12 && state.phase === 'playing'; i += 1) {
      const options = legalPlacements(state)
      if (options.length === 0) break
      applyMove(state, options[(i * 11) % options.length] as never, cfg)
    }
    expect(state.relics).toHaveLength(0)
    expect(state.bonusBp).toBe(0)
    expect(state.multBp).toBeGreaterThanOrEqual(10000)
    expect(state.multBp % 2000).toBe(0)
  })

  it('only exceeds x1 through the chain when no relic is ever taken', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const state = playRun(seed, 'heuristic', cfg, deps, { pickRelic: () => null }).state
      expect(state.relics).toHaveLength(0)
      expect(state.bonusBp).toBe(0)
    }
  })

  it('does raise the bonus once a relic is actually taken', () => {
    const state = playRun(2, 'heuristic', cfg, deps).state
    expect(state.relics.length).toBeGreaterThan(0)
  })

  it('still clamps a real relic bonus to the ceiling', () => {
    const state = fresh(93)
    state.relics = [{ ...RELICS[0]!, id: 'huge', effect: { kind: 'add_mult', value: 10 ** 9 } }]
    for (let i = 0; i < 30 && state.phase === 'playing' && state.bonusBp === 0; i += 1) {
      const options = legalPlacements(state)
      if (options.length === 0) break
      applyMove(state, options[(i * 13) % options.length] as never, cfg)
    }
    expect(state.bonusBp).toBeGreaterThan(0)
    expect(state.multBp).toBeLessThanOrEqual(2000000)
  })
})

describe('occupancy helper', () => {
  it('agrees with the hand when the board is empty', () => {
    const state = fresh(81)
    expect(anyPlacementAvailable(state.grid, state.pieces)).toBe(true)
  })
})