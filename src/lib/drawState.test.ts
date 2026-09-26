import { describe, it, expect } from 'vitest'
import { DrawState, DRAW_STATE_GLSL, isDrawState } from './drawState'

describe('DrawState', () => {
  it('emits one GLSL float #define per state', () => {
    expect(DRAW_STATE_GLSL).toContain('#define STATE_HIDDEN (-1.0)')
    expect(DRAW_STATE_GLSL).toContain('#define STATE_OVERHEAD (2.0)')
  })

  it('matches float attribute values with ±0.5 slack', () => {
    expect(isDrawState(1.9, DrawState.Overhead)).toBe(true)
    expect(isDrawState(1.4, DrawState.Overhead)).toBe(false)
    expect(isDrawState(-1, DrawState.Hidden)).toBe(true)
  })
})
