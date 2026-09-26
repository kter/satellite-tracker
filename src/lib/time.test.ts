import { describe, it, expect } from 'vitest'
import {
  makeClock,
  simNow,
  setMultiplier,
  setPaused,
  resetToNow,
  clockFromSync,
  clockSyncAt,
  MULTIPLIERS,
} from './time'

const T0_SIM = 1_700_000_000_000
const T0_REAL = 10_000

describe('SimClock', () => {
  it('advances 1:1 at multiplier 1', () => {
    const c = makeClock(T0_SIM, T0_REAL)
    expect(simNow(c, T0_REAL + 5000)).toBe(T0_SIM + 5000)
  })

  it('advances 600x at multiplier 600', () => {
    let c = makeClock(T0_SIM, T0_REAL)
    c = setMultiplier(c, 600, T0_REAL)
    expect(simNow(c, T0_REAL + 1000)).toBe(T0_SIM + 600_000)
  })

  it('does not jump when the multiplier changes mid-flight (rebase continuity)', () => {
    let c = makeClock(T0_SIM, T0_REAL)
    const atChange = simNow(c, T0_REAL + 3000)
    c = setMultiplier(c, 60, T0_REAL + 3000)
    expect(simNow(c, T0_REAL + 3000)).toBe(atChange)
    expect(simNow(c, T0_REAL + 4000)).toBe(atChange + 60_000)
  })

  it('freezes while paused and resumes without a jump', () => {
    let c = makeClock(T0_SIM, T0_REAL)
    c = setPaused(c, true, T0_REAL + 1000)
    const frozen = simNow(c, T0_REAL + 1000)
    expect(simNow(c, T0_REAL + 99_000)).toBe(frozen)
    c = setPaused(c, false, T0_REAL + 99_000)
    expect(simNow(c, T0_REAL + 99_000)).toBe(frozen)
    expect(simNow(c, T0_REAL + 100_000)).toBe(frozen + 1000)
  })

  it('pause rebases first, so time before the pause is kept', () => {
    let c = makeClock(T0_SIM, T0_REAL)
    c = setMultiplier(c, 10, T0_REAL)
    c = setPaused(c, true, T0_REAL + 1000)
    expect(simNow(c, T0_REAL + 5000)).toBe(T0_SIM + 10_000)
  })

  it('resetToNow jumps back to real time, keeping the multiplier', () => {
    let c = makeClock(T0_SIM, T0_REAL)
    c = setMultiplier(c, 600, T0_REAL)
    c = resetToNow(c, T0_SIM + 42, T0_REAL + 8000)
    expect(simNow(c, T0_REAL + 8000)).toBe(T0_SIM + 42)
    expect(c.multiplier).toBe(600)
  })

  it('exposes the expected multiplier presets', () => {
    expect([...MULTIPLIERS]).toEqual([1, 10, 60, 600])
  })
})

describe('ClockSync', () => {
  it('roundtrips a clock through its wire form without a jump', () => {
    let c = makeClock(T0_SIM, T0_REAL)
    c = setMultiplier(c, 60, T0_REAL)
    const sync = clockSyncAt(c, T0_REAL + 1000)
    expect(sync).toEqual({ simTimeMs: T0_SIM + 60_000, multiplier: 60, paused: false })
    const mirrored = clockFromSync(sync, 5)
    expect(simNow(mirrored, 5 + 1000)).toBe(T0_SIM + 120_000)
  })

  it('keeps a paused mirror frozen', () => {
    const mirrored = clockFromSync({ simTimeMs: T0_SIM, multiplier: 600, paused: true }, 0)
    expect(simNow(mirrored, 99_999)).toBe(T0_SIM)
  })
})
