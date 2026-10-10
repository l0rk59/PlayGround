import { describe, expect, it } from 'vitest'
import {
  anyPlacementAvailable,
  canPlace,
  clearLines,
  cloneGrid,
  countEmpty,
  createGrid,
  findFullLines,
  freezeCell,
  healFrozen,
  idx,
  placeCells,
} from '../core/board'
import { makePiece, pieceBounds, rotateCells, rotatePiece } from '../core/pieces'
import { EMPTY, type Cell, type ColorId, type Grid } from '../core/types'

function fillRow(grid: Grid, y: number, color: ColorId = 0): void {
  for (let x = 0; x < grid.size; x += 1) grid.cells[idx(grid, x, y)] = color
}

function put(grid: Grid, x: number, y: number, color: ColorId): void {
  grid.cells[idx(grid, x, y)] = color
}

describe('grid basics', () => {
  it('creates an empty 8x8 grid with 64 empty cells', () => {
    const grid = createGrid(8)
    expect(grid.cells.length).toBe(64)
    expect(countEmpty(grid)).toBe(64)
    expect(grid.frozen.every(f => f === false)).toBe(true)
  })

  it('clones deeply so mutations do not leak', () => {
    const grid = createGrid(8)
    fillRow(grid, 0)
    const copy = cloneGrid(grid)
    copy.cells[0] = 3
    copy.frozen[0] = true
    expect(grid.cells[0]).toBe(0)
    expect(grid.frozen[0]).toBe(false)
  })
})

describe('placement', () => {
  it('accepts a piece fully inside the grid', () => {
    const grid = createGrid(8)
    const piece = makePiece('quad', 0)
    expect(canPlace(grid, piece, 0, 0)).toBe(true)
    expect(canPlace(grid, piece, 4, 4)).toBe(true)
  })

  it('rejects a piece crossing the right or bottom edge', () => {
    const grid = createGrid(8)
    expect(canPlace(grid, makePiece('bar5', 0), 4, 0)).toBe(false)
    expect(canPlace(grid, makePiece('bar5', 0), 3, 0)).toBe(true)
    expect(canPlace(grid, makePiece('deep5', 0, 0), 0, 5)).toBe(false)
    expect(canPlace(grid, makePiece('deep5', 0, 0), 0, 4)).toBe(true)
  })

  it('rejects negative coordinates', () => {
    const grid = createGrid(8)
    expect(canPlace(grid, makePiece('dot', 0), -1, 0)).toBe(false)
    expect(canPlace(grid, makePiece('dot', 0), 0, -1)).toBe(false)
  })

  it('rejects overlapping occupied cells', () => {
    const grid = createGrid(8)
    fillRow(grid, 2)
    expect(canPlace(grid, makePiece('dot', 1), 0, 2)).toBe(false)
    expect(canPlace(grid, makePiece('dot', 1), 0, 3)).toBe(true)
  })

  it('rejects a frozen cell but not its neighbours', () => {
    const grid = createGrid(8)
    put(grid, 1, 1, 2)
    freezeCell(grid, 1, 1)
    expect(canPlace(grid, makePiece('dot', 0), 1, 1)).toBe(false)
    expect(canPlace(grid, makePiece('dot', 0), 2, 1)).toBe(true)
  })

  it('freezes only cells that hold a shard', () => {
    const grid = createGrid(8)
    expect(freezeCell(grid, 4, 4)).toBe(false)
    put(grid, 4, 4, 1)
    expect(freezeCell(grid, 4, 4)).toBe(true)
  })

  it('heals every frozen cell', () => {
    const grid = createGrid(8)
    put(grid, 0, 0, 1)
    put(grid, 1, 0, 1)
    freezeCell(grid, 0, 0)
    freezeCell(grid, 1, 0)
    expect(healFrozen(grid)).toBe(2)
    expect(grid.frozen.some(Boolean)).toBe(false)
  })

  it('places cells at the requested offset', () => {
    const grid = createGrid(8)
    placeCells(grid, makePiece('square2', 3), 2, 2)
    expect(grid.cells[idx(grid, 2, 2)]).toBe(3)
    expect(grid.cells[idx(grid, 3, 3)]).toBe(3)
  })
})

describe('line detection', () => {
  it('finds a full row', () => {
    const grid = createGrid(8)
    fillRow(grid, 3)
    const lines = findFullLines(grid)
    expect(lines.length).toBe(1)
    expect(lines[0]?.kind).toBe('row')
    expect(lines[0]?.index).toBe(3)
  })

  it('finds a full column', () => {
    const grid = createGrid(8)
    for (let y = 0; y < 8; y += 1) put(grid, 5, y, 2)
    const lines = findFullLines(grid)
    expect(lines.some(l => l.kind === 'col' && l.index === 5)).toBe(true)
  })

  it('finds a full 3x3 square', () => {
    const grid = createGrid(8)
    for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 3; x += 1) put(grid, x, y, 4)
    const lines = findFullLines(grid)
    const block = lines.find(l => l.kind === 'block')
    expect(block).toBeDefined()
    expect(block?.cells.length).toBe(9)
  })

  it('finds no line on an empty grid', () => {
    expect(findFullLines(createGrid(8))).toHaveLength(0)
  })

  it('does not complete a line interrupted by a frozen cell', () => {
    const grid = createGrid(8)
    fillRow(grid, 4)
    put(grid, 4, 4, 1)
    freezeCell(grid, 4, 4)
    expect(findFullLines(grid).some(l => l.kind === 'row' && l.index === 4)).toBe(false)
  })

  it('detects monochrome rows and rejects mixed rows', () => {
    const mono = createGrid(8)
    fillRow(mono, 1, 3)
    expect(findFullLines(mono)[0]?.monoColor).toBe(3)

    const mixed = createGrid(8)
    fillRow(mixed, 1, 3)
    mixed.cells[idx(mixed, 7, 1)] = 1 as ColorId
    expect(findFullLines(mixed)[0]?.monoColor).toBeNull()
  })

  it('honours the narrow_lines scan by skipping 3x3 squares', () => {
    const grid = createGrid(8)
    for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 3; x += 1) put(grid, x, y, 4)
    expect(findFullLines(grid).some(l => l.kind === 'block')).toBe(true)
    expect(findFullLines(grid, { blocks: false }).some(l => l.kind === 'block')).toBe(false)
  })

  it('clears the intersection of two lines exactly once', () => {
    const grid = createGrid(8)
    fillRow(grid, 0)
    for (let y = 0; y < 8; y += 1) put(grid, 2, y, 1)
    expect(grid.cells.filter(c => c !== EMPTY)).toHaveLength(15)
    const lines = findFullLines(grid)
    const cleared = clearLines(grid, lines)
    expect(cleared.length).toBe(15)
    expect(grid.cells.filter(c => c !== EMPTY)).toHaveLength(0)
  })

  it('leaves the board unchanged when there is nothing to clear', () => {
    const grid = createGrid(8)
    grid.cells[idx(grid, 0, 0)] = 1 as ColorId
    expect(clearLines(grid, []).length).toBe(0)
    expect(grid.cells[idx(grid, 0, 0)]).toBe(1)
  })
})

describe('occupancy', () => {
  it('reports no placement available on a full board', () => {
    const grid = createGrid(8)
    grid.cells.fill(0)
    expect(anyPlacementAvailable(grid, [makePiece('dot', 1)])).toBe(false)
  })

  it('reports a placement available when one hole remains', () => {
    const grid = createGrid(8)
    grid.cells.fill(0)
    grid.cells[idx(grid, 7, 7)] = EMPTY
    expect(anyPlacementAvailable(grid, [makePiece('dot', 1)])).toBe(true)
  })

  it('ignores empty hand slots', () => {
    const grid = createGrid(8)
    grid.cells.fill(0)
    expect(anyPlacementAvailable(grid, [null, null])).toBe(false)
  })
})

describe('piece geometry', () => {
  it('rotates a bar into a column after a quarter turn', () => {
    const rotated = rotateCells([[0, 0], [1, 0], [2, 0]] as const, 1, 1)
    expect(rotated).toEqual([[0, 0], [0, 1], [0, 2]])
  })

  it('returns to the original shape after four quarter turns', () => {
    const original: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 2]]
    const once = rotateCells(original, 3, 1)
    const back = rotateCells(once, 3, 3)
    expect(back).toEqual(original.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]))
  })

  it('keeps rotated pieces inside the grid', () => {
    const bounds = pieceBounds('deep5', 1)
    expect(bounds.w).toBeLessThanOrEqual(8)
    expect(bounds.h).toBeLessThanOrEqual(8)
  })

  it('rotating a piece advances the rotation counter', () => {
    const piece = makePiece('tee4', 0)
    const rotated = rotatePiece(piece)
    expect(rotated.rotation).toBe(1)
    expect(rotated.cells.length).toBe(piece.cells.length)
  })
})