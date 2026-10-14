import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_HRIS_COMPPLAN_BASE_URL || 'http://127.0.0.1:4204';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'hris-compensation-planning-central-acceptance.spec.ts',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  captureGitInfo: { commit: false, diff: false },
  reporter: 'line',
  outputDir: 'test-results/hris-compensation-planning-central',
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'VITE_PRODUCT_SURFACE_TELEMETRY_COLLECTION=false VITE_WEB_VITALS_ENDPOINT= ./node_modules/.bin/vite --mode test --host 127.0.0.1 --port 4204 --strictPort',
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_EXISTING_SERVER === 'true',
    timeout: 120_000,
  },
});
