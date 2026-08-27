import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PRODUCT_ARTIFACT_BASE_URL || 'http://127.0.0.1:4310';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'product-artifact-runtime.spec.ts',
  fullyParallel: false,
  reporter: 'line',
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve-product-artifacts.mjs',
    url: `${baseURL}/__dwp-artifact-health`,
    reuseExistingServer: process.env.E2E_REUSE_EXISTING_SERVER === 'true',
    timeout: 30_000,
  },
});
