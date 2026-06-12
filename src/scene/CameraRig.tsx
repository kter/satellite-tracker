import { useEffect, useRef } from 'react'
import { CameraControls } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'
import { useAppStore } from '../state/store'
import { controlsRef, flyToOverhead, flyHome, HOME_POSITION } from './cameraBus'
import { EARTH_RADIUS_UNITS } from '../lib/geo'

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const userLocation = useAppStore((s) => s.userLocation)

  useEffect(() => {
    controlsRef.current = ref.current
    void ref.current?.setLookAt(...HOME_POSITION, 0, 0, 0, false)
    return () => {
      controlsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (cameraMode === 'overhead' && userLocation) {
      flyToOverhead(userLocation)
    } else if (cameraMode === 'free' && userLocation) {
      // only fly home when leaving overhead mode, not on initial mount
      flyHome()
    }
  }, [cameraMode, userLocation])

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.45}
      minDistance={EARTH_RADIUS_UNITS + 0.4}
      maxDistance={80}
      draggingSmoothTime={0.08}
    />
  )
}
