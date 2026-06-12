import { EARTH_RADIUS_UNITS, type Vec3 } from './geo'

export interface PickInput {
  /** scene-space positions, 3 floats per satellite */
  positions: Float32Array
  count: number
  /** per-sat visibility (category filter); null = all visible */
  visible: Uint8Array | null
  /** column-major 4x4 view-projection matrix (camera.projectionMatrix * camera.matrixWorldInverse) */
  viewProjection: Float32Array | number[]
  cameraPosition: Vec3
  pointerX: number
  pointerY: number
  viewportWidth: number
  viewportHeight: number
  thresholdPx: number
}

/**
 * True when the segment camera→sat is blocked by the Earth sphere
 * (standard ray-sphere intersection against radius EARTH_RADIUS_UNITS at origin).
 */
export function isOccludedByEarth(cam: Vec3, sat: Vec3, radius = EARTH_RADIUS_UNITS): boolean {
  const dx = sat[0] - cam[0]
  const dy = sat[1] - cam[1]
  const dz = sat[2] - cam[2]
  const a = dx * dx + dy * dy + dz * dz
  if (a === 0) return false
  const b = 2 * (cam[0] * dx + cam[1] * dy + cam[2] * dz)
  const c = cam[0] * cam[0] + cam[1] * cam[1] + cam[2] * cam[2] - radius * radius
  const disc = b * b - 4 * a * c
  if (disc < 0) return false
  const sqrtDisc = Math.sqrt(disc)
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)
  // blocked only when the sphere is entered strictly between camera and satellite
  return (t1 > 1e-6 && t1 < 1) || (t2 > 1e-6 && t2 < 1)
}

/**
 * Screen-space nearest-neighbor pick. Runs on the CPU only on click/tap;
 * 10k projections through one matrix is < 1 ms. Returns the satellite index
 * or -1 when nothing is within thresholdPx.
 */
export function pickSatellite(input: PickInput): number {
  const {
    positions,
    count,
    visible,
    viewProjection: m,
    cameraPosition,
    pointerX,
    pointerY,
    viewportWidth,
    viewportHeight,
    thresholdPx,
  } = input

  let best = -1
  let bestDist = thresholdPx
  let bestDepth = Infinity

  for (let i = 0; i < count; i++) {
    if (visible && visible[i] === 0) continue
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]

    const w = m[3] * x + m[7] * y + m[11] * z + m[15]
    if (w <= 0) continue // behind the camera
    const ndcX = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w
    const ndcY = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w
    if (ndcX < -1.1 || ndcX > 1.1 || ndcY < -1.1 || ndcY > 1.1) continue

    const px = ((ndcX + 1) / 2) * viewportWidth
    const py = ((1 - ndcY) / 2) * viewportHeight
    const dist = Math.hypot(px - pointerX, py - pointerY)
    if (dist >= bestDist) continue

    if (isOccludedByEarth(cameraPosition, [x, y, z])) continue

    const depth =
      (x - cameraPosition[0]) ** 2 + (y - cameraPosition[1]) ** 2 + (z - cameraPosition[2]) ** 2
    if (dist < bestDist || depth < bestDepth) {
      best = i
      bestDist = dist
      bestDepth = depth
    }
  }
  return best
}
