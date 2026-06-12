export type CategoryId =
  | 'stations'
  | 'starlink'
  | 'navigation'
  | 'weather'
  | 'science'
  | 'geo'
  | 'other'

export interface SatSource {
  name: string
  noradId: number
  line1: string
  line2: string
  category: CategoryId
}

export interface SatCatalog {
  count: number
  names: string[]
  noradIds: Int32Array
  /** index into CATEGORY_ORDER */
  categories: Uint8Array
  /** per-sat static meta: [inclinationDeg, periodMin, apogeeKm, perigeeKm] */
  meta: Float32Array
}

export type QualityTier = 'high' | 'medium' | 'low'

export type LoadState = 'loading' | 'ready' | 'error'

export interface UserLocation {
  latDeg: number
  lonDeg: number
}

export type CameraMode = 'free' | 'overhead'
