export const MULTIPLIERS = [1, 10, 60, 600] as const
export type Multiplier = (typeof MULTIPLIERS)[number]

export interface ClockState {
  /** simulation epoch (ms since Unix epoch) at the moment of the last rebase */
  baseSimMs: number
  /** wall-clock reference (performance.now() style) at the last rebase */
  baseRealMs: number
  multiplier: number
  paused: boolean
}

export function makeClock(nowSimMs: number, nowRealMs: number): ClockState {
  return { baseSimMs: nowSimMs, baseRealMs: nowRealMs, multiplier: 1, paused: false }
}

/** Current simulation time. Pure: pass the current wall clock in. */
export function simNow(c: ClockState, nowRealMs: number): number {
  if (c.paused) return c.baseSimMs
  return c.baseSimMs + (nowRealMs - c.baseRealMs) * c.multiplier
}

/** Rebase so sim time is continuous across multiplier/pause changes. */
function rebase(c: ClockState, nowRealMs: number): ClockState {
  return { ...c, baseSimMs: simNow(c, nowRealMs), baseRealMs: nowRealMs }
}

export function setMultiplier(c: ClockState, multiplier: number, nowRealMs: number): ClockState {
  return { ...rebase(c, nowRealMs), multiplier }
}

export function setPaused(c: ClockState, paused: boolean, nowRealMs: number): ClockState {
  return { ...rebase(c, nowRealMs), paused }
}

/** Jump back to real time (multiplier preserved). */
export function resetToNow(c: ClockState, nowSimMs: number, nowRealMs: number): ClockState {
  return { ...c, baseSimMs: nowSimMs, baseRealMs: nowRealMs }
}
