import type CameraControls from 'camera-controls'
import { overheadCamera, latLonToScene, normalize, EARTH_RADIUS_UNITS } from '../lib/geo'
import type { UserLocation } from '../types'

export const HOME_POSITION: [number, number, number] = [0, 5, 17]

/** Set by CameraRig once the drei CameraControls instance mounts. */
export const controlsRef: { current: CameraControls | null } = { current: null }

export function flyToOverhead(loc: UserLocation): void {
  const { position, target } = overheadCamera(loc.latDeg, loc.lonDeg)
  void controlsRef.current?.setLookAt(
    position[0],
    position[1],
    position[2],
    target[0],
    target[1],
    target[2],
    true,
  )
}

export function flyHome(): void {
  void controlsRef.current?.setLookAt(...HOME_POSITION, 0, 0, 0, true)
}

/** Rotate the camera so a satellite (scene position) is centered, keeping distance. */
export function flyToSatellite(satPos: [number, number, number]): void {
  const controls = controlsRef.current
  if (!controls) return
  const dist = Math.max(controls.distance, EARTH_RADIUS_UNITS + 4)
  const dir = normalize(satPos)
  if (dir[0] === 0 && dir[1] === 0 && dir[2] === 0) return
  void controls.setLookAt(dir[0] * dist, dir[1] * dist, dir[2] * dist, 0, 0, 0, true)
}

export function userMarkerPosition(loc: UserLocation): [number, number, number] {
  return latLonToScene(loc.latDeg, loc.lonDeg)
}
