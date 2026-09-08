import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// Archive/source/golden provenance is filesystem-only. Do not start a Vite or browser runtime.
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'video-meeting-approved-frame-matrix.spec.ts',
  webServer: undefined,
});
