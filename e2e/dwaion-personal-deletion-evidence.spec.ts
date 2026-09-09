import { expect, test } from '@playwright/test';
import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test('completion capability does not claim deletion and keyboard cleanup exposes backup boundaries', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
  });
  await mockDwaionPersonalIntelligence(page, { deletionExecutionAvailable: true });
  await page.goto('/dwaion/personal-controls');
  await expect(page.getByText('Completion evidence can be verified')).toBeVisible();
  await expect(page.getByText('Completed', { exact: true })).toHaveCount(0);
  const cleanup = page.getByRole('button', { name: 'Clean up data', exact: true });
  await cleanup.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Clean up personal AI data' });
  await expect(
    dialog.getByText('Backup deletion and encryption-key destruction are unavailable.', {
      exact: false,
    })
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('personal-deletion-boundary-390.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
