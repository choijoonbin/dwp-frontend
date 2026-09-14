import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
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
import { CALENDAR_EVENT_FIXTURE, CALENDAR_FOCUS_FIXTURE } from './support/product-area-fixtures';
import { workplaceSourceSnapshot } from './support/workplace-source-snapshot';
import type { CalendarHome, WorkplaceBooking, WorkplacePolicy } from '@dwp-frontend/shared-utils';
import type { Page, TestInfo } from '@playwright/test';

const sourceSnapshots = new Map<
  string,
  { url: string; sources: Awaited<ReturnType<typeof workplaceSourceSnapshot>> }
>();
test.beforeEach(async ({ page }, testInfo) => {
  sourceSnapshots.set(testInfo.testId, {
    url: page.url(),
    sources: await workplaceSourceSnapshot(),
  });
});
test.afterEach(async ({ page }, testInfo) => {
  const before = sourceSnapshots.get(testInfo.testId);
  const after = await workplaceSourceSnapshot();
  const changed = Object.keys(after).filter((file) => before?.sources[file] !== after[file]);
  const record = JSON.stringify(
    { before, after: { url: page.url(), sources: after }, changed },
    null,
    2
  );
  const snapshotPath = testInfo.outputPath('home-source-before-after.json');
  await writeFile(snapshotPath, record + '\n');
  await testInfo.attach('home-source-before-after.json', {
    path: snapshotPath,
    contentType: 'application/json',
  });
  expect(changed, 'Home loaded proofs must use unchanged production sources').toEqual([]);
});

async function captureHome(page: Page, testInfo: TestInfo, prefix: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  const sidebar =
    width >= 1280 ? await page.locator('aside[id$="-desktop-navigation"]').boundingBox() : null;
  await expect
    .poll(async () => Math.round((await page.locator('main').boundingBox())?.x ?? -1))
    .toBe(Math.round(sidebar?.width ?? 0));
  const scope = page.getByTestId('workplace-home-scope');
  await expect(scope.getByRole('combobox')).toHaveCount(0);
  await expect(scope.getByRole('heading', { level: 1 })).toHaveText(
    width >= 1280
      ? prefix.includes('no-site')
        ? 'No site selected'
        : /^Pangyo HQ · (12F|13F)$/u
      : "Today's workplace"
  );
  expect(
    await scope
      .getByRole('heading', { level: 1 })
      .evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize))
  ).toBe(width >= 1280 ? 28 : 22);
  const intro = page
    .getByTestId('workplace-day-brief')
    .getByText('Get ready for your workday', { exact: true });
  if (width < 1280) await expect(intro).toBeHidden();
  else await expect(intro).toBeVisible();
  const cards = page.getByTestId('workplace-home-type-cards').locator(':scope > li');
  await expect(cards).toHaveCount(4);
  expect(
    await cards.evaluateAll(
      (items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().x))).size
    )
  ).toBe(width >= 1280 ? 4 : 2);
  if (width < 1280) {
    expect(
      await cards.evaluateAll((items) =>
        Math.max(...items.map((item) => item.getBoundingClientRect().height))
      )
    ).toBeLessThanOrEqual(160);
    await expect(cards.getByRole('img')).toHaveCount(0);
  }
  const iconColors = await cards.locator('svg').evaluateAll((icons) =>
    icons.map((icon) => ({
      width: icon.getBoundingClientRect().width,
      color: getComputedStyle(icon).color,
    }))
  );
  expect(iconColors.length).toBeGreaterThanOrEqual(4);
  expect(iconColors.every((icon) => icon.width >= 14 && icon.color !== 'rgba(0, 0, 0, 0)')).toBe(
    true
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width
  );
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath(`${prefix}-${width}-loaded.png`),
    fullPage: true,
  });
}

const policy: WorkplacePolicy = {
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
  version: 2,
};
const nextFloor = {
  ...locationFloor,
  floorId: '20000000-0000-0000-0000-000000000013',
  floorNumber: 13,
  name: '13F',
  nameEn: '13F',
  nameKo: '13층',
};

test('home reveals ready native sources while Calendar is pending and changes actual floor and time scope', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:00:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS'),
  });
  let releaseCalendar!: () => void;
  const calendarGate = new Promise<void>((resolve) => {
    releaseCalendar = resolve;
  });
  const reads: { floorId: string | null; from: string | null; to: string | null }[] = [];
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/explore')) {
      const params = url.searchParams;
      reads.push({
        floorId: params.get('floorId'),
        from: params.get('from'),
        to: params.get('to'),
      });
      const floor = params.get('floorId') === nextFloor.floorId ? nextFloor : locationFloor;
      return fulfillSuccess(route, {
        sites: [{ ...locationSite, configuredFloorCount: 2, resourceCount: 4 }],
        floors: [locationFloor, nextFloor],
        selectedFloor: floor,
        resources: [
          { ...locationResource, floorId: floor.floorId },
          {
            ...locationResource,
            floorId: floor.floorId,
            resourceId: '30000000-0000-0000-0000-000000000020',
            code: 'F-20',
            name: 'Focus pod 20',
            nameEn: 'Focus pod 20',
            type: 'FOCUS_POD',
          },
        ],
        occupancy: [],
        closures: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    }
    if (url.pathname.endsWith('/bookings')) return fulfillSuccess(route, []);
    return route.fallback();
  });
  await page.route('**/api/platform/v1/calendar/home**', async (route) => {
    await calendarGate;
    return fulfillSuccess(route, {
      date: '2026-08-19',
      timeZone: 'Asia/Seoul',
      nextEvent: null,
      today: [],
      metrics: {
        eventCount: 0,
        meetingMinutes: 0,
        focusMinutes: 0,
        focusTargetMinutes: 240,
        conflictCount: 0,
        awaitingResponseCount: 0,
        availableRoomCount: 0,
      },
      weekLoad: [],
      attention: [],
      generatedAt: '2026-08-19T00:00:00Z',
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/workplace/home');
  await expect(page.getByTestId('workplace-day-brief')).toBeVisible();
  await expect(
    page.getByTestId('workplace-home-scope').getByRole('heading', { level: 1 })
  ).toHaveText('Pangyo HQ · 12F');
  await expect(page.getByRole('heading', { name: 'Spaces for the next 60 minutes' })).toBeVisible();
  await expect(
    page.getByText('Preparing your workplace overview', { exact: true })
  ).not.toHaveCount(0);
  await expect(page.getByTestId('workplace-physical-open-count')).toHaveText('2');
  await expect(page.getByTestId('workplace-home-type-cards').locator(':scope > li')).toHaveCount(4);
  await expect(
    page.getByTestId('workplace-home-source-summary').locator(':scope > div')
  ).toHaveCount(3);
  await expect(page.getByTestId('workplace-home-scope').getByRole('combobox')).toHaveCount(0);
  for (const width of [1440, 1280, 390, 320])
    await captureHome(page, testInfo, 'workplace-home-partial-calendar', width);
  releaseCalendar();
  await expect(page.getByText('Preparing your workplace overview', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const scope = page.getByTestId('workplace-home-scope');
  await scope.getByRole('button', { name: 'Change location and time', exact: true }).click();
  await scope.getByRole('combobox', { name: /^Floor(?: |$)/u }).click();
  await page.getByRole('option', { name: '13F', exact: true }).click();
  await expect.poll(() => reads.at(-1)?.floorId).toBe(nextFloor.floorId);
  await expect(scope.getByRole('heading', { level: 1 })).toHaveText('Pangyo HQ · 13F');
  await expect(scope.getByRole('combobox', { name: /^Floor(?: |$)/u })).toBeEnabled();
  const minutes = scope
    .getByRole('group', { name: 'Start date and time', exact: true })
    .getByRole('spinbutton', { name: 'Minutes', exact: true });
  await minutes.fill('30');
  await minutes.press('Tab');
  await expect
    .poll(() => reads.at(-1))
    .toEqual({
      floorId: nextFloor.floorId,
      from: '2026-08-19T00:30:00Z',
      to: '2026-08-19T01:30:00Z',
    });
  await expect(page.getByText('Preparing your workplace overview', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('workplace-initial-checks-count')).toHaveText('2');
  await expect(
    page.getByRole('heading', { name: 'Choose the space that fits the work' })
  ).toBeVisible();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath('workplace-home-actual-scope-1440-loaded.png'),
    fullPage: true,
  });
  await scope.getByRole('button', { name: 'Change location and time', exact: true }).click();
  for (const width of [1440, 1280, 390, 320])
    await captureHome(page, testInfo, 'workplace-home-original-density', width);
});

test('an empty authorized site result offers the existing access menu only to a capable administrator', async ({
  page,
}, testInfo) => {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter(
      (item) => item.resourceKey !== 'APP.ROOMS' && item.resourceKey !== 'APP.CALENDAR'
    ),
  });
  let writes = 0;
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    if (route.request().method() !== 'GET') {
      writes += 1;
      return route.fulfill({ status: 403 });
    }
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/explore'))
      return fulfillSuccess(route, {
        sites: [],
        floors: [],
        selectedFloor: null,
        resources: [],
        occupancy: [],
        policy,
        generatedAt: '2026-08-19T00:00:00Z',
      });
    if (path.endsWith('/bookings')) return fulfillSuccess(route, []);
    return route.fallback();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/workplace/home');
  await expect(page.getByText('Preparing your workplace overview', { exact: true })).toHaveCount(0);
  const help = page.getByTestId('workplace-home-access-help');
  await expect(help).toBeVisible();
  await expect(page.getByTestId('workplace-home-type-unavailable')).toHaveCount(4);
  await expect(page.getByTestId('workplace-home-type-unavailable')).toHaveText([
    'Unavailable',
    'Unavailable',
    'Unavailable',
    'Unavailable',
  ]);
  await expect(page.getByTestId('workplace-physical-open-count')).toHaveCount(0);
  await expect(page.getByTestId('workplace-home-scope').getByRole('combobox')).toHaveCount(0);
  await expect(help.getByRole('link', { name: 'Access control', exact: true })).toHaveAttribute(
    'href',
    '/workplace/admin/governance?area=access'
  );
  await expect(
    page.getByRole('heading', { name: 'No workplace site is available to you', exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('workplace-home-empty-authorized-sites-1440-loaded.png'),
    fullPage: true,
  });
  for (const width of [1440, 1280, 390, 320])
    await captureHome(page, testInfo, 'workplace-home-no-site', width);
  expect(writes).toBe(0);
  await mockShellSession(page, ['EMPLOYEE'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter(
      (item) =>
        !item.resourceKey.startsWith('ADMIN.') &&
        item.resourceKey !== 'APP.ROOMS' &&
        item.resourceKey !== 'APP.CALENDAR'
    ),
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No workplace site is available to you', exact: true })
  ).toBeVisible();
  await expect(page.getByTestId('workplace-home-access-help')).toHaveCount(0);
  expect(writes).toBe(0);
});

async function mockNativeCheckInHome(page: Page, { readOnly = false, dark = false } = {}) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(new Date('2026-08-19T00:20:00Z'));
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS.filter(
      (item) =>
        item.resourceKey !== 'APP.ROOMS' &&
        !(readOnly && item.resourceKey === 'APP.WORKPLACE' && item.permissionCode === 'UPDATE')
    ),
    ...(dark
      ? {
          appearance: {
            mode: 'dark',
            density: 'comfortable',
            highContrast: true,
            reduceMotion: true,
          } as const,
        }
      : {}),
  });
  const booking: WorkplaceBooking = {
    bookingId: '40000000-0000-0000-0000-000000000009',
    resourceId: locationResource.resourceId,
    resourceName: locationResource.name,
    resourceType: 'DESK',
    siteName: locationSite.name,
    floorName: locationFloor.name,
    purpose: 'Review the actual owner work plan',
    startsAt: '2026-08-19T00:00:00Z',
    endsAt: '2026-08-19T09:00:00Z',
    status: 'RESERVED',
    visibleToColleagues: false,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: true,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: '2026-08-18T23:00:00Z',
    checkInClosesAt: '2026-08-19T00:30:00Z',
    version: 9,
  };
  const calendar: CalendarHome = {
    date: '2026-08-19',
    timeZone: 'Asia/Seoul',
    nextEvent: null,
    today: [
      {
        ...CALENDAR_EVENT_FIXTURE,
        title: 'Verified project review',
        startsAt: '2026-08-19T01:00:00Z',
        endsAt: '2026-08-19T02:00:00Z',
      },
      {
        ...CALENDAR_FOCUS_FIXTURE,
        title: 'Verified writing focus',
        startsAt: '2026-08-19T04:00:00Z',
        endsAt: '2026-08-19T06:00:00Z',
      },
    ],
    metrics: {
      eventCount: 2,
      meetingMinutes: 60,
      focusMinutes: 120,
      focusTargetMinutes: 240,
      conflictCount: 0,
      awaitingResponseCount: 0,
      availableRoomCount: 0,
    },
    weekLoad: [
      {
        date: '2026-08-19',
        meetingMinutes: 60,
        focusMinutes: 120,
        eventCount: 2,
        conflictCount: 0,
        loadPercent: 37.5,
      },
    ],
    attention: [],
    generatedAt: '2026-08-19T00:20:00Z',
  };
  const state = { unavailable: false, reads: 0, writes: [] as number[], booking, calendar };
  await page.route('**/api/platform/v1/workplace/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/explore'))
      return fulfillSuccess(route, {
        sites: [locationSite],
        floors: [locationFloor],
        selectedFloor: locationFloor,
        resources: ['DESK', 'FOCUS_POD', 'PHONE_BOOTH', 'ROOM'].map((type, index) => ({
          ...locationResource,
          type,
          resourceId: `30000000-0000-0000-0000-${String(index + 12).padStart(12, '0')}`,
          code: `${type}-${index + 12}`,
          name: `${type} ${index + 12}`,
        })),
        occupancy: [
          {
            resourceId: booking.resourceId,
            bookingId: booking.bookingId,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            status: booking.status,
            bookedByDisplayName: null,
            currentUser: true,
          },
        ],
        closures: [],
        policy,
        generatedAt: '2026-08-19T00:20:00Z',
      });
    if (request.method() === 'GET' && path.endsWith('/bookings')) {
      state.reads += 1;
      if (state.unavailable)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"success":false,"message":"Booking source unavailable."}',
        });
      return fulfillSuccess(route, [state.booking]);
    }
    if (request.method() === 'POST' && path.endsWith(`/${booking.bookingId}/check-in`)) {
      const version = (request.postDataJSON() as { version: number }).version;
      state.writes.push(version);
      expect(version).toBe(state.booking.version);
      state.booking = {
        ...state.booking,
        status: 'CHECKED_IN',
        checkedInAt: '2026-08-19T00:20:01Z',
        canCheckIn: false,
        canRelease: true,
        version: version + 1,
      };
      return fulfillSuccess(route, state.booking);
    }
    if (request.method() !== 'GET') throw new Error(`Unexpected native command: ${path}`);
    return route.fallback();
  });
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    fulfillSuccess(route, state.calendar)
  );
  return state;
}

test('the loaded native check-in hero preserves mobile priority and uses the real deadline countdown without authorizing expired actions', async ({
  page,
}, testInfo) => {
  const state = await mockNativeCheckInHome(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/workplace/home');
  const hero = page.getByTestId('workplace-day-context');
  await expect(hero.getByRole('button', { name: 'Check in now', exact: true })).toBeVisible();
  const countdown = page.getByTestId('workplace-home-check-in-countdown');
  await expect(countdown).toContainText('10:00');
  await page.clock.setFixedTime(new Date('2026-08-19T00:20:01Z'));
  await page.clock.fastForward(1000);
  await expect(countdown).toContainText('09:59');
  await expect(hero.getByText('Check in by 09:30', { exact: true })).toBeVisible();
  for (const width of [1440, 1280, 390, 320]) {
    await captureHome(page, testInfo, 'workplace-home-normal-native-check-in', width);
    if (width < 1280) {
      const primary = await hero
        .getByRole('button', { name: 'Check in now', exact: true })
        .boundingBox();
      const detail = await hero
        .getByRole('link', { name: 'View booking', exact: true })
        .boundingBox();
      expect(primary).not.toBeNull();
      expect(detail).not.toBeNull();
      expect(Math.abs(primary!.width - detail!.width)).toBeLessThan(2);
      expect(detail!.y).toBeGreaterThanOrEqual(primary!.y + primary!.height);
      expect(
        await hero.evaluate((element) => {
          for (
            let ancestor: Element | null = element;
            ancestor;
            ancestor = ancestor.parentElement
          ) {
            const background = getComputedStyle(ancestor).backgroundColor;
            if (background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)')
              return background;
          }
          return null;
        })
      ).toBe('rgb(255, 255, 255)');
    }
  }
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
  await page.clock.setFixedTime(new Date('2026-08-19T00:30:01Z'));
  await page.clock.fastForward(600_000);
  await expect(hero.getByRole('button', { name: 'Check in now', exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  await page.clock.setFixedTime(new Date('2026-08-19T00:19:00Z'));
  await page.clock.fastForward(1000);
  await expect(hero.getByRole('button', { name: 'Check in now', exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('native read-only check-in remains a booking detail action and stale booking data requires a manual authoritative recheck', async ({
  page,
}, testInfo) => {
  const state = await mockNativeCheckInHome(page, { readOnly: true });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/workplace/home');
  const hero = page.getByTestId('workplace-day-context');
  await expect(hero.getByRole('button', { name: 'Check in now', exact: true })).toHaveCount(0);
  await expect(hero.getByRole('link', { name: 'View booking', exact: true })).toBeVisible();
  await expect(
    hero.getByText('This account can view the booking but does not have permission to check in.', {
      exact: true,
    })
  ).toBeVisible();
  expect(state.writes).toEqual([]);
  // Override only native permission data; reinstalling the broad shell route would replace this booking fixture.
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(
      route,
      FULL_PRODUCT_PERMISSIONS.filter((item) => item.resourceKey !== 'APP.ROOMS')
    )
  );
  await page.reload();
  await expect(hero.getByRole('button', { name: 'Check in now', exact: true })).toBeVisible();
  state.unavailable = true;
  await page
    .getByTestId('workplace-home-scope')
    .getByRole('button', { name: 'Try again', exact: true })
    .click();
  await expect(hero.getByRole('button', { name: 'Check in now', exact: true })).toHaveCount(0);
  const readCount = state.reads;
  state.unavailable = false;
  state.booking = { ...state.booking, version: 12 };
  await hero.getByRole('button', { name: 'Verify current data', exact: true }).click();
  await expect.poll(() => state.reads).toBeGreaterThan(readCount);
  const checkIn = hero.getByRole('button', { name: 'Check in now', exact: true });
  await expect(checkIn).toBeVisible();
  await captureHome(page, testInfo, 'workplace-home-manual-authority-recovery', 390);
  await checkIn.evaluate((element) => {
    (element as HTMLElement).click();
    (element as HTMLElement).click();
  });
  await expect.poll(() => state.writes).toEqual([12]);
  await expect(checkIn).toHaveCount(0);
});

test('the original home hierarchy stays readable in dark high contrast with reduced motion', async ({
  page,
}, testInfo) => {
  const state = await mockNativeCheckInHome(page, { dark: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/workplace/home');
  for (const width of [1280, 390, 320])
    await captureHome(page, testInfo, 'workplace-home-dark-hc-reduced-motion', width);
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
  expect(state.writes).toEqual([]);
});
