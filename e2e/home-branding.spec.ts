import { expect, test } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

const TENANT_LOGO_URL = '/assets/brand/skax-tenant-logo.svg';

async function mockTenantBranding(
  page: Parameters<typeof mockShellSession>[0],
  logoUrl: string | null = TENANT_LOGO_URL
) {
  await page.route('**/api/platform/v1/tenant-branding', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          organizationName: 'SKAX',
          accentColor: '#2457D6',
          logoUrl,
          version: 1,
        },
      }),
    });
  });
}

async function expectNoHorizontalOverflow(page: Parameters<typeof mockShellSession>[0]) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
}

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
          organizationName: 'SKAX',
          accentColor: '#2457D6',
          logoUrl: TENANT_LOGO_URL,
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
  const brand = header.getByRole('link', { name: 'SKAX Digital Workplace home' });
  const productLabel = brand.getByText('Digital Workplace', { exact: true });
  const divider = brand.getByTestId('tenant-brand-divider');
  const tenantLogo = brand.getByTestId('tenant-brand-logo');

  await expect(header).toBeVisible();
  await expect(tenantLogo).toBeVisible();
  await expect(brand.getByTestId('tenant-brand-name-fallback')).toHaveCount(0);
  await expect
    .poll(() =>
      tenantLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);

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

  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(tenantLogo).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(tenantLogo).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.emulateMedia({ forcedColors: 'active' });
  await expect(tenantLogo).toBeVisible();
  await expect(divider).toBeVisible();
});

test('mobile home keeps the tenant logo compact without horizontal overflow', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile shell geometry is verified here.');
  await mockShellSession(page, ['TENANT_ADMIN']);
  await mockTenantBranding(page);
  await page.goto('/');

  const header = page.getByTestId('home-header');
  const brand = header.getByRole('link', { name: 'SKAX Digital Workplace home' });
  const tenantLogo = brand.getByTestId('tenant-brand-logo');

  await expect(brand).toBeVisible();
  await expect(brand).toContainText('DWP');
  await expect(tenantLogo).toBeVisible();
  await expect(brand.getByTestId('tenant-brand-name-fallback')).toHaveCount(0);
  await expect(brand.getByTestId('tenant-brand-divider')).toBeVisible();
  await expect
    .poll(() =>
      tenantLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);

  const logoBox = await tenantLogo.boundingBox();
  expect(logoBox?.width).toBe(64);
  expect(logoBox?.height).toBe(32);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(tenantLogo).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(tenantLogo).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('home falls back to the tenant name when a configured logo cannot be decoded', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The image failure contract is viewport agnostic.');
  await page.setViewportSize({ width: 1440, height: 800 });
  await mockShellSession(page, ['TENANT_ADMIN']);
  await mockTenantBranding(page, '/assets/brand/missing-tenant-logo.svg');
  await page.route('**/assets/brand/missing-tenant-logo.svg', async (route) => {
    await route.fulfill({ status: 404, contentType: 'image/svg+xml', body: '' });
  });
  await page.goto('/');

  const header = page.getByTestId('home-header');
  const brand = header.getByRole('link', { name: 'SKAX Digital Workplace home' });

  await expect(brand.getByTestId('tenant-brand-name-fallback')).toHaveText('SKAX');
  await expect(brand.getByTestId('tenant-brand-logo')).toHaveCount(0);
  await expect(brand.getByTestId('tenant-brand-divider')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
