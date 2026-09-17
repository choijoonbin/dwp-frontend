import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  cancelWorkplaceBooking,
  checkInWorkplaceBooking,
  createWorkplaceBooking,
  createWorkplaceReleaseWindow,
  getWorkplaceExplore,
  getWorkplaceAdminBookings,
  relocateWorkplaceBooking,
  releaseWorkplaceBooking,
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
  it('keeps canonical site and floor IDs through a scoped, paginated operations read', async () => {
    const response = {
      content: [{ bookingId: 'booking-1', siteId: 'site-1', floorId: 'floor-12' }],
      page: 1,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal('fetch', fetchMock);
    const result = await getWorkplaceAdminBookings('2026-09-14T00:00:00Z', '2026-09-15T00:00:00Z', {
      siteId: 'site/1',
      floorId: 'floor/12',
      page: 1,
      size: 20,
    });
    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe('/api/platform/v1/admin/workplace/bookings');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-09-14T00:00:00Z',
      to: '2026-09-15T00:00:00Z',
      siteId: 'site/1',
      floorId: 'floor/12',
      page: '1',
      size: '20',
    });
    expect(result).toEqual(response);
  });
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

    await relocateWorkplaceBooking(
      'booking/1',
      {
        resourceId: 'desk-2',
        startsAt: '2026-08-19T02:00:00Z',
        endsAt: '2026-08-19T03:00:00Z',
        reason: 'Customer workshop moved',
        version: 4,
      },
      'relocate-command-1'
    );

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
    expect(request.headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'relocate-command-1' })
    );
  });

  it('sends a stable caller-supplied idempotency key for booking lifecycle commands', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValue(jsonResponse({ bookingId: 'booking-1', version: 5 }));
    vi.stubGlobal('fetch', fetchMock);

    await checkInWorkplaceBooking('booking-1', 4, 'check-in-command-1');
    await cancelWorkplaceBooking('booking-1', 4, 'cancel-command-1');
    await releaseWorkplaceBooking('booking-1', 4, 'release-command-1');

    expect(fetchMock.mock.calls.slice(1).map((call) => [
      call[0],
      (call[1] as RequestInit).headers,
    ])).toEqual([
      [
        '/api/platform/v1/workplace/bookings/booking-1/check-in',
        expect.objectContaining({ 'Idempotency-Key': 'check-in-command-1' }),
      ],
      [
        '/api/platform/v1/workplace/bookings/booking-1/cancel',
        expect.objectContaining({ 'Idempotency-Key': 'cancel-command-1' }),
      ],
      [
        '/api/platform/v1/workplace/bookings/booking-1/release',
        expect.objectContaining({ 'Idempotency-Key': 'release-command-1' }),
      ],
    ]);
  });

  it('reuses the same default command identity after an ambiguous booking response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(jsonResponse({ bookingId: 'booking-1', version: 5 }))
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(jsonResponse({ bookingId: 'booking-1', version: 5 }))
      .mockResolvedValueOnce(jsonResponse({ bookingId: 'booking-1', version: 5 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cancelWorkplaceBooking('booking-1', 4)).rejects.toThrow('HTTP transport failed');
    await cancelWorkplaceBooking('booking-1', 4);
    await expect(
      relocateWorkplaceBooking('booking-1', {
        resourceId: 'desk-2',
        startsAt: '2026-08-19T02:00:00Z',
        endsAt: '2026-08-19T03:00:00Z',
        reason: 'Moved',
        version: 4,
      })
    ).rejects.toThrow('HTTP transport failed');
    await relocateWorkplaceBooking('booking-1', {
      resourceId: 'desk-2',
      startsAt: '2026-08-19T02:00:00Z',
      endsAt: '2026-08-19T03:00:00Z',
      reason: 'Moved',
      version: 4,
    });
    await cancelWorkplaceBooking('booking-1', 5);

    const commandKeys = fetchMock.mock.calls.slice(1).map(
      (call) => ((call[1] as RequestInit).headers as Record<string, string>)['Idempotency-Key']
    );
    expect(commandKeys).toEqual([
      'workplace:booking-cancel:booking-1:v4',
      'workplace:booking-cancel:booking-1:v4',
      'workplace:booking-relocate:booking-1:v4',
      'workplace:booking-relocate:booking-1:v4',
      'workplace:booking-cancel:booking-1:v5',
    ]);
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
