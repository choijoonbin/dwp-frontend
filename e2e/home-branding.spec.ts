import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

test('home co-branding keeps the product anchor stable and places the tenant context second', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop co-brand geometry is verified here.');
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockShellSession(page, ['TENANT_ADMIN']);

  let signalBrandingRequest = () => undefined;
  let releaseBranding = () => undefined;
  const brandingRequested = new Promise<void>((resolve) => {
    signalBrandingRequest = resolve;
  });
  const brandingGate = new Promise<void>((resolve) => {
    releaseBranding = resolve;
  });

  await page.route('**/api/platform/v1/tenant-branding', async (route) => {
    signalBrandingRequest();
    await brandingGate;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          organizationName: 'SK AX',
          accentColor: '#2457D6',
          logoUrl: '/assets/brand/dwp-mark.svg',
          version: 1,
        },
      }),
    });
  });

  await page.goto('/');
  await brandingRequested;

  const bootHeader = page.getByTestId('shell-boot-header');
  const bootBrand = bootHeader.locator('a[aria-label="Digital Workplace home"]:visible');
  const bootBrandBox = await bootBrand.boundingBox();
  await expect(page.getByTestId('home-loading-skeleton')).toBeVisible();
  expect(bootBrandBox?.x).toBe(24);

  releaseBranding();

  const header = page.getByTestId('home-header');
  const brand = header.getByRole('link', { name: 'SK AX Digital Workplace home' });
  const productLabel = brand.getByText('Digital Workplace', { exact: true });
  const divider = brand.getByTestId('tenant-brand-divider');
  const tenantLogo = brand.getByTestId('tenant-brand-logo');

  await expect(header).toBeVisible();
  await expect(tenantLogo).toBeVisible();

  const [brandBox, productLabelBox, dividerBox, tenantLogoBox] = await Promise.all([
    brand.boundingBox(),
    productLabel.boundingBox(),
    divider.boundingBox(),
    tenantLogo.boundingBox(),
  ]);

  expect(brandBox?.x).toBe(bootBrandBox?.x);
  expect(dividerBox?.width).toBe(1);
  expect(productLabelBox!.x + productLabelBox!.width).toBeLessThan(dividerBox!.x);
  expect(dividerBox!.x + dividerBox!.width).toBeLessThan(tenantLogoBox!.x);
  expect(tenantLogoBox?.width).toBe(80);
  expect(tenantLogoBox?.height).toBe(40);
});

test('mobile home keeps a compact tenant identifier without horizontal overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile shell geometry is verified here.');
  await mockShellSession(page, ['TENANT_ADMIN']);
  await page.goto('/');

  const header = page.getByTestId('home-header');
  const brand = header.getByRole('link', { name: 'SKAX Digital Workplace home' });

  await expect(brand).toBeVisible();
  await expect(brand).toContainText('DWP');
  await expect(brand.getByTestId('tenant-brand-name-fallback')).toHaveText('SKAX');
  await expect(brand.getByTestId('tenant-brand-divider')).toBeVisible();
  await expect(header.getByTestId('tenant-brand-logo')).toHaveCount(0);

  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
});
