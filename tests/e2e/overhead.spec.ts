import { test, expect } from '@playwright/test'
import { interceptTles, waitForReady, satDebug, TOKYO } from './helpers'

test.describe('GPS overhead view (key feature)', () => {
  test('flies to an oblique overhead view and highlights satellites above the user', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(TOKYO)

    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)

    await page.getByTestId('btn-overhead').click()

    // camera mode switches and the overhead badge appears
    await expect.poll(async () => (await satDebug(page)).cameraMode).toBe('overhead')
    await expect(page.getByTestId('overhead-badge')).toBeVisible()

    // satellites above 20° elevation over Tokyo get counted (fixture has
    // ~1500 Starlink + GEO belt; several are always overhead)
    await expect
      .poll(async () => (await satDebug(page)).overheadCount, { timeout: 15_000 })
      .toBeGreaterThan(0)

    // the button toggles back to the free camera
    await page.getByTestId('btn-overhead').click()
    await expect.poll(async () => (await satDebug(page)).cameraMode).toBe('free')
    await expect(page.getByTestId('overhead-badge')).toBeHidden()
  })

  test('shows a toast when geolocation permission is denied', async ({ page, context }) => {
    await context.grantPermissions([]) // no geolocation permission

    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)

    await page.getByTestId('btn-overhead').click()
    await expect(page.getByTestId('toast')).toBeVisible({ timeout: 15_000 })
    expect((await satDebug(page)).cameraMode).toBe('free')
  })
})
