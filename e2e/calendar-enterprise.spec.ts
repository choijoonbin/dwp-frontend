import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test('calendar supports governed range creation and drag rescheduling', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let releaseMove = () => {};
  const moveGate = new Promise<void>((resolve) => {
    releaseMove = resolve;
  });
  await page.route('**/api/platform/v1/calendar/events/calendar-event-focus', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    await moveGate;
    return route.fallback();
  });
  await page.clock.setFixedTime(new Date('2026-08-18T01:00:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/calendar/schedule');

  const calendar = page.getByTestId('interactive-calendar');
  await expect(calendar).toBeVisible();
  await calendar.getByRole('button', { name: 'Previous Week' }).click();

  const movableEvent = calendar.getByRole('button', {
    name: /Protected focus time.*Time can be changed/u,
  });
  await expect(movableEvent).toBeVisible();
  await movableEvent.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(100);
  let eventBox = await movableEvent.boundingBox();
  const viewportHeight = page.viewportSize()!.height;
  if (!eventBox || eventBox.y + eventBox.height / 2 + 90 >= viewportHeight - 4) {
    await movableEvent.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = Math.max(
          0,
          document.scrollingElement.scrollTop + rect.top - window.innerHeight / 2
        );
      }
    });
  }
  await expect
    .poll(async () => (await movableEvent.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(viewportHeight - 94);
  eventBox = await movableEvent.boundingBox();
  expect(eventBox).not.toBeNull();
  const dropY = eventBox!.y + eventBox!.height / 2 + 90;
  expect(dropY).toBeLessThan(page.viewportSize()!.height - 4);

  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().includes('/api/platform/v1/calendar/events/calendar-event-focus')
  );
  await page.mouse.move(eventBox!.x + eventBox!.width / 2, eventBox!.y + eventBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(eventBox!.x + eventBox!.width / 2, dropY, { steps: 12 });
  await page.mouse.up();

  const request = await updateRequest;
  const payload = request.postDataJSON() as { startsAt: string; endsAt: string; version: number };
  expect(Date.parse(payload.endsAt)).toBeGreaterThan(Date.parse(payload.startsAt));
  expect(payload.version).toBe(CALENDAR_FOCUS_VERSION);
  await expect(calendar).toHaveAttribute('data-calendar-interaction-locked', 'true');
  releaseMove();
  await expect(calendar).toHaveAttribute('data-calendar-interaction-locked', 'false');

  const lockedRecurringEvent = calendar.getByRole('button', {
    name: /Digital workplace operating review.*Read only/u,
  });
  await expect(lockedRecurringEvent).toBeVisible();
  await lockedRecurringEvent.focus();
  await expect(lockedRecurringEvent).toBeFocused();
  await lockedRecurringEvent.press('Enter');
  const lockedEventDialog = page.getByRole('dialog', {
    name: 'Digital workplace operating review',
  });
  await expect(lockedEventDialog).toBeVisible();
  await lockedEventDialog.getByRole('button', { name: 'Close', exact: true }).click();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="interactive-calendar"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar isolates transient briefing failures but purges every surface on authority denial', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'chromium');
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let mode: 'live' | 'transient' | 'denied' = 'live';
  let transientRequests = 0;
  let deniedRequests = 0;
  await page.route('**/api/platform/v1/calendar/home**', async (route) => {
    if (route.request().method() !== 'GET' || mode === 'live') return route.fallback();
    if (mode === 'denied') deniedRequests += 1;
    else transientRequests += 1;
    return route.fulfill({
      status: mode === 'denied' ? 403 : 503,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ERROR',
        errorCode: mode === 'denied' ? 'ROUTE_CAPABILITY_REQUIRED' : 'SERVICE_UNAVAILABLE',
      }),
    });
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/calendar/home');
  await expect(page.getByRole('heading', { level: 1, name: 'Your day' })).toBeVisible();
  const todayWorkspace = page.getByTestId('calendar-today-workspace');
  await expect(todayWorkspace).toBeVisible();
  await expect(page.getByTestId('interactive-calendar')).toHaveCount(0);
  const operatingReview = todayWorkspace.getByRole('button', {
    name: /Digital workplace operating review/u,
  });
  await operatingReview.focus();
  await operatingReview.press('Enter');
  const staleEvent = page.getByRole('dialog', { name: 'Digital workplace operating review' });
  await expect(staleEvent).toBeVisible();

  mode = 'transient';
  await staleEvent.getByRole('button', { name: 'Tentative', exact: true }).click();

  await expect.poll(() => transientRequests).toBe(2);
  await expect(page.getByTestId('calendar-read-state')).toHaveAttribute(
    'data-calendar-read-state',
    'STALE'
  );
  await expect(todayWorkspace).toBeVisible();
  await expect(staleEvent).toBeVisible();

  await staleEvent.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(staleEvent).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  const briefingRail = page.getByTestId('calendar-workspace-rail');
  await expect(briefingRail).toHaveAttribute('data-calendar-rail-state', 'STALE');
  await expect(briefingRail).toContainText(/Current week.*all visible calendars/iu);
  mode = 'denied';
  await page.getByTestId('calendar-read-state').getByRole('button', { name: 'Try again' }).click();
  const readState = page.getByTestId('calendar-read-state');
  await expect(readState).toHaveAttribute('data-calendar-read-state', 'DENIED');
  await expect(readState).toContainText(/Previously loaded calendar data was cleared/iu);
  await expect(page.getByTestId('calendar-today-workspace')).toHaveCount(0);
  await expect(page.getByTestId('calendar-workspace-rail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  await expect(staleEvent).toHaveCount(0);
  expect(deniedRequests).toBeGreaterThanOrEqual(1);

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar quick actions preserve opaque scope and schedule context', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  const createAttempts: Record<string, unknown>[] = [];
  await page.route('**/api/platform/v1/calendar/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    createAttempts.push(route.request().postDataJSON() as Record<string, unknown>);
    if (createAttempts.length === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', errorCode: 'SERVICE_UNAVAILABLE' }),
      });
    }
    return route.fallback();
  });
  await page.goto(
    '/calendar/home?scope=tenant%2Fmember&view=week&date=2026-08-11&calendars=calendar-personal'
  );

  await expect(
    page
      .getByRole('button', { name: 'Quick actions', exact: true })
      .and(page.locator('[aria-expanded]'))
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Your day' })).toBeVisible();
  await expect(page.getByTestId('calendar-today-workspace')).toBeVisible();
  await expect(page.getByTestId('calendar-today-workspace')).toContainText(
    '2 events · 45m meetings · 1h 30m focus'
  );
  const weekOutlook = page.getByTestId('calendar-today-week-outlook');
  await expect(weekOutlook).toBeVisible();
  await expect(weekOutlook.getByRole('heading', { level: 2, name: 'Weekly rhythm' })).toBeVisible();
  await expect(
    page.getByTestId('calendar-workspace-rail').getByRole('heading', { name: 'Weekly rhythm' })
  ).toHaveCount(0);
  await expect(page.getByTestId('calendar-today-open-window')).toHaveCount(3);
  await expect(page.getByTestId('calendar-today-open-window').last()).toContainText(
    'within your working hours'
  );
  await expect(page.getByTestId('interactive-calendar')).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', code: 'Slash', ctrlKey: true, bubbles: true })
    );
  });
  const commands = page.getByRole('dialog', { name: 'Calendar quick actions' });
  await expect(commands).toBeVisible();
  await expect(commands.getByRole('option', { name: 'Create a new event' })).toBeVisible();
  await expect(commands.getByRole('option', { name: 'Create focus time' })).toBeVisible();
  await expect(commands.getByRole('option', { name: 'Create a task time block' })).toBeVisible();
  await expect(commands.getByRole('option', { name: 'Create a time-away block' })).toBeVisible();
  await commands.getByRole('option', { name: 'Create a task time block' }).click();
  const taskComposer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(taskComposer).toBeVisible();
  await expect(taskComposer.getByRole('button', { name: 'Task', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(taskComposer.getByLabel('Room or resource')).toHaveCount(0);
  await expect(taskComposer.getByTestId('calendar-scheduling-assistant')).toHaveCount(0);
  await taskComposer.getByLabel('Title').fill('Prepare launch checklist');
  await taskComposer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect.poll(() => createAttempts.length).toBe(1);
  const retryCreate = taskComposer.getByRole('button', { name: 'Create', exact: true });
  await retryCreate.focus();
  await retryCreate.press('Enter');
  await expect(taskComposer).toHaveCount(0);
  expect(createAttempts).toHaveLength(2);
  expect(createAttempts[0]).toMatchObject({
    type: 'TASK',
    resourceId: null,
    location: null,
    conferenceUrl: null,
    responseRequired: false,
    attendees: [],
  });
  expect(createAttempts[0]?.idempotencyKey).toBeTruthy();
  expect(createAttempts[1]?.idempotencyKey).toBe(createAttempts[0]?.idempotencyKey);

  await page
    .getByRole('button', { name: 'Quick actions', exact: true })
    .and(page.locator('[aria-expanded]'))
    .click();
  await commands.getByRole('option', { name: 'Create a time-away block' }).click();
  const awayComposer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(
    awayComposer.getByRole('button', { name: 'Out of office', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(awayComposer.getByLabel('Required attendees')).toHaveCount(0);
  await expect(awayComposer.getByLabel('Room or resource')).toHaveCount(0);
  await awayComposer.getByLabel('Title').fill('Customer visit travel');
  await awayComposer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(awayComposer).toHaveCount(0);

  await page
    .getByRole('button', { name: 'Quick actions', exact: true })
    .and(page.locator('[aria-expanded]'))
    .click();
  await commands.getByRole('option', { name: 'Create focus time' }).click();
  const focusComposer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(focusComposer.getByRole('button', { name: 'Focus', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(focusComposer.getByLabel('Required attendees')).toHaveCount(0);
  await expect(focusComposer.getByLabel('Room or resource')).toHaveCount(0);
  await focusComposer.getByLabel('Title').fill('Write launch narrative');
  await focusComposer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(focusComposer).toHaveCount(0);

  await page
    .getByRole('button', { name: 'Quick actions', exact: true })
    .and(page.locator('[aria-expanded]'))
    .click();
  await commands.getByRole('option', { name: 'Create a new event' }).click();
  const meetingComposer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(
    meetingComposer.getByRole('button', { name: 'Meeting', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await meetingComposer.getByLabel('Title').fill('Launch readiness review');
  await meetingComposer.getByRole('button', { name: /People, place, and more options/u }).click();
  await expect(meetingComposer.getByLabel('Required attendees')).toBeVisible();
  await meetingComposer.getByLabel('Location').fill('Seoul HQ');
  await meetingComposer.getByLabel('Video meeting link').fill('https://meet.example/launch');
  await expect(meetingComposer.getByLabel('Request attendance responses')).toBeChecked();
  await meetingComposer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(meetingComposer).toHaveCount(0);

  expect(createAttempts).toHaveLength(5);
  expect(createAttempts[2]).toMatchObject({
    type: 'OUT_OF_OFFICE',
    resourceId: null,
    location: null,
    conferenceUrl: null,
    responseRequired: false,
    attendees: [],
  });
  expect(createAttempts[3]).toMatchObject({
    type: 'FOCUS',
    resourceId: null,
    location: null,
    conferenceUrl: null,
    responseRequired: false,
    attendees: [],
  });
  expect(createAttempts[4]).toMatchObject({
    type: 'MEETING',
    location: 'Seoul HQ',
    conferenceUrl: 'https://meet.example/launch',
    responseRequired: true,
    attendees: [],
  });
  expect(new Set(createAttempts.slice(1).map((attempt) => attempt.idempotencyKey)).size).toBe(4);

  await page
    .getByRole('button', { name: 'Quick actions', exact: true })
    .and(page.locator('[aria-expanded]'))
    .click();
  await commands.getByLabel('Create an event or find a calendar action').fill('Open full schedule');
  await commands.getByLabel('Create an event or find a calendar action').press('Enter');

  await expect(page).toHaveURL(/\/calendar\/schedule/u);
  const destination = new URL(page.url());
  expect(destination.searchParams.get('scope')).toBe('tenant/member');
  expect(destination.searchParams.get('view')).toBe('week');
  expect(destination.searchParams.get('date')).toBe('2026-08-11');
  expect(destination.searchParams.get('calendars')).toBe('calendar-personal');
  await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();
  await expect(page.getByTestId('interactive-calendar')).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar coordinates attendee time, room choice, and durable schedule state in one flow', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/calendar/schedule?view=month&date=2026-08-11&calendars=calendar-personal');

  const calendar = page.getByTestId('interactive-calendar');
  await expect(calendar).toBeVisible();
  await expect(page).toHaveURL(/view=month/u);
  await calendar.getByRole('tab', { name: 'Week view', exact: true }).click();
  await expect(page).toHaveURL(/view=week/u);
  await expect(page).toHaveURL(/date=2026-08-11/u);
  expect(new URL(page.url()).searchParams.get('calendars')?.split(',')).toEqual([
    'calendar-company',
    'calendar-personal',
  ]);
  await page.goBack();
  await expect(page).toHaveURL(/view=month/u);
  await expect(page.getByTestId('calendar-schedule-surface')).toHaveAttribute(
    'data-location-search',
    /view=month/u
  );
  await expect(calendar).toHaveAttribute('data-controlled-view', 'month');
  await expect(calendar.getByRole('tab', { name: 'Month view', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.goForward();
  await expect(page).toHaveURL(/view=week/u);

  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a new event' });
  const assistant = dialog.getByTestId('calendar-scheduling-assistant');
  await expect(assistant).toBeVisible();
  await expect(assistant.getByText('Free/busy: 1 person')).toBeVisible();

  const availabilityRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().includes('/api/platform/v1/calendar/scheduling/evaluations')
  );
  await assistant.getByRole('button', { name: 'Check availability', exact: true }).click();
  const request = await availabilityRequest;
  const requestUrl = new URL(request.url());
  const evaluationInput = request.postDataJSON() as {
    durationMinutes: number;
    timeZone: string;
    personIds: string[];
  };
  expect(requestUrl.search).toBe('');
  expect(evaluationInput.durationMinutes).toBe(30);
  expect(evaluationInput.timeZone).toBeTruthy();
  expect(evaluationInput.personIds).toEqual([]);
  await expect(
    assistant.getByText('All checked required attendees are available within working hours.')
  ).toBeVisible();

  const refreshedEvaluation = page.waitForRequest(
    (candidate) =>
      candidate.method() === 'POST' &&
      candidate.url().includes('/api/platform/v1/calendar/scheduling/evaluations')
  );
  await assistant
    .getByRole('button')
    .filter({ hasText: 'All checked required attendees are available within working hours.' })
    .click();
  const refreshedRequest = await refreshedEvaluation;
  const refreshedInput = refreshedRequest.postDataJSON() as {
    roomStartsAt: string;
    roomEndsAt: string;
  };
  expect(refreshedInput.roomStartsAt).toBe('2026-08-11T07:00:00Z');
  expect(refreshedInput.roomEndsAt).toBe('2026-08-11T07:30:00Z');
  await expect(assistant.getByText(/recommended time was applied/iu)).toBeVisible();

  await assistant.getByRole('button', { name: /Focus 08/u }).click();
  await expect(assistant.getByRole('button', { name: /Focus 08/u })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar exposes planning and invitation workbenches', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1280, height: 1000 });

  await page.goto('/calendar/focus');
  await expect(page.getByRole('heading', { name: 'Focus plan', level: 1 })).toBeVisible();
  await expect(page.getByTestId('calendar-navigation-item-focus')).toBeVisible();
  await expect(page.getByText('Protected focus time', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find focus time', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Tuesday, August 11/ })).toBeVisible();

  await page.goto('/calendar/invitations');
  await expect(
    page.getByRole('heading', { name: 'Invitations & responses', level: 1 })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Accepted 1', exact: true }).click();
  await expect(page.getByText('Digital workplace operating review', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'View details for Digital workplace operating review' })
    .click();
  const responseDialog = page.getByRole('dialog', {
    name: 'Digital workplace operating review',
  });
  await expect(responseDialog.getByText('Your response', { exact: true })).toBeVisible();
  await expect(responseDialog.getByRole('button', { name: 'Accept', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  const responseRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request
        .url()
        .includes('/api/platform/v1/calendar/events/calendar-event-operating-review/response')
  );
  await responseDialog.getByRole('button', { name: 'Tentative', exact: true }).click();
  expect((await responseRequest).postDataJSON()).toEqual({ response: 'TENTATIVE' });
  await responseDialog.getByRole('button', { name: 'Close', exact: true }).click();

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar workbenches remain usable on compact screens', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/calendar/focus');
  await expect(page.getByRole('heading', { name: 'Focus plan', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add work block', exact: true })).toBeVisible();
  await expect(page.getByText('Protected focus time', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  await page.goto('/calendar/invitations');
  await expect(
    page.getByRole('heading', { name: 'Invitations & responses', level: 1 })
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: /Filter invitations by response status/u })
  ).toBeVisible();
  await expect(page.getByText('No invitations have this status', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar meeting composer becomes a full-screen, overflow-safe mobile workflow', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/calendar/schedule');

  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        let current: Element | null = element;
        while (current) {
          if (Number.parseFloat(window.getComputedStyle(current).opacity) < 1) return false;
          current = current.parentElement;
        }
        return true;
      })
    )
    .toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeLessThanOrEqual(1);
  expect(bounds!.width).toBeGreaterThanOrEqual(319);
  await dialog.getByRole('button', { name: /People, place, and more options/u }).click();
  await expect(dialog.getByLabel('Event time zone')).toBeVisible();
  await expect(dialog.getByLabel('Required attendees')).toBeVisible();
  await expect(dialog.getByLabel('Optional attendees')).toBeVisible();

  const assistant = dialog.getByTestId('calendar-scheduling-assistant');
  await assistant.scrollIntoViewIfNeeded();
  await expect(assistant).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar governs company sources, explicit sharing, favorites, and trash recovery', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let releaseSubscription = () => {};
  const subscriptionGate = new Promise<void>((resolve) => {
    releaseSubscription = resolve;
  });
  await page.route('**/api/platform/v1/calendar/calendars/*/subscription', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    await subscriptionGate;
    return route.fallback();
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/calendar/schedule');

  await expect(page.getByText('Company calendar', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Company', exact: true })
      .getByText('Required', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Manage sharing for/u })).toHaveCount(1);

  await page.getByRole('button', { name: 'Manage sharing for My calendar' }).click();
  const shareDialog = page.getByRole('dialog', { name: 'Share My calendar' });
  await expect(shareDialog).toBeVisible();
  await expect(shareDialog.getByText('Minseo Kim', { exact: true })).toBeVisible();
  await expect(
    shareDialog.getByText(/People who are not listed here cannot browse this calendar/u)
  ).toBeVisible();
  const freeBusyRadio = shareDialog.getByRole('radio', { name: /Free\/busy only/u });
  const detailRadio = shareDialog.getByRole('radio', { name: /View details/u });
  await expect(freeBusyRadio).toBeChecked();
  await freeBusyRadio.focus();
  await freeBusyRadio.press('ArrowRight');
  await expect(detailRadio).toBeChecked();
  await shareDialog.getByRole('button', { name: 'Done', exact: true }).click();

  const favoriteRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().includes('/api/platform/v1/calendar/calendars/calendar-personal/subscription')
  );
  await page.getByRole('button', { name: 'Remove My calendar from favorites' }).click();
  await favoriteRequest;
  const favoriteButtons = page.getByRole('button', { name: /favorites$/u });
  await expect(favoriteButtons.first()).toBeDisabled();
  await expect(favoriteButtons.nth(1)).toBeDisabled();
  releaseSubscription();
  const favoritePayload = (await favoriteRequest).postDataJSON() as {
    favorite: boolean;
    selected: boolean;
    version: number;
  };
  expect(favoritePayload).toMatchObject({ favorite: false, selected: true, version: 1 });

  await page.goto('/calendar/trash');
  await expect(page.getByRole('heading', { name: 'Trash', level: 1 })).toBeVisible();
  await expect(page.getByText('Archived planning review', { exact: true })).toBeVisible();
  const restoreRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().includes('/api/platform/v1/calendar/events/calendar-event-trashed/restore')
  );
  await page
    .getByRole('region', { name: 'Deleted calendar events' })
    .getByRole('button', { name: 'Restore', exact: true })
    .click();
  const restoreDialog = page.getByRole('dialog', { name: 'Restore this event?' });
  await restoreDialog.getByRole('button', { name: 'Restore', exact: true }).click();
  expect((await restoreRequest).postDataJSON()).toEqual({ version: 4 });

  await page.goto('/calendar/admin/company-calendars');
  await expect(page.getByRole('heading', { name: 'Company calendars', level: 1 })).toBeVisible();
  await expect(page.getByText('Required for all', { exact: true })).toBeVisible();
  await expect(page.getByText('Company town hall', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish event', exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar governance screens remain overflow-safe on compact screens', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/calendar/schedule');
  await page.getByRole('button', { name: 'Select calendars', exact: true }).click();
  const sourcePicker = page.getByRole('dialog', { name: 'Select calendars' });
  await expect(sourcePicker).toBeVisible();
  const sourcePickerAccessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(
    sourcePickerAccessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await sourcePicker.getByRole('button', { name: 'Done', exact: true }).click();

  await page.goto('/calendar/trash');
  await expect(page.getByText('Archived planning review', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  await page.goto('/calendar/admin/company-calendars');
  await expect(page.getByText('Company town hall', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
});

test('calendar isolates schedule feed failures from calendar source controls', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/platform/v1/calendar/events?*', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/calendar/schedule');

  await expect(page.getByText('The schedule could not be loaded.', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('region', { name: 'Company', exact: true })).toBeVisible();
  await expect(page.getByText('Company calendar', { exact: true })).toBeVisible();
  await expect(page.getByTestId('interactive-calendar')).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar expands the planning canvas and turns insight recommendations into actions', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/calendar/schedule');

  const calendar = page.getByTestId('interactive-calendar');
  const sourcePanel = page.getByTestId('calendar-source-panel');
  await expect(calendar).toBeVisible();
  await expect(sourcePanel).toBeVisible();
  const widthWithSources = (await calendar.boundingBox())?.width ?? 0;

  const hidePanel = page.getByRole('button', { name: 'Hide calendar panel', exact: true });
  await expect(hidePanel).toHaveAttribute('aria-expanded', 'true');
  await hidePanel.click();
  await expect(sourcePanel).toBeHidden();
  const widthWithoutSources = (await calendar.boundingBox())?.width ?? 0;
  expect(widthWithoutSources).toBeGreaterThan(widthWithSources + 200);

  const showPanel = page.getByRole('button', { name: 'Show calendar panel', exact: true });
  await expect(showPanel).toHaveAttribute('aria-expanded', 'false');
  await showPanel.click();
  await expect(sourcePanel).toBeVisible();

  await page.goto('/calendar/insights');
  const balanceRecommendation = page.getByRole('button', {
    name: /Balance.*Open schedule/u,
  });
  await expect(balanceRecommendation).toBeVisible();
  await balanceRecommendation.click();
  await expect(page).toHaveURL(/\/calendar\/schedule\?view=week&date=2026-08-14/u);

  await page.goto('/calendar/insights');
  await page.getByRole('button', { name: /Focus.*Protect focus time/u }).click();
  await expect(page.getByRole('dialog', { name: 'Create a new event' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar company actions reflow at 320px and tabs retain calendar context at 200% text', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/calendar/admin/company-calendars');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

  const createCalendar = page.getByRole('button', { name: 'New company calendar', exact: true });
  const publishEvent = page.getByRole('button', { name: 'Publish event', exact: true });
  await expect(createCalendar).toBeVisible();
  await expect(publishEvent).toBeVisible();
  const createBounds = await createCalendar.boundingBox();
  const publishBounds = await publishEvent.boundingBox();
  expect(createBounds).not.toBeNull();
  expect(publishBounds).not.toBeNull();
  expect(createBounds!.x).toBeGreaterThanOrEqual(0);
  expect(createBounds!.x + createBounds!.width).toBeLessThanOrEqual(320);
  expect(publishBounds!.x).toBeGreaterThanOrEqual(0);
  expect(publishBounds!.x + publishBounds!.width).toBeLessThanOrEqual(320);
  expect(createBounds!.y + createBounds!.height).toBeLessThanOrEqual(publishBounds!.y + 1);

  await expect(page.getByRole('tablist', { name: 'Company calendar', exact: true })).toBeVisible();
  await expect(
    page.getByRole('tabpanel', { name: 'Company calendar Published events', exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});

test('calendar remains read-only when Home deep-links a viewer without mutation grants', async ({
  page,
}) => {
  const readOnlyPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) =>
      permission.resourceKey !== 'APP.CALENDAR' || permission.permissionCode === 'VIEW'
  );
  const mutationRequests: string[] = [];
  const evaluationRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().includes('/api/platform/v1/calendar/scheduling/evaluations')
    ) {
      evaluationRequests.push(`${request.method()} ${request.url()}`);
      return;
    }
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
      request.url().includes('/api/platform/v1/calendar')
    ) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await mockShellSession(page, [], { locale: 'en', permissions: readOnlyPermissions });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/calendar/schedule?create=focus');
  await expect(page.getByTestId('interactive-calendar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add focus time', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/calendar/home');
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Protect for focus' })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Quick actions', exact: true })
    .and(page.locator('[aria-expanded]'))
    .click();
  const readOnlyCommands = page.getByRole('dialog', { name: 'Calendar quick actions' });
  await expect(readOnlyCommands).toBeVisible();
  for (const command of [
    'Create a new event',
    'Create focus time',
    'Create a task time block',
    'Create a time-away block',
  ]) {
    await expect(readOnlyCommands.getByRole('option', { name: command })).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
  await expect(readOnlyCommands).toHaveCount(0);

  await page.goto('/calendar/insights');
  await expect(page.getByRole('button', { name: 'Protect focus time', exact: true })).toHaveCount(
    0
  );

  await page.goto('/calendar/availability');
  await page.getByRole('button', { name: 'Find available time', exact: true }).click();
  await expect(
    page.getByText('All participants are available and focus time is preserved.')
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /All participants are available and focus time is preserved\./,
    })
  ).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mutationRequests).toEqual([]);
  expect(evaluationRequests).toHaveLength(1);
});

const CALENDAR_FOCUS_VERSION = 2;
