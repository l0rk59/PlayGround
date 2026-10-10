import { EMPTY, type Rotation, type RunState } from '../core/types'
import { canPlace } from '../core/board'
import { makePiece } from '../core/pieces'
import { BOSSES, RELICS } from '../core/load'
import {
  applyMove,
  chooseRelicAndAdvance,
  createRun,
  prototypeConfig,
  settleRound,
  type RunConfig,
  type RunDeps,
} from '../core/run'
import { hashSeed } from '../core/rng'
import { drawBoard, drawGhost, drawPiece, layoutBoard, type BoardLayout } from './render'
import { Resonance } from './resonance'

const RELICS_BY_ID = new Map(RELICS.map(r => [r.id, r]))
const BOSSES_BY_ID = new Map(BOSSES.map(b => [b.id, b]))

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id)
  if (!node) throw new Error(`missing element #${id}`)
  return node as T
}

const canvas = el<HTMLCanvasElement>('board')
const context = canvas.getContext('2d')
if (!context) throw new Error('canvas 2d context unavailable')
const ctx: CanvasRenderingContext2D = context

const handEl = el('hand')
const overlayEl = el('overlay')
const panelEl = el('panel')
const bannerEl = el('banner')

const deps: RunDeps = { bosses: BOSSES, relicPool: RELICS }
const config: RunConfig = prototypeConfig()
const audio = new Resonance()

const CLEAR_MS = 320
const FLOAT_MS = 780

interface FloatText {
  x: number
  y: number
  text: string
  color: string
  born: number
}

interface SlotView {
  root: HTMLDivElement
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  cell: number
}

let state: RunState = createRun(hashSeed('prototype'), config, deps)
let layout: BoardLayout = layoutBoard(1, 1, config.gridSize)
let slots: SlotView[] = []
let clearing = new Map<number, number>()
let floats: FloatText[] = []
let armedSlot: number | null = null
let dragSlot: number | null = null
let pointerX = 0
let pointerY = 0
let ghost: { slot: number; ox: number; oy: number; valid: boolean } | null = null
let busy = false

let boardPad = 12

function resize(): void {
  const stage = canvas.parentElement
  const width = Math.max(1, Math.floor(stage?.getBoundingClientRect().width ?? window.innerWidth))
  const height = Math.max(1, Math.floor(stage?.getBoundingClientRect().height ?? window.innerHeight))
  const dpr = Math.min(2, window.devicePixelRatio || 1)

  boardPad = Math.max(8, Math.min(16, Math.round(width * 0.035)))
  layout = layoutBoard(width, height, config.gridSize, boardPad)

  const canvasPx = layout.cell * config.gridSize + boardPad * 2
  canvas.width = Math.floor(canvasPx * dpr)
  canvas.height = Math.floor(canvasPx * dpr)
  canvas.style.width = `${canvasPx}px`
  canvas.style.height = `${canvasPx}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  layout = { cell: layout.cell, size: layout.size, originX: boardPad, originY: boardPad }
  buildHand()
}

function buildHand(): void {
  const available = Math.max(1, Math.floor((handEl.clientWidth || layout.cell * state.handSize) / state.handSize))
  const cell = Math.max(16, Math.min(Math.floor((available - 26) / state.handSize), Math.floor(layout.cell * 0.82)))
  handEl.replaceChildren()
  slots = state.pieces.map((piece, index) => {
    const root = document.createElement('div')
    root.className = 'slot'
    const width = (piece?.w ?? 1) * cell
    const height = (piece?.h ?? 1) * cell
    const mini = document.createElement('canvas')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    mini.width = Math.max(1, Math.floor(width * dpr))
    mini.height = Math.max(1, Math.floor(height * dpr))
    mini.style.width = `${width}px`
    mini.style.height = `${height}px`
    const miniContext = mini.getContext('2d')
    if (!miniContext) throw new Error('hand canvas context unavailable')
    const miniCtx: CanvasRenderingContext2D = miniContext
    miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    root.append(mini)
    root.dataset.slot = String(index)
    handEl.append(root)
    const view: SlotView = { root, canvas: mini, ctx: miniCtx, cell }
    paintSlot(view, index)
    attachSlotInput(root, index)
    return view
  })
}

function paintSlot(view: SlotView, index: number): void {
  const piece = state.pieces[index]
  view.ctx.clearRect(0, 0, view.canvas.width, view.canvas.height)
  if (!piece) {
    view.root.classList.add('spent')
    view.root.classList.remove('armed')
    return
  }
  view.root.classList.remove('spent')
  view.root.classList.toggle('armed', armedSlot === index)
  drawPiece(view.ctx, piece, 0, 0, view.cell)
}

function repaintHand(): void {
  slots.forEach((view, index) => paintSlot(view, index))
}

function attachSlotInput(root: HTMLDivElement, index: number): void {
  root.addEventListener('pointerdown', event => {
    event.preventDefault()
    audio.unlock()
    const piece = state.pieces[index]
    if (!piece || busy || state.phase !== 'playing') return
    root.setPointerCapture(event.pointerId)

    if (armedSlot === index) {
      rotateSlot(index)
      return
    }

    armedSlot = index
    dragSlot = index
    pointerX = event.clientX
    pointerY = event.clientY
    ghost = null
    repaintHand()
  })

  root.addEventListener('pointermove', event => {
    if (dragSlot !== index) return
    pointerX = event.clientX
    pointerY = event.clientY
    updateGhost()
  })

  const finish = (event: PointerEvent): void => {
    if (dragSlot !== index) return
    event.preventDefault()
    pointerX = event.clientX
    pointerY = event.clientY
    updateGhost()
    const target = ghost
    dragSlot = null
    ghost = null
    if (target && target.valid) commitMove(target.slot, target.ox, target.oy)
  }

  root.addEventListener('pointerup', finish)
  root.addEventListener('pointercancel', () => {
    dragSlot = null
    ghost = null
  })
}

function rotateSlot(index: number): void {
  const piece = state.pieces[index]
  if (!piece) return
  state.pieces[index] = makePiece(piece.defId, piece.color, (((piece.rotation + 1) % 4) as Rotation))
  repaintHand()
  audio.note(0, 0, false)
}

const FINGER_LIFT = 28

function updateGhost(): void {
  if (dragSlot === null) {
    ghost = null
    return
  }
  const piece = state.pieces[dragSlot]
  if (!piece) {
    ghost = null
    return
  }
  const rect = canvas.getBoundingClientRect()
  const localX = pointerX - rect.left - (piece.w * layout.cell) / 2
  const localY = pointerY - rect.top - FINGER_LIFT - (piece.h * layout.cell) / 2
  const ox = Math.round((localX - layout.originX) / layout.cell)
  const oy = Math.round((localY - layout.originY) / layout.cell)
  ghost = { slot: dragSlot, ox, oy, valid: canPlace(state.grid, piece, ox, oy) }
}

canvas.addEventListener('pointerdown', event => {
  event.preventDefault()
  audio.unlock()
  if (armedSlot === null || busy || state.phase !== 'playing') return
  const piece = state.pieces[armedSlot]
  if (!piece) return
  const rect = canvas.getBoundingClientRect()
  const gx = Math.floor((event.clientX - rect.left - layout.originX) / layout.cell)
  const gy = Math.floor((event.clientY - rect.top - layout.originY) / layout.cell)
  const ox = gx
  const oy = gy
  if (!canPlace(state.grid, piece, ox, oy)) return
  commitMove(armedSlot, ox, oy)
})

function commitMove(slot: number, ox: number, oy: number): void {
  const piece = state.pieces[slot]
  if (!piece) return
  const rotation = piece.rotation
  const result = applyMove(state, { slot, x: ox, y: oy, rotation }, config)
  armedSlot = null
  if (!result.ok) {
    if (result.reason === 'forbidden_color') audio.thud()
    return
  }
  reactToEvents(result.events, result.move?.linesCleared ?? 0)
  repaintHand()
  syncHud()

  if (state.phase === 'round_cleared') {
    busy = true
    window.setTimeout(() => {
      busy = false
      openRelicChoice()
    }, 620)
  } else if (state.phase === 'lost') {
    window.setTimeout(showGameOver, 520)
  } else if (state.phase === 'victory') {
    window.setTimeout(showVictory, 520)
  }
}

function reactToEvents(events: ReturnType<typeof applyMove>['events'], lines: number): void {
  if (lines <= 0) return
  const now = performance.now()
  for (const event of events) {
    if (event.type !== 'clear') continue
    const cells = Number(event.data.cells ?? 0)
    void cells
  }
  const center = {
    x: layout.originX + (layout.cell * layout.size) / 2,
    y: layout.originY + (layout.cell * layout.size) / 2,
  }
  for (const event of events) {
    if (event.type === 'clear') {
      const gained = Number(event.data.score ?? 0)
      floats.push({
        x: center.x,
        y: center.y - layout.size * 0.18,
        text: `+${gained}`,
        color: '#ffe9b0',
        born: now,
      })
      const chain = Number(event.data.chain ?? 0)
      audio.note(chain, chain, chain >= 2)
      if (chain >= 3) audio.chord(chain)
    }
    if (event.type === 'combo') {
      const chain = Number(event.data.chain ?? 0)
      floats.push({ x: center.x, y: center.y + layout.size * 0.1, text: `COMBO x${chain}`, color: '#a78bfa', born: now })
    }
  }
  markClearing()
}

function markClearing(): void {
  const cells = state.grid.cells.length
  for (let i = 0; i < cells; i += 1) clearing.set(i, 0)
  window.setTimeout(() => clearing.clear(), CLEAR_MS)
}

function flashBanner(text: string): void {
  bannerEl.textContent = text
  bannerEl.classList.remove('hidden')
  bannerEl.style.animation = 'none'
  void bannerEl.offsetWidth
  bannerEl.style.animation = ''
  window.setTimeout(() => bannerEl.classList.add('hidden'), 900)
}

function syncHud(): void {
  el('round-pill').textContent = `ROUND ${state.round}/${state.totalRounds}`
  el('moves-pill').textContent = `${state.movesLeft} COUPS`
  el('score-value').textContent = state.score.toLocaleString('fr-FR')
  el('mult-value').textContent = `x${(state.multBp / 10000).toFixed(2)}`
  el('mult-value').classList.toggle('hot', state.chain >= 2)
  el('objective-current').textContent = state.roundScore.toLocaleString('fr-FR')
  el('objective-target').textContent = state.objective.toLocaleString('fr-FR')
  const ratio = Math.max(0, Math.min(1, state.roundScore / Math.max(1, state.objective)))
  el('objective-fill').style.width = `${ratio * 100}%`

  const bossPill = el('boss-pill')
  const boss = state.boss ? BOSSES_BY_ID.get(state.boss.id) : undefined
  bossPill.classList.toggle('hidden', !boss)
  if (boss) bossPill.textContent = boss.text.fr.split('—')[0]?.trim() ?? 'BOSS'

  const strip = el('relic-strip')
  strip.replaceChildren()
  for (const relic of state.relics) {
    const chip = document.createElement('span')
    chip.className = 'relic-chip'
    chip.textContent = relic.name.fr
    strip.append(chip)
  }
}

function hideOverlay(): void {
  overlayEl.classList.add('hidden')
  panelEl.replaceChildren()
}

function openRelicChoice(): void {
  const offers = settleRound(state, config, deps)
  panelEl.replaceChildren()

  const title = document.createElement('h2')
  title.textContent = `Round ${state.round} terminé`
  const sub = document.createElement('p')
  sub.className = 'sub'
  const lastBoss = BOSSES_BY_ID.get(state.boss?.id ?? '')
  sub.textContent = lastBoss
    ? `${lastBoss.text.fr} — la prochaine grille l'attend.`
    : `Score du round : ${state.roundScore.toLocaleString('fr-FR')}. Choisis ta relique.`
  panelEl.append(title, sub)

  const list = document.createElement('div')
  list.className = 'choices'
  for (const relic of offers) {
    const button = document.createElement('button')
    button.className = 'choice'
    const name = document.createElement('span')
    name.className = 'name'
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = relic.rarity
    name.append(tag, document.createTextNode(relic.name.fr))
    const desc = document.createElement('span')
    desc.className = 'desc'
    desc.textContent = relic.text.fr
    button.append(name, desc)
    button.addEventListener('click', () => {
      audio.unlock()
      audio.note(3, 2, true)
      chooseRelicAndAdvance(state, relic.id, config, deps)
      hideOverlay()
      afterRoundAdvance()
    })
    list.append(button)
  }
  panelEl.append(list)
  overlayEl.classList.remove('hidden')
}

function afterRoundAdvance(): void {
  const boss = state.boss ? BOSSES_BY_ID.get(state.boss.id) : undefined
  if (boss) {
    flashBanner(boss.text.fr.split('—')[0]?.trim() ?? 'BOSS')
    audio.thud()
  }
  repaintHand()
  syncHud()
}

function showGameOver(): void {
  panelEl.replaceChildren()
  const title = document.createElement('h2')
  title.textContent = 'Run terminée'
  const sub = document.createElement('p')
  sub.className = 'sub'
  sub.textContent = `Grille verrouillée au round ${state.round}.`
  panelEl.append(title, sub, statGrid(), restartButton('Rejouer'))
  overlayEl.classList.remove('hidden')
  audio.thud()
}

function showVictory(): void {
  panelEl.replaceChildren()
  const title = document.createElement('h2')
  title.textContent = 'Run gagnée'
  const sub = document.createElement('p')
  sub.className = 'sub'
  sub.textContent = 'Six rounds, un score absurde.'
  panelEl.append(title, sub, statGrid(), restartButton('Rejouer'))
  overlayEl.classList.remove('hidden')
  audio.chord(4)
}

function statGrid(): HTMLElement {
  const grid = document.createElement('div')
  grid.className = 'stat-grid'
  const stats: [string, string][] = [
    [state.score.toLocaleString('fr-FR'), 'Éclats'],
    [`x${(state.multBp / 10000).toFixed(2)}`, 'Multiplicateur'],
    [String(state.bestChain), 'Meilleur combo'],
  ]
  for (const [value, key] of stats) {
    const cell = document.createElement('div')
    cell.className = 'stat'
    const v = document.createElement('span')
    v.className = 'v'
    v.textContent = value
    const k = document.createElement('span')
    k.className = 'k'
    k.textContent = key
    cell.append(v, k)
    grid.append(cell)
  }
  return grid
}

function restartButton(label: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = 'btn'
  button.textContent = label
  button.addEventListener('click', () => {
    state = createRun(Math.floor(Math.random() * 0x7fffffff), config, deps)
    clearing.clear()
    floats = []
    armedSlot = null
    hideOverlay()
    buildHand()
    syncHud()
    flashBanner(`ROUND 1`)
  })
  return button
}

function frame(now: number): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  drawBoard(ctx, state.grid, layout, clearing)

  if (ghost) {
    const piece = state.pieces[ghost.slot]
    if (piece) {
      drawGhost(ctx, layout, ghost.ox, ghost.oy, piece, ghost.valid)
      if (dragSlot !== null) {
        const rect = canvas.getBoundingClientRect()
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        drawPiece(
          ctx,
          piece,
          (pointerX - rect.left) * dpr - (piece.w * layout.cell) / 2,
          (pointerY - rect.top) * dpr - FINGER_LIFT - (piece.h * layout.cell) / 2,
          layout.cell,
          0.92,
        )
      }
    }
  }

  floats = floats.filter(f => now - f.born < FLOAT_MS)
  for (const f of floats) {
    const t = (now - f.born) / FLOAT_MS
    ctx.save()
    ctx.globalAlpha = 1 - t * t
    ctx.font = `800 ${Math.round(layout.cell * 0.62)}px ui-rounded, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = f.color
    ctx.shadowColor = 'rgba(0,0,0,0.65)'
    ctx.shadowBlur = 10
    ctx.fillText(f.text, f.x, f.y - t * layout.cell * 1.1)
    ctx.restore()
  }

  requestAnimationFrame(frame)
}

window.addEventListener('resize', () => resize())
window.addEventListener('orientationchange', () => window.setTimeout(resize, 220))
document.addEventListener('contextmenu', event => event.preventDefault())

resize()
syncHud()
requestAnimationFrame(frame)

window.addEventListener('keydown', event => {
  if (event.key === 'm' || event.key === 'M') {
    audio.unlock()
    audio.setMuted(!audio.isMuted)
  }
  void RELICS_BY_ID
})

document.documentElement.dataset.ready = 'true'

declare global {
  interface Window {
    shardline?: {
      layout: () => { originX: number; originY: number; cell: number; fingerLift: number }
      canPlaceAt: (slot: number, x: number, y: number) => boolean
      setObjective: (value: number) => void
      pieceAt: (slot: number) => { w: number; h: number; defId: string; rotation: number } | null
      read: () => { round: number; score: number; phase: string; relics: string[] }
    }
  }
}

window.shardline = {
  layout: () => ({ originX: layout.originX, originY: layout.originY, cell: layout.cell, fingerLift: FINGER_LIFT }),
  canPlaceAt: (slot: number, x: number, y: number) => {
    const piece = state.pieces[slot]
    return piece ? canPlace(state.grid, piece, x, y) : false
  },
  setObjective: (value: number) => {
    state.objective = Math.max(1, Math.floor(value))
    syncHud()
  },
  pieceAt: (slot: number) => {
    const piece = state.pieces[slot]
    return piece ? { w: piece.w, h: piece.h, defId: piece.defId, rotation: piece.rotation } : null
  },
  read: () => ({ round: state.round, score: state.score, phase: state.phase, relics: state.relics.map(r => r.id) }),
}

export type {}