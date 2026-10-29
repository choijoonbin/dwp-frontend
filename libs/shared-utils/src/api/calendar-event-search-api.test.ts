import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import { searchCalendarEventsV2 } from './calendar-event-search-api';

describe('Calendar event search API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('encodes the bounded query and opaque cursor while forwarding cancellation', async () => {
    const signal = new AbortController().signal;
    const page = {
      items: [],
      nextCursor: 'search+/cursor=',
      hasMore: true,
      normalizedQuery: 'team sync',
      range: {
        from: '2026-10-01T00:00:00Z',
        to: '2026-11-01T00:00:00Z',
        timeZone: 'Asia/Seoul',
      },
      generatedAt: '2026-10-28T00:00:00Z',
    };
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: page } });

    await expect(
      searchCalendarEventsV2(
        {
          query: 'team sync',
          from: page.range.from,
          to: page.range.to,
          timeZone: page.range.timeZone,
          limit: 50,
          cursor: page.nextCursor,
        },
        signal
      )
    ).resolves.toEqual(page);

    expect(get).toHaveBeenCalledWith(
      '/api/platform/v2/calendar/events/search?q=team+sync&from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z&timeZone=Asia%2FSeoul&limit=50&cursor=search%2B%2Fcursor%3D',
      { signal }
    );
  });

  it('fails closed when a continuation cursor is missing', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({
      data: {
        data: {
          items: [],
          nextCursor: null,
          hasMore: true,
          normalizedQuery: 'team',
          range: { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', timeZone: 'UTC' },
          generatedAt: '2026-10-28T00:00:00Z',
        },
      },
    });

    await expect(
      searchCalendarEventsV2({
        query: 'team',
        from: '2026-10-01T00:00:00Z',
        to: '2026-11-01T00:00:00Z',
        timeZone: 'UTC',
      })
    ).rejects.toThrow('incomplete cursor contract');
  });
});
