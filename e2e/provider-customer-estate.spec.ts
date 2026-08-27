import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 320, height: 720 } : { width: 1280, height: 800 }
  );
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('customer estate connects global posture, placement, and tenant 360', async ({ page }) => {
  await page.goto('/provider/tenants');

  await expect(page.getByRole('heading', { name: 'Tenant estate', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Customer estate scope' })).toContainText(
    '12 companies · 18 tenants'
  );
  await expect(
    page.getByRole('heading', { name: 'Tenant lifecycle review is required' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Customer estate key signals' })).toContainText(
    '17'
  );
  await expect(page.getByText('Estate placement profile')).toBeVisible();

  await page.getByRole('row', { name: /SKAX Production/ }).click();
  await expect(page).toHaveURL(/\/provider\/tenants\/tenant-skax$/);
  await expect(page.getByRole('heading', { name: 'SKAX Production', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tenant 360 scope' })).toContainText(
    'ap-northeast-2 / Bridge'
  );
  await expect(
    page.getByRole('heading', { name: 'The tenant meets operational readiness criteria' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tenant readiness signals' })).toContainText('1/1');

  await page.getByRole('tab', { name: 'Domains and administrators' }).click();
  await expect(
    page.getByText(
      'Administrator activation is unavailable until a customer-owned out-of-band delivery channel is connected. Provider operators cannot issue or view activation links.'
    )
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Issue activation link' })).toHaveCount(0);
  await expect(page.getByText('Configured administrators').locator('../..')).toContainText('1');
  await expect(page.getByText('Active administrators').locator('../..')).toContainText('1');
  await expect(page.getByText('Park Hyunwoo')).toHaveCount(0);
  await expect(page.getByText('hyunwoo.park@sk.com')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Product access' }).click();
  await expect(page).toHaveURL(/tab=entitlements/);
  await expect(page.getByText('Product access for SKAX Production')).toBeVisible();
});

test('customer estate preserves URL-governed filters without crossing into tenant saved views', async ({
  page,
}) => {
  await page.goto('/provider/tenants');

  await expect(page.getByRole('button', { name: 'Saved views' })).toHaveCount(0);
  await page.getByRole('combobox', { name: /Data region/ }).click();
  await page.getByRole('option', { name: 'Seoul' }).click();
  await expect(page).toHaveURL(/region=ap-northeast-2/);

  await page.getByRole('combobox', { name: /Data region/ }).click();
  await page.getByRole('option', { name: 'All regions' }).click();
  const skaxRow = page.getByRole('row', { name: /SKAX Production/ });
  const acmeRow = page.getByRole('row', { name: /Acme Production/ });
  await skaxRow.getByRole('checkbox').click();
  await acmeRow.getByRole('checkbox').click();

  const comparison = page.getByRole('region', { name: 'Tenant operations comparison' });
  await expect(comparison).toContainText('SKAX Production');
  await expect(comparison).toContainText('Acme Production');
  await expect(page).toHaveURL(
    /compare=.*tenant-skax.*tenant-acme|compare=.*tenant-acme.*tenant-skax/
  );
});

test('customer estate reaches tenant 101 through server pagination', async ({ page }) => {
  await page.goto('/provider/tenants?page=5');

  await expect(page.getByRole('row', { name: /Tenant 101 Production/ })).toBeVisible();
  await expect(page).toHaveURL(/page=5/);
  await expect(page.getByText('25 shown / 150 total')).toBeVisible();
});

test('onboarding review exposes the complete immutable plan before preview', async ({ page }) => {
  await page.goto('/provider/tenants');
  await page.getByRole('button', { name: 'Onboard company' }).click();

  const dialog = page.getByRole('dialog', { name: 'Company and tenant onboarding' });
  await dialog.getByLabel('Company key').fill('acme');
  await dialog.getByLabel('Company name').fill('Acme Corporation');
  await dialog.getByRole('button', { name: 'Next' }).click();

  await dialog.getByLabel('Tenant key').fill('acme-production');
  await dialog.getByLabel('Display name').fill('Acme Production');
  await dialog.getByRole('button', { name: 'Next' }).click();

  await dialog.getByLabel('Administrator name').fill('Casey Admin');
  await dialog.getByLabel('Administrator work email').fill('casey@acme.example');
  await expect(dialog.getByText('Administrator identity will remain staged')).toBeVisible();
  await expect(dialog.getByText(/without a browser activation token or link/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();

  await expect(dialog.getByText('Onboarding plan summary')).toBeVisible();
  await expect(dialog.getByText('Acme Production')).toBeVisible();
  await expect(dialog.getByText('casey@acme.example')).toBeVisible();
  await expect(dialog.getByText('Administrator identity will remain staged')).toBeVisible();
  await dialog.getByLabel('Workforce management').check();
  await dialog.getByLabel('Business justification').fill('New contracted production tenant.');
  await expect(dialog.getByRole('button', { name: 'Preview' })).toBeEnabled();
});

test('customer estate and tenant 360 stay within the viewport', async ({ page }) => {
  await page.goto('/provider/tenants');
  await expect(page.getByRole('region', { name: 'Customer estate key signals' })).toBeVisible();

  let geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);

  await page.getByRole('row', { name: /SKAX Production/ }).click();
  await expect(page.getByRole('region', { name: 'Tenant readiness signals' })).toBeVisible();
  geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});
