import { test } from '@playwright/test';
import { createAuthFile } from '../utils/auth';

/**
 * E2E Authentication Setup Test
 * 
 * This test creates the storageState file by performing actual login.
 * Run this once before running E2E tests: yarn test:e2e:auth-setup
 * 
 * Note: This will open a browser window (headed mode) so you can see the login process.
 */
test('setup authentication', async ({ page }) => {
  await createAuthFile(page);
});
