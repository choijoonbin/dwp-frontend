import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createWorkplaceBooking,
  createWorkplaceReleaseWindow,
  getWorkplaceExplore,
  relocateWorkplaceBooking,
  saveWorkplaceLayout,
  updateWorkplaceBookingLegalHold,
} from './workplace-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('Workplace API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads a floor map only through the Gateway Workplace boundary', async () => {
    const response = { sites: [], floors: [], resources: [], occupancy: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceExplore('2026-08-19T00:00:00Z', '2026-08-19T01:00:00Z', 'floor/12');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/workplace/explore?from=2026-08-19T00%3A00%3A00Z&to=2026-08-19T01%3A00%3A00Z&floorId=floor%2F12',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('creates a booking with the privacy choice preserved', async () => {
    const booking = { bookingId: 'booking-1' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(booking));
    vi.stubGlobal('fetch', fetchMock);

    await createWorkplaceBooking(
      {
        resourceId: 'desk-1',
        startsAt: '2026-08-19T00:00:00Z',
        endsAt: '2026-08-19T01:00:00Z',
        purpose: 'Focus work',
        visibleToColleagues: false,
      },
      'workplace:booking:test-1'
    );

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/workplace/bookings');
    expect(JSON.parse(String(request.body))).toMatchObject({
      resourceId: 'desk-1',
      visibleToColleagues: false,
    });
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe('workplace:booking:test-1');
  });

  it('persists normalized layout coordinates through the admin boundary', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await saveWorkplaceLayout('floor-1', [
      {
        resourceId: 'desk-1',
        positionX: 12.5,
        positionY: 24,
        widthPercent: 8,
        heightPercent: 8,
        rotationDegrees: 0,
        version: 3,
      },
    ]);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/floors/floor-1/layout'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      resources: [
        expect.objectContaining({
          resourceId: 'desk-1',
          positionX: 12.5,
          version: 3,
        }),
      ],
    });
  });

  it('relocates a booking with only the server-authoritative change fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ bookingId: 'booking-1', version: 5 }));
    vi.stubGlobal('fetch', fetchMock);

    await relocateWorkplaceBooking('booking/1', {
      resourceId: 'desk-2',
      startsAt: '2026-08-19T02:00:00Z',
      endsAt: '2026-08-19T03:00:00Z',
      reason: 'Customer workshop moved',
      version: 4,
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/workplace/bookings/booking%2F1/relocate'
    );
    expect(JSON.parse(String(request.body))).toEqual({
      resourceId: 'desk-2',
      startsAt: '2026-08-19T02:00:00Z',
      endsAt: '2026-08-19T03:00:00Z',
      reason: 'Customer workshop moved',
      version: 4,
    });
  });

  it('records legal-hold changes through the admin booking boundary', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ bookingId: 'booking-1', legalHold: true }));
    vi.stubGlobal('fetch', fetchMock);

    await updateWorkplaceBookingLegalHold('booking/1', 4, true, 'Approved investigation');

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/bookings/booking%2F1/legal-hold'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      version: 4,
      legalHold: true,
      reason: 'Approved investigation',
    });
  });

  it('creates an assigned-workspace release window with a retry-safe key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ releaseWindowId: 'window-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await createWorkplaceReleaseWindow(
      {
        resourceId: 'desk-1',
        startsAt: '2026-08-20T00:00:00Z',
        endsAt: '2026-08-20T08:00:00Z',
        note: 'Team day',
      },
      'workplace:release-window:test-1'
    );

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/workplace/release-windows');
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(
      'workplace:release-window:test-1'
    );
  });
});
