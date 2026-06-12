import { test, expect } from '@playwright/test'
import { interceptTles, waitForReady, satDebug } from './helpers'

test.describe('smoke', () => {
  test('loads, renders the 3D canvas, and finishes loading satellite data', async ({ page }) => {
    await interceptTles(page)
    await page.goto('/')

    await expect(page).toHaveTitle(/Orbital/)
    await expect(page.locator('canvas')).toBeVisible()

    await waitForReady(page)
    await expect(page.getByTestId('loading-overlay')).toBeHidden()

    const debug = await satDebug(page)
    expect(debug.satCount).toBeGreaterThan(1000)
    expect(debug.cameraMode).toBe('free')

    await expect(page.getByTestId('data-age')).toBeVisible()
    await expect(page.getByTestId('time-controls')).toBeVisible()
    await expect(page.getByTestId('btn-overhead')).toBeVisible()
  })

  test('shows the brand header and a running UTC clock', async ({ page }) => {
    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)

    await expect(page.locator('.brand h1')).toHaveText('Orbital')
    const clock = page.getByTestId('sim-clock')
    await expect(clock).toContainText('UTC')
    const t1 = await clock.textContent()
    await expect(clock).not.toHaveText(t1!, { timeout: 5000 })
  })
})
