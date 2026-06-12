import * as THREE from 'three'
import { EARTH_RADIUS_UNITS } from '../lib/geo'

const VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// BackSide sphere: fresnel rim facing the camera produces the blue halo.
const FRAGMENT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 + dot(viewDir, normalize(vNormal)), 3.5);
  vec3 glow = vec3(0.23, 0.48, 0.84) * fresnel;
  gl_FragColor = vec4(glow, fresnel * 0.65);
}
`

export function Atmosphere() {
  return (
    <mesh scale={1.035}>
      <sphereGeometry args={[EARTH_RADIUS_UNITS, 64, 64]} />
      <shaderMaterial
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
