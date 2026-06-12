import { useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Earth } from './Earth'
import { Atmosphere } from './Atmosphere'
import { Satellites } from './Satellites'
import { SatLabels } from './SatLabels'
import { SelectedMarker } from './SelectedMarker'
import { OrbitLine } from './OrbitLine'
import { UserMarker } from './UserMarker'
import { CameraRig } from './CameraRig'
import { renderBuffers } from './sharedBuffers'
import { pickSatellite } from '../lib/picking'
import { useAppStore } from '../state/store'
import { dprFor } from '../lib/device'

const DRAG_TOLERANCE_PX = 5

/** Click/tap → CPU screen-space nearest-neighbor pick over the live position buffer. */
function PickingHandler() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    const el = gl.domElement
    let downX = 0
    let downY = 0
    let downAt = 0

    const onDown = (ev: PointerEvent) => {
      downX = ev.clientX
      downY = ev.clientY
      downAt = ev.timeStamp
    }
    const onUp = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > DRAG_TOLERANCE_PX) return
      if (ev.timeStamp - downAt > 800) return // long-press = camera gesture
      const { positions, visible, count } = renderBuffers
      if (!positions || count === 0) return

      camera.updateMatrixWorld()
      const viewProjection = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ).elements
      const rect = el.getBoundingClientRect()
      const index = pickSatellite({
        positions,
        count,
        visible,
        viewProjection,
        cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
        pointerX: ev.clientX - rect.left,
        pointerY: ev.clientY - rect.top,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        thresholdPx: ev.pointerType === 'touch' ? 28 : 14,
      })
      useAppStore.getState().select(index >= 0 ? index : null)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [gl, camera])

  return null
}

export function SceneRoot() {
  const qualityTier = useAppStore((s) => s.qualityTier)

  return (
    <Canvas
      dpr={dprFor(qualityTier, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)}
      camera={{ fov: 45, near: 0.01, far: 1000, position: [0, 5, 17] }}
      gl={{ powerPreference: 'high-performance', antialias: true }}
      style={{ position: 'absolute', inset: 0, background: '#05070d', touchAction: 'none' }}
    >
      <Stars
        radius={300}
        depth={60}
        count={qualityTier === 'low' ? 2500 : 6000}
        factor={6}
        saturation={0}
        fade
        speed={0.4}
      />
      <Earth />
      <Atmosphere />
      <Satellites />
      <SatLabels />
      <SelectedMarker />
      <OrbitLine />
      <UserMarker />
      <CameraRig />
      <PickingHandler />
    </Canvas>
  )
}
