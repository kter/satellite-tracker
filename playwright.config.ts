import { defineConfig, devices } from '@playwright/test'

const ENV_URLS: Record<string, string> = {
  local: 'http://localhost:8080',
  dev: 'https://satellite.dev.devtools.site',
  prd: 'https://satellite.devtools.site',
}

const target = process.env.E2E_TARGET ?? 'local'
const baseURL = ENV_URLS[target]
if (!baseURL) {
  throw new Error(`Unknown E2E_TARGET "${target}" (expected ${Object.keys(ENV_URLS).join('/')})`)
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: target === 'local' ? 40_000 : 70_000,
  expect: { timeout: 15_000 },
  retries: target === 'local' ? 1 : 2,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
