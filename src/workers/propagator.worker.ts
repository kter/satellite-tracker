import { twoline2satrec, propagate, gstime, type SatRec } from 'satellite.js'
import type { MainToWorker, WorkerToMain } from './protocol'
import { ecefKmToScene } from '../lib/geo'
import { deriveSatMeta, packMeta } from '../lib/satMeta'
import { CATEGORY_INDEX } from '../lib/groups'
import { computeScenePosVel } from '../lib/propagation'

interface WorkerClock {
  baseSimMs: number
  baseRealMs: number
  multiplier: number
  paused: boolean
}

let satrecs: SatRec[] = []
let dead: Uint8Array = new Uint8Array(0)
let count = 0
let clock: WorkerClock = { baseSimMs: 0, baseRealMs: 0, multiplier: 1, paused: false }
let timer: ReturnType<typeof setTimeout> | null = null
/** adaptive propagation interval; ≥ 2× measured wall time so the worker idles ≥ 50% */
let intervalMs = 250

function simNow(): number {
  if (clock.paused) return clock.baseSimMs
  return clock.baseSimMs + (performance.now() - clock.baseRealMs) * clock.multiplier
}

function post(msg: WorkerToMain, transfer: Transferable[] = []) {
  ;(postMessage as (m: WorkerToMain, t: Transferable[]) => void)(msg, transfer)
}

function propagateAll() {
  const t0 = performance.now()
  const simMs = simNow()
  const date = new Date(simMs)
  const gmst = gstime(date)
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    if (dead[i]) continue
    const pv = computeScenePosVel(satrecs[i], date, gmst)
    if (!pv) {
      dead[i] = 1
      // dead satellites stay parked at the origin (inside the Earth, never visible)
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
  if (idx < 0 || dead[idx]) return
  const rec = satrecs[idx]
  const meta = deriveSatMeta(rec)
  const periodMs = meta.periodMin * 60 * 1000
  // ECI ellipse (no per-sample gmst): the renderer counter-rotates the whole
  // line by -gmst(simTime) so it stays consistent with the Earth-fixed scene.
  const points = new Float32Array((samples + 1) * 3)
  for (let s = 0; s <= samples; s++) {
    const t = simTimeMs + (periodMs * s) / samples
    let pv: ReturnType<typeof propagate>
    try {
      pv = propagate(rec, new Date(t))
    } catch {
      continue
    }
    if (!pv || typeof pv.position === 'boolean') continue
    const [x, y, z] = ecefKmToScene(pv.position.x, pv.position.y, pv.position.z)
    points[s * 3] = x
    points[s * 3 + 1] = y
    points[s * 3 + 2] = z
  }
  post({ type: 'orbit', noradId, periodMin: meta.periodMin, points }, [points.buffer])
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
      dead = new Uint8Array(count)
      clock = {
        baseSimMs: msg.simTimeMs,
        baseRealMs: performance.now(),
        multiplier: msg.multiplier,
        paused: msg.paused,
      }
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
      clock = {
        baseSimMs: msg.simTimeMs,
        baseRealMs: performance.now(),
        multiplier: msg.multiplier,
        paused: msg.paused,
      }
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
