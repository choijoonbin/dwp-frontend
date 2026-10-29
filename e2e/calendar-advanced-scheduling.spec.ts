import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { mockCalendarShellSession as mockShellSession } from './support/calendar-shell-session';
import { CALENDAR_EVENT_FIXTURE } from './support/product-area-fixtures';
import { FULL_PRODUCT_PERMISSIONS } from './support/shell-session';

import type { Page, Route } from '@playwright/test';
import type {
  CalendarSchedulingPollDetails,
  CreateCalendarSchedulingPollInput,
} from '@dwp-frontend/shared-utils/api/calendar-scheduling-poll-api';

const PERSON_ID = '70ba0853-02a8-7499-b6d8-009251e6a46b';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

function observeCriticalFailures(page: Page) {
  const runtimeErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  return () => {
    expect(runtimeErrors, 'Calendar emitted a page or console error').toEqual([]);
    expect(serverErrors, 'Calendar received an HTTP 5xx response').toEqual([]);
  };
}

async function expectNoSeriousAccessibilityViolations(page: Page, include: string) {
  const accessibility = await new AxeBuilder({ page }).include(include).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

test('server event search opens the selected event inspector', async ({ page }) => {
  const assertNoCriticalFailures = observeCriticalFailures(page);
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    personPublicId: PERSON_ID,
  });

  const searchRequests: URL[] = [];
  await page.route('**/api/platform/v2/calendar/events/search?*', (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    const url = new URL(request.url());
    searchRequests.push(url);
    return fulfillSuccess(route, {
      items: [CALENDAR_EVENT_FIXTURE],
      nextCursor: null,
      hasMore: false,
      normalizedQuery: url.searchParams.get('q'),
      range: {
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
        timeZone: url.searchParams.get('timeZone'),
      },
      generatedAt: '2026-08-11T00:20:00Z',
    });
  });

  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.goto('/calendar/schedule?view=week&date=2026-08-11');
  await expect(page.getByTestId('interactive-calendar')).toBeVisible();

  await page.getByRole('button', { name: 'Search events', exact: true }).click();
  const searchDialog = page.getByRole('dialog', { name: 'Search events' });
  await searchDialog.getByLabel('Search terms').fill('operating');
  await searchDialog.getByRole('button', { name: 'Search', exact: true }).click();

  const searchResult = searchDialog.getByRole('button', {
    name: /Digital workplace operating review.*My calendar/u,
  });
  await expect(searchResult).toBeVisible();
  expect(searchRequests).toHaveLength(1);
  expect(Object.fromEntries(searchRequests[0]!.searchParams)).toMatchObject({
    q: 'operating',
    timeZone: 'Asia/Seoul',
    limit: '50',
  });
  expect(searchRequests[0]!.searchParams.get('from')).toBeTruthy();
  expect(searchRequests[0]!.searchParams.get('to')).toBeTruthy();

  await searchResult.click();
  await expect(searchDialog).toBeHidden();
  const inspector = page.getByRole('dialog', {
    name: 'Digital workplace operating review',
  });
  await expect(inspector).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page, '[role="dialog"]');
  assertNoCriticalFailures();
});

test('authenticated booking completes hold to confirm without persisting its raw token', async ({
  page,
}) => {
  const assertNoCriticalFailures = observeCriticalFailures(page);
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    personPublicId: PERSON_ID,
  });

  const pageId = '00ba0853-02a8-7499-b6d8-009251e6a464';
  const holdId = '10ba0853-02a8-7499-b6d8-009251e6a465';
  const appointmentId = '20ba0853-02a8-7499-b6d8-009251e6a466';
  const rawToken = 'raw-management-token-once';
  const slot = {
    startsAt: '2026-11-02T01:00:00Z',
    endsAt: '2026-11-02T01:30:00Z',
  };
  const bookingPage = {
    pageId,
    ownerType: 'PERSONAL',
    ownerPersonPublicId: null,
    ownerGroupRef: null,
    calendarId: '40ba0853-02a8-7499-b6d8-009251e6a468',
    state: 'PUBLISHED',
    title: 'Design review',
    description: 'Discuss the product',
    timeZone: 'Asia/Seoul',
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    dailyLimit: 8,
    minimumNoticeMinutes: 60,
    maximumAdvanceDays: 30,
    meetingMode: 'IN_PERSON',
    location: 'Room 4',
    conferenceUrl: null,
    dialInInstructions: null,
    availabilityRules: [],
    questions: [],
    publicLinkConfigured: false,
    publicTokenVersion: 0,
    version: 4,
    updatedAt: '2026-11-01T00:00:00Z',
  };
  const bookablePage = {
    pageId,
    pageVersion: 4,
    title: bookingPage.title,
    description: bookingPage.description,
    timeZone: bookingPage.timeZone,
    durationMinutes: bookingPage.durationMinutes,
    meetingMode: bookingPage.meetingMode,
    location: bookingPage.location,
    conferenceUrl: null,
    dialInInstructions: null,
    questions: [],
  };
  const hold = {
    holdId,
    pageId,
    bookerPersonPublicId: PERSON_ID,
    state: 'HELD',
    ...slot,
    expiresAt: '2026-11-01T00:05:00Z',
    fencingToken: 8,
    version: 1,
  };
  const appointment = {
    appointmentId,
    pageId,
    eventId: '60ba0853-02a8-7499-b6d8-009251e6a46a',
    bookerPersonPublicId: PERSON_ID,
    state: 'CONFIRMED',
    ...slot,
    supersedesAppointmentId: null,
    version: 3,
    updatedAt: '2026-11-01T00:00:00Z',
  };
  const holdBodies: Record<string, unknown>[] = [];
  const confirmationBodies: Record<string, unknown>[] = [];
  let confirmed = false;

  await page.route(/\/api\/platform\/v1\/calendar\/booking(?:\/|$)/u, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const base = '/api/platform/v1/calendar/booking';

    if (method === 'GET' && path === `${base}/capabilities`) {
      return fulfillSuccess(route, {
        authenticatedBookingEnabled: true,
        externalPublicBookingEnabled: false,
        externalPublicBookingReason: 'disabled',
        holdTtlSeconds: 300,
      });
    }
    if (method === 'GET' && path === `${base}/pages`) {
      return fulfillSuccess(route, [bookingPage]);
    }
    if (method === 'GET' && path === `${base}/appointments`) {
      return fulfillSuccess(route, confirmed ? [appointment] : []);
    }
    if (method === 'GET' && path === `${base}/pages/${pageId}`) {
      return fulfillSuccess(route, bookingPage);
    }
    if (method === 'GET' && path === `${base}/pages/${pageId}/bookable`) {
      return fulfillSuccess(route, bookablePage);
    }
    if (method === 'GET' && path === `${base}/pages/${pageId}/availability`) {
      return fulfillSuccess(route, {
        pageId,
        pageVersion: 4,
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
        slots: [slot],
        generatedAt: '2026-11-01T00:00:00Z',
      });
    }
    if (method === 'POST' && path === `${base}/pages/${pageId}/holds`) {
      holdBodies.push(request.postDataJSON() as Record<string, unknown>);
      return fulfillSuccess(route, hold);
    }
    if (method === 'POST' && path === `${base}/pages/${pageId}/appointments`) {
      confirmationBodies.push(request.postDataJSON() as Record<string, unknown>);
      confirmed = true;
      return fulfillSuccess(route, { appointment, managementToken: rawToken });
    }
    if (method === 'GET' && path === `${base}/appointments/${appointmentId}`) {
      return fulfillSuccess(route, appointment);
    }
    return route.fallback();
  });

  await page.clock.setFixedTime(new Date('2026-11-01T00:00:00Z'));
  await page.goto('/calendar/bookings');
  await expect(page.getByRole('heading', { name: 'Appointments', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose Design review' }).click();
  await page
    .getByRole('radiogroup', { name: 'Available times' })
    .getByRole('radio')
    .first()
    .check();
  await page.getByRole('button', { name: 'Hold this time' }).click();
  await expect.poll(() => holdBodies.length).toBe(1);
  expect(holdBodies[0]).toMatchObject({ ...slot, pageVersion: 4 });
  expect(holdBodies[0]?.idempotencyKey).toEqual(expect.stringMatching(UUID));

  await page.getByRole('button', { name: 'Confirm appointment' }).click();
  await expect(page.getByRole('heading', { name: 'One-time access token' })).toBeVisible();
  await expect(page.getByText(rawToken, { exact: true })).toBeVisible();
  await expect.poll(() => confirmationBodies.length).toBe(1);
  expect(confirmationBodies[0]).toMatchObject({ holdId, fencingToken: 8, answers: [] });
  expect(confirmationBodies[0]?.idempotencyKey).toEqual(expect.stringMatching(UUID));

  const persisted = await page.evaluate(() => ({
    url: window.location.href,
    local: Object.entries(window.localStorage),
    session: Object.entries(window.sessionStorage),
  }));
  expect(persisted.url).not.toContain(rawToken);
  expect(JSON.stringify(persisted.local)).not.toContain(rawToken);
  expect(JSON.stringify(persisted.session)).not.toContain(rawToken);

  await expectNoSeriousAccessibilityViolations(page, '#dwp-main-content');
  assertNoCriticalFailures();
});

test('scheduling polls render list and detail, then create and open a poll', async ({ page }) => {
  const assertNoCriticalFailures = observeCriticalFailures(page);
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    personPublicId: PERSON_ID,
  });

  const pollBase = '/api/platform/v1/calendar/scheduling-polls';
  const existingPollId = '31ba0853-02a8-7499-b6d8-009251e6a467';
  const createdPollId = '32ba0853-02a8-7499-b6d8-009251e6a468';
  const participantId = '51ba0853-02a8-7499-b6d8-009251e6a469';
  const existingCandidateId = '41ba0853-02a8-7499-b6d8-009251e6a468';
  const details = (
    pollId: string,
    title: string,
    state: CalendarSchedulingPollDetails['poll']['state'],
    candidateId: string,
    version: number,
    description: string | null = null,
    startsAt = '2026-10-29T01:00:00.000Z',
    endsAt = '2026-10-29T01:30:00.000Z',
    expiresAt = '2026-10-29T00:00:00.000Z'
  ): CalendarSchedulingPollDetails => ({
    poll: {
      pollId,
      organizerPersonPublicId: PERSON_ID,
      state,
      title,
      description,
      timeZone: 'Asia/Seoul',
      candidates: [
        {
          candidateId,
          startsAt,
          endsAt,
          resourceId: null,
          yesCount: 0,
          ifNeededCount: 0,
          noCount: 0,
          agreementEligible: false,
        },
      ],
      participants: [
        {
          participantId,
          personPublicId: PERSON_ID,
          externalEmail: null,
          displayName: 'Tenant Admin',
          required: true,
          externalVotingEnabled: false,
        },
      ],
      myVotes: [],
      expiresAt,
      confirmedEventId: null,
      confirmedCandidateId: null,
      version,
      updatedAt: '2026-10-28T00:00:00.000Z',
    },
    availability: [
      {
        candidateId,
        availabilityState: 'AVAILABLE',
        safeReasonCode: null,
        roomHoldActive: false,
      },
    ],
    holds: [],
  });
  const existingDetails = details(
    existingPollId,
    'Existing team sync',
    'DRAFT',
    existingCandidateId,
    0
  );
  let createdDetails: CalendarSchedulingPollDetails | null = null;
  const createBodies: CreateCalendarSchedulingPollInput[] = [];
  const openBodies: Record<string, unknown>[] = [];

  await page.route(/\/api\/platform\/v1\/calendar\/scheduling-polls(?:\/|\?|$)/u, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'GET' && path === pollBase) {
      return fulfillSuccess(route, {
        items: createdDetails ? [createdDetails, existingDetails] : [existingDetails],
        nextUpdatedAt: null,
        nextPollId: null,
        hasMore: false,
      });
    }
    if (method === 'GET' && path === `${pollBase}/${existingPollId}`) {
      return fulfillSuccess(route, existingDetails);
    }
    if (method === 'GET' && path === `${pollBase}/${createdPollId}` && createdDetails) {
      return fulfillSuccess(route, createdDetails);
    }
    if (method === 'POST' && path === pollBase) {
      const body = request.postDataJSON() as CreateCalendarSchedulingPollInput;
      createBodies.push(body);
      const candidate = body.candidates[0]!;
      createdDetails = details(
        createdPollId,
        body.title,
        'DRAFT',
        candidate.candidateId,
        0,
        body.description,
        candidate.startsAt,
        candidate.endsAt,
        body.expiresAt
      );
      return fulfillSuccess(route, createdDetails);
    }
    if (method === 'POST' && path === `${pollBase}/${createdPollId}/open` && createdDetails) {
      openBodies.push(request.postDataJSON() as Record<string, unknown>);
      createdDetails = {
        ...createdDetails,
        poll: {
          ...createdDetails.poll,
          state: 'OPEN',
          version: createdDetails.poll.version + 1,
          updatedAt: '2026-10-28T00:01:00.000Z',
        },
      };
      return fulfillSuccess(route, createdDetails);
    }
    return route.fallback();
  });

  await page.clock.setFixedTime(new Date('2026-10-28T00:00:00Z'));
  await page.goto('/calendar/polls');
  await expect(page.getByRole('heading', { name: 'Scheduling polls' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Existing team sync/u })).toBeVisible();
  await expect(
    page.getByTestId('calendar-scheduling-poll-organizer').getByRole('heading', {
      name: 'Existing team sync',
    })
  ).toBeVisible();

  await page
    .getByRole('region', { name: 'Create a scheduling poll' })
    .getByRole('button', { name: 'Create poll', exact: true })
    .click();
  const creator = page.getByTestId('calendar-scheduling-poll-creator');
  await creator.getByLabel('Poll title').fill('Release planning');
  await creator.getByRole('button', { name: 'Create poll', exact: true }).click();

  await expect.poll(() => createBodies.length).toBe(1);
  expect(createBodies[0]).toMatchObject({
    title: 'Release planning',
    timeZone: 'Asia/Seoul',
  });
  expect(createBodies[0]?.idempotencyKey).toEqual(expect.stringMatching(UUID));
  expect(createBodies[0]?.candidates).toHaveLength(1);
  expect(createBodies[0]?.candidates[0]?.candidateId).toEqual(expect.stringMatching(UUID));
  expect(createBodies[0]?.participants).toEqual([
    expect.objectContaining({ personPublicId: PERSON_ID, required: true, externalEmail: null }),
  ]);

  const organizer = page.getByTestId('calendar-scheduling-poll-organizer');
  await expect(organizer.getByRole('heading', { name: 'Release planning' })).toBeVisible();
  await organizer.getByRole('button', { name: 'Open voting', exact: true }).click();
  await expect.poll(() => openBodies.length).toBe(1);
  expect(openBodies[0]).toEqual({ state: 'OPEN', version: 0 });
  await expect(organizer.getByRole('status')).toHaveText('Open');

  await expectNoSeriousAccessibilityViolations(page, '#dwp-main-content');
  assertNoCriticalFailures();
});
