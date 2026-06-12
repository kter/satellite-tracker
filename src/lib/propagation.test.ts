import { describe, it, expect } from 'vitest'
import {
  twoline2satrec,
  gstime,
  eciToGeodetic,
  propagate,
  degreesLat,
  degreesLong,
} from 'satellite.js'
import { computeScenePosVel, OMEGA_EARTH } from './propagation'
import { KM_PER_UNIT, EARTH_RADIUS_KM, sceneToEcefKm } from './geo'
import { ISS_L1, ISS_L2, ISS_EPOCH_MS, DECAYED_L1, DECAYED_L2 } from './__fixtures__/tleFixtures'

describe('computeScenePosVel', () => {
  it('puts the ISS at LEO altitude (~370-480 km)', () => {
    const rec = twoline2satrec(ISS_L1, ISS_L2)
    const date = new Date(ISS_EPOCH_MS)
    const out = computeScenePosVel(rec, date, gstime(date))
    expect(out).not.toBeNull()
    const altKm = Math.hypot(...out!.position) * KM_PER_UNIT - EARTH_RADIUS_KM
    expect(altKm).toBeGreaterThan(350)
    expect(altKm).toBeLessThan(480)
  })

  it('matches satellite.js geodetic latitude/longitude through the scene mapping', () => {
    const rec = twoline2satrec(ISS_L1, ISS_L2)
    const date = new Date(ISS_EPOCH_MS)
    const gmst = gstime(date)
    const out = computeScenePosVel(rec, date, gmst)!

    const pv = propagate(rec, date)!
    const geo = eciToGeodetic(pv.position as { x: number; y: number; z: number }, gmst)
    const [ex, ey, ez] = sceneToEcefKm(...out.position)
    const lat = (Math.asin(ez / Math.hypot(ex, ey, ez)) * 180) / Math.PI
    const lon = (Math.atan2(ey, ex) * 180) / Math.PI

    // geocentric vs geodetic latitude differ by up to ~0.2°; tolerance covers it
    expect(lat).toBeCloseTo(degreesLat(geo.latitude), 0)
    let dLon = lon - degreesLong(geo.longitude)
    if (dLon > 180) dLon -= 360
    if (dLon < -180) dLon += 360
    expect(Math.abs(dLon)).toBeLessThan(0.5)
  })

  it('velocity matches numerical differentiation of the ECF position (ω×r correction)', () => {
    const rec = twoline2satrec(ISS_L1, ISS_L2)
    const dtSec = 1
    const d0 = new Date(ISS_EPOCH_MS)
    const d1 = new Date(ISS_EPOCH_MS + dtSec * 1000)
    const a = computeScenePosVel(rec, d0, gstime(d0))!
    const b = computeScenePosVel(rec, d1, gstime(d1))!
    for (let k = 0; k < 3; k++) {
      const numeric = (b.position[k] - a.position[k]) / dtSec
      expect(a.velocity[k]).toBeCloseTo(numeric, 5)
    }
  })

  function extrapolationErrorKm(dtSec: number): number {
    const rec = twoline2satrec(ISS_L1, ISS_L2)
    const d0 = new Date(ISS_EPOCH_MS)
    const d1 = new Date(ISS_EPOCH_MS + dtSec * 1000)
    const a = computeScenePosVel(rec, d0, gstime(d0))!
    const b = computeScenePosVel(rec, d1, gstime(d1))!
    return (
      Math.hypot(
        a.position[0] + a.velocity[0] * dtSec - b.position[0],
        a.position[1] + a.velocity[1] * dtSec - b.position[1],
        a.position[2] + a.velocity[2] * dtSec - b.position[2],
      ) * KM_PER_UNIT
    )
  }

  it('linear extrapolation error stays within the ½·a·dt² budget (~4 km at 30 s)', () => {
    expect(extrapolationErrorKm(0.25)).toBeLessThan(0.01)
    expect(extrapolationErrorKm(30)).toBeLessThan(5)
  })

  it('worst-case 600x extrapolation (150 sim-seconds) stays under 120 km — invisible at globe scale', () => {
    expect(extrapolationErrorKm(150)).toBeLessThan(120)
  })

  it('ISS inertial speed is ~7.7 km/s when Earth rotation is added back', () => {
    const rec = twoline2satrec(ISS_L1, ISS_L2)
    const date = new Date(ISS_EPOCH_MS)
    const out = computeScenePosVel(rec, date, gstime(date))!
    const [x, , z] = out.position
    const vEci = [
      out.velocity[0] + OMEGA_EARTH * z,
      out.velocity[1],
      out.velocity[2] - OMEGA_EARTH * x,
    ]
    const speed = Math.hypot(...vEci) * KM_PER_UNIT
    expect(speed).toBeGreaterThan(7.4)
    expect(speed).toBeLessThan(7.9)
  })

  it('returns null instead of throwing when the orbit dips below the surface', () => {
    let rec
    try {
      rec = twoline2satrec(DECAYED_L1, DECAYED_L2)
    } catch {
      return // init itself rejecting the elements is also acceptable
    }
    // ecc=0.5 puts perigee ~3,400 km from the geocenter — underground. Scan one
    // period; SGP4 must error (→ null) somewhere near perigee passage and our
    // wrapper must never throw.
    const periodMin = (2 * Math.PI) / rec.no
    let sawNull = false
    for (let s = 0; s < 64; s++) {
      const date = new Date(ISS_EPOCH_MS + ((periodMin * 60000) / 64) * s)
      if (computeScenePosVel(rec, date, gstime(date)) === null) {
        sawNull = true
        break
      }
    }
    expect(sawNull).toBe(true)
  })
})
