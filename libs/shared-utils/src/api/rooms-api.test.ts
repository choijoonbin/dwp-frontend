import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { cancelRoomBooking, getRoomAvailability, getRoomsAdminOverview } from './rooms-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

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

  it('cancels a booking without crossing into the Calendar app API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cancelRoomBooking('event-1', 8)).resolves.toBeUndefined();

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/rooms/bookings/event-1/cancel');
    expect(JSON.parse(String(request.body))).toEqual({ version: 8 });
  });
});
