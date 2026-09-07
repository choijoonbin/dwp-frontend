import { afterEach, describe, expect, it, vi } from 'vitest';

import { calendarTeamSnapshotIsFresh, getCalendarTeamAvailabilitySnapshot } from './calendar-api';

import type { CalendarTeamAvailabilitySnapshot } from './calendar-team-api';

const snapshot: CalendarTeamAvailabilitySnapshot = {
  date: '2026-09-04',
  timeZone: 'Asia/Seoul',
  generatedAt: '2026-09-04T00:40:00Z',
  validUntil: '2026-09-04T00:40:30Z',
  source: 'DWP_NATIVE_CALENDAR',
  scope: 'SHARED_WITH_ME',
  members: [],
  hasMore: false,
};

describe('shared Calendar team snapshot boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses a read-only independent route with explicit timezone and no target identity parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: snapshot }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    await expect(getCalendarTeamAvailabilitySnapshot()).resolves.toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/calendar/team-availability/snapshot?timeZone=Asia%2FSeoul',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({ 'Cache-Control': 'no-cache' }),
      })
    );
  });

  it('encodes the zone and propagates cancellation on an actor/tenant change', async () => {
    const caller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      caller.abort();
      expect(init.signal?.aborted).toBe(true);
      throw new DOMException('Aborted', 'AbortError');
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      getCalendarTeamAvailabilitySnapshot('America/New_York', caller.signal)
    ).rejects.toThrow();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('timeZone=America%2FNew_York');
  });

  it.each([403, 502, 503])(
    'propagates %i instead of retaining members or fabricating AVAILABLE data',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          text: async () => JSON.stringify({ code: 'FORBIDDEN', message: 'Unavailable' }),
        } as Response)
      );
      await expect(getCalendarTeamAvailabilitySnapshot()).rejects.toThrow();
    }
  );

  it('expires at the exact boundary, including a shortened grant expiry', () => {
    expect(calendarTeamSnapshotIsFresh(snapshot, Date.parse(snapshot.generatedAt))).toBe(true);
    expect(calendarTeamSnapshotIsFresh(snapshot, Date.parse(snapshot.validUntil))).toBe(false);
    expect(
      calendarTeamSnapshotIsFresh(
        { ...snapshot, validUntil: '2026-09-04T00:40:05Z' },
        Date.parse('2026-09-04T00:40:05Z')
      )
    ).toBe(false);
  });

  it('fails closed for invalid, future, inverted, or overlong freshness data', () => {
    const now = Date.parse(snapshot.generatedAt);
    expect(calendarTeamSnapshotIsFresh({ ...snapshot, generatedAt: 'invalid' }, now)).toBe(false);
    expect(calendarTeamSnapshotIsFresh(snapshot, now - 1)).toBe(false);
    expect(
      calendarTeamSnapshotIsFresh({ ...snapshot, validUntil: snapshot.generatedAt }, now)
    ).toBe(false);
    expect(
      calendarTeamSnapshotIsFresh({ ...snapshot, validUntil: '2026-09-04T00:41:00Z' }, now)
    ).toBe(false);
    expect(calendarTeamSnapshotIsFresh(snapshot, Number.NaN)).toBe(false);
  });
});
