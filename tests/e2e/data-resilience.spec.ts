import { test, expect } from '@playwright/test'
import { interceptTles, waitForReady, satDebug } from './helpers'

test.describe('TLE data handling', () => {
  test('second load is served from the localStorage cache without network', async ({ page }) => {
    const intercept = await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)
    const firstLoadRequests = intercept.requestCount()
    expect(firstLoadRequests).toBeGreaterThan(0)

    await page.reload()
    await waitForReady(page)
    expect(intercept.requestCount()).toBe(firstLoadRequests) // zero new requests

    expect((await satDebug(page)).satCount).toBeGreaterThan(1000)
  })

  test('shows the error card when CelesTrak is unreachable and no cache exists', async ({
    page,
  }) => {
    await page.route('**/celestrak.org/**', (route) => route.abort('failed'))
    await page.goto('/')

    await expect(page.getByTestId('load-error')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('load-error')).toContainText('失敗')
  })

  test('falls back to the stale cache with a notice when refetch fails', async ({ page }) => {
    // 1st visit: populate the cache
    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)

    // expire the cache beyond its 2 h max-age, then break the network
    await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!
        if (!key.startsWith('tle-cache-v1:')) continue
        const entry = JSON.parse(localStorage.getItem(key)!)
        entry.fetchedAt = Date.now() - 3 * 60 * 60 * 1000
        localStorage.setItem(key, JSON.stringify(entry))
      }
    })
    await page.unroute('**/celestrak.org/**')
    await page.route('**/celestrak.org/**', (route) => route.abort('failed'))

    await page.reload()
    await waitForReady(page)

    const debug = await satDebug(page)
    expect(debug.satCount).toBeGreaterThan(1000)
    expect(debug.usedStaleCache).toBe(true)
    await expect(page.getByTestId('data-age')).toContainText('古い可能性あり')
  })
})
