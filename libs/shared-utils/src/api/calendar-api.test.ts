import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  cancelCalendarEvent,
  getCalendarHome,
  updateCalendarEvent,
  type UpdateCalendarEventInput,
} from './calendar-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('calendar API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads the today workspace with an explicit IANA time zone', async () => {
    const home = { date: '2026-08-14', timeZone: 'Asia/Seoul', today: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(home));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCalendarHome('Asia/Seoul')).resolves.toEqual(home);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/calendar/home?timeZone=Asia%2FSeoul',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('keeps attendees, resource, recurrence, and version in an event edit', async () => {
    const updatedEvent = { eventId: 'event-1', version: 8 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(updatedEvent));
    vi.stubGlobal('fetch', fetchMock);

    const input: UpdateCalendarEventInput = {
      title: '운영 주간 회의',
      description: '결정 사항과 후속 조치를 확인합니다.',
      type: 'MEETING',
      startsAt: '2026-08-17T00:00:00Z',
      endsAt: '2026-08-17T01:00:00Z',
      timeZone: 'Asia/Seoul',
      allDay: false,
      location: 'A타워 1201 회의실',
      conferenceUrl: null,
      visibility: 'CONFIDENTIAL',
      recurrence: 'WEEKLY',
      recurrenceInterval: 1,
      recurrenceUntil: '2026-10-31',
      responseRequired: true,
      attendees: [
        {
          userId: 11,
          personPublicId: '00ba0853-02a8-7499-b6d8-009251e6a464',
          email: 'yujin.choi@sk.com',
          name: '최유진',
          type: 'OPTIONAL',
        },
      ],
      resourceId: '15048c1b-81af-6757-9bc6-ea09894e5b64',
      version: 7,
    };

    await expect(updateCalendarEvent('event-1', input)).resolves.toEqual(updatedEvent);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/calendar/events/event-1');
    expect(request.method).toBe('PUT');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual(input);
  });

  it('cancels with the current optimistic-lock version', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cancelCalendarEvent('event-1', 8)).resolves.toBeUndefined();

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/calendar/events/event-1/cancel');
    expect(JSON.parse(String(request.body))).toEqual({ version: 8 });
  });
});
