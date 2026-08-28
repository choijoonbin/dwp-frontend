import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';
const REUSE_EXISTING_SERVER = process.env.E2E_REUSE_EXISTING_SERVER === 'true';
const HTML_REPORT_OUTPUT = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || 'playwright-report';
const TEST_OUTPUT = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  captureGitInfo: { commit: false, diff: false },
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: HTML_REPORT_OUTPUT }]]
    : 'line',
  outputDir: TEST_OUTPUT,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],

  webServer: {
    // The Flow Home interaction suite exercises the VIEWS-backed editor.
    // Keep that product contract explicit and only reuse a server when the
    // caller deliberately opts into owning its feature-flag configuration.
    command:
      'VITE_HOME_PERSONALIZATION_V2_ENABLED=true VITE_HOME_WIDGET_LIBRARY_ENABLED=true corepack yarn dev --host 127.0.0.1',
    url: BASE_URL,
    reuseExistingServer: REUSE_EXISTING_SERVER,
    timeout: 120 * 1000,
  },
});
