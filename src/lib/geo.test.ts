import { describe, it, expect } from 'vitest'
import { geodeticToEcf, degreesToRadians } from 'satellite.js'
import {
  latLonAltToEcefKm,
  latLonToScene,
  ecefKmToScene,
  sceneToEcefKm,
  tangentBasis,
  overheadCamera,
  normalize,
  dot,
  cross,
  OVERHEAD_TILT_RAD,
  OVERHEAD_DISTANCE_UNITS,
  EARTH_RADIUS_UNITS,
} from './geo'

describe('latLonAltToEcefKm (WGS84)', () => {
  it('places lat=0 lon=0 on the +X axis at the equatorial radius', () => {
    const [x, y, z] = latLonAltToEcefKm(0, 0, 0)
    expect(x).toBeCloseTo(6378.137, 3)
    expect(y).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(0, 6)
  })

  it('places the north pole on +Z at the polar radius', () => {
    const [x, y, z] = latLonAltToEcefKm(90, 0, 0)
    expect(Math.hypot(x, y)).toBeLessThan(1e-9)
    expect(z).toBeCloseTo(6356.7523, 3)
  })

  it('places lon=90E on the +Y axis', () => {
    const [x, y, z] = latLonAltToEcefKm(0, 90, 0)
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(6378.137, 3)
    expect(z).toBeCloseTo(0, 6)
  })

  it('matches satellite.js geodeticToEcf for Tokyo', () => {
    const ours = latLonAltToEcefKm(35.6812, 139.7671, 0.04)
    const theirs = geodeticToEcf({
      latitude: degreesToRadians(35.6812),
      longitude: degreesToRadians(139.7671),
      height: 0.04,
    })
    expect(ours[0]).toBeCloseTo(theirs.x, 3)
    expect(ours[1]).toBeCloseTo(theirs.y, 3)
    expect(ours[2]).toBeCloseTo(theirs.z, 3)
  })

  it('adds altitude along the surface normal direction', () => {
    const ground = latLonAltToEcefKm(45, 45, 0)
    const high = latLonAltToEcefKm(45, 45, 100)
    const d = Math.hypot(high[0] - ground[0], high[1] - ground[1], high[2] - ground[2])
    expect(d).toBeCloseTo(100, 1)
  })
})

describe('scene/ECEF axis remap', () => {
  it('maps ECEF Z (north pole) onto scene +Y', () => {
    const [sx, sy, sz] = ecefKmToScene(0, 0, 1000)
    expect([sx, sy, sz]).toEqual([0, 1, -0])
  })

  it('maps lon 90E to scene -Z', () => {
    const [sx, sy, sz] = latLonToScene(0, 90)
    expect(sx).toBeCloseTo(0, 6)
    expect(sy).toBeCloseTo(0, 6)
    expect(sz).toBeCloseTo(-6.378137, 4)
  })

  it('roundtrips scene -> ECEF -> scene', () => {
    const ecef: [number, number, number] = [1234.5, -987.6, 4321.0]
    const scene = ecefKmToScene(...ecef)
    const back = sceneToEcefKm(...scene)
    expect(back[0]).toBeCloseTo(ecef[0], 9)
    expect(back[1]).toBeCloseTo(ecef[1], 9)
    expect(back[2]).toBeCloseTo(ecef[2], 9)
  })
})

describe('tangentBasis', () => {
  it('builds an orthonormal right-handed basis at mid latitude', () => {
    const p = latLonToScene(35, 139)
    const { up, east, north } = tangentBasis(p)
    expect(dot(up, east)).toBeCloseTo(0, 10)
    expect(dot(up, north)).toBeCloseTo(0, 10)
    expect(dot(east, north)).toBeCloseTo(0, 10)
    const upFromCross = cross(east, north)
    expect(upFromCross[0]).toBeCloseTo(up[0], 10)
    expect(upFromCross[1]).toBeCloseTo(up[1], 10)
    expect(upFromCross[2]).toBeCloseTo(up[2], 10)
  })

  it('points north toward the pole (positive scene-Y component in the northern hemisphere)', () => {
    const p = latLonToScene(35, 139)
    const { north } = tangentBasis(p)
    expect(north[1]).toBeGreaterThan(0)
  })

  it('stays finite at the poles (fallback reference axis)', () => {
    const p = latLonToScene(89.99, 0)
    const { up, east, north } = tangentBasis(p)
    for (const v of [up, east, north]) {
      expect(Number.isFinite(v[0] + v[1] + v[2])).toBe(true)
      expect(Math.hypot(...v)).toBeCloseTo(1, 6)
    }
  })
})

describe('overheadCamera (oblique GPS view)', () => {
  it('tilts the camera off the zenith by the configured angle — NOT top-down', () => {
    const { position } = overheadCamera(35.6812, 139.7671)
    const p = latLonToScene(35.6812, 139.7671)
    const { up } = tangentBasis(p)
    const camDir = normalize([position[0] - p[0], position[1] - p[1], position[2] - p[2]])
    const angleOffZenith = Math.acos(dot(camDir, up))
    expect(angleOffZenith).toBeCloseTo(OVERHEAD_TILT_RAD, 6)
    expect(angleOffZenith).toBeGreaterThan(0.5) // definitively oblique
  })

  it('keeps the camera at the configured distance from the user', () => {
    const { position } = overheadCamera(-33.87, 151.21) // Sydney, southern hemisphere
    const p = latLonToScene(-33.87, 151.21)
    const d = Math.hypot(position[0] - p[0], position[1] - p[1], position[2] - p[2])
    expect(d).toBeCloseTo(OVERHEAD_DISTANCE_UNITS, 6)
  })

  it('places the camera outside the Earth and the target above the user', () => {
    const { position, target } = overheadCamera(35.68, 139.77)
    expect(Math.hypot(...position)).toBeGreaterThan(EARTH_RADIUS_UNITS)
    const p = latLonToScene(35.68, 139.77)
    expect(Math.hypot(...target)).toBeGreaterThan(Math.hypot(...p))
  })

  it('works at the pole without NaN', () => {
    const { position, target } = overheadCamera(90, 0)
    for (const v of [...position, ...target]) expect(Number.isFinite(v)).toBe(true)
  })
})
