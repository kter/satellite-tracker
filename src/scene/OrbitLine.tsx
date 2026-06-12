import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { gstime } from 'satellite.js'
import { useAppStore, currentSimTimeMs } from '../state/store'
import { useOrbitStore, requestOrbit } from '../hooks/usePropagator'

/** Resample once sim time drifts this far (fraction of a period) from the window center. */
const RESAMPLE_PERIOD_FRACTION = 1 / 6
/** Wall-clock throttle between orbit re-requests. */
const RESAMPLE_MIN_WALL_MS = 1000

/**
 * Orbit of the selected satellite, sampled in ECI by the worker. The group is
 * counter-rotated by -gmst(simTime) every frame so the ECI ellipse stays
 * consistent with the Earth-fixed scene (an ECF-sampled orbit would spiral).
 */
export function OrbitLine() {
  const selectedIndex = useAppStore((s) => s.selectedIndex)
  const catalog = useAppStore((s) => s.catalog)
  const orbit = useOrbitStore()
  const groupRef = useRef<THREE.Group>(null)
  const lastRequestWallMs = useRef(0)

  const selectedNoradId = selectedIndex !== null && catalog ? catalog.noradIds[selectedIndex] : null

  useEffect(() => {
    if (selectedNoradId === null) {
      useOrbitStore.getState().clearOrbit()
      return
    }
    requestOrbit(selectedNoradId)
  }, [selectedNoradId])

  const points = useMemo(() => {
    if (!orbit.points || orbit.noradId !== selectedNoradId) return null
    const arr: [number, number, number][] = []
    for (let i = 0; i < orbit.points.length; i += 3) {
      arr.push([orbit.points[i], orbit.points[i + 1], orbit.points[i + 2]])
    }
    return arr
  }, [orbit.points, orbit.noradId, selectedNoradId])

  useFrame(() => {
    const simMs = currentSimTimeMs()
    if (groupRef.current) {
      groupRef.current.rotation.y = -gstime(new Date(simMs))
    }
    // The sampled window is centered on sampledAtMs; as sim time advances (or
    // jumps at high multipliers) resample so the seam stays opposite the sat.
    const o = useOrbitStore.getState()
    if (selectedNoradId !== null && o.noradId === selectedNoradId && o.points && o.periodMin > 0) {
      const driftMs = Math.abs(simMs - o.sampledAtMs)
      const wallMs = performance.now()
      if (
        driftMs > o.periodMin * 60_000 * RESAMPLE_PERIOD_FRACTION &&
        wallMs - lastRequestWallMs.current > RESAMPLE_MIN_WALL_MS
      ) {
        lastRequestWallMs.current = wallMs
        requestOrbit(selectedNoradId)
      }
    }
  })

  if (!points) return null

  return (
    <group ref={groupRef}>
      <Line points={points} color="#7df9ff" lineWidth={1.2} transparent opacity={0.55} />
    </group>
  )
}
