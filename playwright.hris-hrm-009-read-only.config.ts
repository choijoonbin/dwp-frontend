import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_HRIS_HRM009_BASE_URL || 'http://127.0.0.1:4219';
const FIXTURE_URL = 'http://127.0.0.1:8919';
const REUSE_EXISTING_SERVER = process.env.E2E_REUSE_EXISTING_SERVER === 'true';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'hris-hrm-009-read-only-browser-gate.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  captureGitInfo: { commit: false, diff: false },
  reporter: 'line',
  outputDir: 'test-results/hris-hrm-009-read-only-browser-gate',
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/hris-hrm-009-read-only-browser-gate-server.mjs',
      url: `${FIXTURE_URL}/api/__hrm009-gate/health`,
      reuseExistingServer: REUSE_EXISTING_SERVER,
      timeout: 30_000,
    },
    {
      command:
        'DWP_FRONTEND_DEV_PORT=4219 VITE_API_PROXY_TARGET=http://127.0.0.1:8919 VITE_HRIS_HRM_009_ENABLED=true VITE_PRODUCT_SURFACE_TELEMETRY_COLLECTION=false VITE_WEB_VITALS_ENDPOINT= ./node_modules/.bin/vite --mode test --host 127.0.0.1 --port 4219 --strictPort',
      url: BASE_URL,
      reuseExistingServer: REUSE_EXISTING_SERVER,
      timeout: 120_000,
    },
  ],
});
