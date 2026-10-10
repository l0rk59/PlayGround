import type { ColorId, Piece, Rotation, Vec2 } from './types'
import type { Rng } from './rng'

export interface PieceDef {
  id: string
  cells: Vec2[]
  w: number
  h: number
  weight: number
  cellsCount: number
}

function def(id: string, cells: Vec2[], weight: number): PieceDef {
  let w = 0
  let h = 0
  for (const [x, y] of cells) {
    if (x + 1 > w) w = x + 1
    if (y + 1 > h) h = y + 1
  }
  return { id, cells: cells.slice().sort(cmpVec), w, h, weight, cellsCount: cells.length }
}

function cmpVec(a: Vec2, b: Vec2): number {
  return a[1] - b[1] || a[0] - b[0]
}

const row = (y: number, count: number): Vec2[] =>
  Array.from({ length: count }, (_, x) => [x, y] as Vec2)

export const PIECE_DEFS: readonly PieceDef[] = [
  def('dot', [[0, 0]], 34),
  def('domino', row(0, 2), 80),
  def('corner3', [[0, 0], [1, 0], [0, 1]], 55),
  def('triple', row(0, 3), 34),
  def('square2', [[0, 0], [1, 0], [0, 1], [1, 1]], 26),
  def('quad', row(0, 4), 12),
  def('elbow4', [[0, 0], [0, 1], [0, 2], [1, 2]], 9),
  def('tee4', [[0, 0], [1, 0], [2, 0], [1, 1]], 8),
  def('zig4', [[0, 0], [1, 0], [1, 1], [2, 1]], 7),
  def('bar5', row(0, 5), 5),
  def('deep5', [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]], 3),
  def('rect23', [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], 5),
  def('diamond', [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], 3),
  def('crane5', [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 2),
  def('square3', [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], 1),
]

export const PIECE_BY_ID: Record<string, PieceDef> = Object.fromEntries(
  PIECE_DEFS.map(d => [d.id, d]),
)

export function rotateCells(cells: readonly Vec2[], h: number, times: Rotation): Vec2[] {
  let current = cells.slice()
  for (let t = 0; t < times; t += 1) {
    current = current.map(([x, y]) => [h - 1 - y, x] as Vec2).sort(cmpVec)
  }
  return current
}

export function pieceBounds(defId: string, rotation: Rotation): { cells: Vec2[]; w: number; h: number } {
  const d = PIECE_BY_ID[defId]
  if (!d) throw new Error(`Unknown piece def: ${defId}`)
  const cells = rotateCells(d.cells, d.h, rotation)
  let w = 0
  let h = 0
  for (const [x, y] of cells) {
    if (x + 1 > w) w = x + 1
    if (y + 1 > h) h = y + 1
  }
  return { cells, w, h }
}

export function makePiece(defId: string, color: ColorId, rotation: Rotation = 0): Piece {
  const b = pieceBounds(defId, rotation)
  return { defId, color, rotation, cells: b.cells, w: b.w, h: b.h }
}

export function rotatePiece(piece: Piece): Piece {
  const next = (((piece.rotation + 1) % 4) as Rotation)
  const b = pieceBounds(piece.defId, next)
  return { defId: piece.defId, color: piece.color, rotation: next, cells: b.cells, w: b.w, h: b.h }
}

export interface BagOptions {
  size: number
  colorCount: number
  maxCells: number
  weightBias: number
}

export function generatePiece(rng: Rng, opts: BagOptions): Piece {
  const eligible = PIECE_DEFS.filter(d => d.cellsCount <= opts.maxCells)
  const pool = eligible.length > 0 ? eligible : PIECE_DEFS
  const weights = pool.map(d => {
    const sizePenalty = d.cellsCount > 3 ? Math.max(1, Math.round(opts.weightBias / d.cellsCount)) : 1
    return Math.max(1, Math.round(d.weight * sizePenalty))
  })
  const index = rng.weightedIndex(weights)
  const chosen = pool[index] as PieceDef
  const color = rng.int(opts.colorCount) as ColorId
  return makePiece(chosen.id, color, 0)
}

export function generateHand(rng: Rng, opts: BagOptions): Piece[] {
  return Array.from({ length: opts.size }, () => generatePiece(rng, opts))
}