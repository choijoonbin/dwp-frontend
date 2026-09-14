import { expect, test } from '@playwright/test';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { locationSite, locationFloor } from './support/workplace-location-fixtures';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';

for (const width of [1440, 390]) {
  test(`existing Workplace navigation opens native audit, bookings and access subviews at ${width}`, async ({
    page,
  }, testInfo) => {
    await isolateWorkplaceDevelopmentUpdates(page);
    await mockShellSession(page, ['TENANT_ADMIN'], {
      locale: 'en',
      permissions: FULL_PRODUCT_PERMISSIONS,
    });
    const reads: string[] = [];
    await page.route('**/api/platform/v1/admin/workplace/**', (route) => {
      const url = new URL(route.request().url());
      reads.push(url.pathname);
      if (url.pathname.endsWith('/sites')) return fulfillSuccess(route, [locationSite]);
      if (url.pathname.endsWith('/floors')) return fulfillSuccess(route, [locationFloor]);
      if (url.pathname.endsWith('/bookings') || url.pathname.endsWith('/audit-events'))
        return fulfillSuccess(route, {
          content: [],
          page: 0,
          size: 25,
          totalElements: 0,
          totalPages: 0,
        });
      if (
        url.pathname.endsWith('/access-rules') ||
        url.pathname.endsWith('/delegated-admin-scopes')
      )
        return fulfillSuccess(route, []);
      return route.fallback();
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/workplace/admin/operations?view=bookings&scope=return-scope');
    async function openMenu() {
      if (width < 900) {
        const toggle = page.getByRole('button', { name: 'Open Workplace navigation', exact: true });
        await expect(toggle).toBeVisible();
        await toggle.click();
      }
    }
    await openMenu();
    const navigation = page.getByTestId(width < 900 ? 'rooms-mobile-sidebar' : 'rooms-sidebar');
    const audit = navigation.getByTestId('workplace-subview-admin-operations-audit');
    await expect(audit).toBeVisible();
    await expect(audit).toHaveAttribute('aria-current', 'false');
    await audit.click();
    await expect(page).toHaveURL(/view=audit/);
    expect(new URL(page.url()).searchParams.get('scope')).toBe('return-scope');
    await expect.poll(() => reads.some((x) => x.endsWith('/audit-events'))).toBe(true);
    await openMenu();
    await expect(
      navigation.getByTestId('workplace-subview-admin-operations-bookings')
    ).toHaveAttribute('aria-current', 'false');
    await navigation.getByTestId('workplace-subview-admin-operations-bookings').click();
    await expect(page).toHaveURL(/view=bookings/);
    await expect(page.getByRole('tab', { name: 'Bookings', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await openMenu();
    // Inline children keep the existing parent as a navigable link.
    await expect(navigation.getByTestId('rooms-navigation-item-admin-governance')).toHaveAttribute(
      'href',
      '/workplace/admin/governance'
    );
    await navigation.getByTestId('workplace-subview-admin-governance-access').click();
    await expect(page).toHaveURL(/\/workplace\/admin\/governance\?/);
    expect(new URL(page.url()).searchParams.get('area')).toBe('access');
    expect(new URL(page.url()).searchParams.get('scope')).toBe('return-scope');
    expect(new URL(page.url()).searchParams.has('view')).toBe(false);
    await expect.poll(() => reads.some((x) => x.endsWith('/access-rules'))).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`workplace-native-navigation-${width}.png`),
    });
  });
}

for (const width of [390, 320]) {
  test(`mobile Workplace keeps management access in its navigation drawer at ${width}`, async ({
    page,
  }, testInfo) => {
    await isolateWorkplaceDevelopmentUpdates(page);
    await mockShellSession(page, ['TENANT_ADMIN'], {
      locale: 'en',
      permissions: FULL_PRODUCT_PERMISSIONS,
    });
    await page.route('**/api/platform/v1/workplace/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/explore'))
        return fulfillSuccess(route, {
          sites: [],
          floors: [],
          selectedFloor: null,
          resources: [],
          occupancy: [],
          closures: [],
          policy: null,
          generatedAt: new Date().toISOString(),
        });
      if (path.endsWith('/bookings')) return fulfillSuccess(route, []);
      return route.fallback();
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/workplace/home');
    await expect(page.getByTestId('workplace-home-scope')).toBeVisible();
    await expect(page.getByTestId('rooms-mobile-surface-switcher')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Workplace navigation', exact: true }).click();
    const drawer = page.getByTestId('rooms-mobile-sidebar');
    const management = drawer.getByTestId('product-surface-management-entry');
    await expect(management).toBeVisible();
    await expect(management).toHaveAttribute('href', '/workplace/admin/overview');
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true
    );
    await management.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/workplace\/admin\/overview/);
    await expect(drawer).toBeHidden();
    await expect(page.locator('[data-product-plane="management"]')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`workplace-management-drawer-${width}.png`),
    });
  });
}
