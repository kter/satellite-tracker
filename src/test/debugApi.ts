import { useAppStore } from '../state/store'

export interface SatDebug {
  loadState: string
  satCount: number
  selectedNoradId: number | null
  selectedName: string | null
  overheadCount: number
  labelCount: number
  cameraMode: string
  multiplier: number
  paused: boolean
  usedStaleCache: boolean
}

declare global {
  interface Window {
    __satDebug?: SatDebug
  }
}

/**
 * Mirror app state onto window.__satDebug — the assertion surface for
 * Playwright E2E (canvas pixels are not assertable, this is).
 */
export function installDebugApi(): void {
  const update = () => {
    const s = useAppStore.getState()
    const idx = s.selectedIndex
    window.__satDebug = {
      loadState: s.loadState,
      satCount: s.catalog?.count ?? 0,
      selectedNoradId: idx !== null && s.catalog ? s.catalog.noradIds[idx] : null,
      selectedName: idx !== null && s.catalog ? s.catalog.names[idx] : null,
      overheadCount: s.overheadCount,
      labelCount: s.labelCount,
      cameraMode: s.cameraMode,
      multiplier: s.clock.multiplier,
      paused: s.clock.paused,
      usedStaleCache: s.usedStaleCache,
    }
  }
  update()
  useAppStore.subscribe(update)
}
