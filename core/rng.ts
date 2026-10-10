const MASK = 0xffffffff

export interface Rng {
  state: number
  next(): number
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  weightedIndex(weights: readonly number[]): number
  fork(salt: number): Rng
  clone(): Rng
}

export function normalizeSeed(seed: number): number {
  const n = Math.floor(seed) >>> 0
  return n === 0 ? 0x9e3779b9 : n
}

export function makeRng(seed: number): Rng {
  let state = normalizeSeed(seed)

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }

  const rng: Rng = {
    state,
    next,
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0
      return next() % maxExclusive
    },
    pick<T>(items: readonly T[]): T {
      const item = items[next() % items.length]
      if (item === undefined) throw new Error('Rng.pick on empty array')
      return item
    },
    weightedIndex(weights: readonly number[]): number {
      let total = 0
      for (const w of weights) total += w
      if (total <= 0) return 0
      let roll = next() % total
      for (let i = 0; i < weights.length; i += 1) {
        roll -= weights[i] as number
        if (roll < 0) return i
      }
      return weights.length - 1
    },
    fork(salt: number): Rng {
      return makeRng((state ^ Math.imul(normalizeSeed(salt), 0x85ebca6b)) >>> 0)
    },
    clone(): Rng {
      return makeRng(state)
    },
  }

  Object.defineProperty(rng, 'state', {
    get: () => state,
    set: (value: number) => {
      state = value >>> 0
    },
    enumerable: true,
  })

  return rng
}

export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const SEED_MASK = MASK