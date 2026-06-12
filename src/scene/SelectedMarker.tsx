import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAppStore } from '../state/store'
import { renderBuffers } from './sharedBuffers'

/** Pulsing ring billboard riding on the selected satellite. */
export function SelectedMarker() {
  const selectedIndex = useAppStore((s) => s.selectedIndex)
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ camera, clock }) => {
    const g = groupRef.current
    if (!g) return
    const pos = renderBuffers.positions
    if (selectedIndex === null || !pos || selectedIndex >= renderBuffers.count) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.set(pos[selectedIndex * 3], pos[selectedIndex * 3 + 1], pos[selectedIndex * 3 + 2])
    g.quaternion.copy(camera.quaternion)
    const pulse = 1 + 0.18 * Math.sin(clock.elapsedTime * 5)
    // keep an approximately constant on-screen size
    const dist = camera.position.distanceTo(g.position)
    g.scale.setScalar(pulse * dist * 0.012)
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[1.25, 1.32, 48]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
