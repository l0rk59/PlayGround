import type { Archetype, BossRule, BossKind, ColorId, Condition, Effect, Rarity, Relic, Trigger } from './types'
import relicsRaw from '../data/relics.json'
import bossesRaw from '../data/bosses.json'

const TRIGGERS: Trigger[] = ['on_place', 'on_clear', 'on_combo', 'on_round_start', 'on_round_end']
const ARCHETYPES: Archetype[] = ['cascade', 'citadel', 'prism', 'joker', 'architect', 'dynamite']
const RARITIES: Rarity[] = ['common', 'rare', 'legendary']
const BOSS_KINDS: BossKind[] = [
  'frozen_cells',
  'forbidden_color',
  'rotating_pieces',
  'sparse_bag',
  'low_shards',
  'narrow_lines',
]

function requireField(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid object at ${path}`)
  }
  return value as Record<string, unknown>
}

function requireInt(value: unknown, path: string): number {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new Error(`Expected integer at ${path}`)
  return n
}

function parseCondition(raw: unknown, path: string): Condition {
  const obj = requireField(raw, path)
  const kind = obj.kind
  switch (kind) {
    case 'none':
      return { kind: 'none' }
    case 'min_lines':
    case 'min_chain':
    case 'empty_cells_at_least':
    case 'empty_cells_at_most':
      return { kind, value: requireInt(obj.value, `${path}.value`) } as Condition
    case 'line_mono':
      return { kind: 'line_mono' }
    case 'line_color': {
      const color = requireInt(obj.color, `${path}.color`)
      if (color < 0 || color > 4) throw new Error(`Color out of range at ${path}.color`)
      return { kind: 'line_color', color: color as ColorId }
    }
    default:
      throw new Error(`Unknown condition kind at ${path}: ${String(kind)}`)
  }
}

function parseEffect(raw: unknown, path: string): Effect {
  const obj = requireField(raw, path)
  const kind = obj.kind
  switch (kind) {
    case 'add_shards':
    case 'add_mult':
    case 'add_shards_per_empty':
      return { kind, value: requireInt(obj.value, `${path}.value`) } as Effect
    case 'mul_mult':
      return { kind: 'mul_mult', valueBp: requireInt(obj.valueBp, `${path}.valueBp`) }
    case 'replay_last_clear':
    case 'freeze_random_cell':
    case 'transform_random_piece':
    case 'heal_free_cells':
      return { kind } as Effect
    default:
      throw new Error(`Unknown effect kind at ${path}: ${String(kind)}`)
  }
}

function parseRelic(raw: unknown, index: number): Relic {
  const path = `relics[${index}]`
  const obj = requireField(raw, path)
  const id = obj.id
  const archetype = obj.archetype as Archetype
  const rarity = obj.rarity as Rarity
  const trigger = obj.trigger as Trigger
  if (typeof id !== 'string' || id.length === 0) throw new Error(`Missing id at ${path}`)
  if (!ARCHETYPES.includes(archetype)) throw new Error(`Unknown archetype at ${path}: ${String(archetype)}`)
  if (!RARITIES.includes(rarity)) throw new Error(`Unknown rarity at ${path}: ${String(rarity)}`)
  if (!TRIGGERS.includes(trigger)) throw new Error(`Unknown trigger at ${path}: ${String(trigger)}`)
  const text = requireField(obj.text, `${path}.text`)
  const name = requireField(obj.name, `${path}.name`)
  return {
    id,
    name: { fr: String(name.fr ?? ''), en: String(name.en ?? '') },
    archetype,
    rarity,
    trigger,
    condition: parseCondition(obj.condition, `${path}.condition`),
    effect: parseEffect(obj.effect, `${path}.effect`),
    text: { fr: String(text.fr ?? ''), en: String(text.en ?? '') },
  }
}

function parseBoss(raw: unknown, index: number): BossRule {
  const path = `bosses[${index}]`
  const obj = requireField(raw, path)
  const id = obj.id
  const kind = obj.kind as BossKind
  if (typeof id !== 'string' || id.length === 0) throw new Error(`Missing id at ${path}`)
  if (!BOSS_KINDS.includes(kind)) throw new Error(`Unknown boss kind at ${path}: ${String(kind)}`)
  const text = requireField(obj.text, `${path}.text`)
  const color = obj.color === null || obj.color === undefined ? null : (requireInt(obj.color, `${path}.color`) as BossRule['color'])
  return {
    id,
    kind,
    param: requireInt(obj.param ?? 0, `${path}.param`),
    color,
    text: { fr: String(text.fr ?? ''), en: String(text.en ?? '') },
  }
}

export const RELICS: Relic[] = (relicsRaw as { relics: unknown[] }).relics.map(parseRelic)
export const BOSSES: BossRule[] = (bossesRaw as { bosses: unknown[] }).bosses.map(parseBoss)

const RELIC_IDS = new Set<string>()
for (const relic of RELICS) {
  if (RELIC_IDS.has(relic.id)) throw new Error(`Duplicate relic id: ${relic.id}`)
  RELIC_IDS.add(relic.id)
}

export const RELIC_POOL: Relic[] = RELICS
export const BOSS_POOL: BossRule[] = BOSSES