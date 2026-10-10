import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOSSES, RELICS } from '../core/load'
import { prototypeConfig, type RunConfig, type RunDeps } from '../core/run'
import { playRun, type PolicyName } from './bot'
import type { Relic } from '../core/types'

const deps: RunDeps = { bosses: BOSSES, relicPool: RELICS }
const POLICIES: PolicyName[] = ['random', 'greedy', 'heuristic']

interface RunRow {
  policy: PolicyName
  seed: number
  roundsCleared: number
  won: boolean
  score: number
  relics: string[]
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const a = sorted[lo] ?? 0
  const b = sorted[hi] ?? a
  return Math.floor(a + (b - a) * (pos - lo))
}

function runBatch(policy: PolicyName, seeds: number[], config: RunConfig): RunRow[] {
  const rows: RunRow[] = []
  for (const seed of seeds) {
    const outcome = playRun(seed, policy, config, deps)
    rows.push({
      policy,
      seed,
      roundsCleared: outcome.roundsCleared,
      won: outcome.won,
      score: outcome.state.score,
      relics: outcome.state.relics.map(r => r.id),
    })
  }
  return rows
}

function relicTrials(relic: Relic, seeds: number[], config: RunConfig): RunRow[] {
  const forced: RunDeps = { ...deps, forceOffer: relic.id }
  const rows: RunRow[] = []
  for (const seed of seeds) {
    const outcome = playRun(seed, 'heuristic', config, forced, {
      pickRelic: offers => offers.find(r => r.id === relic.id) ?? null,
    })
    rows.push({
      policy: 'heuristic',
      seed,
      roundsCleared: outcome.roundsCleared,
      won: outcome.won,
      score: outcome.state.score,
      relics: outcome.state.relics.map(r => r.id),
    })
  }
  return rows
}

interface Summary {
  runs: number
  meanScore: number
  medianScore: number
  p90Score: number
  maxScore: number
  medianRounds: number
  victoryRateBp: number
}

function controlTrials(seeds: number[], config: RunConfig): RunRow[] {
  const rows: RunRow[] = []
  for (const seed of seeds) {
    const outcome = playRun(seed, 'heuristic', config, deps, { pickRelic: () => null })
    rows.push({
      policy: 'heuristic',
      seed,
      roundsCleared: outcome.roundsCleared,
      won: outcome.won,
      score: outcome.state.score,
      relics: outcome.state.relics.map(r => r.id),
    })
  }
  return rows
}

function summarize(rows: readonly RunRow[]): Summary {
  const scores = rows.map(r => r.score).sort((a, b) => a - b)
  const rounds = rows.map(r => r.roundsCleared).sort((a, b) => a - b)
  const wins = rows.filter(r => r.won).length
  return {
    runs: rows.length,
    meanScore: Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)),
    medianScore: quantile(scores, 0.5),
    p90Score: quantile(scores, 0.9),
    maxScore: scores[scores.length - 1] ?? 0,
    medianRounds: quantile(rounds, 0.5),
    victoryRateBp: Math.round((wins / Math.max(1, rows.length)) * 10000),
  }
}

function csvEscape(value: string | number): string {
  const s = String(value)
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: readonly (string | number)[][]): string {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n'
}

export interface SimOptions {
  runs?: number
  config?: RunConfig
  outDir?: string
}

export function simulate(options: SimOptions = {}): string {
  const runs = options.runs ?? 120
  const config = options.config ?? prototypeConfig()
  const seeds = Array.from({ length: runs }, (_, i) => i + 1)
  const outDir = options.outDir ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'reports')

  const all: RunRow[] = []
  for (const policy of POLICIES) all.push(...runBatch(policy, seeds, config))

  const perRunRows: (string | number)[][] = [['policy', 'seed', 'rounds_cleared', 'won', 'score', 'relics']]
  for (const r of all) perRunRows.push([r.policy, r.seed, r.roundsCleared, r.won ? 1 : 0, r.score, r.relics.join('|')])

  const summaryRows: (string | number)[][] = [['policy', 'runs', 'meanScore', 'medianScore', 'p90Score', 'maxScore', 'medianRounds', 'victoryRateBp']]
  for (const policy of POLICIES) {
    const s = summarize(all.filter(r => r.policy === policy))
    summaryRows.push([
      policy,
      s.runs,
      s.meanScore,
      s.medianScore,
      s.p90Score,
      s.maxScore,
      s.medianRounds,
      s.victoryRateBp,
    ])
  }

  const baseline = summarize(all.filter(r => r.policy === 'heuristic'))
  const control = summarize(controlTrials(seeds, config))
  const relicRows: (string | number)[][] = [
    ['relic_id', 'archetype', 'rarity', 'mean_score', 'median_score', 'score_delta_bp', 'median_rounds', 'flag'],
  ]
  const flagged: string[] = []
  const meanScore = control.meanScore || 1

  for (const relic of RELICS) {
    const rows = relicTrials(relic, seeds, config)
    const s = summarize(rows)
    const deltaBp = Math.round(((s.meanScore - meanScore) / meanScore) * 10000)
    const flag = deltaBp > 2500 ? 'over_25pct' : deltaBp < -2500 ? 'under_performing' : 'ok'
    if (flag !== 'ok') flagged.push(`${relic.id} (${(deltaBp / 100).toFixed(1)}%)`)
    relicRows.push([relic.id, relic.archetype, relic.rarity, s.meanScore, s.medianScore, deltaBp, s.medianRounds, flag])
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'balance_runs.csv'), toCsv(perRunRows))
  writeFileSync(resolve(outDir, 'balance_summary.csv'), toCsv(summaryRows))
  writeFileSync(resolve(outDir, 'balance_relics.csv'), toCsv(relicRows))

  const lines: string[] = []
  lines.push('SHARDLINE balance report')
  lines.push(`config: ${config.totalRounds} rounds, ${config.baseMoves}+${config.movesPerRound} moves/round, objective ${config.objectiveBase}x${config.objectiveGrowth}`)
  lines.push(`runs per policy: ${runs}`)
  lines.push('')
  for (const policy of POLICIES) {
    const s = summarize(all.filter(r => r.policy === policy))
    lines.push(
      `${policy.padEnd(10)} median=${String(s.medianScore).padStart(7)} p90=${String(s.p90Score).padStart(7)} max=${String(s.maxScore).padStart(7)} medianRounds=${String(s.medianRounds).padStart(2)} victory=${((Number(s.victoryRateBp) / 100).toFixed(1) + '%').padStart(6)}`,
    )
  }
  lines.push('')
  lines.push('targets')
  const medianRounds = baseline.medianRounds
  const targetRound = Math.round(config.totalRounds * 0.65)
  lines.push(
    `  median run reaches round ${medianRounds} (target ${targetRound} of ${config.totalRounds}) -> ${
      Math.abs(medianRounds - targetRound) <= 1 ? 'PASS' : 'TUNE'
    }`,
  )
  lines.push(`  control mean score ${control.meanScore} with no relic taken; deltas are relic vs nothing`)
  lines.push('')
  lines.push(`relics outside +/-25% of median: ${flagged.length === 0 ? 'none' : flagged.join(', ')}`)
  lines.push('')
  lines.push(`csv written to ${outDir}`)

  return lines.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURLSafe(process.argv[1])) {
  const runsArg = process.argv.find(a => a.startsWith('--runs='))
  const runs = runsArg ? Number(runsArg.split('=')[1]) : undefined
  console.log(simulate({ runs }))
}

function pathToFileURLSafe(p: string): string {
  return new URL(`file://${resolve(p)}`).href
}