import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

test('calendar supports governed range creation and drag rescheduling', async ({ page }) => {
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
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
  await page.getByRole('button', { name: 'View details', exact: true }).click();
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
  await page.getByRole('button', { name: 'Calendars', exact: true }).click();
  const sourcePicker = page.getByRole('dialog', { name: 'Choose calendars' });
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
