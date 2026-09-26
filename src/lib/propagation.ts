import { propagate, eciToEcf, type SatRec, type EciVec3 } from 'satellite.js'
import { ecefKmToScene, KM_PER_UNIT, EARTH_RADIUS_KM } from './geo'

/** Earth rotation rate, rad per sim second (for the ECF velocity correction). */
export const OMEGA_EARTH = 7.2921159e-5
/** Earth's gravitational parameter in scene units³/s² (398600.4418 km³/s²). */
const MU_SCENE = 398600.4418 / KM_PER_UNIT ** 3

export interface ScenePosVel {
  position: [number, number, number]
  /** scene units per sim second, in the rotating (ECF) frame */
  velocity: [number, number, number]
}

interface EciPosVel {
  position: EciVec3<number>
  velocity: EciVec3<number>
}

/** SGP4 in ECI km; null on any SGP4 error (decayed orbit etc.). */
function propagateEci(rec: SatRec, date: Date): EciPosVel | null {
  let pv: ReturnType<typeof propagate>
  try {
    pv = propagate(rec, date)
  } catch {
    return null
  }
  if (!pv || typeof pv.position === 'boolean' || typeof pv.velocity === 'boolean') return null
  return { position: pv.position, velocity: pv.velocity }
}

/**
 * Propagate one satellite to `date` and return Earth-fixed scene coordinates.
 *
 * The velocity is the true ECF-frame derivative:
 *   d/dt(r_ecf) = R(gmst)·v_eci − ω × r_ecf
 * (in scene axes ω = (0, Ω, 0), so ω×r = (Ω·z, 0, −Ω·x)), which the renderer
 * uses for extrapolation between worker snapshots.
 */
export function computeScenePosVel(rec: SatRec, date: Date, gmst: number): ScenePosVel | null {
  const pv = propagateEci(rec, date)
  if (!pv) return null // caller marks the sat as failed
  const ecf = eciToEcf(pv.position, gmst)
  const vRot = eciToEcf(pv.velocity, gmst)
  const [px, py, pz] = ecefKmToScene(ecf.x, ecf.y, ecf.z)
  const [rvx, rvy, rvz] = ecefKmToScene(vRot.x, vRot.y, vRot.z)
  return {
    position: [px, py, pz],
    velocity: [rvx - OMEGA_EARTH * pz, rvy, rvz + OMEGA_EARTH * px],
  }
}

/**
 * ECI scene-space points over one period centered on `centerMs` (±T/2), 3
 * floats per sample. Samples SGP4 rejects are dropped rather than left at the
 * origin, where they would draw spikes into the Earth.
 */
export function sampleOrbitEci(
  rec: SatRec,
  centerMs: number,
  periodMs: number,
  samples: number,
): Float32Array {
  const points = new Float32Array((samples + 1) * 3)
  let n = 0
  for (let s = 0; s <= samples; s++) {
    const pv = propagateEci(rec, new Date(centerMs + periodMs * (s / samples - 0.5)))
    if (!pv) continue
    points.set(ecefKmToScene(pv.position.x, pv.position.y, pv.position.z), n * 3)
    n++
  }
  return n === samples + 1 ? points : points.slice(0, n * 3)
}

/**
 * Advance worker snapshot states by `dtSec` sim seconds into `outPos`/`outVel`
 * (same Earth-fixed scene layout as the inputs).
 *
 * Instead of a straight tangent line, each satellite follows the circular
 * two-body motion matching its current state (r(t) = r·cos nt + v/n·sin nt in
 * the inertial frame, n² = μ/|r|³), then is rotated back into the Earth-fixed
 * frame. This keeps markers on the curved orbit line at high multipliers. The
 * acceleration is exact at t = 0, so it is second-order accurate for any orbit,
 * but only near-circular orbits stay accurate over long spans (Molniya/GTO near
 * perigee can drift ~100 km over a 250 s span). Not SGP4 — the worker snapshot
 * remains the source of truth. Satellites parked at the origin stay there.
 */
export function extrapolateStates(
  outPos: Float32Array,
  outVel: Float32Array,
  positions: Float32Array,
  velocities: Float32Array,
  count: number,
  dtSec: number,
): void {
  // Earth-fixed frame rotation over dtSec (about scene +Y), applied at the end
  const phi = OMEGA_EARTH * dtSec
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  for (let i = 0; i < count; i++) {
    const k = i * 3
    const x = positions[k]
    const y = positions[k + 1]
    const z = positions[k + 2]
    const r2 = x * x + y * y + z * z
    if (r2 < 1e-9) {
      outPos[k] = x
      outPos[k + 1] = y
      outPos[k + 2] = z
      outVel[k] = velocities[k]
      outVel[k + 1] = velocities[k + 1]
      outVel[k + 2] = velocities[k + 2]
      continue
    }
    // inertial velocity = ECF velocity + ω×r
    const vx = velocities[k] + OMEGA_EARTH * z
    const vy = velocities[k + 1]
    const vz = velocities[k + 2] - OMEGA_EARTH * x
    const n = Math.sqrt(MU_SCENE / (r2 * Math.sqrt(r2)))
    const c = Math.cos(n * dtSec)
    const sn = Math.sin(n * dtSec)
    const s = sn / n
    // inertial state at t
    const ix = x * c + vx * s
    const iy = y * c + vy * s
    const iz = z * c + vz * s
    const ivx = vx * c - x * n * sn
    const ivy = vy * c - y * n * sn
    const ivz = vz * c - z * n * sn
    // rotate into the Earth-fixed frame at t, then subtract ω×r for the ECF velocity
    const px = ix * cosPhi - iz * sinPhi
    const pz = ix * sinPhi + iz * cosPhi
    outPos[k] = px
    outPos[k + 1] = iy
    outPos[k + 2] = pz
    outVel[k] = ivx * cosPhi - ivz * sinPhi - OMEGA_EARTH * pz
    outVel[k + 1] = ivy
    outVel[k + 2] = ivx * sinPhi + ivz * cosPhi + OMEGA_EARTH * px
  }
}

export interface LiveValues {
  altitudeKm: number
  speedKms: number
}

/** Altitude and inertial speed of satellite `index` from Earth-fixed scene buffers. */
export function liveValuesAt(
  positions: Float32Array,
  velocities: Float32Array,
  index: number,
): LiveValues {
  const k = index * 3
  const x = positions[k]
  const y = positions[k + 1]
  const z = positions[k + 2]
  const vx = velocities[k] + OMEGA_EARTH * z
  const vy = velocities[k + 1]
  const vz = velocities[k + 2] - OMEGA_EARTH * x
  return {
    altitudeKm: Math.hypot(x, y, z) * KM_PER_UNIT - EARTH_RADIUS_KM,
    speedKms: Math.hypot(vx, vy, vz) * KM_PER_UNIT,
  }
}
