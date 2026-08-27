import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const reducedMotionAppearance = {
  mode: 'light',
  density: 'standard',
  highContrast: false,
  reduceMotion: true,
} as const;

test('flag off keeps Home on the legacy hidden-item restore contract', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    appearance: reducedMotionAppearance,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();
  await expect(page.getByRole('button', { name: 'Add items' })).toHaveCount(0);

  const restoreItemsButton = page.getByRole('button', { name: 'Restore hidden items' });
  await expect(restoreItemsButton).toHaveAttribute('aria-disabled', 'true');
  await expect(restoreItemsButton).toHaveAccessibleDescription(
    'Nothing is hidden in this home draft.'
  );
  await restoreItemsButton.click({ force: true });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Hide Live activity widget' }).click();
  await expect(restoreItemsButton).not.toHaveAttribute('aria-disabled', 'true');
  await restoreItemsButton.click();
  const dialog = page.getByRole('dialog', { name: 'Hidden items' });

  await expect(dialog.getByRole('tab', { name: 'Hidden 1' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByRole('dialog', { name: 'Add to home' })).toHaveCount(0);
  await expect(dialog.getByRole('tab', { name: /Library/ })).toHaveCount(0);
  await expect(dialog.getByText('The item library preview is off')).toBeVisible();
  await dialog.getByRole('button', { name: 'Restore Live activity widget to home' }).click();
  await expect(dialog.getByText('No hidden items')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close hidden items' }).click();
  await expect(restoreItemsButton).toBeFocused();
  await expect(restoreItemsButton).toHaveAttribute('aria-disabled', 'true');
});

test('flag off keeps Tenant administration on the existing composition policy', async ({
  page,
}) => {
  await mockShellSession(page, ['ADMIN'], {
    locale: 'en',
    appearance: reducedMotionAppearance,
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.goto('/admin/experience/home-composition?tab=catalog');

  await expect(page.getByRole('tab', { name: 'Widget catalog' })).toHaveCount(0);
  await expect(page.getByText('Home composition policy')).toBeVisible();
});

test('flag off keeps Provider control on existing code contracts', async ({ page }) => {
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: reducedMotionAppearance,
  });
  await page.goto('/provider/code-contracts?tab=widgets');

  await expect(page.getByRole('tab', { name: 'Widget definitions' })).toHaveCount(0);
  await expect(page.getByText('DWP global product code contracts')).toBeVisible();
});
