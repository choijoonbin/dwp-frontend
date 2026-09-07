import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockShellSession } from './support/shell-session';

const meetingId = '81000000-0000-4000-8000-000000000401';
const fingerprint = 'a'.repeat(64);
const meeting = {
  meetingId,
  title: 'Architecture review',
  description: 'Choose the rollout.',
  agenda: 'Review evidence and decide.',
  lifecycleState: 'SCHEDULED',
  accessScope: 'INVITED',
  meetingCode: 'ABCD-EFGH-JKMN',
  startsAt: '2027-02-01T01:00:00Z',
  endsAt: '2027-02-01T02:00:00Z',
  durationMinutes: 60,
  timeZone: 'Asia/Seoul',
  organizerUserId: 42,
  organizerName: 'Mina Kim',
  waitingRoomEnabled: true,
  guestAccessEnabled: false,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  attendeeCount: 4,
  participantRole: 'ORGANIZER',
  canHost: true,
  canModerate: true,
  version: 3,
};
function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: status < 400 ? 'SUCCESS' : 'ERROR', data }),
  });
}
async function setup(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    locale: 'en',
    displayName: 'Mina Kim',
    permissions: ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
      resourceType: 'APP',
      resourceKey: 'APP.MEETINGS',
      permissionCode,
      effect: 'ALLOW' as const,
    })),
  });
  const state = {
    schedule: {
      meetingId,
      lifecycleState: 'SCHEDULED',
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      timeZone: meeting.timeZone,
      meetingVersion: 3,
      seriesId: '81000000-0000-4000-8000-000000000402',
      occurrenceIndex: 2,
      occurrenceCount: 4,
      frequency: 'WEEKLY',
      recurrenceInterval: 1,
      seriesVersion: 2,
      exceptionState: 'NONE',
      invitationRevision: 2,
      deliveryState: 'PENDING',
    },
    changes: [] as { body: Record<string, unknown>; key: string }[],
    cancellations: [] as { body: Record<string, unknown>; key: string }[],
  };
  await page.route('**/api/meetings/v1/meetings**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith(`/${meetingId}/schedule/preview`) && method === 'POST')
      return fulfill(route, {
        previewFingerprint: fingerprint,
        hasCalendarAdjustments: false,
        occurrences: [
          {
            occurrenceIndex: 2,
            startsAt: state.schedule.startsAt,
            localStart: '2027-02-01T10:00:00',
            utcOffset: '+09:00',
            adjustment: 'NONE',
          },
          {
            occurrenceIndex: 3,
            startsAt: '2027-02-08T01:00:00Z',
            localStart: '2027-02-08T10:00:00',
            utcOffset: '+09:00',
            adjustment: 'NONE',
          },
        ],
      });
    if (url.pathname.endsWith(`/${meetingId}/schedule`) && method === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.changes.push({ body, key: route.request().headers()['idempotency-key'] ?? '' });
      state.schedule = {
        ...state.schedule,
        meetingVersion: state.schedule.meetingVersion + 1,
        seriesVersion: state.schedule.seriesVersion + 1,
        invitationRevision: state.schedule.invitationRevision + 1,
        deliveryState: 'PENDING',
      };
      return fulfill(route, state.schedule);
    }
    if (url.pathname.endsWith(`/${meetingId}/cancel/preview`) && method === 'POST')
      return fulfill(route, {
        impactFingerprint: fingerprint,
        scope: 'THIS_AND_FUTURE',
        affectedOccurrenceCount: 2,
        skippedImmutableOccurrenceCount: 1,
        invitationRevision: state.schedule.invitationRevision + 1,
        seriesVersion: state.schedule.seriesVersion,
      });
    if (url.pathname.endsWith(`/${meetingId}/cancel`) && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.cancellations.push({
        body,
        key: route.request().headers()['idempotency-key'] ?? '',
      });
      state.schedule = {
        ...state.schedule,
        lifecycleState: 'CANCELLED',
        exceptionState: 'CANCELLED',
        meetingVersion: state.schedule.meetingVersion + 1,
        seriesVersion: state.schedule.seriesVersion + 1,
        invitationRevision: state.schedule.invitationRevision + 1,
        deliveryState: 'CANCELLED',
      };
      return fulfill(route, state.schedule);
    }
    if (url.pathname.endsWith(`/${meetingId}/schedule`) && method === 'GET')
      return fulfill(route, state.schedule);
    if (url.pathname.endsWith('/meetings') && method === 'GET')
      return fulfill(route, { items: [meeting], total: 1, page: 0, pageSize: 30 });
    return route.fallback();
  });
  await page.goto('/meetings/mine');
  await expect(page.getByTestId('meeting-schedule-management')).toBeVisible();
  return state;
}
async function chooseFutureScope(page: Page) {
  await page.getByRole('combobox', { name: /^Affected occurrences/u }).click();
  await page
    .getByRole('option', { name: 'This and future eligible occurrences', exact: true })
    .click();
}

test('host previews and applies a fenced future-series schedule change', async ({ page }) => {
  const state = await setup(page);
  await expect(
    page.getByText('Delivery intent pending — external invitation delivery is not connected', {
      exact: false,
    })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change schedule', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await chooseFutureScope(page);
  await dialog.getByRole('button', { name: 'Review impact', exact: true }).click();
  await expect(dialog.getByText('2 occurrence(s) will use', { exact: false })).toBeVisible();
  await dialog
    .getByLabel('I reviewed the occurrence, time-zone and invitation impact', { exact: true })
    .check();
  await dialog.getByRole('button', { name: 'Apply reviewed change', exact: true }).click();
  await expect.poll(() => state.changes.length).toBe(1);
  expect(state.changes[0].body).toMatchObject({
    scope: 'THIS_AND_FUTURE',
    expectedVersion: 3,
    expectedSeriesVersion: 2,
    calendarFingerprint: fingerprint,
  });
  expect(state.changes[0].key).toMatch(/^[0-9a-f-]{36}$/u);
});

test('host reviews cancellation counts and immutable skips before confirming', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Cancel meeting', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await chooseFutureScope(page);
  await dialog.getByRole('button', { name: 'Review impact', exact: true }).click();
  await expect(dialog.getByText('2 eligible occurrence(s) will be cancelled')).toBeVisible();
  await expect(
    dialog.getByText('1 past, live or terminal occurrence(s)', { exact: false })
  ).toBeVisible();
  await dialog
    .getByLabel('I reviewed the occurrence, time-zone and invitation impact', { exact: true })
    .check();
  await dialog.getByRole('button', { name: 'Confirm reviewed cancellation', exact: true }).click();
  await expect.poll(() => state.cancellations.length).toBe(1);
  expect(state.cancellations[0].body).toMatchObject({
    scope: 'THIS_AND_FUTURE',
    impactFingerprint: fingerprint,
  });
  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="my-meetings-workspace"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ).toBeLessThanOrEqual(1);
});
