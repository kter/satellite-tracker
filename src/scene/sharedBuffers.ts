/**
 * Frame-rate shared buffers, written by Satellites.tsx every frame and read
 * by picking, the selected-satellite marker, and the info panel. Kept out of
 * React state on purpose — these change 60×/s.
 */
export const renderBuffers: {
  /** extrapolated scene positions actually rendered this frame */
  positions: Float32Array | null
  /** latest worker velocities (scene units / sim second) */
  velocities: Float32Array | null
  /** per-sat category-filter visibility, 1 = visible */
  visible: Uint8Array | null
  /** per-sat draw state: -1 hidden / 0 normal / 1 dimmed / 2 overhead-highlight */
  states: Float32Array | null
  count: number
} = {
  positions: null,
  velocities: null,
  visible: null,
  states: null,
  count: 0,
}
