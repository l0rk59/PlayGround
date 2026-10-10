import { describe, expect, it } from 'vitest'
import { LIMITS, applyRelics, conditionMet, relicShouldFire, type RelicContext } from '../core/relics'
import { createRun, prototypeConfig, DEFAULT_CONFIG } from '../core/run'
import { makeRng } from '../core/rng'
import { RELIC_POOL } from '../core/load'
import type { FullLine, Relic, RunState } from '../core/types'
import { countEmpty, freezeCell, idx } from '../core/board'

const deps = { bosses: [], relicPool: RELIC_POOL }

function relic(overrides: Partial<Relic>): Relic {
  return {
    id: 'test_relic',
    name: { fr: 'Test', en: 'Test' },
    archetype: 'cascade',
    rarity: 'common',
    trigger: 'on_clear',
    condition: { kind: 'none' },
    effect: { kind: 'add_shards', value: 10 },
    text: { fr: 'test', en: 'test' },
    ...overrides,
  }
}

function ctx(overrides: Partial<RelicContext> = {}): RelicContext {
  return {
    trigger: 'on_clear',
    lines: [],
    linesCleared: 0,
    monoLines: 0,
    chain: 0,
    emptyCells: 64,
    replayDepth: 0,
    ...overrides,
  }
}

const monoLine: FullLine = {
  kind: 'row',
  index: 0,
  cells: Array.from({ length: 8 }, (_, x) => [x, 0] as [number, number]),
  monoColor: 1,
}

function stateWith(relics: Relic[]): RunState {
  const state = createRun(11, prototypeConfig(), deps)
  state.relics = relics
  return state
}

describe('conditions', () => {
  it('always passes for none', () => {
    expect(conditionMet({ kind: 'none' }, ctx())).toBe(true)
  })

  it('gates on line count', () => {
    expect(conditionMet({ kind: 'min_lines', value: 2 }, ctx({ linesCleared: 2 }))).toBe(true)
    expect(conditionMet({ kind: 'min_lines', value: 2 }, ctx({ linesCleared: 1 }))).toBe(false)
  })

  it('gates on chain length', () => {
    expect(conditionMet({ kind: 'min_chain', value: 3 }, ctx({ chain: 3 }))).toBe(true)
    expect(conditionMet({ kind: 'min_chain', value: 3 }, ctx({ chain: 2 }))).toBe(false)
  })

  it('gates on monochrome lines', () => {
    expect(conditionMet({ kind: 'line_mono' }, ctx({ monoLines: 1 }))).toBe(true)
    expect(conditionMet({ kind: 'line_mono' }, ctx({ monoLines: 0 }))).toBe(false)
  })

  it('gates on a specific monochrome colour', () => {
    expect(conditionMet({ kind: 'line_color', color: 1 }, ctx({ lines: [monoLine] }))).toBe(true)
    expect(conditionMet({ kind: 'line_color', color: 3 }, ctx({ lines: [monoLine] }))).toBe(false)
  })

  it('gates on empty cell thresholds in both directions', () => {
    expect(conditionMet({ kind: 'empty_cells_at_least', value: 40 }, ctx({ emptyCells: 40 }))).toBe(true)
    expect(conditionMet({ kind: 'empty_cells_at_most', value: 20 }, ctx({ emptyCells: 20 }))).toBe(true)
    expect(conditionMet({ kind: 'empty_cells_at_most', value: 20 }, ctx({ emptyCells: 21 }))).toBe(false)
  })
})

describe('trigger matching', () => {
  it('fires only when the trigger matches', () => {
    const r = relic({ trigger: 'on_combo' })
    expect(relicShouldFire(r, ctx({ trigger: 'on_combo' }))).toBe(true)
    expect(relicShouldFire(r, ctx({ trigger: 'on_place' }))).toBe(false)
  })

  it('requires the condition as well as the trigger', () => {
    const r = relic({ condition: { kind: 'min_lines', value: 3 } })
    expect(relicShouldFire(r, ctx({ linesCleared: 1 }))).toBe(false)
    expect(relicShouldFire(r, ctx({ linesCleared: 3 }))).toBe(true)
  })
})

describe('bounded effects', () => {
  it('adds shards without exceeding the per-trigger cap', () => {
    const state = stateWith([])
    const out = applyRelics(state, [relic({ effect: { kind: 'add_shards', value: 10 ** 9 } })], ctx(), makeRng(1))
    expect(out.shardDelta).toBe(LIMITS.maxShardPerTrigger)
  })

  it('caps shards per empty cell at the per-trigger ceiling', () => {
    const state = stateWith([])
    const out = applyRelics(state, [relic({ effect: { kind: 'add_shards_per_empty', value: 1000 } })], ctx({ emptyCells: 64 }), makeRng(1))
    expect(out.shardDelta).toBe(LIMITS.maxShardPerTrigger)
  })

  it('multiplies the multiplier without overflowing it', () => {
    const state = stateWith([])
    state.multBp = 10000
    const out = applyRelics(state, [relic({ effect: { kind: 'mul_mult', valueBp: 10 ** 9 } })], ctx(), makeRng(1))
    expect(Number.isFinite(out.multBpDelta)).toBe(true)
    expect(out.multBpDelta).toBeLessThanOrEqual(LIMITS.maxMultBpPerTrigger)
  })

  it('treats a multiplier below x1 as a no-op', () => {
    const state = stateWith([])
    state.multBp = 10000
    const out = applyRelics(state, [relic({ effect: { kind: 'mul_mult', valueBp: 10 } })], ctx(), makeRng(1))
    expect(out.multBpDelta).toBe(0)
  })

  it('never produces a negative shard or multiplier delta', () => {
    const state = stateWith([])
    const out = applyRelics(
      state,
      [
        relic({ effect: { kind: 'add_shards', value: -500 } }),
        relic({ effect: { kind: 'add_mult', value: -900 } }),
      ],
      ctx(),
      makeRng(1),
    )
    expect(out.shardDelta).toBe(0)
    expect(out.multBpDelta).toBe(0)
  })

  it('reports every relic that fired', () => {
    const state = stateWith([])
    const out = applyRelics(
      state,
      [relic({ id: 'a' }), relic({ id: 'b', condition: { kind: 'min_lines', value: 9 } }), relic({ id: 'c' })],
      ctx(),
      makeRng(1),
    )
    expect(out.fired).toEqual(['a', 'c'])
  })
})

describe('board-mutating effects', () => {
  it('freezes a filled cell and refuses when none is available', () => {
    const state = stateWith([])
    const out = applyRelics(state, [relic({ effect: { kind: 'freeze_random_cell' } })], ctx(), makeRng(3))
    expect(out.freeze).toBe(false)

    state.grid.cells[idx(state.grid, 2, 2)] = 1
    const hit = applyRelics(state, [relic({ effect: { kind: 'freeze_random_cell' } })], ctx(), makeRng(3))
    expect(hit.freeze).toBe(true)
    expect(state.grid.frozen[idx(state.grid, 2, 2)]).toBe(true)
  })

  it('refuses to freeze past the frozen cell cap', () => {
    const state = stateWith([])
    for (let i = 0; i < LIMITS.maxFrozenCells; i += 1) {
      state.grid.cells[i] = 1
      freezeCell(state.grid, i % 8, Math.floor(i / 8))
    }
    for (let i = LIMITS.maxFrozenCells; i < state.grid.cells.length; i += 1) state.grid.cells[i] = 1
    const out = applyRelics(state, [relic({ effect: { kind: 'freeze_random_cell' } })], ctx(), makeRng(3))
    expect(out.freeze).toBe(false)
  })

  it('heals frozen cells when asked', () => {
    const state = stateWith([])
    state.grid.cells[idx(state.grid, 0, 0)] = 1
    freezeCell(state.grid, 0, 0)
    const out = applyRelics(state, [relic({ effect: { kind: 'heal_free_cells' } })], ctx(), makeRng(3))
    expect(out.heal).toBe(true)
    expect(state.grid.frozen.some(Boolean)).toBe(false)
  })

  it('caps replay depth so chains cannot run forever', () => {
    const state = stateWith([])
    const r = relic({ effect: { kind: 'replay_last_clear' } })
    expect(applyRelics(state, [r], ctx({ replayDepth: 0 }), makeRng(1)).replay).toBe(true)
    expect(applyRelics(state, [r], ctx({ replayDepth: LIMITS.maxReplayDepth }), makeRng(1)).replay).toBe(false)
  })
})

describe('shipped relic pool', () => {
  it('never yields an infinite or negative result under the worst context', () => {
    const state = stateWith([])
    state.multBp = 10000
    const worst = ctx({ lines: [monoLine], linesCleared: 9, monoLines: 9, chain: 99, emptyCells: 64 })
    const out = applyRelics(state, RELIC_POOL, worst, makeRng(77))
    expect(Number.isFinite(out.shardDelta)).toBe(true)
    expect(Number.isFinite(out.multBpDelta)).toBe(true)
    expect(out.shardDelta).toBeGreaterThanOrEqual(0)
    expect(out.multBpDelta).toBeGreaterThanOrEqual(0)
  })

  it('is deterministic for a fixed seed', () => {
    const a = stateWith([])
    const b = stateWith([])
    const c = ctx({ linesCleared: 3, chain: 3 })
    expect(applyRelics(a, RELIC_POOL, c, makeRng(9))).toEqual(applyRelics(b, RELIC_POOL, c, makeRng(9)))
  })

  it('leaves the board empty-cell count untouched for pure scoring relics', () => {
    const state = stateWith([])
    const before = countEmpty(state.grid)
    applyRelics(state, RELIC_POOL, ctx({ linesCleared: 4 }), makeRng(5))
    expect(countEmpty(state.grid)).toBe(before)
  })
})

describe('run config defaults', () => {
  it('keeps the default prototype inside the documented move budget', () => {
    expect(prototypeConfig().totalRounds).toBe(3)
    expect(prototypeConfig().baseMoves).toBeGreaterThanOrEqual(14)
    expect(DEFAULT_CONFIG.totalRounds).toBe(6)
    expect(DEFAULT_CONFIG.bossRounds).toContain(3)
    expect(DEFAULT_CONFIG.bossRounds).toContain(6)
  })
})