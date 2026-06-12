import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { selectLabels, LABEL_MAX_CAMERA_DISTANCE_UNITS, MAX_LABELS } from './labels'

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

function base(positions: Float32Array, cameraPosition: [number, number, number]) {
  const { viewProjection } = makeCamera(cameraPosition)
  return {
    positions,
    count: positions.length / 3,
    states: null,
    selectedIndex: null,
    viewProjection,
    cameraPosition,
    viewportWidth: W,
    viewportHeight: H,
  }
}

describe('selectLabels', () => {
  it('labels a normal satellite within the camera-distance gate', () => {
    // camera at z=10 looking at origin; sat at z=8 is 2 units away (< gate)
    const labels = selectLabels(base(new Float32Array([0, 0, 8]), [0, 0, 10]))
    expect(labels).toHaveLength(1)
    expect(labels[0].index).toBe(0)
    expect(labels[0].x).toBeCloseTo(W / 2, 0)
    expect(labels[0].y).toBeCloseTo(H / 2, 0)
    expect(labels[0].distanceUnits).toBeCloseTo(2, 5)
  })

  it('does not label a normal satellite beyond the gate', () => {
    const far = LABEL_MAX_CAMERA_DISTANCE_UNITS + 1
    const labels = selectLabels(base(new Float32Array([0, 0, 10 - far]), [0, 0, 10]))
    expect(labels).toHaveLength(0)
  })

  it('always labels the selected satellite regardless of distance', () => {
    const far = LABEL_MAX_CAMERA_DISTANCE_UNITS + 10
    const labels = selectLabels({
      ...base(new Float32Array([0, 0, 30 - far]), [0, 0, 30]),
      selectedIndex: 0,
    })
    expect(labels).toHaveLength(1)
  })

  it('always labels overhead-highlighted satellites regardless of distance', () => {
    const far = LABEL_MAX_CAMERA_DISTANCE_UNITS + 10
    const labels = selectLabels({
      ...base(new Float32Array([0, 0, 30 - far]), [0, 0, 30]),
      states: new Float32Array([2]),
    })
    expect(labels).toHaveLength(1)
  })

  it('skips hidden and dimmed satellites', () => {
    const positions = new Float32Array([0, 0.5, 8, 0, -0.5, 8])
    const labels = selectLabels({
      ...base(positions, [0, 0, 10]),
      states: new Float32Array([-1, 1]),
    })
    expect(labels).toHaveLength(0)
  })

  it('still labels a dimmed satellite when it is the selected one', () => {
    const labels = selectLabels({
      ...base(new Float32Array([0, 0, 8]), [0, 0, 10]),
      states: new Float32Array([1]),
      selectedIndex: 0,
    })
    expect(labels).toHaveLength(1)
  })

  it('skips satellites occluded by the Earth', () => {
    // camera in front of the globe; satellite straight behind it
    const labels = selectLabels({
      ...base(new Float32Array([0, 0, -8]), [0, 0, 10]),
      states: new Float32Array([2]), // overhead state ignores the distance gate
    })
    expect(labels).toHaveLength(0)
  })

  it('skips satellites behind the camera and off-screen', () => {
    const positions = new Float32Array([
      0,
      0,
      12, // behind the camera at z=10 (camera looks toward -z)
      0,
      30,
      8, // way above the frustum
    ])
    const labels = selectLabels({
      ...base(positions, [0, 0, 10]),
      states: new Float32Array([2, 2]),
    })
    expect(labels).toHaveLength(0)
  })

  it('orders nearest first and puts the selected satellite at the front', () => {
    const positions = new Float32Array([
      1,
      1,
      7, // 3.3 units from camera
      0,
      0,
      9, // 1 unit from camera (nearest)
      -1,
      -1,
      7.5, // selected, 3 units
    ])
    const labels = selectLabels({ ...base(positions, [0, 0, 10]), selectedIndex: 2 })
    expect(labels.map((l) => l.index)).toEqual([2, 1, 0])
  })

  it('caps the number of labels and de-clutters overlapping ones', () => {
    // 60 sats in a tight screen cluster + grid spread: never more than MAX_LABELS
    const n = 60
    const positions = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (i % 8) * 0.3 - 1
      positions[i * 3 + 1] = Math.floor(i / 8) * 0.3 - 1
      positions[i * 3 + 2] = 8
    }
    const labels = selectLabels(base(positions, [0, 0, 10]))
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.length).toBeLessThanOrEqual(MAX_LABELS)
  })

  it('two satellites in the same grid cell yield a single label', () => {
    const positions = new Float32Array([0, 0, 8, 0.001, 0.001, 8])
    const labels = selectLabels(base(positions, [0, 0, 10]))
    expect(labels).toHaveLength(1)
  })
})
