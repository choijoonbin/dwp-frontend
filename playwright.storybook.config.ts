import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.STORYBOOK_BASE_URL || 'http://localhost:6006';
const HTML_REPORT_OUTPUT = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || 'playwright-report';
const TEST_OUTPUT = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

export default defineConfig({
  testDir: './e2e-storybook',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  workers: process.env.CI ? 1 : undefined,
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
    command: 'corepack yarn storybook --host 127.0.0.1 --exact-port',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
