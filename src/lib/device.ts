import type { QualityTier } from '../types'

export interface DeviceInfo {
  deviceMemoryGb: number | undefined
  hardwareConcurrency: number | undefined
  isCoarsePointer: boolean
}

export function readDeviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    isCoarsePointer: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
  }
}

export function pickQualityTier(info: DeviceInfo): QualityTier {
  const mem = info.deviceMemoryGb
  const cores = info.hardwareConcurrency ?? 8
  if ((mem !== undefined && mem <= 2) || cores <= 4) return 'low'
  if ((mem !== undefined && mem < 8) || info.isCoarsePointer) return 'medium'
  return 'high'
}

/** Maximum number of satellites to propagate/render for a tier. */
export function satBudget(tier: QualityTier): number {
  switch (tier) {
    case 'high':
      return Infinity
    case 'medium':
      return 5000
    case 'low':
      return 2000
  }
}

export function dprFor(tier: QualityTier, deviceDpr: number): number {
  switch (tier) {
    case 'high':
      return Math.min(deviceDpr, 2)
    case 'medium':
      return Math.min(deviceDpr, 1.5)
    case 'low':
      return 1
  }
}

/**
 * Trim the satellite list to the tier budget while keeping category variety:
 * drop "other" first, then thin the largest remaining category (Starlink)
 * by taking every Nth entry.
 */
export function applyBudget<T extends { category: string }>(sats: T[], budget: number): T[] {
  if (sats.length <= budget) return sats
  const withoutOther = sats.filter((s) => s.category !== 'other')
  if (withoutOther.length <= budget) {
    return withoutOther.concat(
      sats.filter((s) => s.category === 'other').slice(0, budget - withoutOther.length),
    )
  }
  const starlink = withoutOther.filter((s) => s.category === 'starlink')
  const rest = withoutOther.filter((s) => s.category !== 'starlink')
  if (rest.length >= budget) return rest.slice(0, budget)
  const room = budget - rest.length
  const step = Math.ceil(starlink.length / room)
  const thinned = starlink.filter((_, i) => i % step === 0)
  return rest.concat(thinned).slice(0, budget)
}
