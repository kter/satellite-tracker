import { useEffect } from 'react'
import { useAppStore } from '../state/store'
import { frameStats } from '../scene/sharedBuffers'

/** ≤ 4 Hz, per the "live readouts poll" rule. */
export const FRAME_STATS_SYNC_MS = 250

/** Copy frame-loop counters into the store, only when they changed. */
export function pushFrameStats(): void {
  const s = useAppStore.getState()
  if (s.labelCount !== frameStats.labelCount) s.setLabelCount(frameStats.labelCount)
  // outside overhead mode the counter may lag one frame behind exitOverhead()
  if (s.cameraMode === 'overhead' && s.overheadCount !== frameStats.overheadCount) {
    s.setOverheadCount(frameStats.overheadCount)
  }
}

export function useFrameStatsSync(): void {
  useEffect(() => {
    const id = setInterval(pushFrameStats, FRAME_STATS_SYNC_MS)
    return () => clearInterval(id)
  }, [])
}
