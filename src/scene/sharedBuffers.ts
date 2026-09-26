/**
 * Frame-rate shared buffers, written by Satellites.tsx every frame and read
 * by picking, the selected-satellite marker, and the info panel. Kept out of
 * React state on purpose — these change 60×/s.
 */
export const renderBuffers: {
  /** extrapolated scene positions actually rendered this frame */
  positions: Float32Array | null
  /** Earth-fixed velocities matching `positions` (scene units / sim second) */
  velocities: Float32Array | null
  /** per-sat category-filter visibility, 1 = visible */
  visible: Uint8Array | null
  /** per-sat DrawState (see lib/drawState) */
  states: Float32Array | null
  count: number
} = {
  positions: null,
  velocities: null,
  visible: null,
  states: null,
  count: 0,
}

/**
 * Counters produced inside useFrame. Never pushed to the store from the frame
 * loop — useFrameStatsSync mirrors them into React state at ≤ 4 Hz.
 */
export const frameStats = {
  /** satellite name labels drawn in the latest label pass */
  labelCount: 0,
  /** satellites above the minimum elevation at the user location */
  overheadCount: 0,
}
