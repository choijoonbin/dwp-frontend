import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  getCalendarExternalProjection,
  type CalendarExternalProjection,
} from './calendar-external-api';

describe('calendar external projection API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads only the bounded private v2 range and forwards cancellation', async () => {
    const projection: CalendarExternalProjection = {
      events: [],
      sources: [
        {
          externalCalendarId: null,
          provider: 'MICROSOFT_365',
          status: 'UNAVAILABLE',
          safeReasonCode: 'MICROSOFT_CALENDAR_CONNECTOR_NOT_CONFIGURED',
          truncated: false,
        },
      ],
      partial: true,
      truncated: false,
      generatedAt: '2026-10-28T00:00:00Z',
    };
    const signal = new AbortController().signal;
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: projection } });

    await expect(
      getCalendarExternalProjection('2026-10-28T00:00:00Z', '2026-11-04T00:00:00Z', signal)
    ).resolves.toEqual(projection);
    expect(get).toHaveBeenCalledWith(
      '/api/platform/v2/calendar/external-events?' +
        'from=2026-10-28T00%3A00%3A00Z&to=2026-11-04T00%3A00%3A00Z&limit=100',
      { signal }
    );
  });
});
