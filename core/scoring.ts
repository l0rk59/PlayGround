import type { ClearResult, FullLine } from './types'
import { lineShards } from './board'

export const MULT_BASE_BP = 10000
export const CHAIN_STEP_BP = 2000
export const MAX_CHAIN_MULT_BP = 100000
export const MIN_MULT_BP = 5000
export const MULT_BP_CEILING = 2000000

export interface ScoreOutcome {
  shardsGained: number
  multBp: number
  scoreGained: number
  chain: number
  linesCleared: number
  monoLines: number
  cellsCleared: number
}

export function clampMultBp(multBp: number): number {
  if (!Number.isFinite(multBp)) return MULT_BASE_BP
  const rounded = Math.round(multBp)
  if (rounded < MIN_MULT_BP) return MIN_MULT_BP
  if (rounded > MULT_BP_CEILING) return MULT_BP_CEILING
  return rounded
}

export function multToDisplay(multBp: number): number {
  return Math.round((multBp / MULT_BASE_BP) * 100) / 100
}

export function chainMultBp(chain: number, bonusBp: number): number {
  const step = Math.max(0, chain) * CHAIN_STEP_BP
  const raw = MULT_BASE_BP + step + bonusBp
  return clampMultBp(Math.min(raw, MAX_CHAIN_MULT_BP + MULT_BASE_BP))
}

export function scoreFromShards(shards: number, multBp: number): number {
  const safeShards = Number.isFinite(shards) ? Math.max(0, Math.floor(shards)) : 0
  return Math.floor((safeShards * multBp) / MULT_BASE_BP)
}

export function evaluateClear(lines: readonly FullLine[], cellsCleared: number): ClearResult {
  let shards = 0
  let monoLines = 0
  for (const line of lines) {
    shards += lineShards(line)
    if (line.monoColor !== null) monoLines += 1
  }
  return { linesCleared: lines.length, shardsGained: shards, monoLines, cellsCleared }
}

export interface Context {
  chain: number
  bonusBp: number
  emptyCells: number
}

export function scoreClear(clear: ClearResult, ctx: Context): ScoreOutcome {
  const chain = clear.linesCleared > 0 ? ctx.chain + 1 : 0
  const multBp = chainMultBp(chain, ctx.bonusBp)
  const scoreGained = clear.linesCleared > 0 ? scoreFromShards(clear.shardsGained, multBp) : 0
  return {
    shardsGained: clear.linesCleared > 0 ? clear.shardsGained : 0,
    multBp,
    scoreGained,
    chain,
    linesCleared: clear.linesCleared,
    monoLines: clear.monoLines,
    cellsCleared: clear.cellsCleared,
  }
}