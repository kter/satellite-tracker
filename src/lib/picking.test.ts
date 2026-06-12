import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { pickSatellite, isOccludedByEarth } from './picking'
import { EARTH_RADIUS_UNITS } from './geo'

const W = 800
const H = 600

function makeCamera(pos: [number, number, number], target: [number, number, number] = [0, 0, 0]) {
  const cam = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000)
  cam.position.set(...pos)
  cam.lookAt(...target)
  cam.updateMatrixWorld()
  const viewProjection = new THREE.Matrix4().multiplyMatrices(
    cam.projectionMatrix,
    cam.matrixWorldInverse,
  ).elements
  return { cam, viewProjection }
}

function projectToPx(cam: THREE.PerspectiveCamera, p: [number, number, number]) {
  const v = new THREE.Vector3(...p).project(cam)
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H }
}

describe('isOccludedByEarth', () => {
  it('blocks a satellite directly behind the globe', () => {
    expect(isOccludedByEarth([0, 0, 20], [0, 0, -8])).toBe(true)
  })

  it('does not block a satellite on the near side', () => {
    expect(isOccludedByEarth([0, 0, 20], [0, 0, 8])).toBe(false)
  })

  it('does not block a satellite well off to the side', () => {
    expect(isOccludedByEarth([0, 0, 20], [15, 0, -5])).toBe(false)
  })

  it('a satellite hovering just above the near surface is not blocked', () => {
    // segment ends 0.13 units above the surface, before the sphere is entered
    expect(isOccludedByEarth([0, 0, 20], [0, 0, EARTH_RADIUS_UNITS + 0.13])).toBe(false)
  })
})

describe('pickSatellite', () => {
  const satA: [number, number, number] = [0, 0, 8] // near side
  const satB: [number, number, number] = [2, 1, 8]
  const satBehind: [number, number, number] = [0, 0, -8] // hidden by the globe

  const positions = new Float32Array([...satA, ...satB, ...satBehind])
  const count = 3

  it('picks the satellite under the pointer', () => {
    const { cam, viewProjection } = makeCamera([0, 0, 20])
    const px = projectToPx(cam, satB)
    const idx = pickSatellite({
      positions,
      count,
      visible: null,
      viewProjection,
      cameraPosition: [0, 0, 20],
      pointerX: px.x + 3,
      pointerY: px.y - 2,
      viewportWidth: W,
      viewportHeight: H,
      thresholdPx: 14,
    })
    expect(idx).toBe(1)
  })

  it('returns -1 when nothing is within the threshold', () => {
    const { viewProjection } = makeCamera([0, 0, 20])
    const idx = pickSatellite({
      positions,
      count,
      visible: null,
      viewProjection,
      cameraPosition: [0, 0, 20],
      pointerX: 10,
      pointerY: 10,
      viewportWidth: W,
      viewportHeight: H,
      thresholdPx: 14,
    })
    expect(idx).toBe(-1)
  })

  it('never picks a satellite occluded by the Earth', () => {
    const { cam, viewProjection } = makeCamera([0, 0, 20])
    // satBehind projects to the screen center, same as satA — A must win;
    // with A hidden by filter, the occluded one still must not be picked
    const px = projectToPx(cam, satA)
    const visible = new Uint8Array([0, 1, 1])
    const idx = pickSatellite({
      positions,
      count,
      visible,
      viewProjection,
      cameraPosition: [0, 0, 20],
      pointerX: px.x,
      pointerY: px.y,
      viewportWidth: W,
      viewportHeight: H,
      thresholdPx: 14,
    })
    expect(idx).toBe(-1)
  })

  it('prefers the nearer satellite when two overlap on screen', () => {
    const overlapping = new Float32Array([0, 0, 10, 0, 0, 9])
    const { cam, viewProjection } = makeCamera([0, 0, 20])
    const px = projectToPx(cam, [0, 0, 10])
    const idx = pickSatellite({
      positions: overlapping,
      count: 2,
      visible: null,
      viewProjection,
      cameraPosition: [0, 0, 20],
      pointerX: px.x,
      pointerY: px.y,
      viewportWidth: W,
      viewportHeight: H,
      thresholdPx: 14,
    })
    expect(idx).toBe(0) // z=10 is closer to the camera at z=20
  })

  it('skips category-filtered satellites', () => {
    const { cam, viewProjection } = makeCamera([0, 0, 20])
    const px = projectToPx(cam, satB)
    const visible = new Uint8Array([1, 0, 1])
    const idx = pickSatellite({
      positions,
      count,
      visible,
      viewProjection,
      cameraPosition: [0, 0, 20],
      pointerX: px.x,
      pointerY: px.y,
      viewportWidth: W,
      viewportHeight: H,
      thresholdPx: 14,
    })
    expect(idx).toBe(-1)
  })

  it('ignores satellites behind the camera', () => {
    const behindCam = new Float32Array([0, 0, 30])
    const { viewProjection } = makeCamera([0, 0, 20])
    const idx = pickSatellite({
      positions: behindCam,
      count: 1,
      visible: null,
      viewProjection,
      cameraPosition: [0, 0, 20],
      pointerX: W / 2,
      pointerY: H / 2,
      viewportWidth: W,
      viewportHeight: H,
      thresholdPx: 50,
    })
    expect(idx).toBe(-1)
  })

  it('widens with the touch threshold', () => {
    const { cam, viewProjection } = makeCamera([0, 0, 20])
    const px = projectToPx(cam, satB)
    const base = {
      positions,
      count,
      visible: null,
      viewProjection,
      cameraPosition: [0, 0, 20] as [number, number, number],
      pointerX: px.x + 20,
      pointerY: px.y,
      viewportWidth: W,
      viewportHeight: H,
    }
    expect(pickSatellite({ ...base, thresholdPx: 14 })).toBe(-1)
    expect(pickSatellite({ ...base, thresholdPx: 28 })).toBe(1)
  })
})
