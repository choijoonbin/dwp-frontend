import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  cancelCalendarEvent,
  createCompanyCalendar,
  deleteCalendarShare,
  getCalendarAvailability,
  getCalendarHome,
  getCalendarPolicy,
  getCalendarShares,
  getCompanyCalendarEvents,
  getCompanyCalendars,
  putCalendarShare,
  restoreCalendarEvent,
  restoreCompanyCalendarEvent,
  trashCalendarEvent,
  trashCompanyCalendarEvent,
  updateCalendarEventPreference,
  updateCalendarSubscription,
  updateCalendarEvent,
  updateCompanyCalendar,
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

  it('loads tenant working-hour policy for the user calendar grid', async () => {
    const policy = {
      weekStart: 1,
      workingDayStart: '09:00',
      workingDayEnd: '18:00',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(policy));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCalendarPolicy()).resolves.toEqual(policy);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/calendar/policy',
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

  it('persists selected and favorite calendar subscription state with its version', async () => {
    const subscription = {
      selected: true,
      favorite: true,
      displayOrder: 2,
      colorOverride: null,
      version: 4,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(subscription));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateCalendarSubscription('calendar/shared', {
        selected: true,
        favorite: true,
        displayOrder: 2,
        colorOverride: null,
        version: 3,
      })
    ).resolves.toEqual(subscription);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/calendar/calendars/calendar%2Fshared/subscription'
    );
    expect(request.method).toBe('PUT');
    expect(JSON.parse(String(request.body))).toEqual({
      selected: true,
      favorite: true,
      displayOrder: 2,
      colorOverride: null,
      version: 3,
    });
  });

  it('manages explicit person calendar shares without putting identity data in query strings', async () => {
    const share = {
      grantId: 'grant-1',
      principalType: 'PERSON',
      principalPersonPublicId: 'person-1',
      principalGroupRef: null,
      principalDisplayName: 'Yujin Choi',
      accessLevel: 'VIEW_DETAILS',
      canViewPrivate: false,
      validUntil: null,
      lifecycleState: 'ACTIVE',
      version: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([share]))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(share))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCalendarShares('calendar-1')).resolves.toEqual([share]);
    await expect(
      putCalendarShare('calendar-1', {
        principalPersonPublicId: 'person-1',
        principalDisplayName: 'Yujin Choi',
        accessLevel: 'VIEW_DETAILS',
        canViewPrivate: false,
        validUntil: null,
        version: 0,
      })
    ).resolves.toEqual(share);
    await expect(deleteCalendarShare('calendar-1', 'grant/1', 1)).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/calendar/calendars/calendar-1/shares'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/calendar/calendars/calendar-1/shares/person-1'
    );
    const putRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(putRequest.method).toBe('PUT');
    expect(String(putRequest.body)).toContain('person-1');
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/api/platform/v1/calendar/calendars/calendar-1/shares/grant%2F1?version=1'
    );
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe('DELETE');
  });

  it('uses capability-backed preference, trash, and restore event endpoints', async () => {
    const preference = { starred: true, hidden: false, version: 5 };
    const capabilities = {
      canViewDetails: true,
      canEdit: true,
      canDelete: true,
      canRestore: false,
      canRespond: false,
      canStar: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(preference))
      .mockResolvedValueOnce(jsonResponse(capabilities))
      .mockResolvedValueOnce(jsonResponse(capabilities));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateCalendarEventPreference('event-1', { starred: true, hidden: false, version: 4 })
    ).resolves.toEqual(preference);
    await expect(trashCalendarEvent('event-1', 5, 'No longer needed')).resolves.toEqual(
      capabilities
    );
    await expect(restoreCalendarEvent('event-1', 6)).resolves.toEqual(capabilities);

    expect(fetchMock.mock.calls.slice(1).map((call) => call[0])).toEqual([
      '/api/platform/v1/calendar/events/event-1/preference',
      '/api/platform/v1/calendar/events/event-1/trash',
      '/api/platform/v1/calendar/events/event-1/restore',
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
      version: 5,
      reason: 'No longer needed',
    });
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body))).toEqual({
      version: 6,
    });
  });

  it('evaluates free-busy identities in a POST body instead of URL logs', async () => {
    const evaluation = {
      evaluationId: 'evaluation-1',
      criteriaHash: 'a'.repeat(64),
      completeness: 'COMPLETE',
      sources: [],
      availability: { participants: [], suggestions: [], generatedAt: '2026-08-27T00:00:00Z' },
      rooms: [],
      generatedAt: '2026-08-27T00:00:00Z',
      validUntil: '2026-08-27T00:00:30Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(evaluation));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getCalendarAvailability(
        ['00ba0853-02a8-7499-b6d8-009251e6a464'],
        '2026-08-27T01:00:00Z',
        '2026-09-10T01:00:00Z',
        30,
        'Asia/Seoul'
      )
    ).resolves.toEqual(evaluation.availability);

    const url = String(fetchMock.mock.calls[1]?.[0]);
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(url).toBe('/api/platform/v1/calendar/scheduling/evaluations');
    expect(url).not.toContain('00ba0853');
    expect(JSON.parse(String(request.body))).toMatchObject({
      personIds: ['00ba0853-02a8-7499-b6d8-009251e6a464'],
      roomStartsAt: '2026-08-27T01:00:00Z',
      roomEndsAt: '2026-08-27T01:30:00.000Z',
      timeZone: 'Asia/Seoul',
    });
  });

  it('uses the governed company-calendar administration boundary', async () => {
    const companyCalendar = {
      calendarId: 'company-1',
      key: 'company-events',
      name: 'Company events',
      nameKo: '회사 일정',
      nameEn: 'Company events',
      color: '#0F766E',
      upcomingEventCount: 1,
      trashedEventCount: 0,
      version: 1,
    };
    const companyEvent = { eventId: 'event-1', calendarId: 'company-1', version: 3 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([companyCalendar]))
      .mockResolvedValueOnce(jsonResponse([companyEvent]))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(companyCalendar))
      .mockResolvedValueOnce(jsonResponse({ ...companyCalendar, version: 2 }))
      .mockResolvedValueOnce(jsonResponse(companyEvent))
      .mockResolvedValueOnce(jsonResponse({ ...companyEvent, version: 4 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCompanyCalendars()).resolves.toEqual([companyCalendar]);
    await expect(
      getCompanyCalendarEvents('company-1', '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z')
    ).resolves.toEqual([companyEvent]);
    const input = {
      key: 'company-events',
      nameKo: '회사 일정',
      nameEn: 'Company events',
      color: '#0F766E',
      version: 0,
    };
    await expect(createCompanyCalendar(input)).resolves.toEqual(companyCalendar);
    await expect(
      updateCompanyCalendar('company-1', { ...input, version: 1 })
    ).resolves.toMatchObject({ version: 2 });
    await expect(trashCompanyCalendarEvent('company-1', 'event-1', 3)).resolves.toEqual(
      companyEvent
    );
    await expect(restoreCompanyCalendarEvent('company-1', 'event-1', 3)).resolves.toMatchObject({
      version: 4,
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/calendar/company-calendars',
      '/api/platform/v1/admin/calendar/company-calendars/company-1/events?from=2026-08-01T00%3A00%3A00Z&to=2026-09-01T00%3A00%3A00Z&deleted=false',
      '/api/auth/csrf',
      '/api/platform/v1/admin/calendar/company-calendars',
      '/api/platform/v1/admin/calendar/company-calendars/company-1',
      '/api/platform/v1/admin/calendar/company-calendars/company-1/events/event-1/trash',
      '/api/platform/v1/admin/calendar/company-calendars/company-1/events/event-1/restore',
    ]);
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[4]?.[1] as RequestInit).method).toBe('PUT');
  });
});
