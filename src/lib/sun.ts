import { sunPos, jday, gstime, eciToEcf } from 'satellite.js'
import { ecefKmToScene, normalize, type Vec3 } from './geo'

/**
 * Unit vector toward the Sun in scene coordinates for a given sim time.
 * Drives the day/night terminator in the Earth shader. The scene is
 * Earth-fixed, so the Sun direction moves as sim time advances.
 */
export function sunDirectionScene(simTimeMs: number): Vec3 {
  const d = new Date(simTimeMs)
  const jd = jday(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  )
  const { rsun } = sunPos(jd)
  const gmst = gstime(d)
  const ecf = eciToEcf({ x: rsun.x, y: rsun.y, z: rsun.z }, gmst)
  return normalize(ecefKmToScene(ecf.x, ecf.y, ecf.z))
}
