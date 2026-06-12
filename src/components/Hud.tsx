import { useEffect, useState } from 'react'
import { useAppStore } from '../state/store'
import { useIsMobile } from '../hooks/useIsMobile'
import { TimeControls } from './TimeControls'
import { SearchBox } from './SearchBox'
import { FilterLegend } from './FilterLegend'
import { InfoPanel } from './InfoPanel'
import { OverheadButton } from './OverheadButton'
import { BottomSheet } from './BottomSheet'
import { LoadingOverlay } from './LoadingOverlay'

function DataAge() {
  const fetchedAt = useAppStore((s) => s.dataFetchedAt)
  const usedStaleCache = useAppStore((s) => s.usedStaleCache)
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  if (fetchedAt === null) return null
  const ageMin = Math.max(0, Math.round((nowMs - fetchedAt) / 60000))
  return (
    <span className={`data-age ${usedStaleCache ? 'stale' : ''}`} data-testid="data-age">
      TLE: {ageMin < 60 ? `${ageMin}分前` : `${Math.round(ageMin / 60)}時間前`}
      {usedStaleCache && ' (古い可能性あり)'}
    </span>
  )
}

function Toast() {
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(clearToast, 4000)
    return () => clearTimeout(id)
  }, [toast, clearToast])
  if (!toast) return null
  return (
    <div className="toast" role="alert" data-testid="toast">
      {toast}
    </div>
  )
}

export function Hud() {
  const isMobile = useIsMobile()

  const panelContent = (
    <>
      <SearchBox />
      <InfoPanel />
      <FilterLegend />
    </>
  )

  return (
    <div className="hud">
      <header className="hud-top">
        <div className="brand">
          <h1>Orbital</h1>
          <DataAge />
        </div>
        <TimeControls />
      </header>

      {isMobile ? (
        <BottomSheet>{panelContent}</BottomSheet>
      ) : (
        <aside className="side-panel">{panelContent}</aside>
      )}

      <OverheadButton />
      <Toast />
      <LoadingOverlay />
    </div>
  )
}
