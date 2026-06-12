import { useState } from 'react'
import { useAppStore } from '../state/store'
import { requestLocation } from '../hooks/useGeolocation'

/**
 * The headline feature: locate the user via GPS and fly the camera to an
 * oblique view above their location so satellite altitudes are readable.
 */
export function OverheadButton() {
  const cameraMode = useAppStore((s) => s.cameraMode)
  const overheadCount = useAppStore((s) => s.overheadCount)
  const enterOverhead = useAppStore((s) => s.enterOverhead)
  const exitOverhead = useAppStore((s) => s.exitOverhead)
  const showToast = useAppStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (cameraMode === 'overhead') {
      exitOverhead()
      return
    }
    setBusy(true)
    try {
      const loc = await requestLocation()
      enterOverhead(loc)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '位置情報を取得できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overhead-control">
      {cameraMode === 'overhead' && (
        <div className="overhead-badge" data-testid="overhead-badge">
          頭上の衛星: <strong data-testid="overhead-count">{overheadCount}</strong> 機
        </div>
      )}
      <button
        className={`btn btn-overhead ${cameraMode === 'overhead' ? 'btn-active' : ''}`}
        data-testid="btn-overhead"
        onClick={onClick}
        disabled={busy}
      >
        {busy
          ? '位置情報取得中…'
          : cameraMode === 'overhead'
            ? '全体ビューに戻る'
            : '📍 頭上の衛星を見る'}
      </button>
    </div>
  )
}
