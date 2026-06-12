import { useAppStore } from '../state/store'

export function LoadingOverlay() {
  const loadState = useAppStore((s) => s.loadState)
  const progress = useAppStore((s) => s.loadProgress)
  const loadError = useAppStore((s) => s.loadError)

  if (loadState === 'ready') return null

  return (
    <div className="loading-overlay" data-testid="loading-overlay">
      {loadState === 'loading' ? (
        <div className="loading-card panel">
          <div className="loading-spinner" />
          <p>衛星データを取得中…</p>
          <progress value={progress.done} max={progress.total} />
        </div>
      ) : (
        <div className="loading-card panel" data-testid="load-error">
          <p>⚠ 衛星データの取得に失敗しました</p>
          <p className="error-detail">{loadError}</p>
          <button className="btn" onClick={() => location.reload()}>
            再読み込み
          </button>
        </div>
      )}
    </div>
  )
}
