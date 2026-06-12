import { describe, it, expect } from 'vitest'
import { pickQualityTier, satBudget, dprFor, applyBudget } from './device'

describe('pickQualityTier', () => {
  it('high for a desktop with plenty of memory', () => {
    expect(
      pickQualityTier({ deviceMemoryGb: 16, hardwareConcurrency: 12, isCoarsePointer: false }),
    ).toBe('high')
  })

  it('medium for a touch device with decent memory', () => {
    expect(
      pickQualityTier({ deviceMemoryGb: 8, hardwareConcurrency: 8, isCoarsePointer: true }),
    ).toBe('medium')
  })

  it('low for low-memory devices', () => {
    expect(
      pickQualityTier({ deviceMemoryGb: 2, hardwareConcurrency: 8, isCoarsePointer: true }),
    ).toBe('low')
  })

  it('low for few cores', () => {
    expect(
      pickQualityTier({
        deviceMemoryGb: undefined,
        hardwareConcurrency: 4,
        isCoarsePointer: false,
      }),
    ).toBe('low')
  })

  it('high when memory is unreported on a fine-pointer device (Safari/Firefox desktop)', () => {
    expect(
      pickQualityTier({
        deviceMemoryGb: undefined,
        hardwareConcurrency: 10,
        isCoarsePointer: false,
      }),
    ).toBe('high')
  })
})

describe('satBudget / dprFor', () => {
  it('budgets shrink with the tier', () => {
    expect(satBudget('high')).toBe(Infinity)
    expect(satBudget('medium')).toBe(5000)
    expect(satBudget('low')).toBe(2000)
  })

  it('clamps dpr per tier', () => {
    expect(dprFor('high', 3)).toBe(2)
    expect(dprFor('medium', 3)).toBe(1.5)
    expect(dprFor('low', 3)).toBe(1)
    expect(dprFor('high', 1)).toBe(1)
  })
})

describe('applyBudget', () => {
  const make = (category: string, n: number) => Array.from({ length: n }, () => ({ category }))

  it('returns everything when under budget', () => {
    const sats = [...make('stations', 10), ...make('other', 10)]
    expect(applyBudget(sats, 100)).toHaveLength(20)
  })

  it('drops "other" first', () => {
    const sats = [...make('stations', 50), ...make('starlink', 50), ...make('other', 100)]
    const out = applyBudget(sats, 120)
    expect(out.filter((s) => s.category === 'stations')).toHaveLength(50)
    expect(out.filter((s) => s.category === 'starlink')).toHaveLength(50)
    expect(out.filter((s) => s.category === 'other')).toHaveLength(20)
  })

  it('thins starlink when still over budget, keeping all other categories', () => {
    const sats = [
      ...make('stations', 100),
      ...make('navigation', 100),
      ...make('starlink', 5000),
      ...make('other', 3000),
    ]
    const out = applyBudget(sats, 1000)
    expect(out.length).toBeLessThanOrEqual(1000)
    expect(out.filter((s) => s.category === 'stations')).toHaveLength(100)
    expect(out.filter((s) => s.category === 'navigation')).toHaveLength(100)
    expect(out.filter((s) => s.category === 'other')).toHaveLength(0)
    expect(out.filter((s) => s.category === 'starlink').length).toBeGreaterThan(0)
  })

  it('never exceeds the budget', () => {
    const sats = [...make('starlink', 9000), ...make('other', 4000)]
    expect(applyBudget(sats, 2000).length).toBeLessThanOrEqual(2000)
  })
})
