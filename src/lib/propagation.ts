import { propagate, eciToEcf, type SatRec } from 'satellite.js'
import { ecefKmToScene } from './geo'

/** Earth rotation rate, rad per sim second (for the ECF velocity correction). */
export const OMEGA_EARTH = 7.2921159e-5

export interface ScenePosVel {
  position: [number, number, number]
  /** scene units per sim second, in the rotating (ECF) frame */
  velocity: [number, number, number]
}

/**
 * Propagate one satellite to `date` and return Earth-fixed scene coordinates.
 *
 * The velocity is the true ECF-frame derivative:
 *   d/dt(r_ecf) = R(gmst)·v_eci − ω × r_ecf
 * (in scene axes ω = (0, Ω, 0), so ω×r = (Ω·z, 0, −Ω·x)), which the renderer
 * uses for linear extrapolation between worker snapshots.
 */
export function computeScenePosVel(rec: SatRec, date: Date, gmst: number): ScenePosVel | null {
  let pv: ReturnType<typeof propagate>
  try {
    pv = propagate(rec, date)
  } catch {
    return null // SGP4 error (decayed orbit etc.) — caller marks the sat dead
  }
  if (!pv || typeof pv.position === 'boolean' || typeof pv.velocity === 'boolean') return null
  const ecf = eciToEcf(pv.position, gmst)
  const vRot = eciToEcf(pv.velocity, gmst)
  const [px, py, pz] = ecefKmToScene(ecf.x, ecf.y, ecf.z)
  const [rvx, rvy, rvz] = ecefKmToScene(vRot.x, vRot.y, vRot.z)
  return {
    position: [px, py, pz],
    velocity: [rvx - OMEGA_EARTH * pz, rvy, rvz + OMEGA_EARTH * px],
  }
}
