import { isOccludedByEarth } from './picking'
import type { Vec3 } from './geo'

/** Normal satellites get a name label only when the camera is this close to them. */
export const LABEL_MAX_CAMERA_DISTANCE_UNITS = 4
/** Hard cap so a dense shell never floods the screen with text. */
export const MAX_LABELS = 24
/** Coarse de-clutter grid: one label per cell. */
const CELL_W_PX = 110
const CELL_H_PX = 18

export interface LabelPlacement {
  index: number
  /** CSS px from the viewport's top-left, at the satellite dot */
  x: number
  y: number
  distanceUnits: number
}

export interface SelectLabelsInput {
  /** scene-space positions, 3 floats per satellite */
  positions: Float32Array
  count: number
  /** per-sat draw state: -1 hidden, 0 normal, 1 dimmed, 2 overhead-highlight (null = all normal) */
  states: Float32Array | null
  selectedIndex: number | null
  /** column-major 4x4 view-projection matrix */
  viewProjection: Float32Array | number[]
  cameraPosition: Vec3
  viewportWidth: number
  viewportHeight: number
  maxDistanceUnits?: number
  maxLabels?: number
}

/**
 * Pick which satellites get an on-screen name label this frame. Eligible are
 * satellites near the camera (i.e. the user zoomed in far enough that
 * individual dots are tellable apart), overhead-highlighted satellites, and
 * the selected satellite at any distance. Nearest-first, de-cluttered on a
 * coarse grid, Earth-occluded and off-screen satellites skipped.
 */
export function selectLabels(input: SelectLabelsInput): LabelPlacement[] {
  const {
    positions,
    count,
    states,
    selectedIndex,
    viewProjection: m,
    cameraPosition: cam,
    viewportWidth,
    viewportHeight,
    maxDistanceUnits = LABEL_MAX_CAMERA_DISTANCE_UNITS,
    maxLabels = MAX_LABELS,
  } = input

  const candidates: LabelPlacement[] = []
  for (let i = 0; i < count; i++) {
    const state = states ? states[i] : 0
    const isSelected = i === selectedIndex
    if (state < -0.5) continue // hidden by category filter
    if (state > 0.5 && state < 1.5 && !isSelected) continue // dimmed in overhead mode

    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const dist = Math.hypot(x - cam[0], y - cam[1], z - cam[2])
    const alwaysLabeled = isSelected || state > 1.5 // selected or overhead-highlighted
    if (!alwaysLabeled && dist > maxDistanceUnits) continue

    const w = m[3] * x + m[7] * y + m[11] * z + m[15]
    if (w <= 0) continue // behind the camera
    const ndcX = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w
    const ndcY = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w
    if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1) continue
    if (isOccludedByEarth(cam, [x, y, z])) continue

    candidates.push({
      index: i,
      x: ((ndcX + 1) / 2) * viewportWidth,
      y: ((1 - ndcY) / 2) * viewportHeight,
      distanceUnits: dist,
    })
  }

  // selected first, then nearest first
  candidates.sort((a, b) => {
    if (a.index === selectedIndex) return -1
    if (b.index === selectedIndex) return 1
    return a.distanceUnits - b.distanceUnits
  })

  const taken = new Set<string>()
  const result: LabelPlacement[] = []
  for (const c of candidates) {
    if (result.length >= maxLabels) break
    const key = `${Math.floor(c.x / CELL_W_PX)}:${Math.floor(c.y / CELL_H_PX)}`
    if (taken.has(key)) continue
    taken.add(key)
    result.push(c)
  }
  return result
}
