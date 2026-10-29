import { axiosInstance } from '../axios-instance';

import type { CalendarEvent } from './calendar-api';
import type { ApiResponse } from '../types';

export type CalendarEventSearchPage = {
  items: CalendarEvent[];
  nextCursor: string | null;
  hasMore: boolean;
  normalizedQuery: string;
  range: {
    from: string;
    to: string;
    timeZone: string;
  };
  generatedAt: string;
};

export async function searchCalendarEventsV2(
  input: Readonly<{
    query: string;
    from: string;
    to: string;
    timeZone: string;
    limit?: number;
    cursor?: string | null;
  }>,
  signal?: AbortSignal
): Promise<CalendarEventSearchPage> {
  const query = new URLSearchParams([
    ['q', input.query],
    ['from', input.from],
    ['to', input.to],
    ['timeZone', input.timeZone],
    ['limit', String(input.limit ?? 50)],
  ]);
  if (input.cursor) query.set('cursor', input.cursor);
  const path = `/api/platform/v2/calendar/events/search?${query.toString()}`;
  const response = signal
    ? await axiosInstance.get<ApiResponse<CalendarEventSearchPage>>(path, { signal })
    : await axiosInstance.get<ApiResponse<CalendarEventSearchPage>>(path);
  const page = response.data.data;
  if (page.hasMore && !page.nextCursor) {
    throw new Error('Calendar event search returned an incomplete cursor contract.');
  }
  return page;
}
