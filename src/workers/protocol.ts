import type { SatSource } from '../types'

export interface InitMessage {
  type: 'init'
  sats: SatSource[]
  simTimeMs: number
  multiplier: number
  paused: boolean
}

export interface TimeSyncMessage {
  type: 'timeSync'
  simTimeMs: number
  multiplier: number
  paused: boolean
}

export interface RequestOrbitMessage {
  type: 'requestOrbit'
  noradId: number
  samples: number
  simTimeMs: number
}

export type MainToWorker = InitMessage | TimeSyncMessage | RequestOrbitMessage

export interface ReadyMessage {
  type: 'ready'
  count: number
  names: string[]
  noradIds: Int32Array
  categories: Uint8Array
  /** packed [inclinationDeg, periodMin, apogeeKm, perigeeKm] per sat */
  meta: Float32Array
}

export interface PositionsMessage {
  type: 'positions'
  simTimeMs: number
  /** scene-space positions, 3 floats per sat (transferred) */
  positions: Float32Array
  /** scene-space velocities, units per sim second, 3 floats per sat (transferred) */
  velocities: Float32Array
}

export interface OrbitMessage {
  type: 'orbit'
  noradId: number
  periodMin: number
  /** sim time at the center of the sampling window (the satellite sits mid-line here) */
  sampledAtMs: number
  /** ECI points over one period centered on sampledAtMs, 3 floats per sample (transferred) */
  points: Float32Array
}

export type WorkerToMain = ReadyMessage | PositionsMessage | OrbitMessage
