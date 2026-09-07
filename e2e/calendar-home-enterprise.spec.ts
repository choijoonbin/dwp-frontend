import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { CALENDAR_EVENT_FIXTURE, CALENDAR_HOME_FIXTURE } from './support/product-area-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test('calendar home requests and validates the user-selected regional timezone', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let requestedTimeZone: string | null = null;
  let returnMismatchedTimeZone = false;
  let createdEvent: Record<string, unknown> | null = null;
  await page.route('**/api/platform/v1/calendar/home**', async (route) => {
    const url = new URL(route.request().url());
    requestedTimeZone = url.searchParams.get('timeZone');
    const timeZone = requestedTimeZone ?? 'Asia/Seoul';
    const responseTimeZone = returnMismatchedTimeZone ? 'Asia/Seoul' : timeZone;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        data: {
          ...CALENDAR_HOME_FIXTURE,
          date: responseTimeZone === 'America/Los_Angeles' ? '2026-08-10' : '2026-08-11',
          timeZone: responseTimeZone,
        },
      }),
    });
  });
  await page.route('**/api/platform/v1/calendar/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    createdEvent = route.request().postDataJSON() as Record<string, unknown>;
    return route.fallback();
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.goto('/calendar/home');

  await expect(page.getByTestId('calendar-today-workspace')).toBeVisible();
  await page.evaluate(() => {
    const regional = {
      timeZone: 'America/Los_Angeles',
      dateFormat: 'locale',
      timeFormat: 'locale',
      firstDayOfWeek: 'locale',
      numberFormat: 'locale',
    };
    window.localStorage.setItem('dwp.regional.v2', JSON.stringify(regional));
    window.dispatchEvent(new CustomEvent('dwp:regional-preference-change', { detail: regional }));
  });
  await expect.poll(() => requestedTimeZone).toBe('America/Los_Angeles');
  await expect(page.getByTestId('calendar-read-state')).toHaveCount(0);
  await expect(page.locator('#dwp-main-content')).toContainText('Monday, August 10');

  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const composer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(composer.getByRole('group', { name: 'Start' }).locator('input')).toHaveValue(
    '08/10/2026 05:30 PM'
  );
  await composer.getByLabel('Title').fill('Los Angeles planning window');
  await composer.getByRole('button', { name: /People, place, and more options/u }).click();
  await expect(composer.getByLabel('Event time zone')).toHaveText('America/Los_Angeles');
  await composer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(composer).toHaveCount(0);
  await expect.poll(() => createdEvent).not.toBeNull();
  expect(createdEvent).toMatchObject({
    timeZone: 'America/Los_Angeles',
    startsAt: '2026-08-11T00:30:00.000Z',
    endsAt: '2026-08-11T01:00:00.000Z',
  });

  returnMismatchedTimeZone = true;
  await page.evaluate(() => {
    const regional = {
      timeZone: 'UTC',
      dateFormat: 'locale',
      timeFormat: 'locale',
      firstDayOfWeek: 'locale',
      numberFormat: 'locale',
    };
    window.localStorage.setItem('dwp.regional.v2', JSON.stringify(regional));
    window.dispatchEvent(new CustomEvent('dwp:regional-preference-change', { detail: regional }));
  });
  await expect.poll(() => requestedTimeZone).toBe('UTC');
  await expect(page.getByTestId('calendar-read-state')).toHaveAttribute(
    'data-calendar-read-state',
    'UNAVAILABLE'
  );
  await expect(page.getByTestId('calendar-today-workspace')).toHaveCount(0);
});

test('calendar labels a future-day next event with its date instead of a misleading countdown', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/platform/v1/calendar/home**', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          ...CALENDAR_HOME_FIXTURE,
          today: [],
          nextEvent: {
            ...CALENDAR_EVENT_FIXTURE,
            eventId: 'calendar-event-tomorrow',
            title: 'Tomorrow planning review',
            startsAt: '2026-08-12T01:00:00Z',
            endsAt: '2026-08-12T01:45:00Z',
          },
        },
      }),
    })
  );
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.goto('/calendar/home');

  const next = page.getByTestId('calendar-today-now');
  await expect(next).toContainText('Next scheduled event');
  await expect(next).toContainText('Wednesday, August 12');
  await expect(next).not.toContainText(/Starts in/iu);
  await expect(next.getByRole('button', { name: 'Join meeting' })).toHaveCount(0);
});

test('calendar exposes meeting join only inside the governed early-join window', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/platform/v1/calendar/home**', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          ...CALENDAR_HOME_FIXTURE,
          generatedAt: '2026-08-11T00:55:00Z',
        },
      }),
    })
  );
  await page.clock.setFixedTime(new Date('2026-08-11T00:55:00Z'));
  await page.goto('/calendar/home');

  const next = page.getByTestId('calendar-today-now');
  await expect(next).toContainText('Starts in 5 minutes');
  await expect(next.getByRole('button', { name: 'Join meeting' })).toBeVisible();
});

test('calendar keeps an active after-hours event in the execution flow', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const afterHoursEvent = {
    ...CALENDAR_EVENT_FIXTURE,
    eventId: 'calendar-event-after-hours',
    title: 'Regional launch bridge',
    startsAt: '2026-09-03T10:30:00Z',
    endsAt: '2026-09-03T11:30:00Z',
    recurrence: 'NONE' as const,
    restrictionReason: null,
  };
  await page.route('**/api/platform/v1/calendar/home**', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          ...CALENDAR_HOME_FIXTURE,
          date: '2026-09-03',
          generatedAt: '2026-09-03T11:00:00Z',
          nextEvent: afterHoursEvent,
          today: [afterHoursEvent],
        },
      }),
    })
  );
  await page.clock.setFixedTime(new Date('2026-09-03T11:00:00Z'));
  await page.goto('/calendar/home');

  await expect(page.getByText(/Move through your next event/u)).toBeVisible();
  await expect(page.getByText(/Review today's record/u)).toHaveCount(0);
  await expect(page.getByTestId('calendar-today-now')).toContainText('In progress');
  await expect(page.getByTestId('calendar-today-now')).toContainText('Regional launch bridge');
});

test('calendar prioritizes remaining work and collapses elapsed events', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/platform/v1/calendar/home**', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          ...CALENDAR_HOME_FIXTURE,
          generatedAt: '2026-08-11T02:00:00Z',
          nextEvent: CALENDAR_HOME_FIXTURE.today[1],
        },
      }),
    })
  );
  await page.clock.setFixedTime(new Date('2026-08-11T02:00:00Z'));
  await page.goto('/calendar/home');

  const past = page.getByTestId('calendar-today-past-events');
  await expect(past).toBeVisible();
  await expect(past).not.toHaveAttribute('open', '');
  await expect(past.locator('summary')).toHaveText('Show 1 earlier event');
  await expect(
    page.getByTestId('calendar-today-now').getByText('Protected focus time', { exact: true })
  ).toBeVisible();
});

test('calendar reveals elapsed-day history instead of leaving an empty canvas', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const earlyEvents = [
    {
      ...CALENDAR_EVENT_FIXTURE,
      eventId: 'calendar-event-early-brief',
      title: 'Morning inbox review',
      startsAt: '2026-08-10T22:00:00Z',
      endsAt: '2026-08-10T22:20:00Z',
      recurrence: 'NONE' as const,
      restrictionReason: null,
    },
    {
      ...CALENDAR_EVENT_FIXTURE,
      eventId: 'calendar-event-commute-plan',
      title: 'Commute planning check',
      startsAt: '2026-08-10T22:30:00Z',
      endsAt: '2026-08-10T22:50:00Z',
      recurrence: 'NONE' as const,
      restrictionReason: null,
    },
    {
      ...CALENDAR_EVENT_FIXTURE,
      eventId: 'calendar-event-daily-setup',
      title: 'Daily planning setup',
      startsAt: '2026-08-10T23:10:00Z',
      endsAt: '2026-08-10T23:30:00Z',
      recurrence: 'NONE' as const,
      restrictionReason: null,
    },
  ];
  await page.route('**/api/platform/v1/calendar/home**', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          ...CALENDAR_HOME_FIXTURE,
          generatedAt: '2026-08-11T09:30:00Z',
          today: [...earlyEvents, ...CALENDAR_HOME_FIXTURE.today],
          nextEvent: {
            ...CALENDAR_EVENT_FIXTURE,
            eventId: 'calendar-event-next-day',
            title: 'Tomorrow planning review',
            startsAt: '2026-08-12T01:00:00Z',
            endsAt: '2026-08-12T01:45:00Z',
          },
        },
      }),
    })
  );
  await page.clock.setFixedTime(new Date('2026-08-11T09:30:00Z'));
  await page.goto(
    '/calendar/home?scope=tenant%2Fmember&view=week&date=2026-08-11&calendars=calendar-personal'
  );

  const closeout = page.getByTestId('calendar-day-closeout');
  await expect(closeout).toBeVisible();
  await expect(closeout).toContainText('No events remain today');
  await expect(closeout).toContainText('Review 5 past events here');

  const past = page.getByTestId('calendar-today-past-events');
  await expect(past).toHaveAttribute('open', '');
  await expect(past.locator('summary')).toHaveText('5 past events');
  await expect(past.getByText('Morning inbox review', { exact: true })).toHaveCount(0);
  await expect(past.getByText('Daily planning setup', { exact: true })).toBeVisible();
  await expect(past.getByText('Digital workplace operating review', { exact: true })).toBeVisible();
  await expect(past.getByText('Protected focus time', { exact: true })).toBeVisible();
  const showMore = past.getByRole('button', { name: 'Show 2 more past events', exact: true });
  await expect(showMore).toHaveAttribute('aria-expanded', 'false');
  await showMore.click();
  await expect(past.getByText('Morning inbox review', { exact: true })).toBeVisible();
  await expect(past.getByText('Commute planning check', { exact: true })).toBeVisible();
  await expect(
    past.getByRole('button', { name: 'Show recent events only', exact: true })
  ).toHaveAttribute('aria-expanded', 'true');

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="calendar-today-workspace"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await closeout.getByRole('button', { name: 'Open Wednesday, August 12' }).click();
  await expect(page).toHaveURL(/\/calendar\/schedule/u);
  const destination = new URL(page.url());
  expect(destination.searchParams.getAll('scope')).toEqual(['tenant/member']);
  expect(destination.searchParams.get('view')).toBe('day');
  expect(destination.searchParams.get('date')).toBe('2026-08-12');
  expect(destination.searchParams.get('calendars')).toBe('calendar-personal');
});

test('calendar treats an expired successful snapshot as read-only stale data', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:25:00Z'));
  await page.goto('/calendar/home');

  await expect(page.getByTestId('calendar-read-state')).toHaveAttribute(
    'data-calendar-read-state',
    'STALE'
  );
  await expect(page.getByTestId('calendar-today-workspace')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Protect for focus' })).toHaveCount(0);
});

test('calendar advances its live countdown, refreshes automatically, and expires an old response', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let homeRequests = 0;
  await page.route('**/api/platform/v1/calendar/home**', async (route) => {
    homeRequests += 1;
    return route.fallback();
  });
  await page.clock.install({ time: new Date('2026-08-11T00:20:00Z') });
  await page.goto('/calendar/home');

  const now = page.getByTestId('calendar-today-now');
  await expect(now).toContainText('Starts in 40 minutes');
  await page.clock.fastForward(61_000);
  await expect(now).toContainText('Starts in 39 minutes');
  expect(homeRequests).toBeGreaterThanOrEqual(2);
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId('calendar-read-state')).toHaveAttribute(
    'data-calendar-read-state',
    'STALE'
  );
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
});

test('calendar isolates work-hour policy failure without inventing a final open window', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/platform/v1/calendar/policy', async (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', errorCode: 'SERVICE_UNAVAILABLE' }),
    })
  );
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.goto('/calendar/home');

  await expect(page.getByTestId('calendar-today-workspace')).toBeVisible();
  await expect(page.getByTestId('calendar-read-state')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toBeVisible();
  await expect(page.getByTestId('calendar-today-open-window')).toHaveCount(2);
  await expect(page.getByTestId('calendar-today-open-window').last()).not.toContainText(
    'within your working hours'
  );
});

test('calendar withdraws cached work-hour guidance after policy refetch failures', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let policyMode: 'ready' | 'transient' | 'denied' = 'ready';
  let transientRequests = 0;
  let deniedRequests = 0;
  await page.route('**/api/platform/v1/calendar/policy', async (route) => {
    if (policyMode === 'ready') return route.fallback();
    if (policyMode === 'transient') transientRequests += 1;
    else deniedRequests += 1;
    return route.fulfill({
      status: policyMode === 'transient' ? 503 : 403,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ERROR',
        errorCode: policyMode === 'transient' ? 'SERVICE_UNAVAILABLE' : 'ROUTE_CAPABILITY_REQUIRED',
      }),
    });
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.goto('/calendar/home');

  const openWindows = page.getByTestId('calendar-today-open-window');
  await expect(openWindows).toHaveCount(3);
  await expect(openWindows.last()).toContainText('within your working hours');

  const createEvent = async (title: string) => {
    await page.getByRole('button', { name: 'New event', exact: true }).click();
    const composer = page.getByRole('dialog', { name: 'Create a new event' });
    await composer.getByLabel('Title').fill(title);
    await composer.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(composer).toHaveCount(0);
  };

  policyMode = 'transient';
  await createEvent('Policy refresh isolation one');
  await expect.poll(() => transientRequests).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('calendar-today-workspace')).toBeVisible();
  await expect(page.getByTestId('calendar-read-state')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toBeVisible();
  await expect(openWindows).toHaveCount(2);
  await expect(page.getByText('within your working hours', { exact: false })).toHaveCount(0);

  policyMode = 'denied';
  await createEvent('Policy refresh isolation two');
  await expect.poll(() => deniedRequests).toBe(1);
  await expect(page.getByTestId('calendar-today-workspace')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toBeVisible();
  await expect(openWindows).toHaveCount(2);
  await expect(page.getByText('within your working hours', { exact: false })).toHaveCount(0);
});

test('calendar keeps its today flow and actions reachable at 320px and 200% text', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/calendar/home');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

  const todayWorkspace = page.getByTestId('calendar-today-workspace');
  await expect(todayWorkspace).toBeVisible();
  await expect(page.getByTestId('interactive-calendar')).toHaveCount(0);
  await expect(page.getByTestId('calendar-today-open-window').first()).toBeVisible();
  const criticalActions = [
    page.getByRole('button', { name: 'Open schedule', exact: true }).first(),
    page.getByRole('button', { name: 'Open today briefing', exact: true }),
    page.getByRole('button', { name: 'Quick actions', exact: true }),
    page.getByRole('button', { name: 'New event', exact: true }),
  ];
  for (const action of criticalActions) {
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  const workspaceBounds = await todayWorkspace.boundingBox();
  expect(workspaceBounds).not.toBeNull();
  expect(workspaceBounds!.x).toBeGreaterThanOrEqual(0);
  expect(workspaceBounds!.x + workspaceBounds!.width).toBeLessThanOrEqual(320);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  await page.getByRole('button', { name: 'Open today briefing', exact: true }).click();
  const rail = page.getByRole('dialog', { name: 'Needs attention' });
  await expect(rail).toBeVisible();
  const railBounds = await rail.boundingBox();
  expect(railBounds).not.toBeNull();
  await expect
    .poll(async () => {
      const current = await rail.boundingBox();
      return current ? Math.round(current.x + current.width) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
