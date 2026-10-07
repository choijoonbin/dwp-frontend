import path from 'node:path';

import { defineConfig } from '@playwright/test';

const baseURL = process.env.HRIS_PREPARATION_BASE_URL;
const artifactRoot = process.env.HRIS_PREPARATION_ARTIFACT_DIR;
if (!baseURL || !artifactRoot || !path.isAbsolute(artifactRoot)) {
  throw new Error('Explicit isolated HRIS URL and new absolute artifact directory are required.');
}
const url = new URL(baseURL);
if (
  url.protocol !== 'http:' ||
  url.hostname !== '127.0.0.1' ||
  !/^[1-9][0-9]{3,4}$/.test(url.port) ||
  Number(url.port) > 65_535 ||
  url.pathname !== '/' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !path.basename(artifactRoot).startsWith('hris-payroll-browser-')
) {
  throw new Error(
    'HRIS browser preparation must use its explicit localhost/new owned artifact scope.'
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'hris-payroll-layer-preparation.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  reporter: 'json',
  outputDir: path.join(artifactRoot, 'test-results'),
  captureGitInfo: { commit: false, diff: false },
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'pay-1440-en-light',
      use: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
    },
    {
      name: 'pay-1280-ko-dark',
      use: { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' },
    },
    {
      name: 'pay-390-en-dark',
      use: {
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'pay-320-ko-light',
      use: {
        viewport: { width: 320, height: 740 },
        colorScheme: 'light',
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'pay-1280-ko-highcontrast',
      use: {
        viewport: { width: 1280, height: 900 },
        forcedColors: 'active',
        reducedMotion: 'reduce',
      },
    },
    {
      name: 'pay-1280-en-text200',
      use: { viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' },
    },
  ],
  webServer: {
    command: `${JSON.stringify(process.execPath)} node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DWP_FRONTEND_DEV_PORT: url.port,
      VITE_API_URL: baseURL.replace(/\/$/, ''),
      VITE_API_PROXY_TARGET: 'http://127.0.0.1:9',
    },
  },
});
