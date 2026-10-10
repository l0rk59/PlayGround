import { describe, expect, it } from 'vitest'
import { hashSeed, makeRng } from '../core/rng'

describe('rng', () => {
  it('produces an identical stream for an identical seed', () => {
    const a = makeRng(1234)
    const b = makeRng(1234)
    for (let i = 0; i < 500; i += 1) expect(a.next()).toBe(b.next())
  })

  it('produces different streams for different seeds', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    let differences = 0
    for (let i = 0; i < 200; i += 1) if (a.next() !== b.next()) differences += 1
    expect(differences).toBeGreaterThan(150)
  })

  it('never returns a negative int for a positive bound', () => {
    const rng = makeRng(99)
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.int(10)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(10)
    }
  })

  it('returns 0 for a non-positive bound instead of throwing', () => {
    const rng = makeRng(7)
    expect(rng.int(0)).toBe(0)
    expect(rng.int(-3)).toBe(0)
  })

  it('distributes weighted picks roughly proportionally', () => {
    const rng = makeRng(4242)
    const counts = [0, 0, 0]
    const weights = [1, 3, 6]
    for (let i = 0; i < 20000; i += 1) {
      const at = rng.weightedIndex(weights)
      counts[at] = (counts[at] ?? 0) + 1
    }
    expect(counts[0]).toBeGreaterThan(1500)
    expect(counts[2]).toBeGreaterThan(counts[1] as number)
    expect(counts[1]).toBeGreaterThan(counts[0] as number)
  })

  it('returns the only element when the pool has one item', () => {
    const rng = makeRng(5)
    for (let i = 0; i < 50; i += 1) expect(rng.pick(['only'])).toBe('only')
  })

  it('clones carry the same state', () => {
    const a = makeRng(555)
    a.next()
    const b = a.clone()
    expect(b.next()).toBe(a.next())
  })

  it('normalizes a zero seed away from the degenerate state', () => {
    expect(makeRng(0).state).not.toBe(0)
  })

  it('hashes strings deterministically and distinctly', () => {
    expect(hashSeed('2026-10-10')).toBe(hashSeed('2026-10-10'))
    expect(hashSeed('2026-10-10')).not.toBe(hashSeed('2026-10-11'))
  })
})