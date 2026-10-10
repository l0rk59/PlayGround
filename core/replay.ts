import type { Rotation, RunState } from './types'
import { makeRng } from './rng'
import { applyMove, chooseRelicAndAdvance, createRun, settleRound, type RunConfig, type RunDeps, type RunDeps as Deps } from './run'

export type ReplayStep =
  | { kind: 'place'; slot: number; x: number; y: number; rotation: Rotation }
  | { kind: 'relic'; id: string | null }

export interface ReplayResult {
  ok: boolean
  error: string | null
  step: number
  state: RunState
}

export function replayRun(seed: number, steps: readonly ReplayStep[], config: RunConfig, deps: Deps): ReplayResult {
  const state = createRun(seed, config, deps)

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i] as ReplayStep
    if (step.kind === 'relic') {
      if (!chooseRelicAndAdvance(state, step.id, config, deps)) {
        return { ok: false, error: `relic not offered at step ${i}`, step: i, state }
      }
      continue
    }
    if (state.phase !== 'playing') return { ok: false, error: `illegal state ${state.phase}`, step: i, state }
    const result = applyMove(state, { slot: step.slot, x: step.x, y: step.y, rotation: step.rotation }, config)
    if (!result.ok) return { ok: false, error: result.reason, step: i, state }
    if (result.state.phase === 'round_cleared') {
      settleRound(result.state, config, deps)
      continue
    }
  }

  return { ok: true, error: null, step: -1, state }
}

export function checksumState(state: RunState): string {
  const cells = state.grid.cells.join('')
  const frozen = state.grid.frozen.map(f => (f ? '1' : '0')).join('')
  const hand = state.pieces.map(p => (p ? `${p.defId}:${p.color}:${p.rotation}` : '-')).join(',')
  return [state.round, state.movesLeft, state.score, state.shards, state.multBp, state.chain, cells, frozen, hand].join('|')
}

export function replayChecksum(seed: number, steps: readonly ReplayStep[], config: RunConfig, deps: RunDeps): string {
  const result = replayRun(seed, steps, config, deps)
  if (!result.ok) throw new Error(`Replay failed at step ${result.step}: ${result.error}`)
  return checksumState(result.state)
}

export function rngOf(state: RunState) {
  return makeRng(state.rngState)
}