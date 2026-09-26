import { create } from 'zustand'

interface OrbitState {
  noradId: number | null
  periodMin: number
  /** sim time at the center of the sampled window */
  sampledAtMs: number
  points: Float32Array | null
  setOrbit: (noradId: number, periodMin: number, sampledAtMs: number, points: Float32Array) => void
  clearOrbit: () => void
}

/** Sampled orbit line of the selected satellite (filled by the SGP4 worker). */
export const useOrbitStore = create<OrbitState>((set) => ({
  noradId: null,
  periodMin: 0,
  sampledAtMs: 0,
  points: null,
  setOrbit: (noradId, periodMin, sampledAtMs, points) =>
    set({ noradId, periodMin, sampledAtMs, points }),
  clearOrbit: () => set({ noradId: null, points: null, periodMin: 0, sampledAtMs: 0 }),
}))
