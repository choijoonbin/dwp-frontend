import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'workplace-native-browser-zoom.spec.ts',
  projects: [{ name: 'chromium', use: { browserName: 'chromium', viewport: null } }],
});
