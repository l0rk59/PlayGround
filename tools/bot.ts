import type { Relic, Rotation, RunState } from '../core/types'
import { EMPTY } from '../core/types'
import { anyPlacementAvailable, canPlace, countEmpty } from '../core/board'
import { applyMove, chooseRelicAndAdvance, createRun, settleRound, snapshot, type MoveInput, type RunConfig, type RunDeps } from '../core/run'
import { makeRng } from '../core/rng'
import type { ReplayStep } from '../core/replay'

export interface Placement {
  slot: number
  x: number
  y: number
  rotation: Rotation
}

export function legalPlacements(state: RunState): Placement[] {
  const out: Placement[] = []
  for (let slot = 0; slot < state.pieces.length; slot += 1) {
    const piece = state.pieces[slot]
    if (!piece) continue
    for (const rotation of [0, 1, 2, 3] as Rotation[]) {
      const probe = { ...piece, rotation }
      const b = probe.cells.reduce(
        (acc, [cx, cy]) => ({ w: Math.max(acc.w, cx + 1), h: Math.max(acc.h, cy + 1) }),
        { w: 0, h: 0 },
      )
      for (let y = 0; y + b.h <= state.grid.size; y += 1) {
        for (let x = 0; x + b.w <= state.grid.size; x += 1) {
          if (canPlace(state.grid, probe, x, y)) out.push({ slot, x, y, rotation })
        }
      }
    }
  }
  return out
}

export type PolicyName = 'random' | 'greedy' | 'heuristic'

export function countHoles(grid: RunState['grid']): number {
  let holes = 0
  for (let y = 0; y < grid.size; y += 1) {
    let rightmost = -1
    for (let x = grid.size - 1; x >= 0; x -= 1) {
      if (grid.cells[y * grid.size + x] !== EMPTY) {
        rightmost = x
        break
      }
    }
    if (rightmost <= 0) continue
    for (let x = 0; x < rightmost; x += 1) {
      if (grid.cells[y * grid.size + x] === EMPTY) holes += 1
    }
  }
  return holes
}

function heuristicValue(before: RunState, after: RunState, gained: number): number {
  const clearedBefore = countEmpty(before.grid)
  const clearedAfter = countEmpty(after.grid)
  const freed = clearedAfter - clearedBefore
  const filled = stateGridFill(after)
  const holes = countHoles(after.grid)
  const crowding = filled / after.grid.cells.length
  return gained + freed * 9 - filled * 2.5 - holes * 14 + crowding * 45
}

function stateGridFill(state: RunState): number {
  let filled = 0
  for (const c of state.grid.cells) if (c !== EMPTY) filled += 1
  return filled
}

export function choosePlacement(
  state: RunState,
  policy: PolicyName,
  rngSeed: number,
  config: RunConfig,
  deps: RunDeps,
): Placement | null {
  const options = legalPlacements(state)
  if (options.length === 0) return null

  if (policy === 'random') {
    const rng = makeRng((rngSeed ^ state.moveIndex * 2654435761) >>> 0)
    return options[rng.int(options.length)] as Placement
  }

  let best: Placement | null = null
  let bestValue = -Infinity
  for (const option of options) {
    const trial = snapshot(state)
    const input: MoveInput = { slot: option.slot, x: option.x, y: option.y, rotation: option.rotation }
    const result = applyMove(trial, input, config)
    if (!result.ok) continue
    const gained = result.state.roundScore - state.roundScore
    const value = policy === 'greedy' ? gained : heuristicValue(state, result.state, gained)
    if (value > bestValue) {
      bestValue = value
      best = option
      if (policy === 'greedy' && gained > 0) break
    }
  }
  void deps
  return best
}

export interface PlayOptions {
  maxSteps?: number
  pickRelic?: (offers: readonly Relic[], round: number) => Relic | null
}

export interface RunOutcome {
  steps: ReplayStep[]
  state: RunState
  roundsCleared: number
  lost: boolean
  won: boolean
  movesPlayed: number
  linesCleared: number
  cellsCleared: number
}

export function playRun(
  seed: number,
  policy: PolicyName,
  config: RunConfig,
  deps: RunDeps,
  options: PlayOptions = {},
): RunOutcome {
  const maxSteps = options.maxSteps ?? 5000
  const pickRelic = options.pickRelic
  const { createRun: start, chooseRelicAndAdvance: advance, settleRound: settle } = {
    createRun,
    chooseRelicAndAdvance,
    settleRound,
  }
  let state = start(seed, config, deps)
  const steps: ReplayStep[] = []
  let roundsCleared = 0
  let movesPlayed = 0
  let linesCleared = 0
  let cellsCleared = 0

  for (let i = 0; i < maxSteps; i += 1) {
    if (state.phase === 'round_cleared') {
      roundsCleared += 1
      if (state.round >= state.totalRounds) break
      const offers = settle(state, config, deps)
      const chosen = pickRelic ? pickRelic(offers, state.round) : offers[(seed + state.round) % Math.max(1, offers.length)]
      steps.push({ kind: 'relic', id: chosen ? chosen.id : null })
      advance(state, chosen ? chosen.id : null, config, deps)
      continue
    }
    if (state.phase !== 'playing') break

    const placement = choosePlacement(state, policy, seed + i, config, deps)
    if (!placement) break
    steps.push({ kind: 'place', slot: placement.slot, x: placement.x, y: placement.y, rotation: placement.rotation })
    const result = applyMove(state, placement, config)
    if (!result.ok) break
    movesPlayed += 1
    linesCleared += result.move?.linesCleared ?? 0
    if (anyPlacementAvailable(state.grid, state.pieces)) continue
  }

  return {
    steps,
    state,
    roundsCleared,
    lost: state.phase === 'lost',
    won: state.phase === 'victory',
    movesPlayed,
    linesCleared,
    cellsCleared,
  }
}

export function boardPressure(state: RunState): number {
  let filled = 0
  for (let i = 0; i < state.grid.cells.length; i += 1) if (state.grid.cells[i] !== EMPTY) filled += 1
  return Math.floor((filled * 10000) / state.grid.cells.length)
}

export function holes(state: RunState): number {
  let n = 0
  for (let i = 0; i < state.grid.cells.length; i += 1) if (state.grid.cells[i] === EMPTY) n += 1
  return n
}