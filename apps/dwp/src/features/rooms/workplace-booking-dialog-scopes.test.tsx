// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkplaceBookingDialog } from './workplace-booking-dialog';
import type {
  WorkplaceBooking,
  WorkplacePolicy,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  close: vi.fn(),
  saved: vi.fn(),
  success: vi.fn(),
  canCreate: true,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));
vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({ canCreateWorkplaceBooking: mocks.canCreate }),
}));
vi.mock('@dwp-frontend/shared-utils', () => ({
  useAuth: () => ({ user: { tenantId: 1, userId: 7 } }),
  useToast: () => ({ success: mocks.success }),
  createWorkplaceBooking: mocks.create,
  createWorkplaceIdempotencyKey: () => 'native-booking-intent-key',
  HttpError: class extends Error {
    status = 503;
  },
}));
const resource: WorkplaceResource = {
  resourceId: 'resource-1',
  floorId: 'floor-1',
  siteId: 'site-1',
  calendarResourceId: null,
  code: 'D-1',
  name: 'Actual desk',
  nameKo: '실제 좌석',
  nameEn: 'Actual desk',
  type: 'DESK',
  mode: 'RESERVABLE',
  state: 'AVAILABLE',
  neighborhood: '',
  capacity: 1,
  features: [],
  accessible: true,
  approvalRequired: false,
  positionX: 0,
  positionY: 0,
  widthPercent: 10,
  heightPercent: 10,
  rotationDegrees: 0,
  assignedToCurrentUser: false,
  assignedUserId: null,
  assignedPersonPublicId: null,
  assignedDisplayName: null,
  version: 3,
};
const policy: WorkplacePolicy = {
  bookingWindowDays: 30,
  maximumActiveBookings: 10,
  minimumBookingMinutes: 30,
  maximumBookingMinutes: 480,
  maximumConsecutiveDays: 5,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  allowRecurring: false,
  requireCheckIn: true,
  checkInLeadMinutes: 30,
  autoReleaseMinutes: 15,
  allowAssignedDeskLending: false,
  showColleagueNames: false,
  bookingRetentionDays: 365,
  version: 2,
};
const confirmed: WorkplaceBooking = {
  bookingId: 'server-confirmed-booking',
  resourceId: resource.resourceId,
  resourceName: resource.name,
  resourceType: 'DESK',
  siteName: 'Actual site',
  floorName: 'Actual floor',
  purpose: '',
  startsAt: '2026-08-19T00:30:00Z',
  endsAt: '2026-08-19T01:30:00Z',
  status: 'RESERVED',
  visibleToColleagues: true,
  checkedInAt: null,
  releasedAt: null,
  canCheckIn: false,
  canCancel: true,
  canRelease: false,
  checkInOpensAt: '2026-08-19T00:00:00Z',
  checkInClosesAt: '2026-08-19T00:45:00Z',
  version: 1,
};
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
async function render(open: boolean, target = resource) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkplaceBookingDialog
          open={open}
          resource={target}
          siteName="Actual site"
          floorName="Actual floor"
          siteTimeZone="Asia/Seoul"
          serverNow="2026-08-19T00:00:00Z"
          initialStart={confirmed.startsAt}
          initialEnd={confirmed.endsAt}
          policy={policy}
          sourceSnapshot={{
            identityKey: '1:7',
            resourceId: target.resourceId,
            resourceVersion: target.version,
            rangeFrom: confirmed.startsAt,
            rangeTo: confirmed.endsAt,
            generatedAt: '2026-08-19T00:00:00Z',
            policyVersion: policy.version,
          }}
          onClose={mocks.close}
          onSaved={mocks.saved}
        />
      </QueryClientProvider>
    )
  );
  await flush();
}
async function submit() {
  const button = Array.from(document.querySelectorAll('button')).find(
    (item) =>
      item.textContent === 'actions.book' ||
      item.textContent === 'workplace.experience.sameRequestRetry'
  );
  if (!button) throw new Error('Book action is unavailable');
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  await flush();
}
async function pending() {
  let complete!: (booking: WorkplaceBooking) => void;
  let fail!: (error: Error) => void;
  mocks.create.mockImplementationOnce(
    () =>
      new Promise<WorkplaceBooking>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      })
  );
  await render(true);
  await submit();
  expect(mocks.create).toHaveBeenCalledTimes(1);
  return { complete, fail };
}
beforeEach(() => {
  mocks.canCreate = true;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  client.clear();
  vi.clearAllMocks();
});

describe('native booking completion scope', () => {
  it('ignores the old result after the same actor selects a different target', async () => {
    const { complete } = await pending();
    await render(true, { ...resource, resourceId: 'resource-2', name: 'Next actual desk' });
    await act(async () => complete(confirmed));
    await flush();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('ignores the old result after closing and reopening the same target', async () => {
    const { complete } = await pending();
    await render(false);
    await render(true);
    await act(async () => complete(confirmed));
    await flush();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
  });
  it('ignores a delayed result after create permission is revoked and restored for the same actor and target', async () => {
    const { complete } = await pending();
    mocks.canCreate = false;
    await render(true);
    mocks.canCreate = true;
    await render(true);
    await act(async () => complete(confirmed));
    await flush();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('passes only the confirmed actual booking to owner navigation before refreshing its source', async () => {
    const { complete } = await pending();
    let refresh!: () => void;
    vi.spyOn(client, 'invalidateQueries').mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          refresh = resolve;
        })
    );
    await act(async () => complete(confirmed));
    await flush();
    expect(mocks.saved).toHaveBeenCalledExactlyOnceWith(confirmed);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    await render(false);
    await act(async () => refresh());
    await flush();
    expect(mocks.saved).toHaveBeenCalledTimes(1);
  });
  it('does not navigate or automatically resubmit an unknown outcome and keeps the exact intent key', async () => {
    const { fail } = await pending();
    await act(async () => fail(new Error('Unknown server outcome')));
    await flush();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    mocks.create.mockResolvedValueOnce(confirmed);
    await submit();
    await flush();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[1][1]).toBe(mocks.create.mock.calls[0][1]);
    expect(mocks.saved).toHaveBeenCalledExactlyOnceWith(confirmed);
  });
  it('locks an unknown intent and retains its exact input and key after closing and reopening the same target', async () => {
    const { fail } = await pending();
    const issued = mocks.create.mock.calls[0];
    await act(async () => fail(new Error('Unknown server result')));
    await flush();
    const purpose = document.querySelector<HTMLInputElement>('input[maxlength="500"]');
    expect(purpose?.disabled).toBe(true);
    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);
    await render(false);
    await render(true);
    expect(document.querySelector<HTMLInputElement>('input[maxlength="500"]')?.disabled).toBe(true);
    mocks.create.mockResolvedValueOnce(confirmed);
    await submit();
    expect(mocks.create.mock.calls[1]).toEqual(issued);
    expect(mocks.saved).toHaveBeenCalledExactlyOnceWith(confirmed);
  });
  it('freezes one native intent when the confirmation is invoked twice in the same tick', async () => {
    let complete!: (booking: WorkplaceBooking) => void;
    mocks.create.mockImplementationOnce(
      () =>
        new Promise<WorkplaceBooking>((resolve) => {
          complete = resolve;
        })
    );
    await render(true);
    const button = Array.from(document.querySelectorAll('button')).find(
      (item) => item.textContent === 'actions.book'
    );
    expect(button).toBeDefined();
    await act(async () => {
      button?.click();
      button?.click();
    });
    await flush();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await act(async () => complete(confirmed));
  });
});
