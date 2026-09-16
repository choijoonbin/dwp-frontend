import { expect, test, type Locator } from '@playwright/test';
import { createHash } from 'node:crypto';

import { CALENDAR_EVENT_FIXTURE } from './support/product-area-fixtures';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const WORK_HANDOFF_PERMISSIONS = [
  ...FULL_PRODUCT_PERMISSIONS,
  {
    resourceType: 'APP',
    resourceKey: 'APP.WORK',
    permissionCode: 'UPDATE',
    effect: 'ALLOW' as const,
  },
];

function workOwnerFingerprint() {
  const owner = JSON.stringify({
    identity: ['TENANT', 1, 1, 'person-session-user'],
    roles: ['CALENDAR_ADMIN'],
    groups: [],
    resourceRoles: [],
    legacyRoleFallbackAllowed: false,
    permissions: WORK_HANDOFF_PERMISSIONS.map((permission) => JSON.stringify(permission)).sort(),
  });
  return `sha256:${createHash('sha256').update(owner).digest('hex')}`;
}

async function fillCalendarDateTime(field: Locator, value: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value])
  );
  const values = [parts.month, parts.day, parts.year, parts.hour, parts.minute, parts.dayPeriod];
  const sections = field.getByRole('spinbutton');
  await expect(sections).toHaveCount(values.length);
  for (const [index, sectionValue] of values.entries())
    await sections.nth(index).fill(sectionValue!);
}

test('Work handoff prefills and submits one private 30-minute focus event with source metadata', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: WORK_HANDOFF_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00.000Z'));
  let created: Record<string, unknown> | null = null;
  let linked: Record<string, unknown> | null = null;
  await page.route('**/api/platform/v1/calendar/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    created = route.request().postDataJSON() as Record<string, unknown>;
    return fulfillSuccess(route, {
      ...CALENDAR_EVENT_FIXTURE,
      ...created,
      eventId: '95fdccda-1ba0-4c7d-9829-189db4da0b4d',
      status: 'CONFIRMED',
      version: 0,
    });
  });
  await page.route('**/api/platform/v1/workspace/work-hub/calendar-links/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    linked = route.request().postDataJSON() as Record<string, unknown>;
    const linkId = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return fulfillSuccess(route, {
      linkId,
      ...linked,
      state: 'LINKED',
      version: 0,
      createdAt: '2026-08-11T00:20:00.000Z',
      updatedAt: '2026-08-11T00:20:00.000Z',
      calendarAvailability: 'REFERENCE_ONLY',
    });
  });

  const sourceUrl = '/work/queue?work=PERSONAL_TASK%3Atask-42%3A';
  const returnTo = `${sourceUrl}#selected`;
  const title = 'Focus: Finish quarterly report';
  const description = `DWP Work\nReference: PERSONAL_TASK:task-42:\nSource: ${sourceUrl}`;
  const routeState = {
    workCalendarEventHandoff: {
      version: 1,
      handoffId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
      origin: 'WORK_HUB',
      ownerFingerprint: workOwnerFingerprint(),
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl,
      returnTo,
      title,
      startsAt: '2026-08-11T01:00:00.000Z',
      endsAt: '2026-08-11T01:30:00.000Z',
      timeZone: 'Asia/Seoul',
      createdAt: '2026-08-11T00:20:00.000Z',
      expiresAt: '2026-08-11T00:35:00.000Z',
    },
  };

  await page.goto('/calendar/schedule');
  await page.evaluate(
    ({ state, url }) => {
      window.history.pushState({ ...(window.history.state ?? {}), usr: state }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    },
    { state: routeState, url: '/calendar/schedule?date=2026-08-11&create=focus' }
  );

  const composer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel('Title')).toHaveValue(title);
  await expect(composer.getByLabel('Notes')).toHaveValue(description);
  await expect.poll(() => new URL(page.url()).searchParams.has('create')).toBe(false);
  expect(new URL(page.url()).searchParams.has('work')).toBe(false);
  expect(new URL(page.url()).searchParams.has('returnTo')).toBe(false);
  expect(await page.evaluate(() => window.history.state?.usr ?? null)).toBeNull();

  await composer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(composer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to work', exact: true })).toHaveCount(0);
  await expect.poll(() => created).not.toBeNull();
  expect(created).toMatchObject({
    title,
    description,
    type: 'FOCUS',
    startsAt: '2026-08-11T01:00:00.000Z',
    endsAt: '2026-08-11T01:30:00.000Z',
    timeZone: 'Asia/Seoul',
    allDay: false,
    visibility: 'PRIVATE',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: false,
    attendees: [],
  });
  expect(created?.idempotencyKey).toBe(routeState.workCalendarEventHandoff.handoffId);
  expect(linked).toEqual({
    work: routeState.workCalendarEventHandoff.work,
    eventId: '95fdccda-1ba0-4c7d-9829-189db4da0b4d',
  });

  expect(new URL(page.url()).pathname).toBe('/calendar/schedule');
});

test('Work link recovery retries only the same link after an exact Calendar receipt', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: WORK_HANDOFF_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00.000Z'));
  const eventId = '95fdccda-1ba0-4c7d-9829-189db4da0b4d';
  let calendarCreates = 0;
  const linkAttempts: Array<{ url: string; body: Record<string, unknown> }> = [];
  await page.route('**/api/platform/v1/calendar/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calendarCreates += 1;
    const input = route.request().postDataJSON() as Record<string, unknown>;
    return fulfillSuccess(route, {
      ...CALENDAR_EVENT_FIXTURE,
      ...input,
      eventId,
      status: 'CONFIRMED',
      version: 0,
    });
  });
  await page.route('**/api/platform/v1/workspace/work-hub/calendar-links/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    linkAttempts.push({ url: route.request().url(), body });
    if (linkAttempts.length === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'link service unavailable' }),
      });
    }
    const linkId = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return fulfillSuccess(route, {
      linkId,
      ...body,
      state: 'LINKED',
      version: 0,
      createdAt: '2026-08-11T00:20:00.000Z',
      updatedAt: '2026-08-11T00:20:01.000Z',
      calendarAvailability: 'REFERENCE_ONLY',
    });
  });
  const sourceUrl = '/work/queue?work=PERSONAL_TASK%3Atask-42%3A';
  const handoffId = '36e6e854-ec64-456c-8bcc-46a7d5ba97f2';
  const routeState = {
    workCalendarEventHandoff: {
      version: 1,
      handoffId,
      origin: 'WORK_HUB',
      ownerFingerprint: workOwnerFingerprint(),
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl,
      returnTo: `${sourceUrl}#selected`,
      title: 'Focus: Finish quarterly report',
      startsAt: '2026-08-11T01:00:00.000Z',
      endsAt: '2026-08-11T01:30:00.000Z',
      timeZone: 'Asia/Seoul',
      createdAt: '2026-08-11T00:20:00.000Z',
      expiresAt: '2026-08-11T00:35:00.000Z',
    },
  };
  await page.goto('/calendar/schedule');
  await page.evaluate(
    ({ state, url }) => {
      window.history.pushState({ ...(window.history.state ?? {}), usr: state }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    },
    { state: routeState, url: '/calendar/schedule?date=2026-08-11&create=focus' }
  );
  const composer = page.getByRole('dialog', { name: 'Create a new event' });
  const title = composer.getByLabel('Title');
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(composer).toContainText(
    'The event was confirmed, but its Work link still needs recovery.'
  );
  await expect(title).toBeDisabled();
  await expect(
    composer.getByRole('button', { name: 'Retry Work link', exact: true })
  ).toBeVisible();
  await composer.getByRole('button', { name: 'Retry Work link', exact: true }).click();
  await expect(composer).toHaveCount(0);
  expect(calendarCreates).toBe(1);
  expect(linkAttempts).toHaveLength(2);
  expect(linkAttempts[0]?.url).toBe(linkAttempts[1]?.url);
  expect(linkAttempts[0]?.url.endsWith(`/${handoffId}`)).toBe(true);
  expect(linkAttempts[0]?.body).toEqual({
    work: routeState.workCalendarEventHandoff.work,
    eventId,
  });
  expect(linkAttempts[1]?.body).toEqual(linkAttempts[0]?.body);
});

test('a real-time reload rehydrates the exact Work link receipt without a second Calendar POST', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: WORK_HANDOFF_PERMISSIONS,
  });
  const capturedAt = new Date();
  const startsAt = new Date(capturedAt.getTime() + 60 * 60_000).toISOString();
  const endsAt = new Date(capturedAt.getTime() + 90 * 60_000).toISOString();
  const expiresAt = new Date(capturedAt.getTime() + 15 * 60_000).toISOString();
  const eventId = '95fdccda-1ba0-4c7d-9829-189db4da0b4d';
  const handoffId = '36e6e854-ec64-456c-8bcc-46a7d5ba97f2';
  let calendarCreates = 0;
  let createdInput: Record<string, unknown> | null = null;
  let calendarReadsUnavailable = false;
  const linkAttempts: Array<{ url: string; body: Record<string, unknown> }> = [];
  await page.route('**/api/platform/v1/calendar/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calendarCreates += 1;
    const input = route.request().postDataJSON() as Record<string, unknown>;
    createdInput = input;
    return fulfillSuccess(route, {
      ...CALENDAR_EVENT_FIXTURE,
      ...input,
      eventId,
      status: 'CONFIRMED',
      version: 0,
    });
  });
  await page.route('**/api/platform/v1/workspace/work-hub/calendar-links/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    linkAttempts.push({ url: route.request().url(), body });
    if (linkAttempts.length === 1) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'link service unavailable' }),
      });
    }
    return fulfillSuccess(route, {
      linkId: handoffId,
      ...body,
      state: 'LINKED',
      version: 0,
      createdAt: capturedAt.toISOString(),
      updatedAt: new Date().toISOString(),
      calendarAvailability: 'REFERENCE_ONLY',
    });
  });
  await page.route('**/api/platform/v1/calendar/**', async (route) => {
    if (route.request().method() !== 'GET' || !calendarReadsUnavailable) return route.fallback();
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'calendar reads unavailable' }),
    });
  });
  const sourceUrl = '/work/queue?work=PERSONAL_TASK%3Atask-42%3A';
  const routeState = {
    workCalendarEventHandoff: {
      version: 1,
      handoffId,
      origin: 'WORK_HUB',
      ownerFingerprint: workOwnerFingerprint(),
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl,
      returnTo: `${sourceUrl}#selected`,
      title: 'Focus: reload-safe quarterly report',
      startsAt,
      endsAt,
      timeZone: 'Asia/Seoul',
      createdAt: capturedAt.toISOString(),
      expiresAt,
    },
  };

  await page.goto('/calendar/schedule');
  await page.evaluate(
    ({ state, url }) => {
      window.history.pushState({ ...(window.history.state ?? {}), usr: state }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    },
    {
      state: routeState,
      url: `/calendar/schedule?date=${startsAt.slice(0, 10)}&create=focus`,
    }
  );
  let composer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(composer).toBeVisible();
  const editedStart = new Date(capturedAt.getTime() + 25 * 60 * 60_000);
  const editedEnd = new Date(capturedAt.getTime() + 26 * 60 * 60_000);
  await composer.getByLabel('Title').fill('Edited reload-safe focus block');
  await fillCalendarDateTime(composer.getByRole('group', { name: 'Start' }), editedStart);
  await fillCalendarDateTime(composer.getByRole('group', { name: 'End' }), editedEnd);
  await composer.getByRole('combobox', { name: 'Importance' }).click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await composer.getByRole('combobox', { name: 'Event time zone' }).click();
  await page.getByRole('option', { name: 'UTC', exact: true }).click();
  await composer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(composer).toContainText(
    'The event was confirmed, but its Work link still needs recovery.'
  );
  expect(calendarCreates).toBe(1);
  expect(createdInput).toMatchObject({
    title: 'Edited reload-safe focus block',
    timeZone: 'UTC',
    importance: 'HIGH',
    idempotencyKey: handoffId,
  });
  expect(linkAttempts).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      JSON.parse(window.sessionStorage.getItem('dwp.calendar.work-handoff-recovery.v1') ?? 'null')
    )
  ).toMatchObject({ input: createdInput, event: { eventId } });
  const createsBeforeReload = calendarCreates;
  const linksBeforeReload = linkAttempts.length;

  // This test deliberately uses the browser's real clock: sessionStorage survives the document
  // reload and the 15-minute handoff remains valid without Playwright clock reinstallation. All
  // Calendar reads fail after reload to prove the verified receipt can retry its Work PUT alone.
  calendarReadsUnavailable = true;
  await page.reload();
  composer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(composer).toBeVisible();
  await expect(composer.getByRole('combobox', { name: /^Calendar/u })).toContainText('My calendar');
  await expect(composer.getByLabel('Title')).toHaveValue('Edited reload-safe focus block');
  await expect(composer.getByLabel('Title')).toBeDisabled();
  await expect(composer.getByRole('combobox', { name: 'Importance' })).toContainText('High');
  await expect(composer.getByRole('combobox', { name: 'Event time zone' })).toContainText('UTC');
  await expect(
    composer.getByRole('button', { name: 'Retry Work link', exact: true })
  ).toBeVisible();
  await composer.getByRole('button', { name: 'Retry Work link', exact: true }).click();
  await expect(composer).toHaveCount(0);

  expect(calendarCreates).toBe(1);
  expect(linkAttempts).toHaveLength(2);
  expect(calendarCreates - createsBeforeReload).toBe(0);
  expect(linkAttempts.length - linksBeforeReload).toBe(1);
  expect(linkAttempts[1]).toEqual(linkAttempts[0]);
  expect(linkAttempts[1]?.url.endsWith(`/${handoffId}`)).toBe(true);
  expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0);
});

test('unknown Calendar response replays the same handoff idempotency key', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: WORK_HANDOFF_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00.000Z'));
  const eventId = '95fdccda-1ba0-4c7d-9829-189db4da0b4d';
  const handoffId = '36e6e854-ec64-456c-8bcc-46a7d5ba97f2';
  const createAttempts: Record<string, unknown>[] = [];
  let linkAttempts = 0;
  await page.route('**/api/platform/v1/calendar/events', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const input = route.request().postDataJSON() as Record<string, unknown>;
    createAttempts.push(input);
    if (createAttempts.length === 1) return route.abort('connectionreset');
    return fulfillSuccess(route, {
      ...CALENDAR_EVENT_FIXTURE,
      ...input,
      eventId,
      status: 'CONFIRMED',
      version: 0,
    });
  });
  await page.route('**/api/platform/v1/workspace/work-hub/calendar-links/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    linkAttempts += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    return fulfillSuccess(route, {
      linkId: handoffId,
      ...body,
      state: 'LINKED',
      version: 0,
      createdAt: '2026-08-11T00:20:00.000Z',
      updatedAt: '2026-08-11T00:20:01.000Z',
      calendarAvailability: 'REFERENCE_ONLY',
    });
  });
  const sourceUrl = '/work/queue?work=PERSONAL_TASK%3Atask-42%3A';
  const state = {
    workCalendarEventHandoff: {
      version: 1,
      handoffId,
      origin: 'WORK_HUB',
      ownerFingerprint: workOwnerFingerprint(),
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl,
      returnTo: `${sourceUrl}#selected`,
      title: 'Focus: Finish quarterly report',
      startsAt: '2026-08-11T01:00:00.000Z',
      endsAt: '2026-08-11T01:30:00.000Z',
      timeZone: 'Asia/Seoul',
      createdAt: '2026-08-11T00:20:00.000Z',
      expiresAt: '2026-08-11T00:35:00.000Z',
    },
  };
  await page.goto('/calendar/schedule');
  await page.evaluate(
    ({ routeState, url }) => {
      window.history.pushState({ ...(window.history.state ?? {}), usr: routeState }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    },
    { routeState: state, url: '/calendar/schedule?date=2026-08-11&create=focus' }
  );
  const composer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect.poll(() => createAttempts.length).toBe(1);
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(composer).toHaveCount(0);

  expect(createAttempts).toHaveLength(2);
  expect(createAttempts.map((attempt) => attempt.idempotencyKey)).toEqual([handoffId, handoffId]);
  expect(linkAttempts).toBe(1);
});

test('state-based Work handoff returns through its verified canonical target', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: WORK_HANDOFF_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00.000Z'));
  const sourceUrl = '/work/queue?work=PERSONAL_TASK%3Atask-42%3A';
  const returnTo = `${sourceUrl}#selected`;
  const state = {
    workCalendarEventHandoff: {
      version: 1,
      handoffId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
      origin: 'WORK_HUB',
      ownerFingerprint: workOwnerFingerprint(),
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl,
      returnTo,
      title: 'Focus: Finish quarterly report',
      startsAt: '2026-08-11T01:00:00.000Z',
      endsAt: '2026-08-11T01:30:00.000Z',
      timeZone: 'Asia/Seoul',
      createdAt: '2026-08-11T00:20:00.000Z',
      expiresAt: '2026-08-11T00:35:00.000Z',
    },
  };
  await page.goto('/calendar/schedule');
  await page.evaluate(
    ({ routeState, url }) => {
      window.history.pushState({ ...(window.history.state ?? {}), usr: routeState }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    },
    { routeState: state, url: '/calendar/schedule?date=2026-08-11&create=focus' }
  );
  await expect(page.getByRole('dialog', { name: 'Create a new event' })).toBeVisible();
  const returnAction = page.getByRole('button', { name: 'Return to work', exact: true });
  await expect(returnAction).toBeVisible();
  await returnAction.click();
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}${url.hash}` === returnTo);
});

test('Work handoff composer closes before Calendar mutation when the authenticated owner changes', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: WORK_HANDOFF_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00.000Z'));
  let calendarCreates = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/platform/v1/calendar/events'
    ) {
      calendarCreates += 1;
    }
  });
  const sourceUrl = '/work/queue?work=PERSONAL_TASK%3Atask-42%3A';
  const state = {
    workCalendarEventHandoff: {
      version: 1,
      handoffId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
      origin: 'WORK_HUB',
      ownerFingerprint: workOwnerFingerprint(),
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl,
      returnTo: `${sourceUrl}#selected`,
      title: 'Focus: Finish quarterly report',
      startsAt: '2026-08-11T01:00:00.000Z',
      endsAt: '2026-08-11T01:30:00.000Z',
      timeZone: 'Asia/Seoul',
      createdAt: '2026-08-11T00:20:00.000Z',
      expiresAt: '2026-08-11T00:35:00.000Z',
    },
  };

  await page.goto('/calendar/schedule');
  await page.evaluate(
    ({ routeState, url }) => {
      window.history.pushState({ ...(window.history.state ?? {}), usr: routeState }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    },
    { routeState: state, url: '/calendar/schedule?date=2026-08-11&create=focus' }
  );
  const composer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(composer).toBeVisible();

  await page.route('**/api/auth/me', (route) =>
    fulfillSuccess(route, {
      userId: 2,
      personPublicId: 'person-other-user',
      displayName: 'Other User',
      jobTitle: 'Employee',
      email: 'other.user@dwp.local',
      tenantId: 1,
      tenantCode: 'default',
      tenantName: 'SKAX',
      identityPlane: 'TENANT',
      preferredLocale: 'en',
      tenantDefaultLocale: 'en',
      roles: ['CALENDAR_ADMIN'],
      groups: [],
      resourceRoles: [],
    })
  );
  const refreshed = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/me') && response.status() === 200
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await refreshed;
  await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();
  await expect(composer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to work', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('task-42');
  expect(calendarCreates).toBe(0);
});

test('Work handoff expiry is rechecked immediately before Calendar creation', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: WORK_HANDOFF_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00.000Z'));
  let calendarCreates = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/platform/v1/calendar/events'
    ) {
      calendarCreates += 1;
    }
  });
  const sourceUrl = '/work/queue?work=PERSONAL_TASK%3Atask-42%3A';
  const state = {
    workCalendarEventHandoff: {
      version: 1,
      handoffId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
      origin: 'WORK_HUB',
      ownerFingerprint: workOwnerFingerprint(),
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl,
      returnTo: `${sourceUrl}#selected`,
      title: 'Focus: Finish quarterly report',
      startsAt: '2026-08-11T01:00:00.000Z',
      endsAt: '2026-08-11T01:30:00.000Z',
      timeZone: 'Asia/Seoul',
      createdAt: '2026-08-11T00:20:00.000Z',
      expiresAt: '2026-08-11T00:35:00.000Z',
    },
  };

  await page.goto('/calendar/schedule');
  await page.evaluate(
    ({ routeState, url }) => {
      window.history.pushState({ ...(window.history.state ?? {}), usr: routeState }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    },
    { routeState: state, url: '/calendar/schedule?date=2026-08-11&create=focus' }
  );
  const composer = page.getByRole('dialog', { name: 'Create a new event' });
  await expect(composer).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-08-11T00:36:00.000Z'));
  await composer.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(composer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to work', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('task-42');
  expect(calendarCreates).toBe(0);
});

test('calendar preserves a canonical Work handoff and offers an explicit return action', async ({
  page,
}) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  const returnTarget = '/work/queue?view=mine#task-task-42';
  const query = new URLSearchParams({
    date: '2026-08-11',
    returnTo: returnTarget,
  });

  await page.goto(`/calendar/schedule?${query.toString()}`);
  const returnAction = page.getByRole('button', { name: 'Return to work', exact: true });
  await expect(returnAction).toBeVisible();
  await returnAction.focus();
  await expect(returnAction).toBeFocused();

  if ((page.viewportSize()?.width ?? 0) >= 900) {
    await page
      .getByTestId('interactive-calendar')
      .getByRole('tab', { name: 'Month view', exact: true })
      .click();
  }
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTarget);

  await returnAction.click();
  await expect(page).toHaveURL(new RegExp(`/work/queue\\?view=mine#task-task-42$`, 'u'));
});

test('calendar hides the Work return action without destination permission', async ({ page }) => {
  const calendarPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) => permission.resourceKey !== 'APP.WORK'
  );
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: calendarPermissions,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));

  await page.goto('/calendar/schedule?returnTo=%2Fwork%2Fqueue');
  await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to work', exact: true })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/calendar/schedule');
});

test('calendar withdraws the Work return action after permission revocation', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.goto('/calendar/schedule?returnTo=%2Fwork%2Fqueue');

  const returnAction = page.getByRole('button', { name: 'Return to work', exact: true });
  await expect(returnAction).toBeVisible();
  await returnAction.focus();
  await expect(returnAction).toBeFocused();
  const revokedPermissions = FULL_PRODUCT_PERMISSIONS.filter(
    (permission) => permission.resourceKey !== 'APP.WORK'
  );
  await page.route('**/api/auth/permissions', (route) => fulfillSuccess(route, revokedPermissions));
  const authorityRefresh = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/permissions') && response.status() === 200
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await authorityRefresh;
  await expect(returnAction).toHaveCount(0);
  expect(
    await page.evaluate(() => document.activeElement?.textContent?.includes('Return to work'))
  ).toBe(false);
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => document.activeElement?.textContent?.includes('Return to work'))
  ).toBe(false);
});

test('calendar hides encoded unsafe Work return aliases', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  for (const returnTo of ['/work/%5cadmin', '/work/queue?filter=%0A']) {
    await page.goto(`/calendar/schedule?returnTo=${encodeURIComponent(returnTo)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Return to work', exact: true })).toHaveCount(0);
  }
});
