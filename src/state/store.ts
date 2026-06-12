import { create } from 'zustand'
import type { CameraMode, LoadState, QualityTier, SatCatalog, UserLocation } from '../types'
import {
  makeClock,
  resetToNow,
  setMultiplier as clockSetMultiplier,
  setPaused as clockSetPaused,
  simNow,
  type ClockState,
} from '../lib/time'
import { CATEGORY_ORDER } from '../lib/groups'
import { pickQualityTier, readDeviceInfo } from '../lib/device'

export interface AppState {
  clock: ClockState
  catalog: SatCatalog | null
  loadState: LoadState
  loadProgress: { done: number; total: number }
  loadError: string | null
  dataFetchedAt: number | null
  usedStaleCache: boolean

  selectedIndex: number | null
  enabledCategories: boolean[]
  searchQuery: string
  userLocation: UserLocation | null
  cameraMode: CameraMode
  overheadCount: number
  /** satellite name labels drawn this frame (E2E assertion surface) */
  labelCount: number
  qualityTier: QualityTier
  toast: string | null

  setMultiplier: (m: number) => void
  setPaused: (p: boolean) => void
  resetClock: () => void
  setCatalog: (c: SatCatalog) => void
  setLoadState: (s: LoadState, error?: string) => void
  setLoadProgress: (done: number, total: number) => void
  setDataInfo: (fetchedAt: number, usedStaleCache: boolean) => void
  select: (index: number | null) => void
  toggleCategory: (categoryIndex: number) => void
  setSearchQuery: (q: string) => void
  enterOverhead: (loc: UserLocation) => void
  exitOverhead: () => void
  setOverheadCount: (n: number) => void
  setLabelCount: (n: number) => void
  setCameraMode: (m: CameraMode) => void
  showToast: (msg: string) => void
  clearToast: () => void
}

export const useAppStore = create<AppState>((set) => ({
  clock: makeClock(Date.now(), performance.now()),
  catalog: null,
  loadState: 'loading',
  loadProgress: { done: 0, total: 1 },
  loadError: null,
  dataFetchedAt: null,
  usedStaleCache: false,

  selectedIndex: null,
  enabledCategories: CATEGORY_ORDER.map(() => true),
  searchQuery: '',
  userLocation: null,
  cameraMode: 'free',
  overheadCount: 0,
  labelCount: 0,
  qualityTier: pickQualityTier(readDeviceInfo()),
  toast: null,

  setMultiplier: (m) => set((s) => ({ clock: clockSetMultiplier(s.clock, m, performance.now()) })),
  setPaused: (p) => set((s) => ({ clock: clockSetPaused(s.clock, p, performance.now()) })),
  resetClock: () => set((s) => ({ clock: resetToNow(s.clock, Date.now(), performance.now()) })),
  setCatalog: (c) => set({ catalog: c, loadState: 'ready' }),
  setLoadState: (loadState, error) => set({ loadState, loadError: error ?? null }),
  setLoadProgress: (done, total) => set({ loadProgress: { done, total } }),
  setDataInfo: (dataFetchedAt, usedStaleCache) => set({ dataFetchedAt, usedStaleCache }),
  select: (selectedIndex) => set({ selectedIndex }),
  toggleCategory: (categoryIndex) =>
    set((s) => {
      const enabledCategories = s.enabledCategories.slice()
      enabledCategories[categoryIndex] = !enabledCategories[categoryIndex]
      return { enabledCategories }
    }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  enterOverhead: (userLocation) => set({ userLocation, cameraMode: 'overhead' }),
  exitOverhead: () => set({ cameraMode: 'free', overheadCount: 0 }),
  setOverheadCount: (overheadCount) => set({ overheadCount }),
  setLabelCount: (labelCount) => set({ labelCount }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}))

/** Current simulation time in ms (uses the live store clock). */
export function currentSimTimeMs(): number {
  return simNow(useAppStore.getState().clock, performance.now())
}
