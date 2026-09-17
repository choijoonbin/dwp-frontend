import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';

import type { Page, Route } from '@playwright/test';
import type { CalendarEvent, CalendarPolicy, WorkplaceBooking } from '@dwp-frontend/shared-utils';

const NOW = new Date('2026-09-16T01:00:00.000Z');
const canonicalPath =
  '/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL';

const roomPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 240,
  maximumAdvanceDays: 90,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 300,
  dailyMeetingLimitMinutes: 240,
  enforceMeetingAgenda: true,
  allowExternalAttendees: false,
  version: 5,
} satisfies CalendarPolicy;

function minutesFromNow(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString();
}

function workplaceBooking(): WorkplaceBooking {
  return {
    bookingId: 'wp-urgent-16',
    resourceId: 'desk-focus-16',
    resourceName: 'Focus desk 16',
    resourceType: 'DESK',
    siteName: 'Seoul HQ',
    floorName: '12F',
    purpose: 'Design review preparation',
    startsAt: minutesFromNow(15),
    endsAt: minutesFromNow(75),
    status: 'RESERVED',
    visibleToColleagues: false,
    checkedInAt: null,
    releasedAt: null,
    canCheckIn: true,
    canCancel: true,
    canRelease: false,
    checkInOpensAt: minutesFromNow(-5),
    checkInClosesAt: minutesFromNow(30),
    version: 7,
  };
}

function calendarEvent(): CalendarEvent {
  return {
    eventId: 'calendar-room-16',
    calendarId: 'calendar-personal',
    calendarName: 'My calendar',
    calendarColor: '#2457D6',
    organizerName: 'Morgan Lee',
    organizerEmail: 'morgan.lee@example.com',
    title: 'Design planning review',
    description: 'Review the next workplace release.',
    type: 'MEETING',
    startsAt: minutesFromNow(120),
    endsAt: minutesFromNow(180),
    timeZone: 'Asia/Seoul',
    allDay: false,
    status: 'CONFIRMED',
    visibility: 'DEFAULT',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: true,
    myResponse: 'NEEDS_ACTION',
    attendees: [
      {
        email: 'tenant.admin@example.com',
        name: 'Tenant Admin',
        type: 'REQUIRED',
        response: 'NEEDS_ACTION',
      },
    ],
    resource: {
      resourceId: 'room-horizon-16',
      code: 'R-1216',
      name: 'Horizon room 16',
      nameKo: '호라이즌 회의실 16',
      nameEn: 'Horizon room 16',
      type: 'ROOM',
      site: 'Seoul HQ',
      floor: '12F',
      capacity: 8,
      features: ['DISPLAY', 'VIDEO', 'WHITEBOARD'],
      timeZone: 'Asia/Seoul',
      approvalRequired: false,
      state: 'AVAILABLE',
      available: true,
      version: 4,
    },
    conflict: false,
    capabilities: {
      canViewDetails: true,
      canEdit: true,
      canDelete: true,
      canRestore: false,
      canRespond: true,
      canStar: true,
    },
    version: 11,
  };
}

type SourceFailure = 'denied' | 'unavailable' | null;

type SetupOptions = Readonly<{
  calendarFailure?: SourceFailure;
  workplaceFailure?: SourceFailure;
}>;

type CommandEvidence = Readonly<{
  calendarBodies: Array<unknown>;
  calendarReads: () => number;
  calendarWrites: () => number;
  makeCalendarStale: () => void;
  makeWorkplaceStale: () => void;
  workplaceBodies: Array<unknown>;
  workplaceReads: () => number;
  workplaceWrites: () => number;
}>;

function fulfillFailure(route: Route, status: 403 | 503, message: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', message, data: null }),
  });
}

async function mockUnifiedReservations(
  page: Page,
  { calendarFailure = null, workplaceFailure = null }: SetupOptions = {}
): Promise<CommandEvidence> {
  await isolateWorkplaceDevelopmentUpdates(page);
  await page.clock.setFixedTime(NOW);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  let workplace = [workplaceBooking()];
  let calendar = [calendarEvent()];
  let workplaceReads = 0;
  let calendarReads = 0;
  let workplaceWrites = 0;
  let calendarWrites = 0;
  let workplaceStale = false;
  let calendarStale = false;
  const workplaceBodies: Array<unknown> = [];
  const calendarBodies: Array<unknown> = [];

  await page.route('**/api/platform/v1/workplace/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/platform/v1/workplace/bookings') {
      workplaceReads += 1;
      if (workplaceFailure === 'denied') {
        return fulfillFailure(route, 403, 'Workplace reservations are outside this scope.');
      }
      if (workplaceFailure === 'unavailable' || workplaceStale) {
        return fulfillFailure(route, 503, 'Workplace reservation source is unavailable.');
      }
      return fulfillSuccess(route, workplace);
    }
    if (request.method() === 'POST' && path.endsWith('/wp-urgent-16/check-in')) {
      workplaceWrites += 1;
      workplaceBodies.push(request.postDataJSON());
      const confirmed: WorkplaceBooking = {
        ...workplace[0],
        status: 'CHECKED_IN',
        checkedInAt: NOW.toISOString(),
        canCheckIn: false,
        canRelease: true,
        version: workplace[0].version + 1,
      };
      workplace = [confirmed];
      return fulfillSuccess(route, confirmed);
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/rooms/bookings**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/platform/v1/rooms/bookings') {
      calendarReads += 1;
      if (calendarFailure === 'denied') {
        return fulfillFailure(route, 403, 'Calendar room reservations are outside this scope.');
      }
      if (calendarFailure === 'unavailable' || calendarStale) {
        return fulfillFailure(route, 503, 'Calendar room reservation source is unavailable.');
      }
      return fulfillSuccess(route, calendar);
    }
    if (request.method() === 'POST' && path.endsWith('/calendar-room-16/response')) {
      calendarWrites += 1;
      calendarBodies.push(request.postDataJSON());
      const response = request.postDataJSON() as { response: CalendarEvent['myResponse'] };
      const confirmed: CalendarEvent = {
        ...calendar[0],
        myResponse: response.response,
        responseRequired: false,
        version: calendar[0].version + 1,
      };
      calendar = [confirmed];
      return fulfillSuccess(route, confirmed);
    }
    return route.fallback();
  });

  await page.route('**/api/platform/v1/rooms/policy', (route) => fulfillSuccess(route, roomPolicy));

  return {
    calendarBodies,
    calendarReads: () => calendarReads,
    calendarWrites: () => calendarWrites,
    makeCalendarStale: () => {
      calendarStale = true;
    },
    makeWorkplaceStale: () => {
      workplaceStale = true;
    },
    workplaceBodies,
    workplaceReads: () => workplaceReads,
    workplaceWrites: () => workplaceWrites,
  };
}

async function expectSourceState(
  page: Page,
  source: 'calendar' | 'workplace',
  state: 'Current' | 'No access' | 'Stale' | 'Unavailable'
) {
  await expect(page.getByTestId(`workplace-reservations-source-${source}`)).toContainText(state, {
    timeout: 20_000,
  });
}

test('combines both authorities, preserves their command routes, and restores back and shared URL state', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const evidence = await mockUnifiedReservations(page);
  await page.goto(canonicalPath);

  const surface = page.locator('main');
  const nextAction = page.getByTestId('workplace-reservations-next-action');
  const workplaceCard = page.getByTestId('workplace-reservation-workplace-wp-urgent-16');
  const calendarCard = page.getByTestId('workplace-reservation-calendar-calendar-room-16');
  await expect(surface).toBeVisible();
  await expectSourceState(page, 'workplace', 'Current');
  await expectSourceState(page, 'calendar', 'Current');
  await expect(workplaceCard).toBeVisible();
  await expect(calendarCard).toBeVisible();

  for (const width of [1440, 1280, 390, 320]) {
    const height = width <= 390 ? 844 : 900;
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(nextAction).toBeVisible();
    await expect
      .poll(async () => (await nextAction.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(width * 0.7);
    const primaryAction = nextAction.getByRole('button', { name: 'Check in now', exact: true });
    await expect(primaryAction).toBeVisible();
    const actionBox = await primaryAction.boundingBox();
    expect((actionBox?.y ?? height) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({
      path: testInfo.outputPath(
        `workplace-unified-reservations-${testInfo.project.name}-${width}.png`
      ),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await nextAction.getByRole('button', { name: 'Check in now', exact: true }).click();
  await expect.poll(evidence.workplaceWrites).toBe(1);
  expect(evidence.workplaceBodies).toEqual([{ version: 7 }]);
  await expect(page.getByText('Check-in was saved.', { exact: true })).toBeVisible();

  await calendarCard.getByRole('button', { name: 'View detail', exact: true }).click();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/workplace/reservations' &&
      url.searchParams.get('reservation') === 'calendar-room-16' &&
      url.searchParams.get('reservationAuthority') === 'CALENDAR'
    );
  });
  const inspector = page.getByRole('complementary', { name: 'Reservation inspector' });
  await expect(inspector.getByRole('heading', { name: 'Design planning review' })).toBeVisible();
  await inspector.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect.poll(evidence.calendarWrites).toBe(1);
  expect(evidence.calendarBodies).toEqual([{ response: 'ACCEPTED' }]);
  await expect(page.getByText('The invitation was accepted.', { exact: true })).toBeVisible();

  const search = page.getByRole('textbox', { name: 'Search reservations', exact: true });
  await search.fill('Design planning');
  await expect(page).toHaveURL(/q=Design\+planning/u);
  const sharedUrl = page.url();
  await calendarCard.getByRole('link', { name: 'View on map', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/workplace/find');
  await page.goBack();
  await expect(page).toHaveURL(sharedUrl);
  await expect(search).toHaveValue('Design planning');
  await expect(inspector.getByRole('heading', { name: 'Design planning review' })).toBeVisible();

  await page.goto('/workplace');
  await page.goto(sharedUrl);
  await expect(search).toHaveValue('Design planning');
  await expect(inspector.getByRole('heading', { name: 'Design planning review' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
});

test('keeps Calendar reservations actionable when Workplace is unavailable', async ({ page }) => {
  test.setTimeout(60_000);
  const evidence = await mockUnifiedReservations(page, { workplaceFailure: 'unavailable' });
  await page.goto(canonicalPath);

  await expectSourceState(page, 'workplace', 'Unavailable');
  await expectSourceState(page, 'calendar', 'Current');
  await expect(page.getByText(/One reservation source is unavailable/u)).toBeVisible();
  await expect(page.getByTestId('workplace-reservation-workplace-wp-urgent-16')).toHaveCount(0);
  const calendarCard = page.getByTestId('workplace-reservation-calendar-calendar-room-16');
  await expect(calendarCard).toBeVisible();
  await calendarCard.getByRole('button', { name: 'View detail', exact: true }).click();
  await page
    .getByRole('complementary', { name: 'Reservation inspector' })
    .getByRole('button', { name: 'Accept', exact: true })
    .click();
  await expect.poll(evidence.calendarWrites).toBe(1);
  expect(evidence.workplaceWrites()).toBe(0);
});

test('keeps Workplace reservations actionable when Calendar access is denied', async ({ page }) => {
  const evidence = await mockUnifiedReservations(page, { calendarFailure: 'denied' });
  await page.goto(canonicalPath);

  await expectSourceState(page, 'calendar', 'No access');
  await expectSourceState(page, 'workplace', 'Current');
  await expect(page.getByText(/One reservation source is unavailable/u)).toBeVisible();
  await expect(page.getByTestId('workplace-reservation-calendar-calendar-room-16')).toHaveCount(0);
  await page
    .getByTestId('workplace-reservations-next-action')
    .getByRole('button', { name: 'Check in now', exact: true })
    .click();
  await expect.poll(evidence.workplaceWrites).toBe(1);
  expect(evidence.calendarWrites()).toBe(0);
});

test('retains stale Workplace data for reading, blocks its writes, and leaves Calendar commands live', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const evidence = await mockUnifiedReservations(page);
  await page.goto(canonicalPath);
  await expectSourceState(page, 'workplace', 'Current');
  evidence.makeWorkplaceStale();
  await page.clock.fastForward(60_100);
  await expect.poll(evidence.workplaceReads).toBeGreaterThanOrEqual(2);
  await expectSourceState(page, 'workplace', 'Stale');

  const workplaceCard = page.getByTestId('workplace-reservation-workplace-wp-urgent-16');
  await expect(workplaceCard).toContainText('Read only · stale');
  await expect(page.getByTestId('workplace-reservations-next-action')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check in now', exact: true })).toHaveCount(0);
  expect(evidence.workplaceWrites()).toBe(0);

  const calendarCard = page.getByTestId('workplace-reservation-calendar-calendar-room-16');
  await calendarCard.getByRole('button', { name: 'View detail', exact: true }).click();
  await page
    .getByRole('complementary', { name: 'Reservation inspector' })
    .getByRole('button', { name: 'Accept', exact: true })
    .click();
  await expect.poll(evidence.calendarWrites).toBe(1);
});

test('retains stale Calendar data for reading, blocks its writes, and leaves Workplace commands live', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const evidence = await mockUnifiedReservations(page);
  await page.goto(canonicalPath);
  await expectSourceState(page, 'calendar', 'Current');
  evidence.makeCalendarStale();
  await page.clock.fastForward(60_100);
  await expect.poll(evidence.calendarReads).toBeGreaterThanOrEqual(2);
  await expectSourceState(page, 'calendar', 'Stale');

  const calendarCard = page.getByTestId('workplace-reservation-calendar-calendar-room-16');
  await expect(calendarCard).toContainText('Read only · stale');
  await calendarCard.getByRole('button', { name: 'View detail', exact: true }).click();
  const inspector = page.getByRole('complementary', { name: 'Reservation inspector' });
  await expect(inspector).toContainText(
    'This source is stale. Refresh it before changing the reservation.'
  );
  await expect(inspector.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
  expect(evidence.calendarWrites()).toBe(0);

  await page
    .getByTestId('workplace-reservations-next-action')
    .getByRole('button', { name: 'Check in now', exact: true })
    .click();
  await expect.poll(evidence.workplaceWrites).toBe(1);
});

test('migrates both legacy reservation links without losing selection, filters, or hash', async ({
  page,
}) => {
  await mockUnifiedReservations(page);
  await page.goto(
    '/workplace/my-bookings?booking=wp-urgent-16&period=WEEK&q=Focus#workplace-detail'
  );
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/workplace/reservations' &&
      url.hash === '#workplace-detail' &&
      url.searchParams.get('types') === 'WORKSPACE' &&
      url.searchParams.get('authority') === 'WORKPLACE' &&
      url.searchParams.get('reservation') === 'wp-urgent-16' &&
      url.searchParams.get('reservationAuthority') === 'WORKPLACE' &&
      url.searchParams.get('period') === 'WEEK' &&
      url.searchParams.get('q') === 'Focus'
    );
  });
  await expect(page.getByTestId('workplace-reservation-workplace-wp-urgent-16')).toBeVisible();

  await page.goto(
    '/workplace/my-meetings?event=calendar-room-16&period=UPCOMING&q=Design#calendar-detail'
  );
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/workplace/reservations' &&
      url.hash === '#calendar-detail' &&
      url.searchParams.get('types') === 'MEETING' &&
      url.searchParams.get('authority') === 'CALENDAR' &&
      url.searchParams.get('reservation') === 'calendar-room-16' &&
      url.searchParams.get('reservationAuthority') === 'CALENDAR' &&
      url.searchParams.get('q') === 'Design'
    );
  });
  await expect(page.getByTestId('workplace-reservation-calendar-calendar-room-16')).toBeVisible();
});
