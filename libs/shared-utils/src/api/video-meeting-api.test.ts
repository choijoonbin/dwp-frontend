import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  VIDEO_MEETING_API_BASE,
  confirmVideoMeetingConnected,
  decideVideoMeetingLobbyRequest,
  endVideoMeeting,
  getVideoMeetingHome,
  getVideoMeetingJoinRequest,
  getVideoMeetings,
  isTrustedVideoMeetingServerUrl,
  issueVideoMeetingToken,
  leaveVideoMeeting,
  normalizeVideoMeetingCode,
  resolveVideoMeetingCode,
  scheduleVideoMeeting,
  searchVideoMeetingPeople,
  startVideoMeeting,
  updateVideoMeetingAdminPolicy,
  type ScheduleVideoMeetingInput,
  type VideoMeetingAdminPolicy,
} from './video-meeting-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

const summary = {
  meetingId: 'meeting-1',
  title: 'Quarterly operating review',
  description: null,
  agenda: 'Decisions and owners',
  lifecycleState: 'SCHEDULED',
  accessScope: 'INVITED',
  meetingCode: 'ABCD-EFGH-JKMN',
  startsAt: '2026-08-27T01:00:00.000Z',
  endsAt: '2026-08-27T01:50:00.000Z',
  durationMinutes: 50,
  timeZone: 'Asia/Seoul',
  organizerUserId: 9,
  organizerName: 'Park Hyunwoo',
  waitingRoomEnabled: true,
  allowJoinBeforeHost: false,
  defaultMicrophoneEnabled: false,
  defaultCameraEnabled: false,
  attendeeCount: 2,
  participantRole: 'ATTENDEE',
  canHost: false,
  canModerate: false,
  version: 4,
};

const participant = {
  participantId: 'participant-1',
  userId: 17,
  displayName: 'Kim Minseo',
  participantRole: 'ATTENDEE',
  attendanceState: 'REQUESTED',
  canSelfUnmute: true,
  joinRequestedAt: '2026-08-27T00:58:00.000Z',
  version: 2,
};

const detail = {
  ...summary,
  guestAccessEnabled: false,
  provider: 'LIVEKIT',
  participants: [participant],
  artifacts: [],
  recordingAvailable: false,
  transcriptAvailable: false,
  aiNotesAvailable: false,
};

const capability = {
  available: true,
  provider: 'LIVEKIT',
  unavailableReason: null,
  audio: true,
  video: true,
  screenShare: true,
  participantList: true,
  chat: true,
  reactions: true,
  handRaise: true,
  captions: false,
  maximumParticipants: 100,
  tokenTtlSeconds: 300,
  unmuteControl: 'REQUEST_ONLY',
  recordingConfigured: false,
  transcriptConfigured: false,
  aiNotesConfigured: false,
};

const policy: VideoMeetingAdminPolicy = {
  meetingsEnabled: true,
  waitingRoomRequired: true,
  guestsAllowed: true,
  participantChatAllowed: true,
  reactionsAllowed: true,
  screenShareAllowed: true,
  unmuteControl: 'REQUEST_ONLY',
  recordingPolicy: 'NEVER',
  allowJoinBeforeHost: false,
  requireAuthenticatedInternalUsers: true,
  maximumParticipants: 100,
  retentionDays: 90,
  artifactRetentionDays: 30,
  chatRetentionDays: 90,
  recordingConfigured: false,
  aiNotesConfigured: false,
  version: 4,
};

function requestAt(fetchMock: ReturnType<typeof vi.fn>, index: number): RequestInit {
  return fetchMock.mock.calls[index]?.[1] as RequestInit;
}

function expectIdempotencyHeader(request: RequestInit, expected?: string) {
  const headers = request.headers as Record<string, string>;
  if (expected) expect(headers['Idempotency-Key']).toBe(expected);
  else expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/u);
}

describe('video meeting API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('uses the gateway root for home and capability truth', async () => {
    const home = {
      serverNow: '2026-08-27T00:30:00.000Z',
      timeZone: 'Asia/Seoul',
      capabilities: capability,
      activeMeeting: null,
      nextMeeting: summary,
      today: [summary],
      recent: [],
      metrics: {
        meetingsToday: 1,
        meetingMinutesToday: 50,
        waitingForApproval: 0,
        qualityScore: null,
        averageJoinSeconds: null,
      },
    };
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/meetings/v1/home?timeZone=Asia%2FSeoul') {
        return Promise.resolve(jsonResponse(home));
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getVideoMeetingHome('Asia/Seoul');

    expect(VIDEO_MEETING_API_BASE).toBe('/api/meetings/v1');
    expect(result.nextMeeting).toMatchObject({ meetingId: 'meeting-1', durationMinutes: 50 });
    expect(result.capabilities).toMatchObject({
      recordingConfigured: false,
      aiNotesConfigured: false,
      captions: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meetings/v1/home?timeZone=Asia%2FSeoul',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('loads the canonical meeting list endpoint with server paging', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [summary], page: 1, pageSize: 20, total: 41 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getVideoMeetings(1, 20)).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
      total: 41,
      items: [{ meetingId: 'meeting-1' }],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/meetings/v1/meetings?page=1&pageSize=20');
  });

  it('searches the meeting workforce projection without exposing numeric entry', async () => {
    const person = {
      userId: 17,
      personPublicId: 'person-17',
      emailAddress: 'minseo.kim@sk.com',
      displayName: 'Kim Minseo',
      jobTitle: 'Platform Engineer',
      organizationName: 'Platform Engineering',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([person]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchVideoMeetingPeople('  minseo  ')).resolves.toEqual([person]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/meetings/v1/people?q=minseo&limit=20');
  });

  it('schedules through /meetings with an idempotency header and canonical body', async () => {
    const input: ScheduleVideoMeetingInput = {
      title: 'Quarterly operating review',
      agenda: 'Decisions and owners',
      startsAt: '2026-08-27T01:00:00.000Z',
      durationMinutes: 50,
      timeZone: 'Asia/Seoul',
      participantUserIds: [17, 23],
      accessScope: 'INVITED',
      waitingRoomEnabled: true,
      allowJoinBeforeHost: false,
      defaultMicrophoneEnabled: false,
      defaultCameraEnabled: false,
      idempotencyKey: 'schedule-01',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ meeting: detail, meetingCode: detail.meetingCode }));
    vi.stubGlobal('fetch', fetchMock);

    await scheduleVideoMeeting(input);

    const request = requestAt(fetchMock, 1);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/meetings/v1/meetings');
    expect(request.method).toBe('POST');
    expectIdempotencyHeader(request, 'schedule-01');
    expect(JSON.parse(String(request.body))).toEqual({
      title: input.title,
      description: null,
      agenda: input.agenda,
      startsAt: input.startsAt,
      durationMinutes: 50,
      timeZone: input.timeZone,
      accessScope: input.accessScope,
      waitingRoomEnabled: true,
      guestAccessEnabled: false,
      participantUserIds: [17, 23],
      guestInvitees: [],
      allowJoinBeforeHost: false,
      defaultMicrophoneEnabled: false,
      defaultCameraEnabled: false,
    });
  });

  it('normalizes the full safe alphabet and polls through meeting detail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          meeting: summary,
          joinAllowed: true,
          denialReason: null,
          waitingRoomRequired: true,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          requestId: 'participant-1',
          state: 'WAITING',
          displayName: 'Kim Minseo',
          email: 'minseo.kim@sk.com',
          organizationName: 'Network Operations',
          external: false,
          requestedAt: '2026-08-27T00:58:00.000Z',
          version: 2,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    expect(normalizeVideoMeetingCode(' abcd-efgh lkmn ')).toBe('ABCDEFGHLKMN');
    await resolveVideoMeetingCode(' abcd-efgh lkmn ');
    await expect(getVideoMeetingJoinRequest('meeting/a', 'participant-1')).resolves.toMatchObject({
      requestId: 'participant-1',
      state: 'WAITING',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/meetings/v1/join-codes/ABCDEFGHLKMN');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting%2Fa/join-requests/participant-1'
    );
  });

  it('accepts normalized meeting codes at the 10 and 16 character boundaries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          meeting: summary,
          joinAllowed: true,
          denialReason: null,
          waitingRoomRequired: false,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          meeting: summary,
          joinAllowed: true,
          denialReason: null,
          waitingRoomRequired: false,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await resolveVideoMeetingCode('abcd-efgh-lk');
    await resolveVideoMeetingCode('abcd-efgh-jklm-npqr');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/meetings/v1/join-codes/ABCDEFGHLK',
      '/api/meetings/v1/join-codes/ABCDEFGHJKLMNPQR',
    ]);
    expect(normalizeVideoMeetingCode('ABCDEFGHJKLMNPQRS')).toBe('ABCDEFGHJKLMNPQR');
  });

  it('rejects meeting codes below the server minimum without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveVideoMeetingCode('abcd-efgh-j')).rejects.toThrow(
      '10 to 16 canonical characters'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends expectedVersion and idempotency for start, end, and admission', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ ...detail, lifecycleState: 'LIVE', version: 5 }))
      .mockResolvedValueOnce(jsonResponse({ ...detail, lifecycleState: 'ENDED', version: 6 }))
      .mockResolvedValueOnce(jsonResponse({ ...participant, attendanceState: 'ADMITTED' }));
    vi.stubGlobal('fetch', fetchMock);

    await startVideoMeeting('meeting-1', 4);
    await endVideoMeeting('meeting-1', 5);
    await decideVideoMeetingLobbyRequest('meeting-1', 'participant-1', 2, 'APPROVE');

    const mutations = [
      ['/api/meetings/v1/meetings/meeting-1/start', 4],
      ['/api/meetings/v1/meetings/meeting-1/end', 5],
      ['/api/meetings/v1/meetings/meeting-1/join-requests/participant-1/admit', 2],
    ] as const;
    mutations.forEach(([url, expectedVersion], index) => {
      const request = requestAt(fetchMock, index + 1);
      expect(fetchMock.mock.calls[index + 1]?.[0]).toBe(url);
      expect(JSON.parse(String(request.body))).toEqual({ expectedVersion });
      expectIdempotencyHeader(request);
    });
  });

  it('rejects unsafe media endpoints before mounting LiveKit', async () => {
    expect(isTrustedVideoMeetingServerUrl('wss://meet.example.com')).toBe(true);
    expect(isTrustedVideoMeetingServerUrl('ws://127.0.0.1:7880')).toBe(true);
    expect(isTrustedVideoMeetingServerUrl('ws://10.0.0.9:7880')).toBe(false);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        jsonResponse({
          meetingId: 'meeting-1',
          sessionId: 'participant-1',
          provider: 'LIVEKIT',
          serverUrl: 'https://unsafe.example.com',
          participantToken: 'secret',
          participantRole: 'ATTENDEE',
          expiresAt: '2026-08-26T10:00:00Z',
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(issueVideoMeetingToken('meeting-1', {})).rejects.toThrow(
      'untrusted realtime endpoint'
    );
  });

  it('fails closed on missing room permissions and records connection lifecycle', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        jsonResponse({
          meetingId: 'meeting-1',
          sessionId: 'participant-1',
          provider: 'LIVEKIT',
          serverUrl: 'wss://meet.example.com',
          participantToken: 'secret',
          participantRole: 'ATTENDEE',
          expiresAt: '2026-08-26T10:00:00Z',
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ...participant, attendanceState: 'JOINED' }))
      .mockResolvedValueOnce(jsonResponse({ ...participant, attendanceState: 'LEFT' }));
    vi.stubGlobal('fetch', fetchMock);

    const credential = await issueVideoMeetingToken('meeting-1', {});
    await confirmVideoMeetingConnected('meeting-1');
    await leaveVideoMeeting('meeting-1');

    expect(credential.effectivePermissions).toEqual({
      microphone: false,
      camera: false,
      screenShare: false,
      participantList: false,
      chat: false,
      reactions: false,
      handRaise: false,
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/meetings/v1/meetings/meeting-1/connected');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/meetings/v1/meetings/meeting-1/leave');
  });

  it('uses browser keepalive for page lifecycle departure synchronization', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ ...participant, attendanceState: 'LEFT' }));
    vi.stubGlobal('fetch', fetchMock);

    await leaveVideoMeeting('meeting-1', { keepalive: true });

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/meetings/v1/meetings/meeting-1/leave');
    expect(requestAt(fetchMock, 1)).toMatchObject({ method: 'POST', keepalive: true });
  });

  it('persists only supported policy fields with optimistic locking', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ ...policy, version: 5 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateVideoMeetingAdminPolicy(policy)).resolves.toMatchObject({ version: 5 });

    const request = requestAt(fetchMock, 1);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/meetings/v1/admin/policy');
    expect(request.method).toBe('PUT');
    expectIdempotencyHeader(request);
    expect(JSON.parse(String(request.body))).toEqual({
      meetingsEnabled: true,
      waitingRoomRequired: true,
      guestsAllowed: true,
      participantChatAllowed: true,
      reactionsAllowed: true,
      screenShareAllowed: true,
      recordingPolicy: 'NEVER',
      allowJoinBeforeHost: false,
      requireAuthenticatedInternalUsers: true,
      maximumParticipants: 100,
      retentionDays: 90,
      artifactRetentionDays: 30,
      chatRetentionDays: 90,
      expectedVersion: 4,
    });
  });
});
