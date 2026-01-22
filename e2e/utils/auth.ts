import type { Page } from '@playwright/test';
import { AUTH_ROUTES } from './routes';

/**
 * Storage state file path
 */
const STORAGE_STATE_PATH = 'e2e/.auth/user.json';

/**
 * Ensure user is authenticated
 * 
 * Strategy:
 * 1. Check if storageState file exists → use it
 * 2. If not, perform login and save storageState
 * 
 * @param page - Playwright page object
 */
export async function ensureAuth(page: Page): Promise<void> {
  // TODO: Implement actual authentication flow
  // For now, we'll skip authentication and assume dev server allows access
  
  // Option 1: If your app has a test user, uncomment and implement:
  // await loginAsTestUser(page);
  
  // Option 2: If your app has a way to bypass auth in dev, implement it here
  // await bypassAuthForTesting(page);
  
  // Option 3: Inject token directly (if using localStorage/sessionStorage)
  // await injectAuthToken(page);
  
  // For initial smoke tests, we'll just check if login is required
  // and skip authentication for now (assuming dev server allows it)
  console.log('Auth check skipped for initial smoke tests');
}

/**
 * Login as test user (TODO: implement)
 * 
 * @param page - Playwright page object
 */
async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto(AUTH_ROUTES.login);
  
  // TODO: Fill in actual login credentials from env variables
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'test123!';
  
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  await page.click('button[type="submit"]');
  
  // Wait for navigation after login
  await page.waitForURL(/\/dashboard|\/admin/, { timeout: 10000 });
  
  // Save storage state for reuse
  await page.context().storageState({ path: STORAGE_STATE_PATH });
}

/**
 * Inject auth token directly (TODO: implement)
 * 
 * @param page - Playwright page object
 */
async function injectAuthToken(page: Page): Promise<void> {
  // TODO: Get token from env or API
  const token = process.env.TEST_AUTH_TOKEN || 'mock-token';
  
  // Navigate to a page first (required for localStorage)
  await page.goto('/');
  
  // Inject token
  await page.evaluate((authToken) => {
    localStorage.setItem('accessToken', authToken);
    // Or sessionStorage.setItem('token', authToken);
  }, token);
  
  // Reload to apply token
  await page.reload();
}

/**
 * Bypass authentication for testing (TODO: implement)
 * 
 * @param page - Playwright page object
 */
async function bypassAuthForTesting(page: Page): Promise<void> {
  // If your backend has a test mode or bypass flag, implement it here
  // For example, setting a cookie or query parameter
  
  await page.goto('/?test-mode=true');
}

/**
 * Logout (for cleanup)
 * 
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Clear localStorage/sessionStorage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Navigate to login page
  await page.goto(AUTH_ROUTES.login);
}
