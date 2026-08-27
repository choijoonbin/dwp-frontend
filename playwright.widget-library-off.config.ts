import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_FLAG_OFF_BASE_URL || 'http://127.0.0.1:4202';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'widget-library-flag-off.e2e.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-flag-off', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'VITE_HOME_PERSONALIZATION_V2_ENABLED=true VITE_HOME_WIDGET_LIBRARY_ENABLED=false ./node_modules/.bin/vite --mode test --host 127.0.0.1 --port 4202',
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_EXISTING_SERVER === 'true',
    timeout: 120 * 1000,
  },
});
