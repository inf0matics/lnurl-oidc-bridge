import { defineConfig, devices } from '@playwright/test'

// Cross-service integration test: spins up compose.e2e.yml (bridge + mock RP)
// and drives a real browser login through both. Kept separate from the fast
// e2e suite because it requires Docker.
export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3011', // the mock RP
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './tests/integration/global-setup.ts',
  globalTeardown: './tests/integration/global-teardown.ts',
})
