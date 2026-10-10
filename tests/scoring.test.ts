import { describe, expect, it } from 'vitest'
import {
  CHAIN_STEP_BP,
  MULT_BASE_BP,
  chainMultBp,
  clampMultBp,
  evaluateClear,
  multToDisplay,
  scoreClear,
  scoreFromShards,
} from '../core/scoring'
import { createGrid, idx } from '../core/board'
import type { ColorId, FullLine } from '../core/types'

function rowLine(cells: number, monoColor: number | null): FullLine {
  const out: [number, number][] = []
  for (let i = 0; i < cells; i += 1) out.push([i, 0])
  return { kind: 'row', index: 0, cells: out, monoColor: monoColor as FullLine['monoColor'] }
}

describe('shard valuation', () => {
  it('values a plain 8-cell row at 16 shards', () => {
    expect(evaluateClear([rowLine(8, null)], 8).shardsGained).toBe(16)
  })

  it('grants a 50 percent mono bonus on a monochrome row', () => {
    expect(evaluateClear([rowLine(8, 2)], 8).shardsGained).toBe(24)
  })

  it('values a 9-cell block at 18 shards', () => {
    expect(evaluateClear([{ kind: 'block', index: 0, cells: new Array(9).fill([0, 0]), monoColor: null } as unknown as FullLine], 9).shardsGained).toBe(18)
  })

  it('sums independent lines and counts mono lines', () => {
    const result = evaluateClear([rowLine(8, 1), rowLine(8, 2)], 16)
    expect(result.linesCleared).toBe(2)
    expect(result.monoLines).toBe(2)
    expect(result.shardsGained).toBe(48)
  })

  it('reports zero shards for an empty clear', () => {
    expect(evaluateClear([], 0).shardsGained).toBe(0)
  })
})

describe('multiplier', () => {
  it('starts at x1', () => {
    expect(chainMultBp(0, 0)).toBe(MULT_BASE_BP)
    expect(multToDisplay(MULT_BASE_BP)).toBe(1)
  })

  it('grows by one chain step per consecutive clear', () => {
    expect(chainMultBp(1, 0)).toBe(MULT_BASE_BP + CHAIN_STEP_BP)
    expect(chainMultBp(3, 0)).toBe(MULT_BASE_BP + 3 * CHAIN_STEP_BP)
  })

  it('adds a relic bonus on top of the chain step', () => {
    expect(chainMultBp(2, 5000)).toBe(MULT_BASE_BP + 2 * CHAIN_STEP_BP + 5000)
  })

  it('clamps below the floor and above the ceiling', () => {
    expect(clampMultBp(-100)).toBe(5000)
    expect(clampMultBp(10 ** 12)).toBe(2000000)
  })

  it('falls back to x1 for a non-finite multiplier', () => {
    expect(clampMultBp(Number.NaN)).toBe(MULT_BASE_BP)
    expect(clampMultBp(Number.POSITIVE_INFINITY)).toBe(MULT_BASE_BP)
  })

  it('never returns a negative multiplier for a negative chain', () => {
    expect(chainMultBp(-5, 0)).toBe(MULT_BASE_BP)
  })
})

describe('score conversion', () => {
  it('floors to an integer so scores stay comparable across replays', () => {
    expect(scoreFromShards(100, 12345)).toBe(Math.floor((100 * 12345) / 10000))
    expect(Number.isInteger(scoreFromShards(33, 17777))).toBe(true)
  })

  it('returns zero for negative or non-finite shards', () => {
    expect(scoreFromShards(-50, MULT_BASE_BP)).toBe(0)
    expect(scoreFromShards(Number.NaN, MULT_BASE_BP)).toBe(0)
  })

  it('is monotonic in shards and in multiplier', () => {
    expect(scoreFromShards(200, 10000)).toBeGreaterThan(scoreFromShards(100, 10000))
    expect(scoreFromShards(100, 20000)).toBeGreaterThan(scoreFromShards(100, 10000))
  })
})

describe('score of a clear', () => {
  it('applies the chain step to the clear that builds the chain', () => {
    const out = scoreClear(
      { linesCleared: 1, shardsGained: 16, monoLines: 0, cellsCleared: 8 },
      { chain: 0, bonusBp: 0, emptyCells: 56 },
    )
    expect(out.chain).toBe(1)
    expect(out.multBp).toBe(MULT_BASE_BP + CHAIN_STEP_BP)
    expect(out.scoreGained).toBe(Math.floor((16 * (MULT_BASE_BP + CHAIN_STEP_BP)) / MULT_BASE_BP))
  })

  it('resets the chain on a move that clears nothing but keeps relic bonus', () => {
    const out = scoreClear(
      { linesCleared: 0, shardsGained: 0, monoLines: 0, cellsCleared: 0 },
      { chain: 4, bonusBp: 8000, emptyCells: 40 },
    )
    expect(out.chain).toBe(0)
    expect(out.scoreGained).toBe(0)
    expect(out.multBp).toBe(MULT_BASE_BP + 8000)
  })

  it('increments the chain on consecutive clears', () => {
    const out = scoreClear(
      { linesCleared: 2, shardsGained: 48, monoLines: 1, cellsCleared: 15 },
      { chain: 2, bonusBp: 0, emptyCells: 49 },
    )
    expect(out.chain).toBe(3)
    expect(out.multBp).toBe(MULT_BASE_BP + 3 * CHAIN_STEP_BP)
    expect(out.scoreGained).toBe(76)
  })
})

describe('scoring invariants on real boards', () => {
  it('produces finite integers for every clearable configuration of a small board', () => {
    const grid = createGrid(8)
    for (let x = 0; x < 8; x += 1) grid.cells[idx(grid, x, 7)] = (x % 5) as ColorId
    for (let y = 0; y < 8; y += 1) grid.cells[idx(grid, 7, y)] = (y % 5) as ColorId
    const result = evaluateClear(
      [
        { kind: 'row', index: 7, cells: Array.from({ length: 8 }, (_, x) => [x, 7] as [number, number]), monoColor: null },
        { kind: 'col', index: 7, cells: Array.from({ length: 8 }, (_, y) => [7, y] as [number, number]), monoColor: null },
      ],
      15,
    )
    expect(Number.isInteger(result.shardsGained)).toBe(true)
    expect(Number.isFinite(scoreFromShards(result.shardsGained, 30000))).toBe(true)
  })
})