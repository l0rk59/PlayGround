import type { Condition, Effect, FullLine, Relic, RunState, Trigger } from './types'
import { clampMultBp, MULT_BASE_BP } from './scoring'
import { countEmpty, freezeCell } from './board'
import type { Rng } from './rng'

export const LIMITS = {
  maxShardPerTrigger: 500,
  maxMultBpPerTrigger: 30000,
  maxShardsPerTurn: 2000,
  maxMultBpPerTurn: 400000,
  maxReplayDepth: 2,
  maxFrozenCells: 24,
} as const

export interface RelicContext {
  trigger: Trigger
  lines: FullLine[]
  linesCleared: number
  monoLines: number
  chain: number
  emptyCells: number
  replayDepth: number
}

export interface RelicOutcome {
  shardDelta: number
  multBpDelta: number
  replay: boolean
  freeze: boolean
  transform: boolean
  heal: boolean
  fired: string[]
}

const ZERO: RelicOutcome = {
  shardDelta: 0,
  multBpDelta: 0,
  replay: false,
  freeze: false,
  transform: false,
  heal: false,
  fired: [],
}

export function conditionMet(condition: Condition, ctx: RelicContext): boolean {
  switch (condition.kind) {
    case 'none':
      return true
    case 'min_lines':
      return ctx.linesCleared >= condition.value
    case 'min_chain':
      return ctx.chain >= condition.value
    case 'line_mono':
      return ctx.monoLines > 0
    case 'line_color':
      return ctx.lines.some(l => l.monoColor === condition.color)
    case 'empty_cells_at_least':
      return ctx.emptyCells >= condition.value
    case 'empty_cells_at_most':
      return ctx.emptyCells <= condition.value
  }
}

export function relicShouldFire(relic: Relic, ctx: RelicContext): boolean {
  if (relic.trigger !== ctx.trigger) return false
  return conditionMet(relic.condition, ctx)
}

export function applyRelics(
  state: RunState,
  relics: readonly Relic[],
  ctx: RelicContext,
  rng: Rng,
): RelicOutcome {
  const outcome: RelicOutcome = { ...ZERO, fired: [] }

  for (const relic of relics) {
    if (!relicShouldFire(relic, ctx)) continue
    const step = applyEffect(state, relic.effect, rng, ctx)
    if (step.shardDelta !== 0) outcome.shardDelta += step.shardDelta
    if (step.multBpDelta !== 0) outcome.multBpDelta += step.multBpDelta
    outcome.replay = outcome.replay || step.replay
    outcome.freeze = outcome.freeze || step.freeze
    outcome.transform = outcome.transform || step.transform
    outcome.heal = outcome.heal || step.heal
    outcome.fired.push(relic.id)
  }

  outcome.shardDelta = clampNonNegative(outcome.shardDelta, LIMITS.maxShardPerTrigger * Math.max(1, relics.length))
  outcome.multBpDelta = clampNonNegative(outcome.multBpDelta, LIMITS.maxMultBpPerTrigger * Math.max(1, relics.length))
  outcome.shardDelta = Math.min(outcome.shardDelta, LIMITS.maxShardsPerTurn)
  outcome.multBpDelta = Math.min(outcome.multBpDelta, LIMITS.maxMultBpPerTurn)

  return outcome
}

function clampNonNegative(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  const v = Math.floor(value)
  if (v <= 0) return 0
  return Math.min(v, max)
}

function applyEffect(
  state: RunState,
  effect: Effect,
  rng: Rng,
  ctx: RelicContext,
): RelicOutcome {
  const out: RelicOutcome = { ...ZERO, fired: [] }

  switch (effect.kind) {
    case 'add_shards':
      out.shardDelta = clampNonNegative(effect.value, LIMITS.maxShardPerTrigger)
      return out

    case 'add_mult':
      out.multBpDelta = clampNonNegative(effect.value, LIMITS.maxMultBpPerTrigger)
      return out

    case 'mul_mult': {
      const factor = clampNonNegative(effect.valueBp, LIMITS.maxMultBpPerTrigger)
      const current = Math.max(MULT_BASE_BP, state.multBp)
      const next = Math.floor((current * Math.max(10000, factor)) / 10000)
      out.multBpDelta = Math.max(0, clampMultBp(next) - current)
      return out
    }

    case 'add_shards_per_empty': {
      const per = clampNonNegative(effect.value, 50)
      out.shardDelta = Math.min(per * Math.max(0, ctx.emptyCells), LIMITS.maxShardsPerTurn)
      return out
    }

    case 'replay_last_clear':
      out.replay = ctx.replayDepth < LIMITS.maxReplayDepth
      return out

    case 'freeze_random_cell': {
      const candidates: number[] = []
      for (let i = 0; i < state.grid.cells.length; i += 1) {
        if (state.grid.cells[i] !== -1 && !state.grid.frozen[i]) candidates.push(i)
      }
      const alreadyFrozen = state.grid.frozen.filter(Boolean).length
      if (candidates.length === 0 || alreadyFrozen >= LIMITS.maxFrozenCells) return out
      const at = candidates[rng.int(candidates.length)] as number
      out.freeze = freezeCell(state.grid, at % state.grid.size, Math.floor(at / state.grid.size))
      return out
    }

    case 'transform_random_piece': {
      const slots = state.pieces.map((p, i) => (p ? i : -1)).filter(i => i >= 0)
      if (slots.length === 0) return out
      out.transform = true
      return out
    }

    case 'heal_free_cells': {
      let healed = 0
      for (let i = 0; i < state.grid.frozen.length; i += 1) {
        if (state.grid.frozen[i]) {
          state.grid.frozen[i] = false
          healed += 1
        }
      }
      out.heal = healed > 0
      return out
    }
  }
}

export function emptyCellsOf(state: RunState): number {
  return countEmpty(state.grid)
}