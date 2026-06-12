import { useEffect } from 'react'
import { create } from 'zustand'
import type { SatSource } from '../types'
import type { WorkerToMain } from '../workers/protocol'
import { fetchAllTles } from '../lib/tle'
import { applyBudget, satBudget } from '../lib/device'
import { useAppStore, currentSimTimeMs } from '../state/store'

export interface Snapshot {
  positions: Float32Array
  velocities: Float32Array
  simTimeMs: number
  count: number
}

/**
 * Latest worker snapshot, read every frame by the scene without React
 * re-renders. Single app instance → module-level ref is fine.
 */
export const snapshotRef: { current: Snapshot | null } = { current: null }

interface OrbitState {
  noradId: number | null
  periodMin: number
  points: Float32Array | null
  setOrbit: (noradId: number, periodMin: number, points: Float32Array) => void
  clearOrbit: () => void
}

export const useOrbitStore = create<OrbitState>((set) => ({
  noradId: null,
  periodMin: 0,
  points: null,
  setOrbit: (noradId, periodMin, points) => set({ noradId, periodMin, points }),
  clearOrbit: () => set({ noradId: null, points: null, periodMin: 0 }),
}))

let workerSingleton: Worker | null = null

export function requestOrbit(noradId: number): void {
  workerSingleton?.postMessage({
    type: 'requestOrbit',
    noradId,
    samples: 256,
    simTimeMs: currentSimTimeMs(),
  })
}

/**
 * Owns the SGP4 worker: fetches TLEs, initializes the worker, keeps the
 * worker clock in sync with the store clock, and routes messages.
 */
export function usePropagator(): void {
  useEffect(() => {
    // Effect is fully cleaned up (worker terminated) so StrictMode's dev-time
    // mount→unmount→mount cycle just creates a fresh worker.
    const worker = new Worker(new URL('../workers/propagator.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerSingleton = worker

    worker.onmessage = (ev: MessageEvent<WorkerToMain>) => {
      const msg = ev.data
      const store = useAppStore.getState()
      switch (msg.type) {
        case 'ready':
          store.setCatalog({
            count: msg.count,
            names: msg.names,
            noradIds: msg.noradIds,
            categories: msg.categories,
            meta: msg.meta,
          })
          break
        case 'positions':
          snapshotRef.current = {
            positions: msg.positions,
            velocities: msg.velocities,
            simTimeMs: msg.simTimeMs,
            count: msg.positions.length / 3,
          }
          break
        case 'orbit':
          useOrbitStore.getState().setOrbit(msg.noradId, msg.periodMin, msg.points)
          break
      }
    }

    const load = async () => {
      const store = useAppStore.getState()
      try {
        const result = await fetchAllTles(localStorage, Date.now(), (done, total) =>
          useAppStore.getState().setLoadProgress(done, total),
        )
        const budgeted: SatSource[] = applyBudget(
          result.sats,
          satBudget(useAppStore.getState().qualityTier),
        )
        useAppStore.getState().setDataInfo(result.fetchedAt, result.usedStaleCache)
        const clock = useAppStore.getState().clock
        worker.postMessage({
          type: 'init',
          sats: budgeted,
          simTimeMs: currentSimTimeMs(),
          multiplier: clock.multiplier,
          paused: clock.paused,
        })
      } catch (err) {
        store.setLoadState('error', err instanceof Error ? err.message : String(err))
      }
    }
    void load()

    // keep the worker clock mirrored on every multiplier/pause/reset change
    let prevClock = useAppStore.getState().clock
    const unsubscribe = useAppStore.subscribe((s) => {
      if (s.clock !== prevClock) {
        prevClock = s.clock
        worker.postMessage({
          type: 'timeSync',
          simTimeMs: currentSimTimeMs(),
          multiplier: s.clock.multiplier,
          paused: s.clock.paused,
        })
      }
    })

    // periodic re-sync guards against drift between the two clocks
    const interval = setInterval(() => {
      const clock = useAppStore.getState().clock
      worker.postMessage({
        type: 'timeSync',
        simTimeMs: currentSimTimeMs(),
        multiplier: clock.multiplier,
        paused: clock.paused,
      })
    }, 5000)

    return () => {
      unsubscribe()
      clearInterval(interval)
      worker.terminate()
      workerSingleton = null
    }
  }, [])
}
