import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { defineConfig } from '@playwright/test';

import { loadHrisW1LiveEnvironment } from './e2e/support/hris-w1-live-environment';

const runtime = loadHrisW1LiveEnvironment();
if (existsSync(runtime.artifactRoot)) {
  throw new Error(
    'HRIS W1 live acceptance requires a new artifact directory; refusing to reuse existing evidence.'
  );
}
if (!existsSync(path.dirname(runtime.artifactRoot))) {
  throw new Error('The parent of HRIS_W1_LIVE_ARTIFACT_DIR must already exist.');
}
mkdirSync(runtime.artifactRoot, { mode: 0o700 });
chmodSync(runtime.artifactRoot, 0o700);

const frontendPort = new URL(runtime.baseURL).port;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'hris-w1-live-synthetic-acceptance.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: Math.max(180_000, runtime.assertionTimeoutMs * 8),
  expect: { timeout: runtime.assertionTimeoutMs },
  captureGitInfo: { commit: false, diff: false },
  outputDir: path.join(runtime.artifactRoot, 'test-results'),
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(runtime.artifactRoot, 'playwright-report.json') }],
    ['html', { open: 'never', outputFolder: path.join(runtime.artifactRoot, 'html-report') }],
  ],
  use: {
    baseURL: runtime.baseURL,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 960 },
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'hris-w1-live-chromium' }],
  webServer: {
    command: `${JSON.stringify(process.execPath)} node_modules/vite/bin/vite.js --mode hris-w1-live --host 127.0.0.1 --strictPort`,
    url: runtime.baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DWP_FRONTEND_DEV_PORT: frontendPort,
      DWP_LIVEKIT_API_KEY: '',
      DWP_LIVEKIT_API_SECRET: '',
      DWP_LIVEKIT_CLIENT_URL: '',
      DWP_LIVEKIT_SMOKE: '',
      LIVEKIT_URL: '',
      VITE_API_URL: runtime.baseURL.replace(/\/$/u, ''),
      VITE_API_PROXY_TARGET: runtime.gatewayURL,
      VITE_DWAION_ATTACHMENT_UPLOAD_ORIGINS: '',
      VITE_HOME_PERSONALIZATION_V2_ENABLED: 'false',
      VITE_HOME_WIDGET_LIBRARY_ENABLED: 'false',
      VITE_LIVEKIT_URL: '',
      VITE_PRODUCT_DWAION_RUNTIME: 'disabled',
      VITE_PRODUCT_NOTIFICATION_RUNTIME: 'disabled',
      VITE_PRODUCT_SURFACE_TELEMETRY_COLLECTION: 'false',
      VITE_TENANT_ID: '',
      VITE_WEB_VITALS_ENDPOINT: '',
      HRIS_W1_LIVE_ACK: '',
      HRIS_W1_LIVE_ARTIFACT_DIR: '',
      HRIS_W1_LIVE_ASSERTION_TIMEOUT_MS: '',
      HRIS_W1_LIVE_BASE_URL: '',
      HRIS_W1_LIVE_GATEWAY_URL: '',
      HRIS_W1_LIVE_RUN_ID: '',
      HRIS_W1_TENANT_A_EMAIL: '',
      HRIS_W1_TENANT_A_ID: '',
      HRIS_W1_TENANT_A_PASSWORD: '',
      HRIS_W1_TENANT_A_ROUTES_JSON: '',
      HRIS_W1_TENANT_B_EMAIL: '',
      HRIS_W1_TENANT_B_ID: '',
      HRIS_W1_TENANT_B_PASSWORD: '',
      HRIS_W1_TENANT_B_ROUTES_JSON: '',
    },
  },
});
