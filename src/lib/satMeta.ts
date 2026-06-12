/** Earth gravitational parameter, km^3/s^2 */
const MU_KM3_S2 = 398600.4418
const EARTH_EQ_RADIUS_KM = 6378.137

export interface SatrecLike {
  /** mean motion, rad/min (satellite.js v7 SatRec.no) */
  no: number
  /** inclination, rad */
  inclo: number
  /** eccentricity */
  ecco: number
}

export interface SatMeta {
  inclinationDeg: number
  periodMin: number
  apogeeKm: number
  perigeeKm: number
}

/** Static orbital metadata derived from SGP4 elements. */
export function deriveSatMeta(rec: SatrecLike): SatMeta {
  const periodMin = (2 * Math.PI) / rec.no
  const nRadS = rec.no / 60
  const semiMajorKm = Math.cbrt(MU_KM3_S2 / (nRadS * nRadS))
  return {
    inclinationDeg: (rec.inclo * 180) / Math.PI,
    periodMin,
    apogeeKm: semiMajorKm * (1 + rec.ecco) - EARTH_EQ_RADIUS_KM,
    perigeeKm: semiMajorKm * (1 - rec.ecco) - EARTH_EQ_RADIUS_KM,
  }
}

export const META_STRIDE = 4

export function packMeta(metas: SatMeta[]): Float32Array {
  const out = new Float32Array(metas.length * META_STRIDE)
  metas.forEach((m, i) => {
    out[i * META_STRIDE] = m.inclinationDeg
    out[i * META_STRIDE + 1] = m.periodMin
    out[i * META_STRIDE + 2] = m.apogeeKm
    out[i * META_STRIDE + 3] = m.perigeeKm
  })
  return out
}

export function unpackMeta(meta: Float32Array, index: number): SatMeta {
  return {
    inclinationDeg: meta[index * META_STRIDE],
    periodMin: meta[index * META_STRIDE + 1],
    apogeeKm: meta[index * META_STRIDE + 2],
    perigeeKm: meta[index * META_STRIDE + 3],
  }
}
