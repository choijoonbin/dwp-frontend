import { existsSync } from 'fs';
import { join } from 'path';
import type { Page } from '@playwright/test';

/**
 * Storage state file path (can be overridden via env)
 */
export const STORAGE_STATE_PATH = process.env.E2E_STORAGE_STATE_PATH || 'e2e/.auth/user.json';

/**
 * Ensures authentication by loading storageState.
 * If storageState file doesn't exist, provides clear instructions and fails the test.
 */
export async function ensureAuth(page: Page): Promise<void> {
  const storageStatePath = join(process.cwd(), STORAGE_STATE_PATH);

  // Check if storageState file exists
  if (!existsSync(storageStatePath)) {
    const errorMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ E2E 인증 파일이 존재하지 않습니다!

📍 파일 경로: ${storageStatePath}

🔧 해결 방법:
1. 로컬 개발 서버를 실행하세요: yarn dev
2. 브라우저로 인증 파일을 생성하세요:

   yarn test:e2e:auth-setup

   (또는 수동으로 http://localhost:5173/sign-in 에서 로그인 후
    DevTools에서 Application → Storage 확인)

📖 자세한 내용: docs/reference/E2E_SMOKE_TESTS.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    throw new Error(errorMessage);
  }

  // If storageState exists, Playwright will load it automatically
  // via playwright.config.ts use.storageState setting
  console.log(`✅ E2E 인증 파일 로드 완료: ${storageStatePath}`);
}

/**
 * Creates storageState by performing actual login.
 * This should be called once manually to generate the auth file.
 * 
 * Usage: yarn test:e2e:auth-setup
 * 
 * @param page - Playwright page object
 */
export async function createAuthFile(page: Page): Promise<void> {
  const storageStatePath = join(process.cwd(), STORAGE_STATE_PATH);

  console.log('🔐 Starting authentication setup...');

  // Navigate to login page
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');

  // Fill in credentials
  // Priority 1: testid-based selectors
  const usernameInput = page.getByTestId('auth-username');
  const passwordInput = page.getByTestId('auth-password');
  const submitButton = page.getByTestId('auth-submit');

  // Check if testid selectors exist, fallback to name-based
  const hasTestIds = await usernameInput.count() > 0;

  if (hasTestIds) {
    await usernameInput.fill('admin');
    await passwordInput.fill('admin1234!');
    await submitButton.click();
  } else {
    // Fallback: name-based selectors
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin1234!');
    await page.click('button[type="submit"]');
  }

  // Wait for redirect to /admin/monitoring (or any admin page)
  try {
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    console.log('✅ Login successful, redirected to admin area');
  } catch (error) {
    console.error('❌ Login failed or timeout waiting for redirect');
    throw error;
  }

  // Save storage state
  await page.context().storageState({ path: storageStatePath });
  console.log(`✅ 인증 파일 생성 완료: ${storageStatePath}`);
  console.log('이제 yarn test:e2e 로 E2E 테스트를 실행할 수 있습니다.');
}

/**
 * Logout (for cleanup if needed)
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
  await page.goto('/sign-in');
}
