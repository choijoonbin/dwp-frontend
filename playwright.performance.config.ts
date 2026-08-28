import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_PERFORMANCE_BASE_URL || 'http://127.0.0.1:4203';
const configuredUrl = new URL(BASE_URL);
const configuredPort = Number(configuredUrl.port);

if (
  configuredUrl.protocol !== 'http:' ||
  configuredUrl.hostname !== '127.0.0.1' ||
  !Number.isSafeInteger(configuredPort) ||
  configuredPort < 1024 ||
  configuredPort > 65_535
) {
  throw new Error('E2E_PERFORMANCE_BASE_URL must use http://127.0.0.1 with a valid port');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'performance-budget.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `DWP_FRONTEND_DEV_PORT=${configuredPort} corepack yarn start --host 127.0.0.1 --port ${configuredPort} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_EXISTING_SERVER === 'true',
    timeout: 120_000,
  },
});
