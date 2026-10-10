export type ColorId = 0 | 1 | 2 | 3 | 4

export const COLORS: readonly ColorId[] = [0, 1, 2, 3, 4]

export const EMPTY = -1

export type Cell = ColorId | typeof EMPTY

export type Vec2 = readonly [number, number]

export interface FullLine {
  kind: 'row' | 'col' | 'block'
  index: number
  cells: Vec2[]
  monoColor: ColorId | null
}

export interface Grid {
  size: number
  cells: Cell[]
  frozen: boolean[]
}

export type Rotation = 0 | 1 | 2 | 3

export interface Piece {
  defId: string
  color: ColorId
  rotation: Rotation
  cells: Vec2[]
  w: number
  h: number
}

export type Archetype =
  | 'cascade'
  | 'citadel'
  | 'prism'
  | 'joker'
  | 'architect'
  | 'dynamite'

export type Rarity = 'common' | 'rare' | 'legendary'

export type Trigger = 'on_place' | 'on_clear' | 'on_combo' | 'on_round_start' | 'on_round_end'

export type Condition =
  | { kind: 'none' }
  | { kind: 'min_lines'; value: number }
  | { kind: 'min_chain'; value: number }
  | { kind: 'line_mono' }
  | { kind: 'line_color'; color: ColorId }
  | { kind: 'empty_cells_at_least'; value: number }
  | { kind: 'empty_cells_at_most'; value: number }

export type Effect =
  | { kind: 'add_shards'; value: number }
  | { kind: 'add_mult'; value: number }
  | { kind: 'mul_mult'; valueBp: number }
  | { kind: 'add_shards_per_empty'; value: number }
  | { kind: 'replay_last_clear' }
  | { kind: 'freeze_random_cell' }
  | { kind: 'transform_random_piece' }
  | { kind: 'heal_free_cells' }

export interface Relic {
  id: string
  name: { fr: string; en: string }
  archetype: Archetype
  rarity: Rarity
  trigger: Trigger
  condition: Condition
  effect: Effect
  text: { fr: string; en: string }
}

export type BossKind =
  | 'frozen_cells'
  | 'forbidden_color'
  | 'rotating_pieces'
  | 'sparse_bag'
  | 'low_shards'
  | 'narrow_lines'

export interface BossRule {
  id: string
  kind: BossKind
  param: number
  color: ColorId | null
  text: { fr: string; en: string }
}

export type MoveKind = 'place' | 'swap' | 'discard'

export interface Move {
  index: number
  round: number
  kind: MoveKind
  slot: number
  defId: string
  color: ColorId
  rotation: Rotation
  x: number
  y: number
  shardDelta: number
  multBpDelta: number
  linesCleared: number
}

export type Phase = 'playing' | 'round_cleared' | 'lost' | 'victory'

export interface RunState {
  seed: number
  rngState: number
  round: number
  totalRounds: number
  movesLeft: number
  phase: Phase
  grid: Grid
  pieces: (Piece | null)[]
  handSize: number
  score: number
  roundScore: number
  shards: number
  multBp: number
  bonusBp: number
  chain: number
  bestChain: number
  relics: Relic[]
  pendingRelics: Relic[]
  boss: BossRule | null
  objective: number
  fragments: number
  turnsSinceClear: number
  moveIndex: number
  dealsLeft: number
  replayCount: number
}

export interface ClearResult {
  linesCleared: number
  shardsGained: number
  monoLines: number
  cellsCleared: number
}

export interface GameEvent {
  type: 'place' | 'clear' | 'combo' | 'round_start' | 'round_clear' | 'round_fail' | 'relic_trigger' | 'run_victory' | 'no_space'
  data: Record<string, number | string | boolean>
}

export interface AppliedMove {
  ok: boolean
  reason: string
  state: RunState
  events: GameEvent[]
  move: Move | null
}