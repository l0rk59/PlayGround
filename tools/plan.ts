import { writeFileSync } from 'node:fs'
import { hashSeed } from '../core/rng'
import { BOSSES, RELICS } from '../core/load'
import {
  applyMove,
  chooseRelicAndAdvance,
  createRun,
  prototypeConfig,
  settleRound,
  type RunDeps,
} from '../core/run'
import { legalPlacements } from './bot'
import type { RunState } from '../core/types'

const deps: RunDeps = { bosses: BOSSES, relicPool: RELICS }
const config = prototypeConfig()
const seed = hashSeed('prototype')

export interface PlannedMove {
  slot: number
  x: number
  y: number
  rotation: 0 | 1 | 2 | 3
}

export interface PlannedRound {
  round: number
  objective: number
  moves: PlannedMove[]
  relicChoice: string | null
  relicOfferIds: string[]
}

export interface RunPlan {
  seed: number
  rounds: PlannedRound[]
  finalPhase: string
  finalScore: number
}

function cloneState(state: RunState): RunState {
  return {
    ...state,
    grid: { size: state.grid.size, cells: state.grid.cells.slice(), frozen: state.grid.frozen.slice() },
    pieces: state.pieces.map(p => (p ? { ...p, cells: p.cells.map(c => [c[0], c[1]] as [number, number]) } : null)),
    relics: state.relics.slice(),
    pendingRelics: state.pendingRelics.slice(),
  }
}

function bestPlacement(state: RunState): PlannedMove | null {
  const options = legalPlacements(state)
  if (options.length === 0) return null
  let best = options[0] as PlannedMove
  let bestValue = -Infinity
  for (const option of options) {
    const trial = cloneState(state)
    const before = state.roundScore
    const result = applyMove(trial, option, config)
    if (!result.ok) continue
    let cleared = 0
    for (let at = 0; at < trial.grid.cells.length; at += 1) {
      if (trial.grid.cells[at] === -1 && state.grid.cells[at] !== -1) cleared += 1
    }
    const value = trial.roundScore - before + cleared * 10
    if (value > bestValue) {
      bestValue = value
      best = option
    }
  }
  return best
}

export function planFullRun(maxRounds = 3): RunPlan {
  const state = createRun(seed, config, deps)
  const rounds: PlannedRound[] = []

  for (let guard = 0; guard < 400 && state.phase !== 'lost' && state.phase !== 'victory'; guard += 1) {
    const round = state.round
    const objective = state.objective
    const moves: PlannedMove[] = []

    while (state.phase === 'playing' && moves.length < 40) {
      const move = bestPlacement(state)
      if (!move) break
      const result = applyMove(state, move, config)
      if (!result.ok) break
      moves.push(move)
    }

    if (state.phase !== 'round_cleared') {
      rounds.push({ round, objective, moves, relicChoice: null, relicOfferIds: [] })
      break
    }

    const offers = settleRound(state, config, deps)
    const pick = offers[0]?.id ?? null
    rounds.push({ round, objective, moves, relicChoice: pick, relicOfferIds: offers.map(o => o.id) })
    if (!chooseRelicAndAdvance(state, pick, config, deps)) break
  }

  return { seed, rounds, finalPhase: state.phase, finalScore: state.score }
}

if (process.argv[1]?.endsWith('plan.ts')) {
  const plan = planFullRun()
  const target = process.argv.find(a => a.startsWith('--out='))?.split('=')[1] ?? 'reports/plan.json'
  writeFileSync(target, JSON.stringify(plan, null, 2))
  console.log(
    `wrote ${plan.rounds.length} rounds to ${target}; phase=${plan.finalPhase} score=${plan.finalScore}`,
  )
  for (const r of plan.rounds) console.log(`  round ${r.round}: ${r.moves.length} moves, relic ${r.relicChoice ?? 'none'}`)
}