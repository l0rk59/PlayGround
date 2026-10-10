import { EMPTY, type Cell, type ColorId, type FullLine, type Grid, type Piece, type Vec2 } from './types'
import { COLORS } from './types'

export const BLOCK = 3

export function createGrid(size = 8): Grid {
  return {
    size,
    cells: new Array<Cell>(size * size).fill(EMPTY),
    frozen: new Array<boolean>(size * size).fill(false),
  }
}

export function cloneGrid(grid: Grid): Grid {
  return { size: grid.size, cells: grid.cells.slice(), frozen: grid.frozen.slice() }
}

export function idx(grid: Grid, x: number, y: number): number {
  return y * grid.size + x
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.size && y < grid.size
}

export function canPlace(grid: Grid, piece: Piece, ox: number, oy: number): boolean {
  if (ox < 0 || oy < 0) return false
  if (ox + piece.w > grid.size || oy + piece.h > grid.size) return false
  for (const [cx, cy] of piece.cells) {
    const at = idx(grid, ox + cx, oy + cy)
    if (grid.cells[at] !== EMPTY) return false
    if (grid.frozen[at]) return false
  }
  return true
}

export function placeCells(grid: Grid, piece: Piece, ox: number, oy: number): void {
  for (const [cx, cy] of piece.cells) {
    grid.cells[idx(grid, ox + cx, oy + cy)] = piece.color
  }
}

export interface LineScan {
  blocks: boolean
}

export const DEFAULT_SCAN: LineScan = { blocks: true }

export function findFullLines(grid: Grid, scan: LineScan = DEFAULT_SCAN): FullLine[] {
  const lines: FullLine[] = []
  const { size } = grid

  for (let y = 0; y < size; y += 1) {
    const cells: Vec2[] = []
    let complete = true
    for (let x = 0; x < size; x += 1) {
      const at = idx(grid, x, y)
      if (grid.cells[at] === EMPTY || grid.frozen[at]) {
        complete = false
        break
      }
      cells.push([x, y])
    }
    if (complete) lines.push({ kind: 'row', index: y, cells, monoColor: monoOf(grid, cells) })
  }

  for (let x = 0; x < size; x += 1) {
    const cells: Vec2[] = []
    let complete = true
    for (let y = 0; y < size; y += 1) {
      const at = idx(grid, x, y)
      if (grid.cells[at] === EMPTY || grid.frozen[at]) {
        complete = false
        break
      }
      cells.push([x, y])
    }
    if (complete) lines.push({ kind: 'col', index: x, cells, monoColor: monoOf(grid, cells) })
  }

  if (scan.blocks) {
    for (let by = 0; by + BLOCK <= size; by += 1) {
      for (let bx = 0; bx + BLOCK <= size; bx += 1) {
        const cells: Vec2[] = []
        let complete = true
        for (let y = 0; y < BLOCK; y += 1) {
          for (let x = 0; x < BLOCK; x += 1) {
            const at = idx(grid, bx + x, by + y)
            if (grid.cells[at] === EMPTY || grid.frozen[at]) {
              complete = false
              y = BLOCK
              break
            }
            cells.push([bx + x, by + y])
          }
        }
        if (complete) lines.push({ kind: 'block', index: by * size + bx, cells, monoColor: monoOf(grid, cells) })
      }
    }
  }

  return lines
}

function monoOf(grid: Grid, cells: readonly Vec2[]): ColorId | null {
  let color: ColorId | null = null
  for (const [x, y] of cells) {
    const c = grid.cells[idx(grid, x, y)] as ColorId
    if (color === null) color = c
    else if (color !== c) return null
  }
  return color
}

export function clearLines(grid: Grid, lines: readonly FullLine[]): Vec2[] {
  const cleared = new Set<number>()
  for (const line of lines) {
    for (const [x, y] of line.cells) cleared.add(idx(grid, x, y))
  }
  const out: Vec2[] = []
  for (const at of [...cleared].sort((a, b) => a - b)) {
    grid.cells[at] = EMPTY
    out.push([at % grid.size, Math.floor(at / grid.size)])
  }
  return out
}

export function freezeCell(grid: Grid, x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return false
  const at = idx(grid, x, y)
  if (grid.cells[at] === EMPTY) return false
  grid.frozen[at] = true
  return true
}

export function healFrozen(grid: Grid): number {
  let healed = 0
  for (let i = 0; i < grid.frozen.length; i += 1) {
    if (grid.frozen[i]) {
      grid.frozen[i] = false
      healed += 1
    }
  }
  return healed
}

export function countEmpty(grid: Grid): number {
  let n = 0
  for (const c of grid.cells) if (c === EMPTY) n += 1
  return n
}

export function countFilled(grid: Grid): number {
  return grid.cells.length - countEmpty(grid)
}

export function anyPlacementAvailable(grid: Grid, pieces: readonly (Piece | null)[]): boolean {
  for (const piece of pieces) {
    if (!piece) continue
    for (let y = 0; y <= grid.size - piece.h; y += 1) {
      for (let x = 0; x <= grid.size - piece.w; x += 1) {
        if (canPlace(grid, piece, x, y)) return true
      }
    }
  }
  return false
}

export function colorInPalette(color: ColorId): boolean {
  return COLORS.includes(color)
}

export function lineShards(line: FullLine): number {
  return line.cells.length * 2 + (line.monoColor !== null ? line.cells.length : 0)
}