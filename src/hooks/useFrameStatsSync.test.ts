import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../state/store'
import { frameStats } from '../scene/sharedBuffers'
import { pushFrameStats } from './useFrameStatsSync'

describe('pushFrameStats', () => {
  beforeEach(() => {
    useAppStore.setState({ labelCount: 0, overheadCount: 0, cameraMode: 'free' })
    frameStats.labelCount = 0
    frameStats.overheadCount = 0
  })

  it('mirrors the label count into the store', () => {
    frameStats.labelCount = 7
    pushFrameStats()
    expect(useAppStore.getState().labelCount).toBe(7)
  })

  it('mirrors the overhead count only while in overhead mode', () => {
    frameStats.overheadCount = 12
    pushFrameStats()
    expect(useAppStore.getState().overheadCount).toBe(0)

    useAppStore.setState({ cameraMode: 'overhead' })
    pushFrameStats()
    expect(useAppStore.getState().overheadCount).toBe(12)
  })

  it('does not notify subscribers when nothing changed', () => {
    let notified = 0
    const unsubscribe = useAppStore.subscribe(() => notified++)
    pushFrameStats()
    unsubscribe()
    expect(notified).toBe(0)
  })
})
