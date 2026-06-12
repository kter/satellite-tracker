import { useEffect, useState } from 'react'
import { useAppStore, currentSimTimeMs } from '../state/store'
import { MULTIPLIERS } from '../lib/time'

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

export function TimeControls() {
  const multiplier = useAppStore((s) => s.clock.multiplier)
  const paused = useAppStore((s) => s.clock.paused)
  const setMultiplier = useAppStore((s) => s.setMultiplier)
  const setPaused = useAppStore((s) => s.setPaused)
  const resetClock = useAppStore((s) => s.resetClock)

  const [clockText, setClockText] = useState(() => formatUtc(currentSimTimeMs()))
  useEffect(() => {
    const id = setInterval(() => setClockText(formatUtc(currentSimTimeMs())), 250)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="time-controls panel" data-testid="time-controls">
      <div className="sim-clock" data-testid="sim-clock">
        {clockText}
      </div>
      <div className="time-buttons">
        <button
          className="btn"
          data-testid="btn-pause"
          aria-label={paused ? '再生' : '一時停止'}
          onClick={() => setPaused(!paused)}
        >
          {paused ? '▶' : '⏸'}
        </button>
        {MULTIPLIERS.map((m) => (
          <button
            key={m}
            className={`btn ${multiplier === m && !paused ? 'btn-active' : ''}`}
            data-testid={`btn-speed-${m}`}
            onClick={() => {
              setMultiplier(m)
              if (paused) setPaused(false)
            }}
          >
            {m}x
          </button>
        ))}
        <button className="btn" data-testid="btn-now" onClick={resetClock} title="現在時刻に戻す">
          Now
        </button>
      </div>
    </div>
  )
}
