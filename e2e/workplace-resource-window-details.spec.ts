import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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

test('native inspector keeps selected-window facts anonymous and mobile booking footer visible while scrolling', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  const queries: Record<string, string>[] = [];
  let denied = false;
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
    if (denied)
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: '{"success":false,"message":"Resource authority revoked"}',
      });
    return fulfillSuccess(route, {
      sites: [locationSite],
      floors: [locationFloor],
      selectedFloor: locationFloor,
      resources: [locationResource],
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
      occupancy: [
        {
          resourceId: locationResource.resourceId,
          bookingId: 'PRIVATE-BOOKING-ID',
          bookedByDisplayName: 'CONFIDENTIAL PERSON',
          currentUser: false,
          status: 'RESERVED',
          startsAt: '2026-08-19T00:10:00Z',
          endsAt: '2026-08-19T00:25:00Z',
        },
      ],
      closures: [
        {
          resourceId: locationResource.resourceId,
          availability: 'UNAVAILABLE',
          startsAt: '2026-08-19T00:35:00Z',
          endsAt: '2026-08-19T00:40:00Z',
        },
      ],
      generatedAt: '2026-08-19T00:00:00Z',
    });
  });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(
    `/workplace/explore?site=${locationSite.siteId}&floor=${locationFloor.floorId}&date=2026-08-19&time=09%3A17&duration=45&timeZone=Asia%2FSeoul&view=list&resource=${locationResource.resourceId}`
  );
  const inspector = page.getByRole('complementary', { name: locationResource.name, exact: true });
  const summary = inspector.getByTestId('workplace-resource-window-summary');
  await expect(summary).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Start time/u })).toHaveCount(0);
  const filters = page.getByRole('button', { name: 'Filters', exact: true });
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('combobox', { name: /^Start time/u })).toContainText('09:17');
  await expect(page.getByRole('combobox', { name: /^Duration/u })).toContainText('45 min');
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded', 'false');
  await expect(summary.getByText('09:17–09:25', { exact: true })).toBeVisible();
  await expect(summary.getByText('09:35–09:40', { exact: true })).toBeVisible();
  await expect(summary.getByRole('status')).toContainText(
    'Check-in opens 60 minutes before arrival; no-shows are released 30 minutes after start.'
  );
  expect(await page.locator('main').textContent()).not.toContain('CONFIDENTIAL PERSON');
  expect(await page.locator('main').textContent()).not.toContain('PRIVATE-BOOKING-ID');
  expect(queries.at(-1)).toMatchObject({
    from: '2026-08-19T00:17:00Z',
    to: '2026-08-19T01:02:00Z',
    floorId: locationFloor.floorId,
  });
  await page.screenshot({
    path: testInfo.outputPath('native-window-inspector-1280-loaded.png'),
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const footer = inspector.getByTestId('detail-inspector-footer');
    await expect(footer).toBeVisible();
    const before = await footer.boundingBox();
    expect(before?.y).toBeGreaterThan(0);
    expect(Math.round((before?.y ?? 0) + (before?.height ?? 0))).toBe(1000);
    await footer.evaluate((element) => {
      const body = element.previousElementSibling;
      if (body instanceof HTMLElement) body.scrollTop = body.scrollHeight;
    });
    expect(await footer.boundingBox()).toEqual(before);
    await expect(
      footer.getByRole('button', { name: 'Book this space', exact: true })
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await expect
      .poll(() => inspector.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1');
    await page.screenshot({
      path: testInfo.outputPath(`native-window-inspector-${width}-loaded.png`),
      fullPage: false,
    });
  }
  const axe = await new AxeBuilder({ page }).include('aside').analyze();
  expect(
    axe.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
  ).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  const enlargedFooter = inspector.getByTestId('detail-inspector-footer');
  await expect(enlargedFooter).toBeVisible();
  const enlargedBox = await enlargedFooter.boundingBox();
  expect(Math.round((enlargedBox?.y ?? 0) + (enlargedBox?.height ?? 0))).toBe(1000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const close = inspector.getByRole('button', { name: 'Close', exact: true });
  await close.focus();
  await expect(close).toBeFocused();
  const enlargedAxe = await new AxeBuilder({ page }).include('aside').analyze();
  expect(
    enlargedAxe.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('native-window-inspector-320-root-font200-hc-rm-loaded.png'),
    fullPage: false,
  });
  denied = true;
  await page.reload();
  await expect(inspector).toHaveCount(0);
  await expect(page.getByTestId('workplace-resource-window-summary')).toHaveCount(0);
  expect(writes).toBe(0);
});
