import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';

import {
  acknowledgeVideoMeetingContentNotice,
  getVideoMeetingContentPlan,
  requestVideoMeetingRecording,
  stopVideoMeetingRecording,
  updateVideoMeetingContentPlan,
} from './video-meeting-content-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function requestAt(fetchMock: ReturnType<typeof vi.fn>, index: number): RequestInit {
  return fetchMock.mock.calls[index]?.[1] as RequestInit;
}

const plan = {
  meetingId: 'meeting-1',
  planId: 'plan-1',
  recordingRequested: true,
  transcriptionRequested: true,
  aiSummaryRequested: false,
  e2eeEnabled: false,
  state: 'READY',
  blockers: [],
  dependencies: {
    egressAvailable: true,
    storageAvailable: true,
    kmsAvailable: true,
    auditAvailable: true,
    speechToTextAvailable: true,
    languageModelAvailable: false,
  },
  notice: {
    noticeId: 'notice-1',
    revision: 2,
    state: 'PUBLISHED',
    disclosureCode: 'RECORDING_AND_TRANSCRIPTION',
    recordingDisclosed: true,
    transcriptionDisclosed: true,
    aiSummaryDisclosed: false,
    publishedAt: '2026-08-28T01:00:00Z',
    acknowledgedByViewer: false,
  },
  consent: { requiredAcknowledgements: 2, receivedAcknowledgements: 1, complete: false },
  recordingSession: null,
  version: 4,
  updatedAt: '2026-08-28T01:00:00Z',
} as const;

describe('video meeting content API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads the server-authoritative content plan from the canonical path', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(plan));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getVideoMeetingContentPlan('meeting/a')).resolves.toMatchObject({
      planId: 'plan-1',
      state: 'READY',
      notice: { revision: 2, acknowledgedByViewer: false },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/meetings/v1/meetings/meeting%2Fa/content-plan');
  });

  it('updates a plan and acknowledges its current notice with idempotency', async () => {
    const acknowledgement = {
      acknowledgementId: 'ack-1',
      noticeId: 'notice-1',
      noticeRevision: 2,
      participantId: 'participant-1',
      acknowledgedAt: '2026-08-28T01:01:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(plan))
      .mockResolvedValueOnce(jsonResponse(acknowledgement));
    vi.stubGlobal('fetch', fetchMock);

    await updateVideoMeetingContentPlan('meeting-1', {
      recordingRequested: true,
      transcriptionRequested: true,
      aiSummaryRequested: false,
      e2eeEnabled: false,
      expectedVersion: 3,
      idempotencyKey: 'content-plan-01',
    });
    await acknowledgeVideoMeetingContentNotice('meeting-1', 'notice/1', 'content-ack-01');

    expect(JSON.parse(String(requestAt(fetchMock, 1).body))).toEqual({
      recordingRequested: true,
      transcriptionRequested: true,
      aiSummaryRequested: false,
      e2eeEnabled: false,
      expectedVersion: 3,
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting-1/content-notices/notice%2F1/acknowledge'
    );
    expect((requestAt(fetchMock, 2).headers as Record<string, string>)['Idempotency-Key']).toBe(
      'content-ack-01'
    );
  });

  it('requests and stops recording with optimistic concurrency versions', async () => {
    const command = {
      accepted: true,
      commandState: 'REQUESTED',
      blockers: [],
      recordingSession: { recordingSessionId: 'session-1', state: 'REQUESTED', version: 9 },
      contentPlanVersion: 4,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(command))
      .mockResolvedValueOnce(jsonResponse({ ...command, commandState: 'STOP_REQUESTED' }));
    vi.stubGlobal('fetch', fetchMock);

    await requestVideoMeetingRecording('meeting-1', 4, 'recording-start-01');
    await stopVideoMeetingRecording('meeting-1', 9, 'recording-stop-01');

    expect(JSON.parse(String(requestAt(fetchMock, 1).body))).toEqual({ expectedPlanVersion: 4 });
    expect(JSON.parse(String(requestAt(fetchMock, 2).body))).toEqual({
      expectedSessionVersion: 9,
    });
  });

  it('rejects malformed command keys before a mutation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestVideoMeetingRecording('meeting-1', 4, 'bad key')).rejects.toThrow(
      'valid idempotency key'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
