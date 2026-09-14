import { expect, test } from '@playwright/test';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import type { Page } from '@playwright/test';
import type { WorkplaceResource } from '@dwp-frontend/shared-utils';

const siteId = '10000000-0000-0000-0000-000000000001';
const floorId = '20000000-0000-0000-0000-000000000001';
const deskId = '30000000-0000-0000-0000-000000000001';
const roomId = '30000000-0000-0000-0000-000000000002';
const closureId = '60000000-0000-0000-0000-000000000001';
const calendarId = '70000000-0000-0000-0000-000000000001';
const site = {
  siteId,
  code: 'QA',
  name: 'QA site',
  nameKo: 'QA 사이트',
  nameEn: 'QA site',
  type: 'HEADQUARTERS',
  timeZone: 'Asia/Seoul',
  state: 'ACTIVE',
  configuredFloorCount: 1,
  resourceCount: 2,
  version: 1,
};
const floor = {
  floorId,
  siteId,
  siteName: site.name,
  floorNumber: 1,
  name: 'QA floor',
  nameKo: 'QA 층',
  nameEn: 'QA floor',
  planWidth: 1200,
  planHeight: 800,
  backgroundAssetPath: null,
  resourceCount: 2,
  state: 'ACTIVE',
  version: 1,
};
const desk = {
  resourceId: deskId,
  siteId,
  floorId,
  code: 'QA-DESK',
  name: 'QA desk',
  nameKo: 'QA 좌석',
  nameEn: 'QA desk',
  type: 'DESK',
  capacity: 1,
  features: [],
  neighborhood: null,
  assignedUserId: null,
  calendarResourceId: null,
  approvalRequired: false,
  accessible: true,
  mode: 'RESERVABLE',
  positionX: 12,
  positionY: 20,
  widthPercent: 8,
  heightPercent: 6,
  rotationDegrees: 0,
  assignedToCurrentUser: false,
  assignedPersonPublicId: null,
  assignedDisplayName: null,
  state: 'AVAILABLE',
  version: 1,
} satisfies WorkplaceResource;
const room = {
  ...desk,
  resourceId: roomId,
  code: 'QA-ROOM',
  name: 'QA room',
  nameEn: 'QA room',
  type: 'ROOM',
  capacity: 6,
  calendarResourceId: calendarId,
} satisfies WorkplaceResource;
const generatedAt = '2026-09-14T02:00:00Z';
const metadata = {
  generatedAt,
  sourceUpdatedAt: generatedAt,
  availability: 'AVAILABLE',
  owner: 'WP_BOOKINGS',
  denominatorBasis: 'current roster resource minutes',
  historicalRosterAvailable: false,
  recurringOccurrencesIncluded: true,
};
const selectedClosure = {
  closureId,
  resourceId: deskId,
  siteId,
  floorId,
  resourceName: desk.name,
  timeZone: site.timeZone,
  startsAt: '2026-10-01T00:00:00Z',
  endsAt: '2026-10-02T00:00:00Z',
  status: 'ACTIVE',
  reason: 'Fixture selected maintenance interval',
  cancellationReason: null,
  resourceVersionAtCreate: 1,
  version: 0,
  createdAt: generatedAt,
  updatedAt: generatedAt,
  affectedBookingsPath: '',
};
const nativePage = <T>(content: T[], page = 0, totalElements = content.length) => ({
  content,
  page,
  size: 20,
  totalElements,
  totalPages: Math.ceil(totalElements / 20),
  generatedAt,
});
const deskBookings = Array.from({ length: 21 }, (_, index) => ({
  bookingId: `40000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  resourceId: deskId,
  siteId,
  floorId,
  resourceName: `Affected desk booking ${String(index + 1).padStart(2, '0')}`,
  resourceType: 'DESK',
  floorName: floor.name,
  status: 'RESERVED',
  startsAt: '2026-10-01T01:00:00Z',
  endsAt: '2026-10-01T02:00:00Z',
  checkedInAt: null,
  releasedAt: null,
  legalHold: false,
  version: 1,
  updatedAt: generatedAt,
  detailHref: '/workplace/admin/operations',
  exceptionReasons: [],
}));
const roomBookings = Array.from({ length: 21 }, (_, index) => ({
  bookingId: `80000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  eventId: `90000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  calendarResourceId: calendarId,
  startsAt: index === 20 ? '2026-10-01T04:45:00Z' : '2026-10-01T01:00:00Z',
  endsAt: index === 20 ? '2026-10-01T05:45:00Z' : '2026-10-01T02:00:00Z',
  status: 'CONFIRMED',
  version: 1,
  owner: 'ROOMS_CALENDAR',
}));
type ImpactRead = {
  resourceId: string;
  kind: 'WP' | 'ROOMS';
  page: number;
  size: number;
  from: string | null;
  to: string | null;
  siteId: string | null;
};

async function setup(page: Page, allowClosureCreation = false) {
  await isolateWorkplaceDevelopmentUpdates(page);
  await mockShellSession(page, ['TENANT_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  const reads: ImpactRead[] = [];
  const writes: string[] = [];
  const creates: { body: Record<string, unknown>; key: string | undefined }[] = [];
  await page.route('**/api/platform/v1/admin/workplace/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== 'GET') {
      writes.push(path);
      if (
        allowClosureCreation &&
        request.method() === 'POST' &&
        path.endsWith(`/resources/${deskId}/closures`)
      ) {
        const body = request.postDataJSON() as Record<string, unknown>;
        creates.push({ body, key: request.headers()['idempotency-key'] });
        return fulfillSuccess(route, { ...selectedClosure, ...body });
      }
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'This review must not issue a mutation.' }),
      });
    }
    if (path.endsWith('/sites')) return fulfillSuccess(route, [site]);
    if (path.endsWith('/floors')) return fulfillSuccess(route, [floor]);
    if (path.endsWith('/resources')) return fulfillSuccess(route, [desk, room]);
    if (path.endsWith('/governance/delegated-admin-scopes/effective'))
      return fulfillSuccess(route, []);
    if (path.endsWith('/future-booking-impact') || path.endsWith('/room-booking-impact')) {
      const params = url.searchParams;
      const kind = path.endsWith('/room-booking-impact') ? 'ROOMS' : 'WP';
      const read = {
        resourceId: path.split('/').at(-2)!,
        kind,
        page: Number(params.get('page')),
        size: Number(params.get('size')),
        from: params.get('from'),
        to: params.get('to'),
        siteId: params.get('siteId'),
      } satisfies ImpactRead;
      reads.push(read);
      const start = read.page * read.size;
      if (kind === 'ROOMS')
        return fulfillSuccess(route, {
          ...nativePage(roomBookings.slice(start, start + read.size), read.page, 21),
          resourceId: roomId,
          calendarResourceId: calendarId,
          siteId,
          startsAt: read.from,
          endsAt: read.to,
          source: 'ROOMS_CALENDAR',
          availability: 'AVAILABLE',
          owner: 'ROOMS_CALENDAR',
          existingBookingsMutated: false,
        });
      return fulfillSuccess(route, {
        resourceId: deskId,
        siteId,
        resourceName: desk.name,
        owner: 'WP_BOOKINGS',
        resourceState: 'AVAILABLE',
        from: read.from,
        to: read.to,
        metadata,
        affectedBookings: nativePage(deskBookings.slice(start, start + read.size), read.page, 21),
        mutatesBookings: false,
        notificationScheduled: false,
        replacementScheduled: false,
      });
    }
    if (path.endsWith('/experience/facilities/closures'))
      return fulfillSuccess(
        route,
        nativePage(url.searchParams.get('resourceId') === deskId ? [selectedClosure] : [])
      );
    if (path.endsWith(`/experience/facilities/closures/${closureId}`))
      return fulfillSuccess(route, selectedClosure);
    if (path.endsWith('/experience/facilities/requests'))
      return fulfillSuccess(route, nativePage([]));
    if (path.endsWith('/photo') || path.endsWith('/photo/metadata'))
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NOT_FOUND', message: 'No registered photo' }),
      });
    return route.fallback();
  });
  return { reads, writes, creates };
}
const acknowledgement = 'I have reviewed the current values, proposed values and known impact.';
async function selectSpace(page: Page, name: string) {
  await page
    .getByRole('region', { name: 'Spaces to work on', exact: true })
    .getByRole('button', { name: new RegExp(name, 'u') })
    .click();
}

test('closure impact paginates native WP and Rooms owners and resets review on page, interval and resource changes', async ({
  page,
}, testInfo) => {
  const state = await setup(page);
  await page.clock.install({ time: new Date('2026-09-14T02:00:00Z') });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/workplace/admin/operations?view=facilities');
  await selectSpace(page, desk.name);
  const panel = page.getByRole('region', { name: 'Scheduled space closure', exact: true });
  const nav = panel.getByRole('navigation', { name: 'Future booking impact', exact: true });
  const check = panel.getByRole('checkbox', { name: acknowledgement });
  const schedule = panel.getByRole('button', { name: 'Schedule closure', exact: true });
  const latest = (kind: ImpactRead['kind']) =>
    state.reads.filter((read) => read.kind === kind).at(-1);
  await expect(panel.getByText('21 affected bookings', { exact: true })).toBeVisible();
  await expect(panel.getByText(/^Affected desk booking /u)).toHaveCount(20);
  await expect
    .poll(() => latest('WP'))
    .toMatchObject({ resourceId: deskId, siteId, page: 0, size: 20 });
  const initialInterval = { from: latest('WP')!.from, to: latest('WP')!.to };
  await expect(nav.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await panel
    .getByRole('textbox', { name: 'Closure reason', exact: true })
    .fill('Reviewed maintenance');
  await check.check();
  await expect(schedule).toBeEnabled();
  await nav.getByRole('button', { name: 'Next', exact: true }).click();
  await expect
    .poll(() => latest('WP'))
    .toMatchObject({ resourceId: deskId, siteId, page: 1, size: 20, ...initialInterval });
  await expect(panel.getByText(/^Affected desk booking /u)).toHaveCount(1);
  await expect(panel.getByText(/^Affected desk booking 21 ·/u)).toBeVisible();
  await expect(check).not.toBeChecked();
  await expect(check).toBeEnabled();
  await expect(schedule).toBeDisabled();
  await expect(nav.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await check.check();
  await expect(schedule).toBeEnabled();
  // Expire the cached first page so Previous also proves the native page=0 request.
  await page.clock.fastForward(31_000);
  await nav.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(panel.getByText(/^Affected desk booking /u)).toHaveCount(20);
  await expect.poll(() => latest('WP')).toMatchObject({ page: 0, size: 20, ...initialInterval });
  await expect(check).not.toBeChecked();
  await nav.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(panel.getByText(/^Affected desk booking /u)).toHaveCount(1);
  await check.check();
  await panel.getByRole('button', { name: /Fixture selected maintenance interval/u }).click();
  await expect
    .poll(() => latest('WP'))
    .toMatchObject({
      page: 0,
      size: 20,
      from: selectedClosure.startsAt,
      to: selectedClosure.endsAt,
    });
  await expect(panel.getByText(/^Affected desk booking /u)).toHaveCount(20);
  await expect(check).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Cancel closure', exact: true })).toBeDisabled();
  await nav.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(panel.getByText(/^Affected desk booking /u)).toHaveCount(1);
  await selectSpace(page, room.name);
  await expect
    .poll(() => latest('ROOMS'))
    .toMatchObject({ resourceId: roomId, siteId, page: 0, size: 20 });
  const roomRows = panel.getByText(/ · CONFIRMED$/u);
  await expect(roomRows).toHaveCount(20);
  await expect(panel.getByText(/^Affected desk booking /u)).toHaveCount(0);
  await expect(check).not.toBeChecked();
  await panel
    .getByRole('textbox', { name: 'Closure reason', exact: true })
    .fill('Reviewed room maintenance');
  await check.check();
  await expect(schedule).toBeEnabled();
  await nav.getByRole('button', { name: 'Next', exact: true }).click();
  await expect
    .poll(() => latest('ROOMS'))
    .toMatchObject({ resourceId: roomId, siteId, page: 1, size: 20 });
  await expect(roomRows).toHaveCount(1);
  await expect(roomRows).toContainText('1:45 PM');
  await expect(check).not.toBeChecked();
  await expect(schedule).toBeDisabled();
  await page.clock.fastForward(31_000);
  await nav.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(roomRows).toHaveCount(20);
  await expect.poll(() => latest('ROOMS')).toMatchObject({ page: 0, size: 20 });
  expect(state.writes).toEqual([]);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath('closure-impact-pagination-room-1280.png'),
    fullPage: true,
  });
});

test('same-tick closure scheduling dispatches one confirmed native command and idempotency key', async ({
  page,
}) => {
  const state = await setup(page, true);
  await page.goto('/workplace/admin/operations?view=facilities');
  await selectSpace(page, desk.name);
  const panel = page.getByRole('region', { name: 'Scheduled space closure', exact: true });
  const reason = panel.getByRole('textbox', { name: 'Closure reason', exact: true });
  await reason.fill('One reviewed maintenance command');
  await panel.getByRole('checkbox', { name: acknowledgement }).check();
  const schedule = panel.getByRole('button', { name: 'Schedule closure', exact: true });
  await expect(schedule).toBeEnabled();
  const issuedInterval = state.reads.at(-1)!;
  await schedule.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await expect(reason).toHaveValue('');
  expect(state.creates).toHaveLength(1);
  expect(state.writes).toEqual([
    `/api/platform/v1/admin/workplace/experience/facilities/resources/${deskId}/closures`,
  ]);
  expect(state.creates[0]?.body).toEqual({
    startsAt: issuedInterval.from,
    endsAt: issuedInterval.to,
    version: 1,
    reason: 'One reviewed maintenance command',
    confirmed: true,
  });
  expect(state.creates[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
  await expect(schedule).toBeDisabled();
});
