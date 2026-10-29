import { defineConfig } from '@playwright/test';

import { loadMailLiveEnvironment } from './e2e/support/mail-live-environment';

const runtime = loadMailLiveEnvironment();

export default defineConfig({
  testDir: './e2e',
  testMatch: 'mail-live-vertical.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: 'line',
  use: {
    baseURL: runtime.gatewayURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'mail-live-gateway' }],
});
