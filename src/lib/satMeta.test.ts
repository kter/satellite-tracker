import { describe, it, expect } from 'vitest'
import { twoline2satrec } from 'satellite.js'
import { deriveSatMeta, packMeta, unpackMeta } from './satMeta'
import { ISS_L1, ISS_L2, GEO_L1, GEO_L2 } from './__fixtures__/tleFixtures'

describe('deriveSatMeta', () => {
  it('derives ISS period ≈ 92.9 min and inclination 51.63°', () => {
    const meta = deriveSatMeta(twoline2satrec(ISS_L1, ISS_L2))
    expect(meta.periodMin).toBeGreaterThan(92)
    expect(meta.periodMin).toBeLessThan(93.5)
    expect(meta.inclinationDeg).toBeCloseTo(51.63, 1)
  })

  it('derives ISS apogee/perigee around 400-440 km', () => {
    const meta = deriveSatMeta(twoline2satrec(ISS_L1, ISS_L2))
    expect(meta.perigeeKm).toBeGreaterThan(380)
    expect(meta.apogeeKm).toBeLessThan(460)
    expect(meta.apogeeKm).toBeGreaterThanOrEqual(meta.perigeeKm)
  })

  it('derives a ~24 h period and ~35,786 km altitude for a GEO satellite', () => {
    const meta = deriveSatMeta(twoline2satrec(GEO_L1, GEO_L2))
    expect(meta.periodMin).toBeGreaterThan(1420)
    expect(meta.periodMin).toBeLessThan(1450)
    expect(meta.apogeeKm).toBeGreaterThan(35000)
    expect(meta.apogeeKm).toBeLessThan(36800)
  })
})

describe('packMeta / unpackMeta', () => {
  it('roundtrips metadata through the packed Float32Array', () => {
    const meta = deriveSatMeta(twoline2satrec(ISS_L1, ISS_L2))
    const packed = packMeta([meta, meta])
    const out = unpackMeta(packed, 1)
    expect(out.inclinationDeg).toBeCloseTo(meta.inclinationDeg, 3)
    expect(out.periodMin).toBeCloseTo(meta.periodMin, 3)
    expect(out.apogeeKm).toBeCloseTo(meta.apogeeKm, 1)
    expect(out.perigeeKm).toBeCloseTo(meta.perigeeKm, 1)
  })
})
