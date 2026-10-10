import type { BossRule, ColorId, RunState } from './types'
import type { BagOptions } from './pieces'
import type { Rng } from './rng'
import { freezeCell } from './board'
import { LIMITS } from './relics'

export const BOSS_BY_ID: Record<string, BossRule> = {}

export function registerBosses(rules: readonly BossRule[]): void {
  for (const rule of rules) BOSS_BY_ID[rule.id] = rule
}

export function blocksEnabled(state: RunState): boolean {
  return !(state.boss && state.boss.kind === 'narrow_lines')
}

export function isForbidden(state: RunState, color: ColorId): boolean {
  return state.boss?.kind === 'forbidden_color' && state.boss.color === color
}

export function shardScaleBp(state: RunState): number {
  return state.boss?.kind === 'low_shards' ? Math.max(2500, Math.min(10000, state.boss.param)) : 10000
}

export function autoRotate(state: RunState): boolean {
  return state.boss?.kind === 'rotating_pieces'
}

export interface BagConfig {
  size: number
  colorCount: number
  maxCells: number
  weightBias: number
}

export function bagOptions(state: RunState, base: BagConfig): BagOptions {
  const maxCells = state.boss?.kind === 'sparse_bag' ? Math.max(1, Math.min(4, state.boss.param)) : base.maxCells
  const weightBias = state.boss?.kind === 'sparse_bag' ? 12 : base.weightBias
  return { size: base.size, colorCount: base.colorCount, maxCells, weightBias }
}

export function activateBoss(state: RunState, rule: BossRule | null, rng: Rng): void {
  state.boss = rule
  if (!rule) return

  if (rule.kind === 'frozen_cells') {
    const target = Math.max(1, Math.min(rule.param, state.grid.size))
    let frozen = 0
    let guard = 0
    while (frozen < target && guard < 400) {
      guard += 1
      const x = rng.int(state.grid.size)
      const y = rng.int(state.grid.size)
      const at = y * state.grid.size + x
      if (state.grid.cells[at] === -1) continue
      if (freezeCell(state.grid, x, y)) frozen += 1
    }
  }
}

export function tickBoss(state: RunState, rng: Rng): void {
  const rule = state.boss
  if (!rule) return

  if (rule.kind === 'frozen_cells') {
    const target = Math.max(1, Math.min(rule.param, LIMITS.maxFrozenCells))
    let frozen = 0
    for (const f of state.grid.frozen) if (f) frozen += 1
    if (frozen >= target) return
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const at = rng.int(state.grid.cells.length)
      if (state.grid.cells[at] === -1) continue
      if (state.grid.frozen[at]) continue
      freezeCell(state.grid, at % state.grid.size, Math.floor(at / state.grid.size))
      return
    }
  }
}

export function objectiveForRound(round: number, config: RoundObjectives): number {
  const exponent = Math.max(0, round - 1)
  const raw = config.objectiveBase * Math.pow(config.objectiveGrowth, exponent)
  return Math.max(1, Math.round(raw))
}

export interface RoundObjectives {
  objectiveBase: number
  objectiveGrowth: number
  baseMoves: number
  movesPerRound: number
  maxMoves: number
}

export function movesForRound(round: number, config: RoundObjectives): number {
  return Math.min(config.maxMoves, config.baseMoves + config.movesPerRound * Math.max(0, round - 1))
}