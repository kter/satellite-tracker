import { useEffect, useState } from 'react'
import { useAppStore } from '../state/store'
import { renderBuffers } from '../scene/sharedBuffers'
import { unpackMeta } from '../lib/satMeta'
import { CATEGORY_ORDER } from '../lib/groups'
import { KM_PER_UNIT, EARTH_RADIUS_KM } from '../lib/geo'

/** Earth rotation rate (rad/s) — used to convert stored ECF velocity back to inertial speed. */
const OMEGA_EARTH = 7.2921159e-5

interface LiveValues {
  altitudeKm: number
  speedKms: number
}

function readLiveValues(index: number): LiveValues | null {
  const { positions, velocities, count } = renderBuffers
  if (!positions || !velocities || index >= count) return null
  const x = positions[index * 3]
  const y = positions[index * 3 + 1]
  const z = positions[index * 3 + 2]
  const vx = velocities[index * 3] + OMEGA_EARTH * z
  const vy = velocities[index * 3 + 1]
  const vz = velocities[index * 3 + 2] - OMEGA_EARTH * x
  return {
    altitudeKm: Math.hypot(x, y, z) * KM_PER_UNIT - EARTH_RADIUS_KM,
    speedKms: Math.hypot(vx, vy, vz) * KM_PER_UNIT,
  }
}

export function InfoPanel() {
  const selectedIndex = useAppStore((s) => s.selectedIndex)
  const catalog = useAppStore((s) => s.catalog)
  const select = useAppStore((s) => s.select)
  const [live, setLive] = useState<LiveValues | null>(null)

  useEffect(() => {
    if (selectedIndex === null) return
    const update = () => setLive(readLiveValues(selectedIndex))
    update()
    const id = setInterval(update, 250)
    return () => clearInterval(id)
  }, [selectedIndex])

  if (selectedIndex === null || !catalog) return null
  const meta = unpackMeta(catalog.meta, selectedIndex)
  const category = CATEGORY_ORDER[catalog.categories[selectedIndex]]

  return (
    <div className="info-panel panel" data-testid="info-panel">
      <div className="info-header">
        <span className="cat-dot" style={{ background: category.color }} />
        <h2 data-testid="sat-name">{catalog.names[selectedIndex]}</h2>
        <button
          className="btn btn-close"
          aria-label="閉じる"
          data-testid="btn-close-info"
          onClick={() => select(null)}
        >
          ×
        </button>
      </div>
      <dl className="info-grid">
        <dt>NORAD ID</dt>
        <dd data-testid="sat-norad">{catalog.noradIds[selectedIndex]}</dd>
        <dt>分類</dt>
        <dd>{category.label}</dd>
        <dt>高度</dt>
        <dd data-testid="sat-altitude">{live ? `${live.altitudeKm.toFixed(0)} km` : '—'}</dd>
        <dt>速度</dt>
        <dd data-testid="sat-speed">{live ? `${live.speedKms.toFixed(2)} km/s` : '—'}</dd>
        <dt>軌道傾斜角</dt>
        <dd data-testid="sat-inclination">{meta.inclinationDeg.toFixed(1)}°</dd>
        <dt>周期</dt>
        <dd data-testid="sat-period">{meta.periodMin.toFixed(1)} 分</dd>
        <dt>遠地点</dt>
        <dd>{meta.apogeeKm.toFixed(0)} km</dd>
        <dt>近地点</dt>
        <dd>{meta.perigeeKm.toFixed(0)} km</dd>
      </dl>
    </div>
  )
}
