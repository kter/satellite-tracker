/**
 * Coordinate conventions (single source of truth):
 *
 * - ECEF (km): WGS84 Earth-fixed frame, Z = polar axis.
 * - Scene units: 1 unit = 1000 km, axes remapped to three.js Y-up:
 *     scene = (ecef.x, ecef.z, -ecef.y) / 1000
 *   The same permutation applies to ECI vectors (it is frame-agnostic).
 */

export const KM_PER_UNIT = 1000
export const EARTH_RADIUS_KM = 6371
export const EARTH_RADIUS_UNITS = EARTH_RADIUS_KM / KM_PER_UNIT

// WGS84 ellipsoid
const WGS84_A = 6378.137 // semi-major axis, km
const WGS84_E2 = 6.69437999014e-3 // first eccentricity squared

export type Vec3 = [number, number, number]

export function ecefKmToScene(x: number, y: number, z: number): Vec3 {
  return [x / KM_PER_UNIT, z / KM_PER_UNIT, -y / KM_PER_UNIT]
}

export function sceneToEcefKm(x: number, y: number, z: number): Vec3 {
  return [x * KM_PER_UNIT, -z * KM_PER_UNIT, y * KM_PER_UNIT]
}

/** Geodetic lat/lon (degrees) + altitude (km) → ECEF km (WGS84). */
export function latLonAltToEcefKm(latDeg: number, lonDeg: number, altKm = 0): Vec3 {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const sinLat = Math.sin(lat)
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat)
  const cosLat = Math.cos(lat)
  return [
    (n + altKm) * cosLat * Math.cos(lon),
    (n + altKm) * cosLat * Math.sin(lon),
    (n * (1 - WGS84_E2) + altKm) * sinLat,
  ]
}

export function latLonToScene(latDeg: number, lonDeg: number, altKm = 0): Vec3 {
  const [x, y, z] = latLonAltToEcefKm(latDeg, lonDeg, altKm)
  return ecefKmToScene(x, y, z)
}

function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

export function normalize(v: Vec3): Vec3 {
  const n = norm(v)
  if (n === 0) return [0, 0, 0]
  return [v[0] / n, v[1] / n, v[2] / n]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export interface TangentBasis {
  up: Vec3
  east: Vec3
  north: Vec3
}

/**
 * Local tangent basis at a scene-space point. Scene Y is the polar axis;
 * near the poles (|up·Y| > 0.999) fall back to scene X to keep east defined.
 */
export function tangentBasis(pScene: Vec3): TangentBasis {
  const up = normalize(pScene)
  const polar: Vec3 = [0, 1, 0]
  const ref: Vec3 = Math.abs(dot(up, polar)) > 0.999 ? [1, 0, 0] : polar
  const east = normalize(cross(ref, up))
  const north = normalize(cross(up, east))
  return { up, east, north }
}

export interface ObliqueCamera {
  position: Vec3
  target: Vec3
}

/** Camera tilt off the zenith axis. 0 would be a straight top-down view. */
export const OVERHEAD_TILT_RAD = (38 * Math.PI) / 180
/** Camera distance from the user location, in scene units (≈ 2,200 km). */
export const OVERHEAD_DISTANCE_UNITS = 2.2
/** Aim a little above the user so the LEO shell sits mid-frame. */
export const OVERHEAD_TARGET_LIFT_UNITS = 0.4

/*
 * Closest the camera may dolly to its orbit target. camera-controls measures
 * this from the target, not the Earth's center, so each camera mode needs its
 * own limit.
 */
/** Free mode orbits the Earth's center → ~80 km above the surface. */
export const FREE_MIN_CAMERA_DISTANCE_UNITS = EARTH_RADIUS_UNITS + 0.08
/**
 * Overhead mode orbits a point above the user; the limit must stay below the
 * overhead framing distance or the first zoom-in would snap the camera outward.
 */
export const OVERHEAD_MIN_CAMERA_DISTANCE_UNITS = 0.2

/**
 * Oblique "overhead" camera for a ground location: positioned off-zenith by
 * OVERHEAD_TILT_RAD toward the south (looking poleward) so satellite altitude
 * differences above the user are visually separated.
 */
export function overheadCamera(latDeg: number, lonDeg: number): ObliqueCamera {
  const p = latLonToScene(latDeg, lonDeg)
  const { up, north } = tangentBasis(p)
  const cosT = Math.cos(OVERHEAD_TILT_RAD)
  const sinT = Math.sin(OVERHEAD_TILT_RAD)
  const dir: Vec3 = [
    up[0] * cosT - north[0] * sinT,
    up[1] * cosT - north[1] * sinT,
    up[2] * cosT - north[2] * sinT,
  ]
  return {
    position: [
      p[0] + dir[0] * OVERHEAD_DISTANCE_UNITS,
      p[1] + dir[1] * OVERHEAD_DISTANCE_UNITS,
      p[2] + dir[2] * OVERHEAD_DISTANCE_UNITS,
    ],
    target: [
      p[0] + up[0] * OVERHEAD_TARGET_LIFT_UNITS,
      p[1] + up[1] * OVERHEAD_TARGET_LIFT_UNITS,
      p[2] + up[2] * OVERHEAD_TARGET_LIFT_UNITS,
    ],
  }
}
