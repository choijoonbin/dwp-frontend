import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CalendarBooking, CalendarPolicy, CalendarResource } from '@dwp-frontend/shared-utils';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const room = {
  resourceId: '91000000-0000-0000-0000-000000000001',
  code: 'QA-ROOM',
  name: 'Native approval test room',
  nameKo: '승인 테스트 회의실',
  nameEn: 'Native approval test room',
  type: 'ROOM',
  site: 'Native meeting test site',
  floor: '12',
  capacity: 18,
  features: ['VIDEO'],
  timeZone: 'Asia/Seoul',
  approvalRequired: true,
  state: 'AVAILABLE',
  available: true,
  version: 3,
} satisfies CalendarResource;
const calendarPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 240,
  maximumAdvanceDays: 30,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 300,
  dailyMeetingLimitMinutes: 240,
  enforceMeetingAgenda: true,
  allowExternalAttendees: false,
  version: 2,
} satisfies CalendarPolicy;
const workplacePolicy = {
  bookingWindowDays: 30,
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
  bookingRetentionDays: 365,
  version: 2,
};

// The owner returns 100 genuine DTO rows in this controlled fixture. Local pages
// count that array; no server page, estimated aggregate, or generated UI row exists.
const bookings: CalendarBooking[] = Array.from({ length: 100 }, (_, index) => {
  const starts = new Date(Date.UTC(2026, 8, 18 + Math.floor(index / 20), 0, (index % 20) * 30));
  return {
    bookingId: `92000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    eventId: `93000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    resourceId: room.resourceId,
    resourceName: room.name,
    eventTitle: `Native pending meeting ${String(index + 1).padStart(3, '0')}`,
    startsAt: starts.toISOString(),
    endsAt: new Date(starts.getTime() + 30 * 60_000).toISOString(),
    organizerName: `Test organizer ${index + 1}`,
    organizerEmail: `organizer-${index + 1}@example.test`,
    status: 'PENDING',
    requestedBy: 900018,
    version: index + 4,
  };
});

async function setup(page: Page, options: { readOnly?: boolean } = {}) {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: options.readOnly
      ? FULL_PRODUCT_PERMISSIONS.filter(
          (item) => item.resourceKey !== 'ADMIN.ROOMS' || item.permissionCode === 'VIEW'
        )
      : FULL_PRODUCT_PERMISSIONS,
  });
  const state = {
    pending: bookings.map((booking) => ({ ...booking })),
    denied: false,
    failDecision: false,
    decisionGate: null as Promise<void> | null,
    pendingReads: 0,
    writes: [] as { path: string; body: Record<string, unknown> }[],
  };
  await page.route('**/api/platform/v1/admin/rooms/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/overview'))
      return fulfillSuccess(route, {
        resources: [room],
        activeResources: 1,
        resourcesInMaintenance: 0,
        bookingsThisWeek: 60,
        pendingBookings: state.pending.length,
        eventsThisWeek: 60,
        conflictedUsers: 0,
        policy: calendarPolicy,
        generatedAt: '2026-09-14T03:00:00Z',
      });
    if (path.endsWith('/bookings/pending')) {
      state.pendingReads += 1;
      if (state.denied)
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'FORBIDDEN',
            message: 'Fixture: pending source authority revoked',
          }),
        });
      return fulfillSuccess(route, state.pending);
    }
    if (path.endsWith('/decision') && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      if (state.decisionGate) await state.decisionGate;
      if (state.failDecision)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
            message: 'Fixture: outcome unknown',
          }),
        });
      const target = state.pending.find((booking) => path.includes(booking.bookingId));
      expect(target).toBeDefined();
      expect(body.version).toBe(target!.version);
      state.pending = state.pending.filter((booking) => booking.bookingId !== target!.bookingId);
      return fulfillSuccess(route, {
        ...target,
        status: body.decision === 'APPROVE' ? 'CONFIRMED' : 'DECLINED',
        decisionNote: body.note,
        version: target!.version + 1,
      });
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/admin/workplace/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/policy')) return fulfillSuccess(route, workplacePolicy);
    if (path.endsWith('/sites')) return fulfillSuccess(route, []);
    if (path.endsWith('/governance/delegated-admin-scopes/effective'))
      return fulfillSuccess(route, []);
    return route.fallback();
  });
  return state;
}

async function stableViewport(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await expect
    .poll(() =>
      page
        .locator('main')
        .first()
        .evaluate((element) => {
          const offset =
            window.innerWidth >= 1200
              ? document.querySelector('[data-testid="rooms-sidebar"]')!.getBoundingClientRect()
                  .width
              : 0;
          const rect = element.getBoundingClientRect();
          return (
            Math.abs(rect.x - offset) < 1 && Math.abs(rect.width - (window.innerWidth - offset)) < 1
          );
        })
    )
    .toBe(true);
}

test('embedded approval panel pages the actual 100 rows at 1440/390/320 and dispatches only the selected visible ID', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const state = await setup(page);
  await page.goto('/workplace/admin/policies');
  const queue = page.getByTestId('policy-room-approval-queue');
  const navigation = queue.getByRole('navigation', {
    name: 'Approval queue pages',
    includeHidden: true,
  });
  const rows = queue.locator('[data-room-booking-id]');
  await expect(rows).toHaveCount(5);
  await expect(navigation).toContainText('100 bookings · 1–5 · page 1 of 20');
  await expect(
    navigation.getByRole('button', { name: 'Previous', exact: true, includeHidden: true })
  ).toBeDisabled();
  await expect(page.getByText(bookings[99].eventTitle, { exact: true })).not.toBeAttached();
  for (const width of [1440, 390, 320]) {
    await stableViewport(page, width);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    expect((await queue.boundingBox())!.height).toBeLessThan(width === 1440 ? 800 : 1350);
    await page.screenshot({
      path: `/tmp/workplace-policy-approval-queue-${width}.png`,
      fullPage: true,
    });
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="policy-room-approval-queue"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      axe.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? '')),
      JSON.stringify(axe.violations)
    ).toEqual([]);
  }
  await navigation.getByRole('button', { name: 'Next', exact: true, includeHidden: true }).click();
  await expect(navigation).toContainText('100 bookings · 6–10 · page 2 of 20');
  expect(
    await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-room-booking-id'))
    )
  ).toEqual(bookings.slice(5, 10).map((booking) => booking.bookingId));
  await rows.first().getByRole('button', { name: 'Approve', exact: true }).click();
  const approval = page.getByRole('dialog', { name: 'Approve this booking?', exact: true });
  await approval
    .getByRole('textbox', { name: /^Operator note/u })
    .fill('This hidden selection must be discarded');
  // A navigation/context change must also fence a mounted dialog before React renders.
  await navigation
    .getByRole('button', { name: 'Previous', exact: true, includeHidden: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(approval).not.toBeVisible();
  await expect(navigation).toContainText('page 1 of 20');
  await navigation.getByRole('button', { name: 'Next', exact: true, includeHidden: true }).click();
  await rows.nth(2).getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(approval.getByRole('textbox', { name: /^Operator note/u })).toHaveValue('');
  await expect(approval).toContainText(bookings[7].eventTitle);
  await approval
    .getByRole('textbox', { name: /^Operator note/u })
    .fill('Approve the exact page-two native booking');
  await approval.getByRole('button', { name: 'Approve', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(approval).not.toBeVisible();
  await expect(navigation).toContainText('99 bookings · 1–5 · page 1 of 20');
  expect(state.writes).toEqual([
    {
      path: `/api/platform/v1/admin/rooms/bookings/${bookings[7].bookingId}/decision`,
      body: {
        decision: 'APPROVE',
        note: 'Approve the exact page-two native booking',
        version: bookings[7].version,
      },
    },
  ]);
});

test('embedded pending and UNKNOWN commands lock pages until an explicit source recheck', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/workplace/admin/policies');
  const queue = page.getByTestId('policy-room-approval-queue');
  const navigation = queue.getByRole('navigation', {
    name: 'Approval queue pages',
    includeHidden: true,
  });
  await navigation.getByRole('button', { name: 'Next', exact: true, includeHidden: true }).click();
  await queue
    .locator('[data-room-booking-id]')
    .first()
    .getByRole('button', { name: 'Decline', exact: true })
    .click();
  const decline = page.getByRole('dialog', { name: 'Decline this booking?', exact: true });
  await decline
    .getByRole('textbox', { name: /^Operator note/u })
    .fill('Decline original page-two booking');
  let release!: () => void;
  state.decisionGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.failDecision = true;
  await decline.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  await expect(
    navigation.getByRole('button', { name: 'Previous', exact: true, includeHidden: true })
  ).toBeDisabled();
  await expect(
    navigation.getByRole('button', { name: 'Next', exact: true, includeHidden: true })
  ).toBeDisabled();
  await expect(
    queue.getByRole('button', { name: 'Refresh', exact: true, includeHidden: true })
  ).toBeDisabled();
  release();
  await expect(decline).not.toBeVisible();
  await expect(queue).toContainText('result');
  await expect(
    navigation.getByRole('button', { name: 'Previous', exact: true, includeHidden: true })
  ).toBeDisabled();
  await expect(
    navigation.getByRole('button', { name: 'Next', exact: true, includeHidden: true })
  ).toBeDisabled();
  await expect(queue.getByRole('button', { name: 'Approve', exact: true }).first()).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await queue.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    navigation.getByRole('button', { name: 'Next', exact: true, includeHidden: true })
  ).toBeEnabled();
  await expect(navigation).toContainText('page 1 of 20');
  expect(state.writes).toHaveLength(1);
});

test('embedded source version refresh and 403 close the original decision without dispatch', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/workplace/admin/policies');
  const queue = page.getByTestId('policy-room-approval-queue');
  await queue
    .locator('[data-room-booking-id]')
    .first()
    .getByRole('button', { name: 'Approve', exact: true })
    .click();
  const approval = page.getByRole('dialog', { name: 'Approve this booking?', exact: true });
  await approval
    .getByRole('textbox', { name: /^Operator note/u })
    .fill('Previous-version reason must be discarded');
  state.pending[0].version += 1;
  await queue
    .getByRole('button', { name: 'Refresh', exact: true, includeHidden: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(approval).not.toBeVisible();
  await expect(
    queue
      .locator('[data-room-booking-id]')
      .first()
      .getByRole('button', { name: 'Approve', exact: true })
  ).toBeEnabled();
  await queue
    .locator('[data-room-booking-id]')
    .first()
    .getByRole('button', { name: 'Approve', exact: true })
    .click();
  await expect(approval.getByRole('textbox', { name: /^Operator note/u })).toHaveValue('');
  await approval
    .getByRole('textbox', { name: /^Operator note/u })
    .fill('Revoked-source reason must not dispatch');
  state.denied = true;
  const readsBefore = state.pendingReads;
  await queue
    .getByRole('button', { name: 'Refresh', exact: true, includeHidden: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect.poll(() => state.pendingReads).toBeGreaterThan(readsBefore);
  await expect(approval).not.toBeVisible();
  await expect(queue.locator('[data-room-booking-id]')).toHaveCount(0);
  await expect(
    queue.getByRole('navigation', { name: 'Approval queue pages', includeHidden: true })
  ).not.toBeAttached();
  await expect(queue.getByRole('button', { name: 'Approve', exact: true })).not.toBeAttached();
  expect(state.writes).toHaveLength(0);
});

test('standalone Rooms operations keeps its full native queue and VIEW-only embedded pages remain readable', async ({
  page,
}) => {
  await setup(page, { readOnly: true });
  await page.goto('/workplace/admin/policies');
  const queue = page.getByTestId('policy-room-approval-queue');
  await expect(queue.locator('[data-room-booking-id]')).toHaveCount(5);
  await queue.getByRole('button', { name: 'Next', exact: true, includeHidden: true }).click();
  await expect(queue.getByText(bookings[5].eventTitle, { exact: true })).toBeVisible();
  await expect(queue.getByRole('button', { name: 'Approve', exact: true })).not.toBeAttached();
  await page.goto('/workplace/admin/meeting-operations');
  await expect(page.getByText(bookings[0].eventTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(bookings[99].eventTitle, { exact: true })).toBeAttached();
  await expect(
    page.getByRole('navigation', { name: 'Approval queue pages', includeHidden: true })
  ).not.toBeAttached();
  await expect(page.getByRole('heading', { name: 'Room health', exact: true })).toBeVisible();
});
