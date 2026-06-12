import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './store'
import { CATEGORY_ORDER } from '../lib/groups'

function resetStore() {
  const s = useAppStore.getState()
  useAppStore.setState({
    selectedIndex: null,
    enabledCategories: CATEGORY_ORDER.map(() => true),
    searchQuery: '',
    userLocation: null,
    cameraMode: 'free',
    overheadCount: 0,
    toast: null,
    clock: { ...s.clock, multiplier: 1, paused: false },
  })
}

describe('app store', () => {
  beforeEach(resetStore)

  it('toggleCategory flips only the targeted category', () => {
    useAppStore.getState().toggleCategory(1)
    const cats = useAppStore.getState().enabledCategories
    expect(cats[1]).toBe(false)
    expect(cats.filter(Boolean)).toHaveLength(CATEGORY_ORDER.length - 1)
    useAppStore.getState().toggleCategory(1)
    expect(useAppStore.getState().enabledCategories[1]).toBe(true)
  })

  it('enterOverhead stores the location and switches the camera mode', () => {
    useAppStore.getState().enterOverhead({ latDeg: 35.68, lonDeg: 139.77 })
    const s = useAppStore.getState()
    expect(s.cameraMode).toBe('overhead')
    expect(s.userLocation).toEqual({ latDeg: 35.68, lonDeg: 139.77 })
  })

  it('exitOverhead returns to free mode and clears the count', () => {
    useAppStore.getState().enterOverhead({ latDeg: 1, lonDeg: 2 })
    useAppStore.getState().setOverheadCount(42)
    useAppStore.getState().exitOverhead()
    const s = useAppStore.getState()
    expect(s.cameraMode).toBe('free')
    expect(s.overheadCount).toBe(0)
    // location is kept so the marker can stay visible
    expect(s.userLocation).not.toBeNull()
  })

  it('setMultiplier/setPaused update the clock immutably', () => {
    const before = useAppStore.getState().clock
    useAppStore.getState().setMultiplier(60)
    const after = useAppStore.getState().clock
    expect(after).not.toBe(before)
    expect(after.multiplier).toBe(60)
    useAppStore.getState().setPaused(true)
    expect(useAppStore.getState().clock.paused).toBe(true)
  })

  it('select stores the index and can clear it', () => {
    useAppStore.getState().select(123)
    expect(useAppStore.getState().selectedIndex).toBe(123)
    useAppStore.getState().select(null)
    expect(useAppStore.getState().selectedIndex).toBeNull()
  })

  it('toast can be shown and cleared', () => {
    useAppStore.getState().showToast('hello')
    expect(useAppStore.getState().toast).toBe('hello')
    useAppStore.getState().clearToast()
    expect(useAppStore.getState().toast).toBeNull()
  })
})
