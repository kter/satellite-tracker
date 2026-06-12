import { test, expect } from '@playwright/test'
import { interceptTles, waitForReady, satDebug, openPanelIfMobile } from './helpers'

test.describe('search and selection', () => {
  test.beforeEach(async ({ page }) => {
    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)
    await openPanelIfMobile(page)
  })

  test('searching ISS selects it and shows correct orbital data', async ({ page }) => {
    await page.getByTestId('search-input').fill('ISS')
    await expect(page.getByTestId('search-results')).toBeVisible()
    await page.getByText('ISS (ZARYA)').click()

    const info = page.getByTestId('info-panel')
    await expect(info).toBeVisible()
    await expect(page.getByTestId('sat-name')).toHaveText('ISS (ZARYA)')
    await expect(page.getByTestId('sat-norad')).toHaveText('25544')

    // ISS knowns: alt ~420 km, speed ~7.7 km/s, inclination 51.6°, period ~93 min
    await expect(page.getByTestId('sat-inclination')).toContainText('51.6')
    const periodMin = Number.parseFloat((await page.getByTestId('sat-period').textContent())!)
    expect(periodMin).toBeGreaterThan(92)
    expect(periodMin).toBeLessThan(94)

    await expect
      .poll(async () => {
        const text = await page.getByTestId('sat-altitude').textContent()
        return Number.parseFloat(text ?? '0')
      })
      .toBeGreaterThan(300)
    const alt = Number.parseFloat((await page.getByTestId('sat-altitude').textContent())!)
    expect(alt).toBeLessThan(500)

    const speed = Number.parseFloat((await page.getByTestId('sat-speed').textContent())!)
    expect(speed).toBeGreaterThan(7.3)
    expect(speed).toBeLessThan(8.1)

    const debug = await satDebug(page)
    expect(debug.selectedNoradId).toBe(25544)
  })

  test('search narrows results and clears after selection', async ({ page }) => {
    await page.getByTestId('search-input').fill('STARLINK')
    const items = page.getByTestId('search-results').locator('li')
    await expect(items.first()).toBeVisible()
    const n = await items.count()
    expect(n).toBeGreaterThan(1)
    expect(n).toBeLessThanOrEqual(20)

    await items.first().click()
    await expect(page.getByTestId('search-results')).toBeHidden()
    await expect(page.getByTestId('search-input')).toHaveValue('')
    expect((await satDebug(page)).selectedName).toContain('STARLINK')
  })

  test('closing the info panel deselects', async ({ page }) => {
    await page.getByTestId('search-input').fill('ISS')
    await page.getByText('ISS (ZARYA)').click()
    await expect(page.getByTestId('info-panel')).toBeVisible()

    await page.getByTestId('btn-close-info').click()
    await expect(page.getByTestId('info-panel')).toBeHidden()
    expect((await satDebug(page)).selectedNoradId).toBeNull()
  })
})
