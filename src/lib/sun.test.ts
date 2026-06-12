import { describe, it, expect } from 'vitest'
import { sunDirectionScene } from './sun'
import { sceneToEcefKm } from './geo'

function subsolarLatLonDeg(simMs: number): { lat: number; lon: number } {
  const [sx, sy, sz] = sunDirectionScene(simMs)
  const [x, y, z] = sceneToEcefKm(sx, sy, sz)
  const r = Math.hypot(x, y, z)
  return {
    lat: (Math.asin(z / r) * 180) / Math.PI,
    lon: (Math.atan2(y, x) * 180) / Math.PI,
  }
}

describe('sunDirectionScene', () => {
  it('returns a unit vector', () => {
    const v = sunDirectionScene(Date.UTC(2026, 5, 12, 3, 0, 0))
    expect(Math.hypot(...v)).toBeCloseTo(1, 6)
  })

  it('puts the subsolar point near the equator at the March equinox', () => {
    const { lat } = subsolarLatLonDeg(Date.UTC(2026, 2, 20, 12, 0, 0))
    expect(Math.abs(lat)).toBeLessThan(1.5)
  })

  it('puts the subsolar point near the Tropic of Cancer at the June solstice', () => {
    const { lat } = subsolarLatLonDeg(Date.UTC(2026, 5, 21, 12, 0, 0))
    expect(lat).toBeGreaterThan(22)
    expect(lat).toBeLessThan(24.5)
  })

  it('puts the subsolar point near the Tropic of Capricorn at the December solstice', () => {
    const { lat } = subsolarLatLonDeg(Date.UTC(2026, 11, 21, 12, 0, 0))
    expect(lat).toBeLessThan(-22)
    expect(lat).toBeGreaterThan(-24.5)
  })

  it('subsolar longitude is near 0 at 12:00 UTC (within equation-of-time wiggle)', () => {
    const { lon } = subsolarLatLonDeg(Date.UTC(2026, 2, 20, 12, 0, 0))
    expect(Math.abs(lon)).toBeLessThan(5)
  })

  it('subsolar longitude is near 180 at 00:00 UTC', () => {
    const { lon } = subsolarLatLonDeg(Date.UTC(2026, 2, 20, 0, 0, 0))
    expect(Math.abs(Math.abs(lon) - 180)).toBeLessThan(5)
  })

  it('moves westward as UTC advances (Earth-fixed frame)', () => {
    const a = subsolarLatLonDeg(Date.UTC(2026, 5, 12, 2, 0, 0))
    const b = subsolarLatLonDeg(Date.UTC(2026, 5, 12, 4, 0, 0))
    // 2 hours → 30° westward
    let delta = a.lon - b.lon
    if (delta < -180) delta += 360
    expect(delta).toBeCloseTo(30, 0)
  })
})
