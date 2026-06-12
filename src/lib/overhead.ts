import { dot, normalize, type Vec3 } from './geo'

/** Satellites above this elevation angle count as "overhead". */
export const MIN_ELEVATION_DEG = 20
export const SIN_MIN_ELEVATION = Math.sin((MIN_ELEVATION_DEG * Math.PI) / 180)

/**
 * Flag satellites above the elevation threshold as seen from observer point P
 * (scene coords). Writes 1/0 into `out` and returns the overhead count.
 * Pure vector math — runs over the whole position buffer in well under a ms.
 */
export function computeOverheadFlags(
  positions: Float32Array,
  count: number,
  pScene: Vec3,
  out: Uint8Array,
  sinMinElevation: number = SIN_MIN_ELEVATION,
): number {
  const up = normalize(pScene)
  let found = 0
  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3] - pScene[0]
    const dy = positions[i * 3 + 1] - pScene[1]
    const dz = positions[i * 3 + 2] - pScene[2]
    const len = Math.hypot(dx, dy, dz)
    const sinEl = len > 0 ? dot([dx, dy, dz], up) / len : -1
    const flag = sinEl > sinMinElevation ? 1 : 0
    out[i] = flag
    found += flag
  }
  return found
}
