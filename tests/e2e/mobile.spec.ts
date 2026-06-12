import { test, expect } from '@playwright/test'
import { interceptTles, waitForReady } from './helpers'

test.describe('mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await interceptTles(page)
    await page.goto('/')
    await waitForReady(page)
  })

  test('uses a bottom sheet on small screens and a side panel on desktop', async ({
    page,
    isMobile,
  }) => {
    if (isMobile) {
      await expect(page.getByTestId('bottom-sheet')).toBeVisible()
      await expect(page.locator('.side-panel')).toHaveCount(0)
    } else {
      await expect(page.locator('.side-panel')).toBeVisible()
      await expect(page.getByTestId('bottom-sheet')).toHaveCount(0)
    }
  })

  test('bottom sheet opens, exposes search, and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile-only behavior')

    const sheet = page.getByTestId('bottom-sheet')
    await expect(sheet).not.toHaveClass(/open/)

    await page.getByTestId('sheet-handle').click()
    await expect(sheet).toHaveClass(/open/)

    await page.getByTestId('search-input').fill('ISS')
    await expect(page.getByTestId('search-results')).toBeVisible()

    await page.getByTestId('sheet-handle').click()
    await expect(sheet).not.toHaveClass(/open/)
  })

  test('selecting a satellite from search shows the info panel in the sheet', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile-only behavior')

    await page.getByTestId('sheet-handle').click()
    await page.getByTestId('search-input').fill('ISS')
    await page.getByText('ISS (ZARYA)').click()
    await expect(page.getByTestId('info-panel')).toBeVisible()
    await expect(page.getByTestId('sat-norad')).toHaveText('25544')
  })
})
