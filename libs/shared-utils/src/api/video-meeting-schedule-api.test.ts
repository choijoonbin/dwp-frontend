import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import type { ScheduleVideoMeetingInput } from './video-meeting-api';
import {
  cancelScheduledVideoMeeting,
  commitVideoMeetingScheduleDraft,
  createVideoMeetingSeries,
  discardVideoMeetingScheduleDraft,
  getVideoMeetingSchedule,
  getVideoMeetingScheduleDraft,
  previewVideoMeetingCancellation,
  previewVideoMeetingScheduleDraftRecurrence,
  previewVideoMeetingReschedule,
  previewVideoMeetingSeries,
  rescheduleVideoMeeting,
  saveVideoMeetingScheduleDraft,
} from './video-meeting-schedule-api';

const meetingId = '88000000-0000-4000-8000-000000000001';
const key = '88000000-0000-4000-8000-000000000002';
const draftId = '88000000-0000-4000-8000-000000000003';
const personId = '88000000-0000-4000-8000-000000000004';
const agendaItemId = '88000000-0000-4000-8000-000000000005';
const fingerprint = 'a'.repeat(64);
const schedule = {
  meetingId,
  lifecycleState: 'SCHEDULED',
  startsAt: '2027-01-31T01:00:00Z',
  endsAt: '2027-01-31T02:00:00Z',
  timeZone: 'Asia/Seoul',
  meetingVersion: 3,
  seriesId: null,
  occurrenceIndex: null,
  occurrenceCount: null,
  frequency: null,
  recurrenceInterval: null,
  seriesVersion: null,
  exceptionState: 'NONE',
  invitationRevision: 2,
  deliveryState: 'PENDING',
};
const input: ScheduleVideoMeetingInput = {
  title: 'Architecture review',
  startsAt: '2027-01-31T01:00:00.000Z',
  durationMinutes: 60,
  timeZone: 'Asia/Seoul',
  participantUserIds: [7],
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  idempotencyKey: key,
};
const scheduleDraft = {
  draftId,
  title: 'Architecture review',
  agenda: 'Approve the release boundary',
  startsAt: '2099-09-05T01:00:00Z',
  durationMinutes: 60,
  timeZone: 'Asia/Seoul',
  accessScope: 'INVITED',
  waitingRoomEnabled: true,
  allowJoinBeforeHost: false,
  participants: [
    {
      userId: 7,
      personPublicId: personId,
      emailAddress: 'joonbin@sk.com',
      displayName: 'Joonbin',
      jobTitle: 'Architect',
      organizationName: 'DWP',
    },
  ],
  agendaItems: [
    {
      itemId: agendaItemId,
      position: 0,
      title: 'Decision',
      objective: 'Review evidence',
      ownerUserId: 7,
      plannedMinutes: 15,
    },
  ],
  recurrence: { frequency: 'WEEKLY', interval: 1, occurrenceCount: 4 },
  sourceTemplateId: null,
  sourceTemplateVersion: null,
  lastStep: 'REVIEW',
  version: 2,
  retentionUntil: '2099-09-12T00:00:00Z',
  updatedAt: '2099-09-04T00:00:01Z',
};
function scheduleDraftSlot(overrides: Record<string, unknown> = {}) {
  return {
    draft: scheduleDraft,
    discardOnly: false,
    draftId,
    version: 2,
    retentionUntil: '2099-09-12T00:00:00Z',
    observedAt: '2099-09-04T00:00:02Z',
    ...overrides,
  };
}
function transport(data: unknown, status = 200) {
  const fetch = vi.fn().mockImplementation(
    async (url: string) =>
      ({
        ok: status < 400,
        status,
        text: async () =>
          JSON.stringify({
            data: url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : data,
          }),
      }) as Response
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function last(fetch: ReturnType<typeof transport>) {
  return [...fetch.mock.calls].reverse().find(([url]) => !String(url).includes('/csrf')) as [
    string,
    RequestInit,
  ];
}

describe('V30 meeting schedule public contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('previews a recurrence using the selected IANA-zone wall clock and explicit adjustments', async () => {
    const fetch = transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: true,
      occurrences: [
        {
          occurrenceIndex: 1,
          startsAt: '2027-01-31T01:00:00Z',
          localStart: '2027-01-31T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
        {
          occurrenceIndex: 2,
          startsAt: '2027-02-28T01:00:00Z',
          localStart: '2027-02-28T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'MONTH_END_CLAMPED',
        },
        {
          occurrenceIndex: 3,
          startsAt: '2027-03-31T01:00:00Z',
          localStart: '2027-03-31T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
      ],
    });
    await previewVideoMeetingSeries(input, {
      frequency: 'MONTHLY',
      interval: 1,
      occurrenceCount: 3,
    });
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meeting-series/preview');
    expect(JSON.parse(String(init.body))).toMatchObject({
      meeting: { startsAt: '2027-01-31T10:00:00+09:00', timeZone: 'Asia/Seoul' },
      recurrence: { frequency: 'MONTHLY', interval: 1, occurrenceCount: 3 },
    });
  });

  it('creates a reviewed series with the exact fingerprint and stable key', async () => {
    const fetch = transport({ meeting: { meetingId } });
    await createVideoMeetingSeries(
      input,
      { frequency: 'WEEKLY', interval: 2, occurrenceCount: 4 },
      fingerprint,
      key
    );
    const [url, init] = last(fetch);
    expect(url).toBe('/api/meetings/v1/meeting-series');
    expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
    expect(JSON.parse(String(init.body))).toMatchObject({ previewFingerprint: fingerprint });
  });

  it('loads, previews and applies one schedule change without actor fields', async () => {
    let fetch = transport(schedule);
    await getVideoMeetingSchedule(meetingId);
    expect(last(fetch)[0]).toBe(`/api/meetings/v1/meetings/${meetingId}/schedule`);
    vi.unstubAllGlobals();
    fetch = transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: false,
      occurrences: [
        {
          occurrenceIndex: 1,
          startsAt: '2027-02-01T01:00:00Z',
          localStart: '2027-02-01T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
      ],
    });
    const change = {
      startsAt: '2027-02-01T01:00:00Z',
      durationMinutes: 45,
      timeZone: 'Asia/Seoul',
      scope: 'THIS_ONLY' as const,
      expectedSeriesVersion: null,
      expectedVersion: 3,
      calendarFingerprint: null,
    };
    await previewVideoMeetingReschedule(meetingId, change);
    expect(last(fetch)[0].endsWith('/schedule/preview')).toBe(true);
    vi.unstubAllGlobals();
    fetch = transport({
      ...schedule,
      startsAt: '2027-02-01T01:00:00Z',
      endsAt: '2027-02-01T01:45:00Z',
      meetingVersion: 4,
    });
    await rescheduleVideoMeeting(meetingId, change, key);
    const [url, init] = last(fetch);
    expect(url.endsWith('/schedule')).toBe(true);
    expect(JSON.parse(String(init.body))).not.toHaveProperty('actorId');
    expect(init.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
  });

  it('accepts ordered source occurrence indexes when previewing a future-series change', async () => {
    transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: false,
      occurrences: [
        {
          occurrenceIndex: 2,
          startsAt: '2027-02-01T01:00:00Z',
          localStart: '2027-02-01T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
        {
          occurrenceIndex: 4,
          startsAt: '2027-02-15T01:00:00Z',
          localStart: '2027-02-15T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
      ],
    });
    const result = await previewVideoMeetingReschedule(meetingId, {
      startsAt: '2027-02-01T01:00:00Z',
      durationMinutes: 45,
      timeZone: 'Asia/Seoul',
      scope: 'THIS_AND_FUTURE',
      expectedSeriesVersion: 7,
      expectedVersion: 3,
      calendarFingerprint: null,
    });
    expect(result.occurrences.map(({ occurrenceIndex }) => occurrenceIndex)).toEqual([2, 4]);
  });

  it('rejects reordered source occurrence indexes in a schedule-change preview', async () => {
    transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: false,
      occurrences: [
        {
          occurrenceIndex: 3,
          startsAt: '2027-02-08T01:00:00Z',
          localStart: '2027-02-08T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
        {
          occurrenceIndex: 2,
          startsAt: '2027-02-01T01:00:00Z',
          localStart: '2027-02-01T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
      ],
    });
    await expect(
      previewVideoMeetingReschedule(meetingId, {
        startsAt: '2027-02-01T01:00:00Z',
        durationMinutes: 45,
        timeZone: 'Asia/Seoul',
        scope: 'THIS_AND_FUTURE',
        expectedSeriesVersion: 7,
        expectedVersion: 3,
        calendarFingerprint: null,
      })
    ).rejects.toThrow('occurrence');
  });

  it.each([
    {
      instant: '2099-11-01T05:30:00Z',
      offset: '-04:00',
      expected: '2099-11-01T01:30:00-04:00',
    },
    {
      instant: '2099-11-01T06:30:00Z',
      offset: '-05:00',
      expected: '2099-11-01T01:30:00-05:00',
    },
  ])('preserves the selected instant as an explicit DST overlap offset: %s', async (fixture) => {
    const fetch = transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: true,
      occurrences: [
        {
          occurrenceIndex: 1,
          startsAt: fixture.instant,
          localStart: '2099-11-01T01:30:00',
          utcOffset: fixture.offset,
          adjustment: 'DST_OVERLAP_EXPLICIT_OFFSET',
        },
      ],
    });
    await previewVideoMeetingReschedule(meetingId, {
      startsAt: fixture.instant,
      durationMinutes: 45,
      timeZone: 'America/New_York',
      scope: 'THIS_ONLY',
      expectedSeriesVersion: null,
      expectedVersion: 3,
      calendarFingerprint: null,
    });
    const [, request] = last(fetch);
    expect(JSON.parse(String(request.body))).toMatchObject({
      startsAt: fixture.expected,
      timeZone: 'America/New_York',
    });
  });

  it('requires a reviewed cancellation fingerprint before applying it', async () => {
    let fetch = transport({
      impactFingerprint: fingerprint,
      scope: 'THIS_ONLY',
      affectedOccurrenceCount: 1,
      skippedImmutableOccurrenceCount: 0,
      invitationRevision: 3,
      seriesVersion: null,
    });
    const impact = { scope: 'THIS_ONLY' as const, expectedSeriesVersion: null, expectedVersion: 3 };
    await previewVideoMeetingCancellation(meetingId, impact);
    expect(last(fetch)[0].endsWith('/cancel/preview')).toBe(true);
    vi.unstubAllGlobals();
    fetch = transport({ ...schedule, lifecycleState: 'CANCELLED', meetingVersion: 4 });
    await cancelScheduledVideoMeeting(
      meetingId,
      { ...impact, impactFingerprint: fingerprint },
      key
    );
    const [url, init] = last(fetch);
    expect(url.endsWith('/cancel')).toBe(true);
    expect(JSON.parse(String(init.body))).toEqual({ ...impact, impactFingerprint: fingerprint });
  });

  it.each([
    { lifecycleState: 'UNKNOWN' },
    { endsAt: schedule.startsAt },
    { timeZone: 'Not/A_Zone' },
    { invitationRevision: 0 },
    { deliveryState: 'SENT' },
    { exceptionState: 'MOVED' },
    { seriesId: meetingId, seriesVersion: 1 },
    {
      seriesId: meetingId,
      seriesVersion: 1,
      occurrenceIndex: 5,
      occurrenceCount: 4,
      frequency: 'WEEKLY',
      recurrenceInterval: 1,
    },
  ])('rejects a malformed schedule projection: %s', async (patch) => {
    transport({ ...schedule, ...patch });
    await expect(getVideoMeetingSchedule(meetingId)).rejects.toThrow('schedule');
  });

  it.each([
    {
      hasCalendarAdjustments: false,
      localStart: '2027-01-31T11:00:00',
      adjustment: 'NONE',
    },
    {
      hasCalendarAdjustments: false,
      localStart: 'not-local-time',
      adjustment: 'NONE',
    },
    {
      hasCalendarAdjustments: false,
      localStart: '2027-01-31T10:00:00',
      adjustment: 'MONTH_END_CLAMPED',
    },
  ])('rejects an inconsistent recurrence occurrence: %s', async (patch) => {
    transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: patch.hasCalendarAdjustments,
      occurrences: [
        {
          occurrenceIndex: 1,
          startsAt: '2027-01-31T01:00:00Z',
          localStart: patch.localStart,
          utcOffset: '+09:00',
          adjustment: patch.adjustment,
        },
      ],
    });
    await expect(
      previewVideoMeetingSeries(input, {
        frequency: 'MONTHLY',
        interval: 1,
        occurrenceCount: 3,
      })
    ).rejects.toThrow('schedule');
  });

  it('rejects a recurrence preview whose returned occurrence count differs from the request', async () => {
    transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: false,
      occurrences: [
        {
          occurrenceIndex: 1,
          startsAt: '2027-01-31T01:00:00Z',
          localStart: '2027-01-31T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
      ],
    });
    await expect(
      previewVideoMeetingSeries(input, {
        frequency: 'MONTHLY',
        interval: 1,
        occurrenceCount: 3,
      })
    ).rejects.toThrow('schedule');
  });

  it('rejects invalid IDs, recurrence ranges, fingerprints and transplanted responses', async () => {
    const fetch = transport({ ...schedule, meetingId: key });
    await expect(getVideoMeetingSchedule(meetingId)).rejects.toThrow('binding');
    await expect(
      previewVideoMeetingSeries(input, { frequency: 'WEEKLY', interval: 0, occurrenceCount: 4 })
    ).rejects.toThrow();
    await expect(
      cancelScheduledVideoMeeting(
        meetingId,
        {
          scope: 'THIS_ONLY',
          expectedSeriesVersion: null,
          expectedVersion: 3,
          impactFingerprint: 'unsafe',
        },
        key
      )
    ).rejects.toThrow();
    await expect(getVideoMeetingSchedule('../other')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a cancellation impact whose series fence differs from the request', async () => {
    transport({
      impactFingerprint: fingerprint,
      scope: 'THIS_AND_FUTURE',
      affectedOccurrenceCount: 2,
      skippedImmutableOccurrenceCount: 0,
      invitationRevision: 3,
      seriesVersion: 8,
    });
    await expect(
      previewVideoMeetingCancellation(meetingId, {
        scope: 'THIS_AND_FUTURE',
        expectedSeriesVersion: 7,
        expectedVersion: 3,
      })
    ).rejects.toThrow('impact');
  });

  it('reads the self-owned singleton draft and drops identity, device, consent and token hints', async () => {
    const fetch = transport(
      scheduleDraftSlot({
        tenantId: 99,
        ownerUserId: 7,
        deviceId: 'never',
        consent: true,
        token: 'never',
        draft: {
          ...scheduleDraft,
          tenantId: 99,
          ownerUserId: 7,
          participants: [{ ...scheduleDraft.participants[0], tenantId: 99, token: 'never' }],
          agendaItems: [{ ...scheduleDraft.agendaItems[0], consent: true }],
        },
      })
    );
    const result = await getVideoMeetingScheduleDraft(new AbortController().signal);
    expect(last(fetch)[0]).toBe('/api/meetings/v1/schedule-draft');
    expect(last(fetch)[1].signal).toBeDefined();
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('ownerUserId');
    expect(result).not.toHaveProperty('deviceId');
    expect(result).not.toHaveProperty('consent');
    expect(result).not.toHaveProperty('token');
    expect(result.draft?.participants[0]).toEqual(scheduleDraft.participants[0]);
    expect(result.draft?.agendaItems[0]).toEqual(scheduleDraft.agendaItems[0]);
  });

  it('supports an empty slot and a revoked-source discard-only slot without draft content', async () => {
    transport({
      draft: null,
      discardOnly: false,
      draftId: null,
      version: null,
      retentionUntil: null,
      observedAt: '2099-09-04T00:00:02Z',
    });
    await expect(getVideoMeetingScheduleDraft()).resolves.toEqual({
      draft: null,
      discardOnly: false,
      draftId: null,
      version: null,
      retentionUntil: null,
      observedAt: '2099-09-04T00:00:02Z',
    });
    vi.unstubAllGlobals();
    transport({
      draft: null,
      discardOnly: true,
      draftId,
      version: 2,
      retentionUntil: '2099-09-12T00:00:00Z',
      observedAt: '2099-09-04T00:00:02Z',
      title: 'must never be exposed',
    });
    await expect(getVideoMeetingScheduleDraft()).resolves.toEqual({
      draft: null,
      discardOnly: true,
      draftId,
      version: 2,
      retentionUntil: '2099-09-12T00:00:00Z',
      observedAt: '2099-09-04T00:00:02Z',
    });
  });

  it('saves only allowlisted draft fields with a stable command key', async () => {
    const fetch = transport(scheduleDraft);
    const result = await saveVideoMeetingScheduleDraft(
      {
        expectedVersion: 2,
        title: 'Architecture review',
        agenda: 'Approve the release boundary',
        startsAt: '2099-09-05T01:00:00Z',
        durationMinutes: 60,
        timeZone: 'Asia/Seoul',
        accessScope: 'INVITED',
        waitingRoomEnabled: true,
        allowJoinBeforeHost: false,
        participantUserIds: [7],
        agendaItems: [
          {
            itemId: agendaItemId,
            title: 'Decision',
            objective: 'Review evidence',
            ownerUserId: 7,
            plannedMinutes: 15,
            deviceId: 'never',
            consent: true,
          } as NonNullable<
            Parameters<typeof saveVideoMeetingScheduleDraft>[0]['agendaItems']
          >[number],
        ],
        recurrence: { frequency: 'WEEKLY', interval: 1, occurrenceCount: 4 },
        sourceTemplateId: null,
        sourceTemplateVersion: null,
        lastStep: 'REVIEW',
        tenantId: 99,
        userId: 7,
        token: 'never',
      } as Parameters<typeof saveVideoMeetingScheduleDraft>[0],
      key
    );
    const [url, request] = last(fetch);
    expect(url).toBe('/api/meetings/v1/schedule-draft');
    expect(request.headers).toEqual(expect.objectContaining({ 'Idempotency-Key': key }));
    expect(JSON.parse(String(request.body))).toEqual({
      expectedVersion: 2,
      title: 'Architecture review',
      agenda: 'Approve the release boundary',
      startsAt: '2099-09-05T01:00:00Z',
      durationMinutes: 60,
      timeZone: 'Asia/Seoul',
      accessScope: 'INVITED',
      waitingRoomEnabled: true,
      allowJoinBeforeHost: false,
      participantUserIds: [7],
      agendaItems: [
        {
          itemId: agendaItemId,
          title: 'Decision',
          objective: 'Review evidence',
          ownerUserId: 7,
          plannedMinutes: 15,
        },
      ],
      recurrence: { frequency: 'WEEKLY', interval: 1, occurrenceCount: 4 },
      sourceTemplateId: null,
      sourceTemplateVersion: null,
      lastStep: 'REVIEW',
    });
    expect(result).toEqual(scheduleDraft);
  });

  it('previews, commits and discards against the same optimistic draft version', async () => {
    let fetch = transport({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: false,
      occurrences: [
        {
          occurrenceIndex: 1,
          startsAt: '2099-09-05T01:00:00Z',
          localStart: '2099-09-05T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
          token: 'never',
        },
      ],
      tenantId: 99,
    });
    await expect(previewVideoMeetingScheduleDraftRecurrence(2)).resolves.toEqual({
      previewFingerprint: fingerprint,
      hasCalendarAdjustments: false,
      occurrences: [
        {
          occurrenceIndex: 1,
          startsAt: '2099-09-05T01:00:00Z',
          localStart: '2099-09-05T10:00:00',
          utcOffset: '+09:00',
          adjustment: 'NONE',
        },
      ],
    });
    expect(JSON.parse(String(last(fetch)[1].body))).toEqual({ expectedVersion: 2 });
    vi.unstubAllGlobals();
    fetch = transport({
      meeting: { meetingId, meetingCode: 'ABCDEFGHJKLM', tenantId: 99, token: 'never' },
      meetingCode: 'ABCDEFGHJKLM',
      tenantId: 99,
    });
    await expect(commitVideoMeetingScheduleDraft(2, fingerprint, key)).resolves.toEqual({
      meetingId,
      meetingCode: 'ABCDEFGHJKLM',
    });
    expect(JSON.parse(String(last(fetch)[1].body))).toEqual({
      expectedVersion: 2,
      previewFingerprint: fingerprint,
    });
    vi.unstubAllGlobals();
    fetch = transport({ draftId, version: 2, discarded: true, ownerUserId: 7 });
    await expect(discardVideoMeetingScheduleDraft(2, key)).resolves.toEqual({
      draftId,
      version: 2,
      discarded: true,
    });
    expect(JSON.parse(String(last(fetch)[1].body))).toEqual({ expectedVersion: 2 });
  });

  it.each([
    scheduleDraftSlot({ draftId: meetingId }),
    scheduleDraftSlot({ discardOnly: true }),
    scheduleDraftSlot({ retentionUntil: '2099-09-03T00:00:00Z' }),
    scheduleDraftSlot({
      draft: {
        ...scheduleDraft,
        participants: [scheduleDraft.participants[0], scheduleDraft.participants[0]],
      },
    }),
    scheduleDraftSlot({
      draft: {
        ...scheduleDraft,
        agendaItems: [{ ...scheduleDraft.agendaItems[0], position: 1 }],
      },
    }),
    scheduleDraftSlot({
      draft: { ...scheduleDraft, sourceTemplateId: draftId, sourceTemplateVersion: null },
    }),
  ])('rejects an unbound or inconsistent draft slot: %#', async (fixture) => {
    transport(fixture);
    await expect(getVideoMeetingScheduleDraft()).rejects.toThrow('schedule draft');
  });

  it('rejects unsafe draft commands before transport and propagates server denials', async () => {
    const fetch = transport(scheduleDraft);
    await expect(
      saveVideoMeetingScheduleDraft({ expectedVersion: null, participantUserIds: [7, 7] }, key)
    ).rejects.toThrow();
    await expect(
      saveVideoMeetingScheduleDraft({ expectedVersion: null, sourceTemplateId: draftId }, key)
    ).rejects.toThrow();
    await expect(commitVideoMeetingScheduleDraft(2, 'unsafe', key)).rejects.toThrow();
    await expect(discardVideoMeetingScheduleDraft(-1, key)).rejects.toThrow();
    await expect(discardVideoMeetingScheduleDraft(2, '')).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    transport(null, 403);
    await expect(getVideoMeetingScheduleDraft()).rejects.toThrow();
  });
});
