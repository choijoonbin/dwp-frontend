import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민서',
    jobTitle: 'Network Operations Lead',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('일반 구성원의 언어 변경은 언어 및 지역 설정에서만 제공한다', async ({ page }) => {
  await page.goto('/account/profile');

  await expect(page.getByRole('heading', { name: '프로필', level: 1 })).toBeVisible();
  await expect(page.getByText('기본 언어', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '변경', exact: true })).toHaveCount(0);
  const profile = page.getByTestId('account-main');
  await expect(profile.getByText('김민서', { exact: true })).toBeVisible();
  await expect(profile.getByText('WORKSPACE_MEMBER', { exact: true })).toBeVisible();

  await page.goto('/account/settings/language');

  await expect(page.getByRole('heading', { name: '언어 및 지역', level: 1 })).toBeVisible();
  await expect(page.getByRole('group', { name: '제품 언어' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: '제품 언어' }).getByRole('button', {
      name: '한국어',
      pressed: true,
    })
  ).toBeVisible();
});
