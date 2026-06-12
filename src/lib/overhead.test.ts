import { describe, it, expect } from 'vitest'
import { computeOverheadFlags, SIN_MIN_ELEVATION, MIN_ELEVATION_DEG } from './overhead'
import { latLonToScene, tangentBasis, EARTH_RADIUS_UNITS } from './geo'

function buildPositions(points: number[][]): Float32Array {
  const out = new Float32Array(points.length * 3)
  points.forEach((p, i) => out.set(p, i * 3))
  return out
}

describe('computeOverheadFlags', () => {
  const p = latLonToScene(35.68, 139.77) // Tokyo
  const { up, north } = tangentBasis(p)

  function atElevation(elevDeg: number, rangeUnits = 0.6): number[] {
    // a point at the given elevation angle from the observer, toward north
    const e = (elevDeg * Math.PI) / 180
    return [
      p[0] + (up[0] * Math.sin(e) + north[0] * Math.cos(e)) * rangeUnits,
      p[1] + (up[1] * Math.sin(e) + north[1] * Math.cos(e)) * rangeUnits,
      p[2] + (up[2] * Math.sin(e) + north[2] * Math.cos(e)) * rangeUnits,
    ]
  }

  it('flags a satellite at the zenith', () => {
    const positions = buildPositions([atElevation(90)])
    const out = new Uint8Array(1)
    expect(computeOverheadFlags(positions, 1, p, out)).toBe(1)
    expect(out[0]).toBe(1)
  })

  it('rejects a satellite on the opposite side of the Earth', () => {
    const antipode = latLonToScene(-35.68, -40.23, 550)
    const positions = buildPositions([antipode])
    const out = new Uint8Array(1)
    expect(computeOverheadFlags(positions, 1, p, out)).toBe(0)
    expect(out[0]).toBe(0)
  })

  it('respects the elevation threshold boundary on both sides', () => {
    const justAbove = atElevation(MIN_ELEVATION_DEG + 1)
    const justBelow = atElevation(MIN_ELEVATION_DEG - 1)
    const positions = buildPositions([justAbove, justBelow])
    const out = new Uint8Array(2)
    expect(computeOverheadFlags(positions, 2, p, out)).toBe(1)
    expect(out[0]).toBe(1)
    expect(out[1]).toBe(0)
  })

  it('counts across a large buffer and only flags the overhead ones', () => {
    const pts: number[][] = []
    for (let i = 0; i < 100; i++) pts.push(atElevation(i < 30 ? 45 : 5))
    const positions = buildPositions(pts)
    const out = new Uint8Array(100)
    expect(computeOverheadFlags(positions, 100, p, out)).toBe(30)
  })

  it('uses a sane sin threshold constant', () => {
    expect(SIN_MIN_ELEVATION).toBeCloseTo(Math.sin((20 * Math.PI) / 180), 12)
  })

  it('handles a degenerate satellite at the observer position without flagging', () => {
    const positions = buildPositions([[p[0], p[1], p[2]]])
    const out = new Uint8Array(1)
    expect(computeOverheadFlags(positions, 1, p, out)).toBe(0)
  })

  it('treats a satellite just above the horizon at long range correctly', () => {
    // GEO-like range pointing up
    const geo = atElevation(60, (42164 - 6371) / 1000 / 1)
    const positions = buildPositions([geo])
    const out = new Uint8Array(1)
    expect(computeOverheadFlags(positions, 1, p, out)).toBe(1)
    expect(Math.hypot(geo[0], geo[1], geo[2])).toBeGreaterThan(EARTH_RADIUS_UNITS)
  })
})
