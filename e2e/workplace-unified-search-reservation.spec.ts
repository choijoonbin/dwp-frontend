import { expect, test, type Page } from '@playwright/test';

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

const roomResource = {
  ...locationResource,
  resourceId: '30000000-0000-4000-8000-000000000013',
  calendarResourceId: 'calendar-resource-horizon-12',
  code: 'R-1208',
  name: 'Horizon room 12',
  nameKo: '호라이즌 회의실 12',
  nameEn: 'Horizon room 12',
  type: 'ROOM' as const,
  mode: 'RESERVABLE' as const,
  neighborhood: 'Collaboration zone',
  capacity: 8,
  features: ['DISPLAY', 'VIDEO', 'WHITEBOARD'],
  positionX: 34,
  positionY: 18,
  widthPercent: 18,
  heightPercent: 14,
  version: 3,
};

const workplacePolicy = {
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
};

const canonicalWindow =
  `v=1&date=2026-08-19&start=09%3A17&duration=45&tz=Asia%2FSeoul` +
  `&sites=${locationSite.siteId}&floors=${locationFloor.floorId}`;

async function mockUnifiedFind(page: Page) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  let workplaceWrites = 0;
  let roomWrites = 0;
  let persistedBooking: Record<string, unknown> | null = null;

  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata')) {
      return route.fulfill({ status: 404 });
    }
    if (path.endsWith('/explore') && request.method() === 'GET') {
      return fulfillSuccess(route, {
        sites: [{ ...locationSite, resourceCount: 2 }],
        floors: [{ ...locationFloor, resourceCount: 2 }],
        selectedFloor: { ...locationFloor, resourceCount: 2 },
        resources: [locationResource, roomResource],
        occupancy: [],
        closures: [],
        generatedAt: '2026-08-19T00:00:00Z',
        policy: workplacePolicy,
      });
    }
    if (path.endsWith('/bookings')) {
      if (request.method() === 'GET') {
        return fulfillSuccess(route, persistedBooking ? [persistedBooking] : []);
      }
      workplaceWrites += 1;
      const input = request.postDataJSON() as Record<string, unknown>;
      persistedBooking = {
        bookingId: '40000000-0000-4000-8000-000000000014',
        resourceId: locationResource.resourceId,
        resourceName: locationResource.name,
        resourceType: 'DESK',
        siteName: locationSite.name,
        floorName: locationFloor.name,
        purpose: input.purpose,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: 'RESERVED',
        visibleToColleagues: input.visibleToColleagues,
        checkedInAt: null,
        releasedAt: null,
        canCheckIn: true,
        canCancel: true,
        canRelease: false,
        checkInOpensAt: '2026-08-18T23:30:00Z',
        checkInClosesAt: '2026-08-19T01:00:00Z',
        version: 0,
      };
      return fulfillSuccess(route, persistedBooking);
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/rooms/policy', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
        message: 'Room policy authority is unavailable',
      }),
    })
  );
  await page.route('**/api/platform/v1/rooms/bookings', async (route) => {
    if (route.request().method() !== 'GET') roomWrites += 1;
    return route.fulfill({ status: 403 });
  });

  return {
    workplaceWrites: () => workplaceWrites,
    roomWrites: () => roomWrites,
  };
}

function currentUrl(page: Page) {
  return new URL(page.url());
}

test('uses /workplace/find as the canonical surface and migrates both legacy entry points once', async ({
  page,
}) => {
  await mockUnifiedFind(page);

  await page.goto('/workplace/find');
  await expect(page.getByTestId('workplace-discovery-scope')).toBeVisible();
  await expect.poll(() => currentUrl(page).pathname).toBe('/workplace/find');
  await expect.poll(() => currentUrl(page).searchParams.get('v')).toBe('1');
  await expect.poll(() => currentUrl(page).searchParams.get('types')).toBe('ALL');

  await page.goto(
    `/workplace/explore?date=2026-08-19&time=09%3A17&duration=45` +
      `&timeZone=Asia%2FSeoul&site=${locationSite.siteId}&floor=${locationFloor.floorId}` +
      '&type=DESK&feature=MONITOR&view=list&q=Focus#saved-find'
  );
  await expect(page).toHaveURL((url) => {
    const params = url.searchParams;
    return (
      url.pathname === '/workplace/find' &&
      url.hash === '#saved-find' &&
      params.get('v') === '1' &&
      params.get('start') === '09:17' &&
      params.get('tz') === 'Asia/Seoul' &&
      params.get('sites') === locationSite.siteId &&
      params.get('floors') === locationFloor.floorId &&
      params.get('types') === 'DESK' &&
      params.get('features') === 'MONITOR' &&
      params.get('q') === 'Focus' &&
      !['time', 'timeZone', 'site', 'floor', 'type', 'feature'].some((key) => params.has(key))
    );
  });
  await expect(page.getByRole('button', { name: /Focus desk 12/u })).toBeVisible();
  await expect(page.getByRole('button', { name: /Horizon room 12/u })).toHaveCount(0);

  await page.goto(
    `/workplace/rooms?date=2026-08-19&time=09%3A17&duration=45` +
      `&timeZone=Asia%2FSeoul&site=${locationSite.siteId}&floor=${locationFloor.floorId}` +
      '&type=DESK&view=list#saved-room'
  );
  await expect(page).toHaveURL((url) => {
    const params = url.searchParams;
    return (
      url.pathname === '/workplace/find' &&
      url.hash === '#saved-room' &&
      params.get('v') === '1' &&
      params.get('types') === 'ROOM' &&
      params.get('start') === '09:17' &&
      params.get('tz') === 'Asia/Seoul' &&
      !params.has('type') &&
      !params.has('time') &&
      !params.has('timeZone')
    );
  });
  await expect(page.getByRole('button', { name: /Horizon room 12/u })).toBeVisible();
  await expect(page.getByRole('button', { name: /Focus desk 12/u })).toHaveCount(0);
});

test('keeps non-room discovery and booking usable when the room policy source fails and restores shared URL state', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const writes = await mockUnifiedFind(page);
  await page.goto(`/workplace/find?${canonicalWindow}&types=ALL&view=list`);

  const scope = page.getByTestId('workplace-discovery-scope');
  const filters = page.getByRole('button', { name: 'Filters', exact: true });
  const deskResult = page.getByRole('button', { name: /Focus desk 12/u });
  const roomResult = page.getByRole('button', { name: /Horizon room 12/u });
  await expect(scope).toBeVisible();
  await expect(
    page.getByText(
      'The meeting-room booking policy is unavailable. Room booking is disabled until it is restored.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(deskResult).toBeVisible();
  await expect(roomResult).toBeVisible();

  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(scope).toBeVisible();
    await expect(filters).toBeVisible();
    await expect(deskResult).toBeVisible();
    const scopeBox = await scope.boundingBox();
    const filterBox = await filters.boundingBox();
    expect(scopeBox?.y).toBeLessThan(1000);
    expect((filterBox?.y ?? 1000) + (filterBox?.height ?? 0)).toBeLessThanOrEqual(1000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
  }

  await roomResult.click();
  const roomInspector = page.getByRole('complementary', {
    name: roomResource.name,
    exact: true,
  });
  await expect(roomInspector).toBeVisible();
  await expect(
    roomInspector.getByText(
      'The meeting-room booking policy is unavailable. Room booking is disabled until it is restored.',
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    roomInspector.getByRole('button', { name: 'Book this space', exact: true })
  ).toBeDisabled();
  expect(writes.roomWrites()).toBe(0);

  await roomInspector.getByRole('button', { name: 'Close', exact: true }).click();
  await filters.click();
  const criteria = page.getByRole('dialog', { name: 'Space search criteria', exact: true });
  const search = criteria.getByRole('textbox', {
    name: 'Search spaces, neighborhoods, or amenities',
    exact: true,
  });
  await search.fill('Focus');
  await criteria.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await deskResult.click();
  const deskInspector = page.getByRole('complementary', {
    name: locationResource.name,
    exact: true,
  });
  await expect(deskInspector).toBeVisible();
  await expect(
    deskInspector.getByRole('button', { name: 'Book this space', exact: true })
  ).toBeEnabled();
  const sharedUrl = page.url();
  expect(currentUrl(page).searchParams.get('q')).toBe('Focus');
  expect(currentUrl(page).searchParams.get('resource')).toBe(locationResource.resourceId);

  const roomUrl = new URL(sharedUrl);
  roomUrl.searchParams.set('q', 'Horizon');
  roomUrl.searchParams.set('resource', roomResource.resourceId);
  await page.goto(roomUrl.toString());
  await expect(
    page.getByRole('complementary', { name: roomResource.name, exact: true })
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(sharedUrl);
  await expect(deskInspector).toBeVisible();

  await page.goto('/workplace/home');
  await page.goto(sharedUrl);
  await expect(page).toHaveURL(sharedUrl);
  await expect(deskInspector).toBeVisible();
  await deskInspector.getByRole('button', { name: 'Close', exact: true }).click();
  await filters.click();
  await expect(
    page.getByRole('dialog', { name: 'Space search criteria', exact: true }).getByRole('textbox', {
      name: 'Search spaces, neighborhoods, or amenities',
      exact: true,
    })
  ).toHaveValue('Focus');
  await page
    .getByRole('dialog', { name: 'Space search criteria', exact: true })
    .getByRole('button', { name: 'Apply filters', exact: true })
    .click();

  await deskResult.click();
  await expect(deskInspector).toBeVisible();
  await deskInspector.getByRole('button', { name: 'Book this space', exact: true }).click();
  const bookingDialog = page.getByRole('dialog', { name: 'Book a workspace', exact: true });
  await expect(bookingDialog).toBeVisible();
  await bookingDialog.getByLabel('Purpose', { exact: true }).fill('Unified search booking');
  await bookingDialog.getByRole('button', { name: 'Book', exact: true }).click();
  await expect.poll(writes.workplaceWrites).toBe(1);
  expect(writes.roomWrites()).toBe(0);
});
