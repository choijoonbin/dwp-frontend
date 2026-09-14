import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import {
  locationFloor,
  locationResource,
  locationSite,
} from './support/workplace-location-fixtures';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';

test('source composition begins with actual scope and preserves native query and search inside condition disclosure', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  const queries: Record<string, string>[] = [];
  let state: 'READY' | 'NO_SITE' | 'DENIED' = 'READY';
  let writes = 0;
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') {
      writes += 1;
      return route.fulfill({ status: 403 });
    }
    if (!url.pathname.endsWith('/explore')) return route.fulfill({ status: 404 });
    queries.push(Object.fromEntries(url.searchParams));
    if (state === 'DENIED')
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: '{"success":false,"message":"Scope authority revoked"}',
      });
    return fulfillSuccess(route, {
      sites: state === 'READY' ? [locationSite] : [],
      floors: state === 'READY' ? [locationFloor] : [],
      selectedFloor: state === 'READY' ? locationFloor : null,
      resources: state === 'READY' ? [locationResource] : [],
      occupancy: [],
      closures: [],
      generatedAt: '2026-08-19T00:00:00Z',
      policy: {
        bookingWindowDays: 30,
        bookingRetentionDays: 365,
        maximumActiveBookings: 20,
        minimumBookingMinutes: 30,
        maximumBookingMinutes: 480,
        maximumConsecutiveDays: 5,
        workingDayStart: '07:00:00',
        workingDayEnd: '20:00:00',
        allowRecurring: false,
        requireCheckIn: true,
        checkInLeadMinutes: 60,
        autoReleaseMinutes: 30,
        allowAssignedDeskLending: false,
        showColleagueNames: false,
        version: 4,
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/workplace/explore?site=${locationSite.siteId}&floor=${locationFloor.floorId}&date=2026-08-19&time=09%3A17&duration=45&timeZone=Asia%2FSeoul&view=list&q=Focus`
  );
  const scope = page.getByTestId('workplace-discovery-scope');
  const search = page.getByRole('textbox', {
    name: 'Search spaces, neighborhoods, or amenities',
    exact: true,
  });
  const filters = page.getByRole('button', { name: 'Filters', exact: true });
  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      scope.getByRole('heading', { level: 1, name: 'Find a space · Pangyo HQ · 12F', exact: true })
    ).toBeVisible();
    await expect(scope).toContainText('2026-08-19 · 09:17 · 45 min');
    const box = await scope.boundingBox();
    expect(box?.y).toBeLessThan(110);
    expect(box?.height).toBeLessThanOrEqual(100);
    await expect(page.locator('main').getByRole('heading', { level: 1 })).toHaveCount(1);
    if (width < 768) {
      const resultHeading = page
        .getByRole('heading', { level: 2, name: locationSite.name, exact: true })
        .locator('..')
        .locator('..');
      const headingBox = await resultHeading.boundingBox();
      expect(headingBox?.height).toBeLessThan(65);
      const legend = page.getByLabel('Space status legend', { exact: true });
      const legendBox = await legend.boundingBox();
      expect(
        (legendBox?.y ?? 0) - ((headingBox?.y ?? 0) + (headingBox?.height ?? 0))
      ).toBeLessThanOrEqual(16);
    }
    await expect(search).toHaveCount(0);
    await expect(
      page.locator('main').getByRole('status').filter({ hasText: '1 of 1 results' })
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({
      path: testInfo.outputPath(`explore-compact-native-scope-${width}-loaded.png`),
      fullPage: true,
    });
    await filters.click();
    if (width < 768)
      await expect(
        page.getByRole('dialog', { name: 'Space search criteria', exact: true })
      ).toBeVisible();
    else await expect(filters).toHaveAttribute('aria-expanded', 'true');
    await expect(search).toHaveValue('Focus');
    await expect(page.getByRole('combobox', { name: /^Start time/u })).toContainText('09:17');
    await expect(page.getByRole('combobox', { name: /^Duration/u })).toContainText('45 min');
    await search.fill('No matching space');
    await expect(page).toHaveURL(/q=No\+matching\+space/u);
    if (width < 768) await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    else await filters.click();
    await expect(search).toHaveCount(0);
    await expect(
      page.locator('main').getByRole('status').filter({ hasText: '0 of 1 results' })
    ).toBeVisible();
    await expect(
      page.locator('main').getByText('No matching space', { exact: true })
    ).toBeVisible();
    await filters.click();
    await expect(search).toHaveValue('No matching space');
    await search.fill('Focus');
    if (width < 768) {
      await page.keyboard.press('Escape');
      await expect(filters).toBeFocused();
    } else await filters.click();
    await expect(search).toHaveCount(0);
    expect(queries.at(-1)).toMatchObject({
      floorId: locationFloor.floorId,
      from: '2026-08-19T00:17:00Z',
      to: '2026-08-19T01:02:00Z',
    });
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active', colorScheme: 'dark' });
  await expect(scope.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await filters.focus();
  await expect(filters).toBeFocused();
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    axe.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('explore-compact-native-scope-320-root-font200-hc-rm-loaded.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'none' });
  state = 'NO_SITE';
  await page.reload();
  await expect(
    scope.getByRole('heading', { level: 1, name: 'Find a space', exact: true })
  ).toBeVisible();
  await expect(page.getByText('No sites are available', { exact: true })).toBeVisible();
  await expect(scope).not.toContainText(locationSite.name);
  await page.screenshot({
    path: testInfo.outputPath('explore-compact-no-site-320-loaded.png'),
    fullPage: true,
  });
  state = 'DENIED';
  await page.reload();
  await expect(
    scope.getByRole('heading', { level: 1, name: 'Find a space', exact: true })
  ).toBeVisible();
  await expect(page.locator('main')).not.toContainText(locationSite.name);
  await expect(
    page.getByRole('complementary', { name: locationResource.name, exact: true })
  ).toHaveCount(0);
  expect(writes).toBe(0);
});
