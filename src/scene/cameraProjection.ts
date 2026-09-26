import * as THREE from 'three'
import type { Vec3 } from '../lib/geo'

const viewProjection = new THREE.Matrix4()

/**
 * View-projection matrix + camera position in the shape the screen-space
 * helpers (picking, label selection) take. The returned `elements` array is
 * reused across calls — consume it before calling again.
 */
export function cameraProjection(camera: THREE.Camera): {
  viewProjection: Float32Array | number[]
  cameraPosition: Vec3
} {
  camera.updateMatrixWorld()
  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  return {
    viewProjection: viewProjection.elements,
    cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
  }
}
