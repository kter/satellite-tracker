import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAppStore } from '../state/store'
import { latLonToScene, tangentBasis } from '../lib/geo'
import { MIN_ELEVATION_DEG } from '../lib/overhead'

const CONE_HEIGHT = 2.5
const CONE_HALF_ANGLE_RAD = ((90 - MIN_ELEVATION_DEG) * Math.PI) / 180

/** Pin + translucent zenith cone marking the "overhead" region at the user location. */
export function UserMarker() {
  const userLocation = useAppStore((s) => s.userLocation)
  const pinRef = useRef<THREE.Mesh>(null)

  const placement = useMemo(() => {
    if (!userLocation) return null
    const p = latLonToScene(userLocation.latDeg, userLocation.lonDeg)
    const { up } = tangentBasis(p)
    const upVec = new THREE.Vector3(...up)
    // ConeGeometry's apex points along local +Y; map +Y → −up so the apex sits
    // at the user location and the cone opens skyward.
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      upVec.clone().negate(),
    )
    const conePos = new THREE.Vector3(...p).addScaledVector(upVec, CONE_HEIGHT / 2)
    return { pinPosition: new THREE.Vector3(...p), quat, conePos }
  }, [userLocation])

  useFrame(({ clock }) => {
    if (pinRef.current) {
      const s = 1 + 0.25 * Math.sin(clock.elapsedTime * 4)
      pinRef.current.scale.setScalar(s)
    }
  })

  if (!placement) return null
  const coneRadius = CONE_HEIGHT * Math.tan(CONE_HALF_ANGLE_RAD)

  return (
    <group>
      <mesh ref={pinRef} position={placement.pinPosition}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial color="#ff7d4d" />
      </mesh>
      {/* zenith cone: apex at the user, opening upward; half-angle = 90° − min elevation */}
      <mesh position={placement.conePos} quaternion={placement.quat}>
        <coneGeometry args={[coneRadius, CONE_HEIGHT, 48, 1, true]} />
        <meshBasicMaterial
          color="#4da6ff"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
