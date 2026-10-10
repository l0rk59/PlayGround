import { EMPTY, type ColorId, type Grid, type Piece } from '../core/types'

export interface Shade {
  base: string
  light: string
  dark: string
}

export const PALETTE: Shade[] = [
  { base: '#f2b33d', light: '#ffdf9c', dark: '#a8730f' },
  { base: '#4fd1e1', light: '#b0eef6', dark: '#1d7f92' },
  { base: '#a78bfa', light: '#e0d3ff', dark: '#5c3fc0' },
  { base: '#5dd39e', light: '#b0f0ce', dark: '#1f9163' },
  { base: '#f26d8b', light: '#ffc0cc', dark: '#ad3350' },
]

export interface BoardLayout {
  originX: number
  originY: number
  cell: number
  size: number
}

export function layoutBoard(width: number, height: number, size: number, pad = 10): BoardLayout {
  const cell = Math.floor(Math.min((width - pad * 2) / size, (height - pad * 2) / size))
  const boardPx = cell * size
  return {
    cell,
    size,
    originX: Math.round((width - boardPx) / 2),
    originY: Math.round((height - boardPx) / 2),
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export function drawCellSlot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  roundRect(ctx, x, y, size, size, size * 0.22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()
}

export interface ShardStyle {
  alpha?: number
  scale?: number
  glow?: number
}

export function drawShard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: ColorId,
  style: ShardStyle = {},
): void {
  const shade = PALETTE[color] ?? (PALETTE[0] as Shade)
  const inset = size * 0.09
  const grow = style.scale ?? 1
  const w = (size - inset * 2) * grow
  const h = (size - inset * 2) * grow
  const offsetX = x + inset - ((w - (size - inset * 2)) / 2)
  const offsetY = y + inset - ((h - (size - inset * 2)) / 2)

  ctx.save()
  ctx.globalAlpha = style.alpha ?? 1

  const gradient = ctx.createLinearGradient(offsetX, offsetY, offsetX, offsetY + h)
  gradient.addColorStop(0, shade.light)
  gradient.addColorStop(0.45, shade.base)
  gradient.addColorStop(1, shade.dark)
  ctx.fillStyle = gradient
  roundRect(ctx, offsetX, offsetY, w, h, h * 0.26)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.34)'
  roundRect(ctx, offsetX + w * 0.16, offsetY + h * 0.12, w * 0.42, h * 0.16, h * 0.08)
  ctx.fill()

  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1
  roundRect(ctx, offsetX, offsetY, w, h, h * 0.26)
  ctx.stroke()

  if ((style.glow ?? 0) > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = style.glow ?? 0
    ctx.fillStyle = shade.light
    roundRect(ctx, offsetX, offsetY, w, h, h * 0.26)
    ctx.fill()
  }

  ctx.restore()
}

export function drawFrozen(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save()
  ctx.fillStyle = 'rgba(190, 225, 255, 0.4)'
  roundRect(ctx, x + size * 0.09, y + size * 0.09, size * 0.82, size * 0.82, size * 0.22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(225, 245, 255, 0.85)'
  ctx.lineWidth = Math.max(1, size * 0.045)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = Math.max(1, size * 0.03)
  ctx.beginPath()
  ctx.moveTo(x + size * 0.28, y + size * 0.62)
  ctx.lineTo(x + size * 0.72, y + size * 0.38)
  ctx.stroke()
  ctx.restore()
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  layout: BoardLayout,
  clearing: ReadonlyMap<number, number>,
): void {
  const { cell, originX, originY, size } = layout
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      drawCellSlot(ctx, originX + x * cell, originY + y * cell, cell)
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = y * size + x
      const color = grid.cells[at]
      if (color === EMPTY) continue
      const px = originX + x * cell
      const py = originY + y * cell
      const progress = clearing.get(at)

      if (progress === undefined) {
        drawShard(ctx, px, py, cell, color as ColorId)
      } else {
        const t = Math.min(1, progress)
        drawShard(ctx, px, py, cell, color as ColorId, { scale: 1 + t * 0.5, alpha: 1 - t, glow: (1 - t) * 0.5 })
      }

      if (grid.frozen[at]) drawFrozen(ctx, px, py, cell)
    }
  }
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  ox: number,
  oy: number,
  piece: Piece,
  valid: boolean,
): void {
  const { cell, originX, originY } = layout
  ctx.save()
  for (const [cx, cy] of piece.cells) {
    const x = originX + (ox + cx) * cell
    const y = originY + (oy + cy) * cell
    ctx.globalAlpha = valid ? 0.42 : 0.16
    ctx.fillStyle = valid ? '#ffe9b0' : '#ff6b6b'
    roundRect(ctx, x + cell * 0.08, y + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.22)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = valid ? 'rgba(255,233,176,0.85)' : 'rgba(255,107,107,0.8)'
    ctx.lineWidth = Math.max(1.5, cell * 0.06)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  x: number,
  y: number,
  cell: number,
  alpha = 1,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  for (const [cx, cy] of piece.cells) {
    drawShard(ctx, x + cx * cell, y + cy * cell, cell, piece.color)
  }
  ctx.restore()
}

export function pieceCanvasSize(piece: Piece, cell: number): { w: number; h: number } {
  return { w: piece.w * cell, h: piece.h * cell }
}
