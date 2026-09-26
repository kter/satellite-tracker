import { useEffect } from 'react'
import type { SatSource } from '../types'
import type { MainToWorker, WorkerToMain } from '../workers/protocol'
import { fetchAllTles } from '../lib/tle'
import { applyBudget, satBudget } from '../lib/device'
import { useAppStore, currentSimTimeMs } from '../state/store'
import { useOrbitStore } from '../state/orbitStore'
import { clockSyncAt, type ClockSync } from '../lib/time'

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

let workerSingleton: Worker | null = null

function post(worker: Worker | null, msg: MainToWorker): void {
  worker?.postMessage(msg)
}

/** Current store clock in the wire form the worker mirrors. */
function currentClockSync(): ClockSync {
  return clockSyncAt(useAppStore.getState().clock, performance.now())
}

export function requestOrbit(noradId: number): void {
  post(workerSingleton, {
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
          useOrbitStore.getState().setOrbit(msg.noradId, msg.periodMin, msg.sampledAtMs, msg.points)
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
        post(worker, { type: 'init', sats: budgeted, clock: currentClockSync() })
      } catch (err) {
        store.setLoadState('error', err instanceof Error ? err.message : String(err))
      }
    }
    void load()

    // keep the worker clock mirrored on every multiplier/pause/reset change
    const syncClock = () => post(worker, { type: 'timeSync', clock: currentClockSync() })
    let prevClock = useAppStore.getState().clock
    const unsubscribe = useAppStore.subscribe((s) => {
      if (s.clock !== prevClock) {
        prevClock = s.clock
        syncClock()
      }
    })

    // periodic re-sync guards against drift between the two clocks
    const interval = setInterval(syncClock, 5000)

    return () => {
      unsubscribe()
      clearInterval(interval)
      worker.terminate()
      workerSingleton = null
    }
  }, [])
}
