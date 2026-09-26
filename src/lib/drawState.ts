/**
 * Per-satellite draw state, stored as floats in the shader's `aState`
 * attribute and read back by label selection. Single source of truth for the
 * encoding on both the JS and GLSL side.
 */
export const DrawState = {
  Hidden: -1,
  Normal: 0,
  Dimmed: 1,
  Overhead: 2,
} as const
export type DrawState = (typeof DrawState)[keyof typeof DrawState]

/** GLSL #defines mirroring DrawState, for shaders that read `aState`. */
export const DRAW_STATE_GLSL = Object.entries(DrawState)
  .map(([name, v]) => `#define STATE_${name.toUpperCase()} (${v.toFixed(1)})`)
  .join('\n')

/** Float attribute values are compared with ±0.5 slack. */
export function isDrawState(value: number, state: DrawState): boolean {
  return Math.abs(value - state) < 0.5
}
