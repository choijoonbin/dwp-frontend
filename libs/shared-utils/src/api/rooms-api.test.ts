import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  cancelRoomBooking,
  createRoomBooking,
  getRoomAvailability,
  getRoomsAdminOverview,
  getRoomsPolicy,
  respondToRoomBooking,
  updateRoomBooking,
} from './rooms-api';

import type { CreateCalendarEventInput } from './calendar-api';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function roomActionAuthority(
  expectedDecisionRevision: string
): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision,
    contextKey: 'workplace-work',
    contextScopeKey: 'scope-workplace',
  };
}

const createInput = {
  title: 'Contract verification',
  type: 'MEETING',
  startsAt: '2026-10-28T01:00:00Z',
  endsAt: '2026-10-28T01:30:00Z',
  timeZone: 'Asia/Seoul',
  allDay: false,
  visibility: 'DEFAULT',
  recurrence: 'NONE',
  recurrenceInterval: 1,
  responseRequired: false,
  attendees: [],
  resourceId: 'room-1',
  idempotencyKey: 'room-contract-verification',
} satisfies CreateCalendarEventInput;

describe('rooms API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads privacy-safe occupancy through the Rooms Gateway boundary', async () => {
    const availability = {
      rooms: [],
      occupancy: [
        {
          resourceId: 'room-1',
          startsAt: '2026-08-19T00:00:00Z',
          endsAt: '2026-08-19T01:00:00Z',
          bookingStatus: 'CONFIRMED',
        },
      ],
      generatedAt: '2026-08-19T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(availability));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getRoomAvailability('2026-08-19T00:00:00Z', '2026-08-20T00:00:00Z')
    ).resolves.toEqual(availability);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/rooms/availability?from=2026-08-19T00%3A00%3A00Z&to=2026-08-20T00%3A00%3A00Z',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    expect(JSON.stringify(availability.occupancy)).not.toContain('title');
  });

  it('uses the dedicated Rooms admin boundary', async () => {
    const overview = { resources: [], bookingsThisWeek: 0 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(overview));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getRoomsAdminOverview()).resolves.toEqual(overview);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/admin/rooms/overview',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('loads the tenant room policy through the member-safe Rooms boundary', async () => {
    const policy = { workingDayStart: '08:00:00', workingDayEnd: '20:00:00' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(policy));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getRoomsPolicy()).resolves.toEqual(policy);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/rooms/policy',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('forwards each exact action decision revision and scope through the Rooms boundary', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValue(jsonResponse({ eventId: 'event-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await createRoomBooking(createInput, roomActionAuthority('revision-create'));
    await updateRoomBooking(
      'event-1',
      { ...createInput, idempotencyKey: undefined, version: 7 },
      roomActionAuthority('revision-update')
    );
    await respondToRoomBooking('event-1', 'ACCEPTED', roomActionAuthority('revision-response'));
    await expect(
      cancelRoomBooking('event-1', 8, roomActionAuthority('revision-cancel'))
    ).resolves.toBeUndefined();

    const actionRequests = fetchMock.mock.calls.slice(1).map(([url, init]) => ({
      url,
      init: init as RequestInit,
    }));
    expect(actionRequests.map(({ url }) => url)).toEqual([
      '/api/platform/v1/rooms/bookings?contextScopeKey=scope-workplace',
      '/api/platform/v1/rooms/bookings/event-1?contextScopeKey=scope-workplace',
      '/api/platform/v1/rooms/bookings/event-1/response?contextScopeKey=scope-workplace',
      '/api/platform/v1/rooms/bookings/event-1/cancel?contextScopeKey=scope-workplace',
    ]);
    expect(
      actionRequests.map(
        ({ init }) => (init.headers as Record<string, string>)['X-DWP-Expected-Decision-Revision']
      )
    ).toEqual(['revision-create', 'revision-update', 'revision-response', 'revision-cancel']);

    expect(JSON.parse(String(actionRequests[3]?.init.body))).toEqual({ version: 8 });
  });
});
