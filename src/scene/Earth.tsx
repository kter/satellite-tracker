import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { EARTH_RADIUS_UNITS } from '../lib/geo'
import { sunDirectionScene } from '../lib/sun'
import { currentSimTimeMs, useAppStore } from '../state/store'

const VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpec;
uniform vec3 uSunDir;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vNormal);
  float sunDot = dot(n, uSunDir);
  float dayAmt = smoothstep(-0.12, 0.18, sunDot);

  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;
  vec3 cityGlow = night * vec3(1.0, 0.82, 0.55) * 1.6;
  // keep continents readable on the dark side: faint cool ambient of the day map
  vec3 nightSide = cityGlow + day * vec3(0.10, 0.12, 0.16);
  vec3 daySide = day * (0.55 + 0.6 * clamp(sunDot, 0.0, 1.0));
  vec3 col = mix(nightSide, daySide, dayAmt);

  // ocean specular highlight (spec map is bright on water)
  float specMask = texture2D(uSpec, vUv).r;
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 halfDir = normalize(uSunDir + viewDir);
  col += vec3(0.9, 0.9, 0.8) * pow(max(dot(n, halfDir), 0.0), 48.0) * specMask * dayAmt * 0.45;

  // faint blue limb so the night side reads as a sphere on the dark bg
  float rim = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
  col += vec3(0.12, 0.22, 0.42) * rim * 0.7;

  gl_FragColor = vec4(col, 1.0);
}
`

export function Earth() {
  const qualityTier = useAppStore((s) => s.qualityTier)
  // low tier sticks to the lighter 2K set; everyone else gets 4K NASA imagery
  const [day, night, spec] = useTexture(
    qualityTier === 'low'
      ? [
          '/textures/earth_atmos_2048.jpg',
          '/textures/earth_lights_2048.png',
          '/textures/earth_specular_2048.jpg',
        ]
      : [
          '/textures/earth_day_4k.jpg',
          '/textures/earth_night_4k.jpg',
          '/textures/earth_specular_2048.jpg',
        ],
  )

  const uniforms = useMemo(() => {
    for (const t of [day, night, spec]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
    }
    return {
      uDay: { value: day },
      uNight: { value: night },
      uSpec: { value: spec },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    }
  }, [day, night, spec])

  useFrame(() => {
    const [x, y, z] = sunDirectionScene(currentSimTimeMs())
    uniforms.uSunDir.value.set(x, y, z)
  })

  return (
    <mesh>
      <sphereGeometry args={[EARTH_RADIUS_UNITS, 96, 96]} />
      <shaderMaterial vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} />
    </mesh>
  )
}
