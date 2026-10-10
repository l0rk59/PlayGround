import type { AppliedMove, BossRule, ClearResult, ColorId, FullLine, GameEvent, Move, Relic, Rotation, RunState } from './types'
import { EMPTY } from './types'
import { makeRng, type Rng } from './rng'
import {
  anyPlacementAvailable,
  canPlace,
  clearLines,
  countEmpty,
  createGrid,
  findFullLines,
  placeCells,
  cloneGrid,
} from './board'
import { makePiece, generateHand, rotatePiece } from './pieces'
import {
  MULT_BASE_BP,
  clampMultBp,
  evaluateClear,
  scoreClear,
  scoreFromShards,
} from './scoring'
import { LIMITS, applyRelics, type RelicContext } from './relics'
import {
  activateBoss,
  autoRotate,
  bagOptions,
  blocksEnabled,
  isForbidden,
  movesForRound,
  objectiveForRound,
  shardScaleBp,
  tickBoss,
  type RoundObjectives,
} from './boss'

export interface RunConfig extends RoundObjectives {
  gridSize: number
  totalRounds: number
  handSize: number
  colorCount: number
  maxPieceCells: number
  weightBias: number
  dealsPerRound: number
  relicChoiceSize: number
  bossRounds: number[]
}

export const DEFAULT_CONFIG: RunConfig = {
  gridSize: 8,
  totalRounds: 6,
  handSize: 3,
  colorCount: 5,
  maxPieceCells: 6,
  weightBias: 4,
  baseMoves: 24,
  movesPerRound: 2,
  maxMoves: 32,
  objectiveBase: 80,
  objectiveGrowth: 1.35,
  dealsPerRound: 2,
  relicChoiceSize: 3,
  bossRounds: [3, 6],
}

export function prototypeConfig(): RunConfig {
  return { ...DEFAULT_CONFIG, totalRounds: 3, bossRounds: [3], objectiveGrowth: 1.8 }
}

export interface MoveInput {
  slot: number
  x: number
  y: number
  rotation: Rotation
}

export interface RunDeps {
  bosses: readonly BossRule[]
  relicPool: readonly Relic[]
  forceOffer?: string | null
}

function bossForRound(round: number, config: RunConfig, deps: RunDeps): BossRule | null {
  if (!config.bossRounds.includes(round) || deps.bosses.length === 0) return null
  const index = config.bossRounds.indexOf(round) % deps.bosses.length
  return deps.bosses[index] as BossRule
}

export function createRun(seed: number, config: RunConfig, deps: RunDeps): RunState {
  const rng = makeRng(seed)
  const state: RunState = {
    seed,
    rngState: rng.state,
    round: 1,
    totalRounds: config.totalRounds,
    movesLeft: movesForRound(1, config),
    phase: 'playing',
    grid: createGrid(config.gridSize),
    pieces: new Array(config.handSize).fill(null),
    handSize: config.handSize,
    score: 0,
    roundScore: 0,
    shards: 0,
    multBp: MULT_BASE_BP,
    bonusBp: 0,
    chain: 0,
    bestChain: 0,
    relics: [],
    pendingRelics: [],
    boss: bossForRound(1, config, deps),
    objective: objectiveForRound(1, config),
    fragments: 0,
    turnsSinceClear: 0,
    moveIndex: 0,
    dealsLeft: config.dealsPerRound,
    replayCount: 0,
  }
  refillHand(state, rng, config)
  if (state.boss) activateBoss(state, state.boss, rng)
  fireRoundRelics(state, 'on_round_start', rng)
  state.rngState = rng.state
  return state
}

export function refillHand(state: RunState, rng: Rng, config: RunConfig): void {
  const missing: number[] = []
  for (let i = 0; i < state.handSize; i += 1) if (!state.pieces[i]) missing.push(i)
  if (missing.length === 0) return
  const generated = generateHand(rng, {
    ...bagOptions(state, {
      size: config.handSize,
      colorCount: config.colorCount,
      maxCells: config.maxPieceCells,
      weightBias: config.weightBias,
    }),
    size: missing.length,
  })
  for (let k = 0; k < missing.length; k += 1) {
    let piece = generated[k]!
    if (isForbidden(state, piece.color)) {
      piece = makePiece(piece.defId, ((piece.color + 1) % config.colorCount) as ColorId, piece.rotation)
    }
    state.pieces[missing[k] as number] = piece
  }
  if (autoRotate(state)) {
    for (let i = 0; i < state.pieces.length; i += 1) {
      const p = state.pieces[i]
      if (p) state.pieces[i] = rotatePiece(p)
    }
  }
}

function fireRelics(
  state: RunState,
  trigger: RelicContext['trigger'],
  base: RelicContext,
  rng: Rng,
): { shards: number; multBp: number; replay: boolean; transform: boolean } {
  const ctx: RelicContext = { ...base, trigger }
  const outcome = applyRelics(state, state.relics, ctx, rng)
  if (outcome.multBpDelta !== 0) {
    state.multBp = clampMultBp(state.multBp + outcome.multBpDelta)
    state.bonusBp = Math.max(0, state.bonusBp + outcome.multBpDelta)
  }
  return {
    shards: outcome.shardDelta,
    multBp: outcome.multBpDelta,
    replay: outcome.replay,
    transform: outcome.transform,
  }
}

function fireRoundRelics(state: RunState, trigger: 'on_round_start' | 'on_round_end', rng: Rng): number {
  const ctx: RelicContext = {
    trigger,
    lines: [],
    linesCleared: 0,
    monoLines: 0,
    chain: state.chain,
    emptyCells: countEmpty(state.grid),
    replayDepth: state.replayCount,
  }
  const outcome = applyRelics(state, state.relics, ctx, rng)
  if (outcome.multBpDelta !== 0) {
    state.multBp = clampMultBp(state.multBp + outcome.multBpDelta)
    state.bonusBp = Math.max(0, state.bonusBp + outcome.multBpDelta)
  }
  return outcome.shardDelta
}

export function applyMove(state: RunState, input: MoveInput, config: RunConfig = DEFAULT_CONFIG): AppliedMove {
  const events: GameEvent[] = []
  const reject = (reason: string): AppliedMove => ({ ok: false, reason, state, events, move: null })

  if (state.phase !== 'playing') return reject('phase')
  const piece = state.pieces[input.slot]
  if (!piece) return reject('empty_slot')
  if (state.movesLeft <= 0) return reject('no_moves')
  if (input.x < 0 || input.y < 0) return reject('out_of_bounds')

  const rng = makeRng(state.rngState)
  const rotation = autoRotate(state) ? piece.rotation : input.rotation
  const placed = makePiece(piece.defId, piece.color, rotation)

  if (isForbidden(state, placed.color)) {
    state.rngState = rng.state
    return reject('forbidden_color')
  }
  if (!canPlace(state.grid, placed, input.x, input.y)) {
    state.rngState = rng.state
    return reject('no_fit')
  }

  placeCells(state.grid, placed, input.x, input.y)
  tickBoss(state, rng)

  let fullLines: FullLine[] = findFullLines(state.grid, { blocks: blocksEnabled(state) })
  let clearedCells: [number, number][] = []
  let clear: ClearResult = { linesCleared: 0, shardsGained: 0, monoLines: 0, cellsCleared: 0 }
  if (fullLines.length > 0) {
    clearedCells = clearLines(state.grid, fullLines) as [number, number][]
    clear = evaluateClear(fullLines, clearedCells.length)
  }

  const emptyCellsBefore = countEmpty(state.grid)
  const scaleBp = shardScaleBp(state)

  const outcome = scoreClear(clear, { chain: state.chain, bonusBp: state.bonusBp, emptyCells: emptyCellsBefore })
  state.chain = outcome.chain
  state.multBp = outcome.multBp
  if (state.chain > state.bestChain) state.bestChain = state.chain

  const baseShards = Math.floor((outcome.shardsGained * scaleBp) / 10000)
  const emptyCells = countEmpty(state.grid)

  const baseCtx: RelicContext = {
    trigger: 'on_place',
    lines: fullLines,
    linesCleared: clear.linesCleared,
    monoLines: clear.monoLines,
    chain: state.chain,
    emptyCells,
    replayDepth: state.replayCount,
  }

  let shardTotal = baseShards

  for (const trigger of ['on_place', 'on_clear', 'on_combo'] as const) {
    const fired = fireRelics(state, trigger, baseCtx, rng)
    shardTotal += fired.shards
    if (fired.replay && state.replayCount < LIMITS.maxReplayDepth) {
      state.replayCount += 1
      shardTotal += baseShards
      events.push({ type: 'relic_trigger', data: { trigger, replay: true, depth: state.replayCount } })
    }
    if (fired.transform) transformRandomPiece(state, rng, config)
  }

  const gain = scoreFromShards(shardTotal, state.multBp)
  state.shards += shardTotal
  state.roundScore += gain
  state.score += gain
  state.movesLeft -= 1
  state.turnsSinceClear = clear.linesCleared > 0 ? 0 : state.turnsSinceClear + 1
  state.pieces[input.slot] = null

  const move: Move = {
    index: state.moveIndex,
    round: state.round,
    kind: 'place',
    slot: input.slot,
    defId: placed.defId,
    color: placed.color,
    rotation: placed.rotation,
    x: input.x,
    y: input.y,
    shardDelta: shardTotal,
    multBpDelta: state.multBp - MULT_BASE_BP,
    linesCleared: clear.linesCleared,
  }
  state.moveIndex += 1
  state.rngState = rng.state

  events.push({ type: 'place', data: { slot: input.slot, x: input.x, y: input.y, color: placed.color } })
  if (clear.linesCleared > 0) {
    events.push({
      type: 'clear',
      data: {
        lines: clear.linesCleared,
        mono: clear.monoLines,
        shards: clear.shardsGained,
        cells: clear.cellsCleared,
        chain: state.chain,
        score: gain,
      },
    })
    if (state.chain >= 2) events.push({ type: 'combo', data: { chain: state.chain, multBp: state.multBp } })
  }

  const refillRng = makeRng(rng.state)
  refillHand(state, refillRng, config)
  state.rngState = refillRng.state

  if (!anyPlacementAvailable(state.grid, state.pieces)) {
    if (state.dealsLeft > 0) {
      state.dealsLeft -= 1
      for (let i = 0; i < state.pieces.length; i += 1) state.pieces[i] = null
      const dealRng = makeRng(state.rngState)
      refillHand(state, dealRng, config)
      state.rngState = dealRng.state
      events.push({ type: 'no_space', data: { redealt: true } })
    } else {
      state.phase = 'lost'
      state.fragments += fragmentsFor(state)
      events.push({ type: 'round_fail', data: { round: state.round, score: state.score, reason: 'no_space' } })
    }
  }

  if (state.phase === 'playing') {
    if (state.roundScore >= state.objective) {
      const bonus = fireRoundRelics(state, 'on_round_end', makeRng(state.rngState))
      if (bonus > 0) {
        state.shards += bonus
        const extra = scoreFromShards(bonus, state.multBp)
        state.roundScore += extra
        state.score += extra
      }
      state.phase = 'round_cleared'
      events.push({ type: 'round_clear', data: { round: state.round, score: state.roundScore } })
    } else if (state.movesLeft <= 0) {
      state.phase = 'lost'
      state.fragments += fragmentsFor(state)
      events.push({ type: 'round_fail', data: { round: state.round, score: state.score, reason: 'moves' } })
    }
  }

  return { ok: true, reason: '', state, events, move }
}

function transformRandomPiece(state: RunState, rng: Rng, config: RunConfig): void {
  const slots = state.pieces.map((p, i) => (p ? i : -1)).filter(i => i >= 0)
  if (slots.length === 0) return
  const slot = slots[rng.int(slots.length)] as number
  const piece = state.pieces[slot]
  if (!piece) return
  const nextColor = ((piece.color + 1 + rng.int(Math.max(1, config.colorCount - 1))) % config.colorCount) as ColorId
  state.pieces[slot] = makePiece(piece.defId, isForbidden(state, nextColor) ? piece.color : nextColor, piece.rotation)
}

export function fragmentsFor(state: RunState): number {
  return Math.max(0, Math.floor(state.score / 500)) + (state.round - 1) * 2
}

export function offerRelics(state: RunState, rng: Rng, pool: readonly Relic[], size: number): Relic[] {
  const owned = new Set(state.relics.map(r => r.id))
  const candidates = pool.filter(r => !owned.has(r.id))
  const source = candidates.length >= size ? candidates : pool.slice()
  const offers: Relic[] = []
  const used = new Set<string>()
  let guard = 0
  while (offers.length < size && guard < 200) {
    guard += 1
    const relic = source[rng.int(source.length)]
    if (!relic || used.has(relic.id)) continue
    used.add(relic.id)
    offers.push(relic)
  }
  return offers
}

export function advanceRound(state: RunState, config: RunConfig, deps: RunDeps): void {
  const rng = makeRng(state.rngState)

  if (state.round >= state.totalRounds) {
    state.phase = 'victory'
    state.boss = null
    state.rngState = rng.state
    return
  }

  state.round += 1
  state.grid = createGrid(config.gridSize)
  state.pendingRelics = []
  state.roundScore = 0
  state.chain = 0
  state.multBp = MULT_BASE_BP
  state.bonusBp = 0
  state.replayCount = 0
  state.movesLeft = movesForRound(state.round, config)
  state.objective = objectiveForRound(state.round, config)
  state.dealsLeft = config.dealsPerRound
  state.phase = 'playing'
  state.boss = bossForRound(state.round, config, deps)

  for (let i = 0; i < state.pieces.length; i += 1) state.pieces[i] = null
  refillHand(state, rng, config)
  if (state.boss) activateBoss(state, state.boss, rng)
  fireRoundRelics(state, 'on_round_start', rng)
  state.rngState = rng.state
}

export function settleRound(state: RunState, config: RunConfig, deps: RunDeps): Relic[] {
  if (state.pendingRelics.length > 0) return state.pendingRelics
  const rng = makeRng(state.rngState)
  const offers = offerRelics(state, rng, deps.relicPool, config.relicChoiceSize)

  const forced = deps.forceOffer ? deps.relicPool.find(r => r.id === deps.forceOffer) : undefined
  if (forced && !offers.some(r => r.id === forced.id)) {
    const rng2 = makeRng(rng.state)
    const filler = offerRelics(state, rng2, deps.relicPool.filter(r => r.id !== forced.id), config.relicChoiceSize - 1)
    offers.length = 0
    offers.push(forced, ...filler.slice(0, Math.max(0, config.relicChoiceSize - 1)))
    rng.state = rng2.state
  }

  state.pendingRelics = offers
  state.rngState = rng.state
  return offers
}

export function chooseRelicAndAdvance(
  state: RunState,
  relicId: string | null,
  config: RunConfig,
  deps: RunDeps,
): boolean {
  if (state.phase !== 'round_cleared') return false

  const offers = state.pendingRelics
  let chosen: Relic | null = null
  if (relicId !== null) {
    chosen = offers.find(r => r.id === relicId) ?? null
    if (!chosen) return false
  }
  if (chosen) state.relics.push(chosen)
  state.pendingRelics = []
  advanceRound(state, config, deps)
  return true
}

export function snapshot(state: RunState): RunState {
  return {
    ...state,
    grid: cloneGrid(state.grid),
    pieces: state.pieces.map(p => (p ? { ...p, cells: p.cells.map(c => [c[0], c[1]] as [number, number]) } : null)),
    relics: state.relics.slice(),
    pendingRelics: state.pendingRelics.slice(),
  }
}

export function emptyCellsRemaining(state: RunState): number {
  return countEmpty(state.grid)
}

export function filledRatioBp(state: RunState): number {
  const filled = state.grid.cells.filter(c => c !== EMPTY).length
  return Math.floor((filled * 10000) / state.grid.cells.length)
}