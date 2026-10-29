import { defineConfig } from '@playwright/test';
import path from 'node:path';

import { loadNotificationLiveEnvironment } from './e2e/support/notification-live-environment';

const runtime = loadNotificationLiveEnvironment();
const frontendPort = new URL(runtime.baseURL).port;
const artifactBase = path.resolve('artifacts');
const artifactRoot = path.resolve(
  process.env.NOTIFICATION_LIVE_ARTIFACT_DIR || 'artifacts/notification-live-vertical'
);
if (!artifactRoot.startsWith(`${artifactBase}${path.sep}`)) {
  throw new Error('NOTIFICATION_LIVE_ARTIFACT_DIR must resolve beneath the frontend artifacts/.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'live-notification-vertical.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 180_000,
  expect: { timeout: runtime.evidenceTimeoutMs },
  captureGitInfo: { commit: false, diff: false },
  outputDir: path.join(artifactRoot, 'test-results'),
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(artifactRoot, 'playwright-report.json') }],
    ['html', { open: 'never', outputFolder: path.join(artifactRoot, 'html-report') }],
  ],
  use: {
    baseURL: runtime.baseURL,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 960 },
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'notification-live-chromium' }],
  webServer: {
    command: `${JSON.stringify(process.execPath)} node_modules/vite/bin/vite.js preview --host 127.0.0.1 --strictPort`,
    url: runtime.baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DWP_FRONTEND_DEV_PORT: frontendPort,
      VITE_API_URL: runtime.baseURL,
      VITE_API_PROXY_TARGET: runtime.gatewayURL,
      VITE_PRODUCT_NOTIFICATION_RUNTIME: 'enabled',
      VITE_PRODUCT_SURFACE_TELEMETRY_COLLECTION: 'false',
      VITE_TENANT_ID: '',
    },
  },
});
