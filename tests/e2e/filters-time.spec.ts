import { test, expect } from '@playwright/test'
import { interceptTles, waitForReady, satDebug, openPanelIfMobile } from './helpers'

test.describe('category filters', () => {
  test('disabling Starlink reduces the visible count and re-enabling restores it', async ({
    page,
  }) => {
    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)
    await openPanelIfMobile(page)

    const readCount = async () => {
      const text = await page.getByTestId('visible-count').textContent()
      return Number.parseInt((text ?? '0').replace(/[^0-9]/g, ''), 10)
    }

    // __satDebug updates synchronously with the store, but the DOM commits a
    // tick later — poll instead of reading immediately after waitForReady.
    await expect.poll(readCount).toBeGreaterThan(1000)
    const before = await readCount()

    await page.getByTestId('filter-starlink').click()
    await expect.poll(readCount).toBeLessThan(before - 1000) // fixture has ~1500 Starlink sats

    await page.getByTestId('filter-starlink').click()
    await expect.poll(readCount).toBe(before)
  })
})

test.describe('time controls', () => {
  test.beforeEach(async ({ page }) => {
    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)
  })

  test('pause freezes the simulation clock', async ({ page }) => {
    await page.getByTestId('btn-pause').click()
    expect((await satDebug(page)).paused).toBe(true)

    const clock = page.getByTestId('sim-clock')
    const t1 = await clock.textContent()
    await page.waitForTimeout(1500)
    expect(await clock.textContent()).toBe(t1)

    await page.getByTestId('btn-pause').click()
    expect((await satDebug(page)).paused).toBe(false)
  })

  test('600x advances the sim clock far faster than real time', async ({ page }) => {
    await page.getByTestId('btn-speed-600').click()
    expect((await satDebug(page)).multiplier).toBe(600)

    const parseClock = async () => {
      const text = (await page.getByTestId('sim-clock').textContent()) ?? ''
      return Date.parse(text.replace(' UTC', 'Z').replace(' ', 'T'))
    }
    const t1 = await parseClock()
    await page.waitForTimeout(2000)
    const t2 = await parseClock()
    // 2 real seconds at 600x ≈ 20 sim-minutes
    expect(t2 - t1).toBeGreaterThan(10 * 60_000)
  })

  test('Now resets the sim clock back to real time', async ({ page }) => {
    await page.getByTestId('btn-speed-600').click()
    await page.waitForTimeout(1500) // sim drifts ~15 minutes ahead

    // back to 1x first so the clock cannot run away again between poll reads
    await page.getByTestId('btn-speed-1').click()
    await page.getByTestId('btn-now').click()

    await expect
      .poll(async () => {
        const text = (await page.getByTestId('sim-clock').textContent()) ?? ''
        const simMs = Date.parse(text.replace(' UTC', 'Z').replace(' ', 'T'))
        return Math.abs(simMs - Date.now())
      })
      .toBeLessThan(60_000)
  })
})
