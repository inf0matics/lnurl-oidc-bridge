import { defineConfig, devices } from '@playwright/test'

// Dedicated test port (not 3000) so the e2e server never collides with a
// `npm run dev` instance running elsewhere on the default port.
const PORT = Number(process.env.PORT ?? 3210)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Run the server directly (not `tsx watch`): watch mode spawns a child
    // process Playwright can't reap, which lingers on the port between runs.
    command: 'npx tsx src/server.ts',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      OIDC_ISSUER: baseURL,
      OIDC_CLIENT_ID: 'test-client',
      OIDC_CLIENT_SECRET: 'test-secret',
      OIDC_REDIRECT_URIS: `${baseURL}/cb`,
    },
  },
})
