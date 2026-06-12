import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Page } from '@playwright/test'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')

const FIXTURE_BY_GROUP: Record<string, string> = {
  stations: 'stations.tle',
  starlink: 'starlink.tle',
  'gps-ops': 'gps-ops.tle',
  'glo-ops': 'glo-ops.tle',
  galileo: 'galileo.tle',
  beidou: 'beidou.tle',
  weather: 'weather.tle',
  science: 'science.tle',
  geo: 'geo.tle',
  // "active" is huge in reality; serving geo dupes keeps tests fast and deterministic
  active: 'geo.tle',
}

export interface TleIntercept {
  /** number of CelesTrak requests that reached the route handler */
  requestCount: () => number
}

/**
 * Serve deterministic TLE fixtures for every CelesTrak request. Keeps E2E
 * independent of network, rate limits, and live orbital data — and works
 * identically against local, dev, and prd targets.
 */
export async function interceptTles(page: Page): Promise<TleIntercept> {
  let count = 0
  await page.route('**/celestrak.org/**', async (route) => {
    count += 1
    const url = new URL(route.request().url())
    const group = url.searchParams.get('GROUP') ?? 'stations'
    const file = FIXTURE_BY_GROUP[group] ?? 'stations.tle'
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: readFileSync(path.join(fixturesDir, file), 'utf8'),
    })
  })
  return { requestCount: () => count }
}

interface SatDebug {
  loadState: string
  satCount: number
  selectedNoradId: number | null
  selectedName: string | null
  overheadCount: number
  cameraMode: string
  multiplier: number
  paused: boolean
  usedStaleCache: boolean
}

export async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const d = (window as unknown as { __satDebug?: SatDebug }).__satDebug
      return d?.loadState === 'ready' && d.satCount > 0
    },
    { timeout: 30_000 },
  )
}

export function satDebug(page: Page): Promise<SatDebug> {
  return page.evaluate(() => (window as unknown as { __satDebug: SatDebug }).__satDebug)
}

/** On the mobile layout the panel content lives in the bottom sheet — open it. */
export async function openPanelIfMobile(page: Page): Promise<void> {
  const handle = page.getByTestId('sheet-handle')
  if (await handle.isVisible()) {
    await handle.click()
  }
}

export const TOKYO = { latitude: 35.6812, longitude: 139.7671 }
