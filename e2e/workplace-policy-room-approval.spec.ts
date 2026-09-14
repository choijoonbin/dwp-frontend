import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CalendarBooking, CalendarPolicy, CalendarResource } from '@dwp-frontend/shared-utils';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
const metadata = { generatedAt: '2026-09-14T03:00:00Z' };
const initialPolicy = {
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
const initialRoom = {
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
const roomPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 240,
  maximumAdvanceDays: 30,
  defaultBufferMinutes: 10,
  weeklyFocusTargetMinutes: 300,
  dailyMeetingLimitMinutes: 240,
  enforceMeetingAgenda: true,
  allowExternalAttendees: false,
  version: 2,
} satisfies CalendarPolicy;
const initialRoomBooking = {
  bookingId: '92000000-0000-0000-0000-000000000001',
  eventId: '93000000-0000-0000-0000-000000000001',
  resourceId: initialRoom.resourceId,
  resourceName: initialRoom.name,
  eventTitle: 'Native approval test meeting',
  startsAt: '2026-09-18T05:00:00Z',
  endsAt: '2026-09-18T08:30:00Z',
  organizerName: 'Tenant Admin',
  organizerEmail: 'tenant-admin@example.test',
  status: 'PENDING',
  requestedBy: 900018,
  version: 4,
} satisfies CalendarBooking;
async function setup(page: Page, options: { roomReadOnly?: boolean } = {}) {
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: options.roomReadOnly
      ? FULL_PRODUCT_PERMISSIONS.filter(
          (item) => item.resourceKey !== 'ADMIN.ROOMS' || item.permissionCode === 'VIEW'
        )
      : FULL_PRODUCT_PERMISSIONS,
  });
  const state = {
    room: { ...initialRoom } as CalendarResource,
    pendingRooms: [{ ...initialRoomBooking }] as CalendarBooking[],
    createdRooms: [] as CalendarResource[],
    roomFailure: false,
    roomGate: null as Promise<void> | null,
    writes: [] as { path: string; body: Record<string, unknown>; key: string | undefined }[],
  };
  await page.route('**/api/platform/v1/admin/rooms/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/overview'))
      return fulfillSuccess(route, {
        activeResources: 1,
        resourcesInMaintenance: 0,
        bookingsThisWeek: 1,
        pendingBookings: state.pendingRooms.length,
        eventsThisWeek: 1,
        conflictedUsers: 0,
        policy: roomPolicy,
        resources: [state.room, ...state.createdRooms],
        generatedAt: metadata.generatedAt,
      });
    if (path.endsWith('/bookings/pending')) return fulfillSuccess(route, state.pendingRooms);
    if (
      (path.includes('/resources/') && request.method() === 'PUT') ||
      (path.endsWith('/resources') && request.method() === 'POST')
    ) {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: undefined });
      if (state.roomGate) await state.roomGate;
      if (state.roomFailure)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Fixture: native resource outcome unavailable',
            code: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
          }),
        });
      if (request.method() === 'POST') {
        const created = {
          ...state.room,
          ...body,
          resourceId: '91000000-0000-0000-0000-000000000002',
          name: body.nameEn,
          version: 0,
        };
        state.createdRooms.push(created);
        return fulfillSuccess(route, created);
      }
      state.room = { ...state.room, ...body, version: state.room.version + 1 };
      return fulfillSuccess(route, state.room);
    }
    if (path.endsWith('/decision') && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ path, body, key: undefined });
      const decided = {
        ...initialRoomBooking,
        status: body.decision === 'APPROVE' ? 'CONFIRMED' : 'DECLINED',
        decisionNote: body.note,
        version: 5,
      };
      state.pendingRooms = [];
      return fulfillSuccess(route, decided);
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/admin/workplace/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/policy')) return fulfillSuccess(route, initialPolicy);
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

test('native Rooms approval queue and per-room configuration use actual owner commands and versions', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/workplace/admin/policies');
  await expect(page.getByText(initialRoomBooking.eventTitle, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const approval = page.getByRole('dialog', { name: 'Approve this booking?', exact: true });
  await expect(approval.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await approval
    .getByRole('textbox', { name: /^Operator note/u })
    .fill('Native operator approval reason');
  await approval.getByRole('button', { name: 'Approve', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(approval).not.toBeVisible();
  await expect(page.getByText(initialRoomBooking.eventTitle, { exact: true })).not.toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    path: `/api/platform/v1/admin/rooms/bookings/${initialRoomBooking.bookingId}/decision`,
    body: { decision: 'APPROVE', note: 'Native operator approval reason', version: 4 },
  });
  await page.getByRole('button', { name: 'Meeting approval workflow', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Room approval rules', exact: true });
  await settings.getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit room', exact: true });
  await expect(edit.getByText('Version: 3', { exact: true })).toBeVisible();
  await edit.getByRole('combobox', { name: /^Require operator approval for bookings/u }).click();
  await page.getByRole('option', { name: 'Disabled', exact: true }).click();
  await edit.getByRole('textbox', { name: /^Time zone/u }).fill('Not/A_Real_Zone');
  await edit.getByRole('checkbox').check();
  await expect(edit.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await edit.getByRole('textbox', { name: /^Time zone/u }).fill('Asia/Seoul');
  await edit.getByRole('checkbox').check();
  await edit.getByRole('button', { name: 'Save', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(edit).not.toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toMatchObject({
    path: `/api/platform/v1/admin/rooms/resources/${initialRoom.resourceId}`,
    body: {
      code: initialRoom.code,
      nameKo: initialRoom.nameKo,
      nameEn: initialRoom.nameEn,
      type: 'ROOM',
      site: initialRoom.site,
      floor: initialRoom.floor,
      capacity: 18,
      features: ['VIDEO'],
      timeZone: 'Asia/Seoul',
      state: 'AVAILABLE',
      approvalRequired: false,
      version: 3,
    },
  });
  await expect(
    settings.getByText('Require operator approval for bookings: Disabled', { exact: true })
  ).toBeVisible();
});

test('native Rooms registration supports real editing and a lost result requires original recheck', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/workplace/admin/policies');
  await page.getByRole('button', { name: 'Meeting approval workflow', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Room approval rules', exact: true });
  await settings.getByRole('button', { name: 'Add room', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add room', exact: true });
  await add.getByRole('textbox', { name: /^Resource code/u }).fill('QA-NATIVE-NEW');
  await add.getByRole('textbox', { name: /^Site/u }).fill('Native meeting test site');
  await add.getByRole('textbox', { name: /^Korean name/u }).fill('신규 승인 테스트 회의실');
  await add.getByRole('textbox', { name: /^English name/u }).fill('New native approval test room');
  await add.getByRole('spinbutton', { name: /^Capacity/u }).fill('10');
  await add.getByRole('textbox', { name: /^Time zone/u }).fill('Asia/Seoul');
  await add.getByRole('checkbox').check();
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(add).not.toBeVisible();
  expect(state.writes[0]).toMatchObject({
    path: '/api/platform/v1/admin/rooms/resources',
    body: {
      code: 'QA-NATIVE-NEW',
      nameEn: 'New native approval test room',
      type: 'ROOM',
      capacity: 10,
      version: null,
    },
  });
  await expect(settings.getByText('New native approval test room', { exact: true })).toBeVisible();
  await settings.getByRole('button', { name: 'Edit', exact: true }).first().click();
  const edit = page.getByRole('dialog', { name: 'Edit room', exact: true });
  await edit.getByRole('spinbutton', { name: /^Capacity/u }).fill('20');
  for (const width of [1440, 1280, 390, 320, 640]) {
    await stableViewport(page, width);
    await edit.locator('.MuiDialogContent-root').evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(edit.getByRole('region', { name: 'Current values', exact: true })).toBeVisible();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({
      path: `/tmp/workplace-native-room-draft-${width}.png`,
      fullPage: false,
    });
  }
  await edit.getByRole('checkbox').check();
  state.roomFailure = true;
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    edit.getByRole('button', { name: 'Reload current values', exact: true })
  ).toBeVisible();
  await expect(edit.getByRole('spinbutton', { name: /^Capacity/u })).toBeDisabled();
  await expect(edit.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(2);
  state.roomFailure = false;
  await edit.getByRole('button', { name: 'Reload current values', exact: true }).click();
  await expect(edit.getByRole('spinbutton', { name: /^Capacity/u })).toBeEnabled();
  await expect(edit.getByRole('spinbutton', { name: /^Capacity/u })).toHaveValue('20');
  await expect(edit.getByRole('checkbox')).not.toBeChecked();
  await edit.getByRole('checkbox').check();
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(edit).not.toBeVisible();
  expect(state.writes).toHaveLength(3);
  expect(state.writes[2]?.body).toMatchObject({ capacity: 20, version: 3 });
  for (const width of [1440, 1280, 390, 320, 640]) {
    await stableViewport(page, width);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/workplace-native-approval-settings-${width}.png`,
      fullPage: true,
    });
  }
  const axe = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    axe.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? '')),
    JSON.stringify(axe.violations)
  ).toEqual([]);
});

test('native Rooms VIEW renders actual approvals and configuration while hiding unavailable commands', async ({
  page,
}) => {
  await setup(page, { roomReadOnly: true });
  await page.goto('/workplace/admin/policies');
  await expect(page.getByText(initialRoomBooking.eventTitle, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Decline', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Meeting approval workflow', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Room approval rules', exact: true });
  await expect(settings.getByText(initialRoom.name, { exact: true })).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Edit', exact: true })).not.toBeVisible();
  await expect(settings.getByRole('button', { name: 'Add room', exact: true })).not.toBeVisible();
});

test('native Rooms UNKNOWN registration stays blocked after reopen and cannot be inferred from a list', async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto('/workplace/admin/policies');
  const settings = page.getByRole('region', { name: 'Room approval rules', exact: true });
  await settings.getByRole('button', { name: 'Add room', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add room', exact: true });
  await add.getByRole('textbox', { name: /^Resource code/u }).fill('QA-LOST-NEW');
  await add.getByRole('textbox', { name: /^Site/u }).fill('Native meeting test site');
  await add.getByRole('textbox', { name: /^Korean name/u }).fill('결과 미확인 회의실');
  await add.getByRole('textbox', { name: /^English name/u }).fill('Lost result native test room');
  await add.getByRole('checkbox').check();
  state.roomFailure = true;
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    add.getByRole('button', { name: 'Reload current values', exact: true })
  ).toBeVisible();
  await add.getByRole('button', { name: 'Cancel', exact: true }).click();
  await settings.getByRole('button', { name: 'Add room', exact: true }).click();
  await expect(add.getByRole('textbox', { name: /^Resource code/u })).toBeDisabled();
  state.roomFailure = false;
  await add.getByRole('button', { name: 'Reload current values', exact: true }).click();
  await expect(add.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(add.getByRole('checkbox')).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
