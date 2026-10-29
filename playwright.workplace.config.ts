import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig(baseConfig, {
  testMatch: [/(?:rooms|workplace-.*)\.spec\.ts/u],
  testIgnore: [/live.*\.spec\.ts/u, /workplace-native-browser-zoom\.spec\.ts/u],
  projects: baseConfig.projects?.filter(({ name }) => name === 'chromium' || name === 'mobile'),
  workers: 1,
  updateSnapshots: 'none',
});
