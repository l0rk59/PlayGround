import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
const config = JSON.parse(readFileSync(join(runtime, 'linux.json'), 'utf8'))
process.env.DISPLAY = ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()

const url = process.env.VERIFY_URL ?? 'http://localhost:3000'
const out = process.env.VERIFY_DIR ?? 'screenshots'
const errors = []

const browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 })

async function open(viewport) {
  const page = await browser.newPage({ viewport, hasTouch: true, isMobile: viewport.width < 700 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#hand .slot', { timeout: 20000 })
  await page.waitForTimeout(350)
  return page
}

const read = async page => ({
  moves: await page.textContent('#moves-pill'),
  score: await page.textContent('#score-value'),
  round: await page.textContent('#round-pill'),
  boss: await page.locator('#boss-pill').isVisible(),
  mult: await page.textContent('#mult-value'),
  objective: await page.textContent('#objective-current'),
})

const cellPoint = (board, x, y, piece, geo) => {
  const px = board.x + geo.originX + (x + piece.w / 2) * geo.cell
  const py = board.y + geo.originY + (y + piece.h / 2) * geo.cell + geo.fingerLift
  return [px, py]
}

const drag = async (page, slotIndex, gx, gy) => {
  const slot = page.locator('#hand .slot').nth(slotIndex)
  const box = await slot.boundingBox()
  const board = await page.locator('#board').boundingBox()
  if (!box || !board) return false
  const before = await page.textContent('#moves-pill')
  const piece = await page.evaluate(i => window.shardline.pieceAt(i), slotIndex)
  const geo = await page.evaluate(() => window.shardline.layout())
  if (!piece || !geo) return false
  const [px, py] = cellPoint(board, gx, gy, piece, geo)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(px, py, { steps: 14 })
  await page.waitForTimeout(110)
  await page.screenshot({ path: join(out, 'drag-ghost.png') })
  await page.mouse.up()
  await page.waitForTimeout(170)
  return (await page.textContent('#moves-pill')) !== before
}

const a = await open({ width: 390, height: 844 })
const beforeA = await read(a)
const dragged = await drag(a, 0, 2, 2)
const afterA = await read(a)
console.log('drag test', JSON.stringify({ before: beforeA, after: afterA, placed: dragged }))
console.log(dragged ? 'PASS pointer drag places a piece' : 'FAIL pointer drag did not move anything')
await a.close()

const b = await open({ width: 390, height: 844 })
const boardB = await b.locator('#board').boundingBox()
const plan = JSON.parse(readFileSync(join(process.cwd(), 'reports/plan.json'), 'utf8'))
let played = 0
let relicPicks = 0
let roundAdvanced = 0

for (const step of plan.rounds) {
  for (const move of step.moves) {
    if (await b.locator('#overlay').isVisible()) break
    if (!(await drag(b, move.slot, move.x, move.y))) break
    played++
  }
  if (await b.locator('#overlay').isVisible()) {
    const choices = await b.locator('#overlay .choice').count()
    console.log(`round ${step.round} cleared: overlay shows ${choices} relic choices`)
    if (choices !== 3) errors.push(`expected 3 relic choices, saw ${choices}`)
    await b.screenshot({ path: join(out, 'relic-choice.png') })
    if (step.relicChoice) {
      const label = await b.locator('#overlay .choice').first().textContent()
      await b.locator('#overlay .choice').first().click()
      relicPicks++
      console.log(`  picked "${String(label).slice(0, 40).trim()}"`)
    }
    await b.waitForTimeout(420)
    const now = await read(b)
    console.log(`  now: ${JSON.stringify(now)}`)
    if (Number(String(now.round).replace(/[^0-9]/g, '')) > step.round) roundAdvanced++
  }
}

await b.waitForTimeout(400)

await b.evaluate(() => window.shardline.setObjective(10))
for (const move of plan.rounds[0].moves) {
  if (await b.locator('#overlay').isVisible()) break
  await drag(b, move.slot, move.x, move.y)
}
await b.waitForTimeout(900)
if (await b.locator('#overlay').isVisible()) {
  const choices = await b.locator('#overlay .choice').count()
  console.log(`forced round clear: overlay shows ${choices} relic choices`)
  if (choices !== 3) errors.push(`expected 3 relic choices, saw ${choices}`)
  await b.screenshot({ path: join(out, 'relic-choice.png') })
  const label = await b.locator('#overlay .choice').first().textContent()
  await b.locator('#overlay .choice').first().click()
  relicPicks++
  await b.waitForTimeout(500)
  const after = await read(b)
  console.log(`picked "${String(label).replace(/\s+/g, ' ').trim().slice(0, 48)}" -> ${JSON.stringify(after)}`)
  const afterState = await b.evaluate(() => window.shardline.read())
  console.log('engine state after pick', JSON.stringify(afterState))
  if (afterState.round > 1) roundAdvanced++
  if (afterState.relics.length === 0) errors.push('relic was not added to the run')
  if (afterState.round <= 1) errors.push('round did not advance after the relic pick')
}

const finalB = await read(b)
console.log('full run', JSON.stringify(finalB), `played ${played} moves, ${relicPicks} relic picks`)
await b.screenshot({ path: join(out, 'mobile-progress.png') })

const score = Number(String(finalB.score).replace(/[^\d]/g, ''))
console.log(score > 0 ? `PASS scoring works (${score} eclairats)` : 'FAIL score never moved')
console.log(relicPicks > 0 ? `PASS relic choice and round advance work (${roundAdvanced} advances)` : 'FAIL no round ever completed in the browser')
await b.close()

const desktop = await open({ width: 1440, height: 900 })
const planD = JSON.parse(readFileSync(join(process.cwd(), 'reports/plan.json'), 'utf8'))
for (const move of planD.rounds[0]?.moves.slice(0, 6) ?? []) await drag(desktop, move.slot, move.x, move.y)
await desktop.waitForTimeout(400)
await desktop.screenshot({ path: join(out, 'desktop-played.png') })
console.log('desktop', JSON.stringify(await read(desktop)))
await desktop.close()

console.log(errors.length ? `CONSOLE ERRORS: ${JSON.stringify(errors)}` : 'no console errors')
await browser.close()
process.exit(errors.length || !dragged || score <= 0 || relicPicks === 0 ? 1 : 0)