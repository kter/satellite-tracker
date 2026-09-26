import { twoline2satrec, gstime, type SatRec } from 'satellite.js'
import type { MainToWorker, WorkerToMain } from './protocol'
import { deriveSatMeta, packMeta } from '../lib/satMeta'
import { CATEGORY_INDEX } from '../lib/groups'
import { computeScenePosVel, sampleOrbitEci } from '../lib/propagation'
import { clockFromSync, makeClock, simNow, type ClockState } from '../lib/time'

let satrecs: SatRec[] = []
/** 1 once SGP4 has failed for a satellite; it is never propagated again */
let propagationFailed: Uint8Array = new Uint8Array(0)
let count = 0
let clock: ClockState = makeClock(0, 0)
let timer: ReturnType<typeof setTimeout> | null = null
/** adaptive propagation interval; ≥ 2× measured wall time so the worker idles ≥ 50% */
let intervalMs = 250

function post(msg: WorkerToMain, transfer: Transferable[] = []) {
  ;(postMessage as (m: WorkerToMain, t: Transferable[]) => void)(msg, transfer)
}

function propagateAll() {
  const t0 = performance.now()
  const simMs = simNow(clock, performance.now())
  const date = new Date(simMs)
  const gmst = gstime(date)
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    if (propagationFailed[i]) continue
    const pv = computeScenePosVel(satrecs[i], date, gmst)
    if (!pv) {
      propagationFailed[i] = 1
      // failed satellites stay parked at the origin (inside the Earth, never visible)
      continue
    }
    positions.set(pv.position, i * 3)
    velocities.set(pv.velocity, i * 3)
  }

  const wallMs = performance.now() - t0
  intervalMs = Math.max(250, Math.min(2000, wallMs * 2))
  post({ type: 'positions', simTimeMs: simMs, positions, velocities }, [
    positions.buffer,
    velocities.buffer,
  ])
}

function loop() {
  propagateAll()
  timer = setTimeout(loop, intervalMs)
}

function sampleOrbit(noradId: number, samples: number, simTimeMs: number) {
  const idx = satrecs.findIndex((r) => Number(r.satnum) === noradId)
  if (idx < 0 || propagationFailed[idx]) return
  const rec = satrecs[idx]
  const meta = deriveSatMeta(rec)
  // ECI ellipse (no per-sample gmst): the renderer counter-rotates the whole
  // line by -gmst(simTime) so it stays consistent with the Earth-fixed scene.
  // The window is centered on simTimeMs (±T/2) so the open seam left by J2
  // precession sits at the antipode instead of right at the satellite.
  const points = sampleOrbitEci(rec, simTimeMs, meta.periodMin * 60 * 1000, samples)
  post({ type: 'orbit', noradId, periodMin: meta.periodMin, sampledAtMs: simTimeMs, points }, [
    points.buffer,
  ])
}

onmessage = (ev: MessageEvent<MainToWorker>) => {
  const msg = ev.data
  switch (msg.type) {
    case 'init': {
      const names: string[] = []
      const noradIds = new Int32Array(msg.sats.length)
      const categoriesArr = new Uint8Array(msg.sats.length)
      satrecs = []
      const metas = []
      let n = 0
      for (const sat of msg.sats) {
        let rec: SatRec
        try {
          rec = twoline2satrec(sat.line1, sat.line2)
        } catch {
          continue // drop parse failures
        }
        satrecs.push(rec)
        names.push(sat.name)
        noradIds[n] = sat.noradId
        categoriesArr[n] = CATEGORY_INDEX[sat.category]
        metas.push(deriveSatMeta(rec))
        n++
      }
      count = n
      propagationFailed = new Uint8Array(count)
      clock = clockFromSync(msg.clock, performance.now())
      post({
        type: 'ready',
        count,
        names,
        noradIds: noradIds.slice(0, count),
        categories: categoriesArr.slice(0, count),
        meta: packMeta(metas),
      })
      if (timer) clearTimeout(timer)
      loop()
      break
    }
    case 'timeSync': {
      clock = clockFromSync(msg.clock, performance.now())
      // re-propagate immediately so jumps (pause, reset-to-now) take effect fast
      if (timer) {
        clearTimeout(timer)
        loop()
      }
      break
    }
    case 'requestOrbit': {
      sampleOrbit(msg.noradId, msg.samples, msg.simTimeMs)
      break
    }
  }
}
