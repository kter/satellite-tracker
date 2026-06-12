import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { renderBuffers } from './sharedBuffers'
import { selectLabels } from '../lib/labels'
import { useAppStore } from '../state/store'

const REFRESH_FRAMES = 3

/**
 * Satellite name labels drawn on a 2D canvas overlaid on the WebGL canvas
 * (one fillText pass beats thousands of DOM nodes). Labels appear next to
 * satellites near the camera — i.e. once the user has zoomed in enough —
 * plus the selected and overhead-highlighted ones.
 */
export function SatLabels() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const frame = useRef(0)
  const viewProjection = useRef(new THREE.Matrix4())
  const lastCount = useRef(-1)

  useEffect(() => {
    const overlay = document.createElement('canvas')
    overlay.dataset.testid = 'sat-labels'
    overlay.style.position = 'absolute'
    overlay.style.inset = '0'
    overlay.style.pointerEvents = 'none'
    gl.domElement.parentElement?.appendChild(overlay)
    overlayRef.current = overlay
    return () => {
      overlay.remove()
      overlayRef.current = null
    }
  }, [gl])

  useFrame(() => {
    frame.current++
    if (frame.current % REFRESH_FRAMES !== 0) return
    const overlay = overlayRef.current
    if (!overlay) return

    const rect = gl.domElement.getBoundingClientRect()
    const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2)
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    if (overlay.width !== Math.round(w * dpr) || overlay.height !== Math.round(h * dpr)) {
      overlay.width = Math.round(w * dpr)
      overlay.height = Math.round(h * dpr)
      overlay.style.width = `${w}px`
      overlay.style.height = `${h}px`
    }
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const { positions, states, count } = renderBuffers
    const state = useAppStore.getState()
    const catalog = state.catalog
    let labels: ReturnType<typeof selectLabels> = []
    if (positions && catalog && count > 0 && w > 0 && h > 0) {
      camera.updateMatrixWorld()
      viewProjection.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      labels = selectLabels({
        positions,
        count,
        states,
        selectedIndex: state.selectedIndex,
        viewProjection: viewProjection.current.elements,
        cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
        viewportWidth: w,
        viewportHeight: h,
      })
      ctx.font = '11px Inter, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(5, 7, 13, 0.85)'
      ctx.fillStyle = 'rgba(219, 228, 245, 0.92)'
      for (const l of labels) {
        const name = catalog.names[l.index]
        ctx.strokeText(name, l.x + 9, l.y)
        ctx.fillText(name, l.x + 9, l.y)
      }
    }
    if (labels.length !== lastCount.current) {
      lastCount.current = labels.length
      state.setLabelCount(labels.length)
    }
  })

  return null
}
