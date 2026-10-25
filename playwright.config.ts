import { defineConfig, devices } from '@playwright/test'
import { E2E_APP_ENV, E2E_PORT } from './e2e/env'

// Browser tests: a real browser clicks through a production build of the app
// against a LOCAL Supabase (`supabase start`, own ports in supabase/config.toml).
// Never pointed at the hosted project: the build below gets the local URL and keys.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- -H 127.0.0.1 -p ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: E2E_APP_ENV,
  },
})
