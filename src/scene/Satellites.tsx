import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAppStore } from '../state/store'
import { snapshotRef } from '../hooks/usePropagator'
import { renderBuffers } from './sharedBuffers'
import { CATEGORY_ORDER } from '../lib/groups'
import { computeOverheadFlags } from '../lib/overhead'
import { latLonToScene } from '../lib/geo'
import { simNow } from '../lib/time'

const VERTEX = /* glsl */ `
attribute vec3 aColor;
// -1 hidden / 0 normal / 1 dimmed / 2 overhead-highlight
attribute float aState;
uniform float uSize;
uniform float uDpr;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float scale = aState > 1.5 ? 1.8 : 1.0;
  float size = clamp(uSize * scale / -mv.z, 1.5, 16.0) * uDpr;
  gl_PointSize = aState < -0.5 ? 0.0 : size;
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = aState < -0.5 ? 0.0 : (aState > 1.5 ? 1.0 : (aState > 0.5 ? 0.18 : 0.85));
}
`

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha <= 0.001) discard;
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float edge = smoothstep(0.5, 0.32, d);
  gl_FragColor = vec4(vColor, vAlpha * edge);
}
`

const OVERHEAD_REFRESH_FRAMES = 5
const COUNT_PUSH_FRAMES = 30

export function Satellites() {
  const catalog = useAppStore((s) => s.catalog)
  const enabledCategories = useAppStore((s) => s.enabledCategories)
  const dpr = useThree((s) => s.viewport.dpr)

  const pointsRef = useRef<THREE.Points>(null)
  const frame = useRef(0)
  const overheadFlags = useRef<Uint8Array | null>(null)
  const lastOverheadCount = useRef(-1)

  const buffers = useMemo(() => {
    if (!catalog) return null
    const count = catalog.count
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const states = new Float32Array(count)
    const visible = new Uint8Array(count).fill(1)
    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
      color.set(CATEGORY_ORDER[catalog.categories[i]].color)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    overheadFlags.current = new Uint8Array(count)
    renderBuffers.visible = visible
    renderBuffers.count = count
    return { positions, colors, states, visible, count }
  }, [catalog])

  const uniforms = useMemo(() => ({ uSize: { value: 26 }, uDpr: { value: dpr } }), [dpr])

  // category-filter visibility → both the pick mask and the shader state attr
  useEffect(() => {
    if (!buffers || !catalog) return
    for (let i = 0; i < buffers.count; i++) {
      buffers.visible[i] = enabledCategories[catalog.categories[i]] ? 1 : 0
    }
    writeStates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffers, catalog, enabledCategories])

  function writeStates() {
    if (!buffers) return
    const overheadMode = useAppStore.getState().cameraMode === 'overhead'
    const flags = overheadFlags.current
    for (let i = 0; i < buffers.count; i++) {
      if (!buffers.visible[i]) {
        buffers.states[i] = -1
      } else if (overheadMode && flags) {
        buffers.states[i] = flags[i] ? 2 : 1
      } else {
        buffers.states[i] = 0
      }
    }
    const geo = pointsRef.current?.geometry
    const attr = geo?.getAttribute('aState') as THREE.BufferAttribute | undefined
    if (attr) attr.needsUpdate = true
  }

  useFrame(() => {
    if (!buffers || !pointsRef.current) return
    const snap = snapshotRef.current
    if (!snap) return

    const state = useAppStore.getState()
    const simMs = simNow(state.clock, performance.now())
    const dtSec = (simMs - snap.simTimeMs) / 1000
    const n = Math.min(buffers.count, snap.count)
    const pos = buffers.positions
    for (let i = 0; i < n * 3; i++) {
      pos[i] = snap.positions[i] + snap.velocities[i] * dtSec
    }
    renderBuffers.positions = pos
    renderBuffers.velocities = snap.velocities

    const geo = pointsRef.current.geometry
    ;(geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true

    frame.current++
    if (state.cameraMode === 'overhead' && state.userLocation && overheadFlags.current) {
      if (frame.current % OVERHEAD_REFRESH_FRAMES === 0) {
        const p = latLonToScene(state.userLocation.latDeg, state.userLocation.lonDeg)
        const found = computeOverheadFlags(pos, n, p, overheadFlags.current)
        writeStates()
        if (
          found !== lastOverheadCount.current &&
          frame.current % COUNT_PUSH_FRAMES < OVERHEAD_REFRESH_FRAMES
        ) {
          lastOverheadCount.current = found
          state.setOverheadCount(found)
        }
      }
    } else if (lastOverheadCount.current !== -1) {
      lastOverheadCount.current = -1
      writeStates()
    }
  })

  if (!buffers) return null

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[buffers.positions, 3]}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute attach="attributes-aColor" args={[buffers.colors, 3]} />
        <bufferAttribute
          attach="attributes-aState"
          args={[buffers.states, 1]}
          usage={THREE.DynamicDrawUsage}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  )
}
