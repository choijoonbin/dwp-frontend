import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';

import {
  acknowledgeVideoMeetingHand,
  clearVideoMeetingHandRequests,
  deleteVideoMeetingChatMessage,
  getVideoMeetingChatMessages,
  getVideoMeetingHandRequests,
  raiseVideoMeetingHand,
  sendVideoMeetingChatMessage,
} from './video-meeting-collaboration-api';

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

const participant = {
  participantId: 'participant-17',
  userId: 17,
  personPublicId: 'person-17',
  displayName: 'Kim Minseo',
  participantRole: 'ATTENDEE',
};

const chatMessage = {
  messageId: 'message-1',
  sequence: 7,
  createdSequence: 7,
  sender: participant,
  state: 'ACTIVE',
  text: 'Please review the rollout risk.',
  sentAt: '2026-08-27T08:00:00Z',
  retentionUntil: '2026-11-25T08:00:00Z',
  deletedAt: null,
  mine: true,
  canDelete: true,
};

const handRequest = {
  requestId: 'request-1',
  sequence: 8,
  raisedSequence: 8,
  requester: participant,
  state: 'RAISED',
  raisedAt: '2026-08-27T08:01:00Z',
  acknowledgedAt: null,
  resolvedAt: null,
  mine: true,
  canLower: true,
  canAcknowledge: false,
  canDismiss: false,
};

describe('video meeting collaboration API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads incremental chat and hand streams with bounded cursors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ items: [chatMessage], nextSequence: 7, hasMore: false })
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [handRequest], nextSequence: 8, hasMore: false })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getVideoMeetingChatMessages('meeting/a', -4, 500)).resolves.toMatchObject({
      nextSequence: 7,
      items: [{ messageId: 'message-1' }],
    });
    await expect(getVideoMeetingHandRequests('meeting/a', 7, 50)).resolves.toMatchObject({
      nextSequence: 8,
      items: [{ requestId: 'request-1' }],
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/meetings/v1/meetings/meeting%2Fa/chat/messages?afterSequence=0&limit=100',
      '/api/meetings/v1/meetings/meeting%2Fa/hand-requests?afterSequence=7&limit=50',
    ]);
  });

  it('sends and tombstones chat with canonical bodies and idempotency', async () => {
    const deleted = { ...chatMessage, sequence: 9, state: 'DELETED', text: '', canDelete: false };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(chatMessage))
      .mockResolvedValueOnce(jsonResponse(deleted));
    vi.stubGlobal('fetch', fetchMock);

    await sendVideoMeetingChatMessage('meeting-1', {
      text: '  Please review the rollout risk.  ',
      idempotencyKey: 'chat-message-01',
    });
    await deleteVideoMeetingChatMessage('meeting-1', 'message/1', {
      reason: '  withdrawn  ',
      idempotencyKey: 'chat-delete-01',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/meetings/v1/meetings/meeting-1/chat/messages');
    expect(JSON.parse(String(requestAt(fetchMock, 1).body))).toEqual({
      text: 'Please review the rollout risk.',
    });
    expect((requestAt(fetchMock, 1).headers as Record<string, string>)['Idempotency-Key']).toBe(
      'chat-message-01'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/meetings/v1/meetings/meeting-1/chat/messages/message%2F1/delete'
    );
    expect(JSON.parse(String(requestAt(fetchMock, 2).body))).toEqual({ reason: 'withdrawn' });
  });

  it('uses idempotent commands for the participant and moderator hand queue', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(handRequest))
      .mockResolvedValueOnce(jsonResponse({ ...handRequest, state: 'ACKNOWLEDGED', sequence: 9 }))
      .mockResolvedValueOnce(jsonResponse({ clearedCount: 1, sequence: 10 }));
    vi.stubGlobal('fetch', fetchMock);

    await raiseVideoMeetingHand('meeting-1', 'hand-raise-01');
    await acknowledgeVideoMeetingHand('meeting-1', 'request/1', 'hand-ack-0001');
    await expect(clearVideoMeetingHandRequests('meeting-1', 'hand-clear-01')).resolves.toEqual({
      clearedCount: 1,
      sequence: 10,
    });

    expect(fetchMock.mock.calls.slice(1).map(([url]) => url)).toEqual([
      '/api/meetings/v1/meetings/meeting-1/hand-requests/raise',
      '/api/meetings/v1/meetings/meeting-1/hand-requests/request%2F1/acknowledge',
      '/api/meetings/v1/meetings/meeting-1/hand-requests/clear',
    ]);
    for (const [index, key] of ['hand-raise-01', 'hand-ack-0001', 'hand-clear-01'].entries()) {
      expect(
        (requestAt(fetchMock, index + 1).headers as Record<string, string>)['Idempotency-Key']
      ).toBe(key);
    }
  });

  it('rejects malformed idempotency keys before a collaboration mutation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(raiseVideoMeetingHand('meeting-1', 'bad key')).rejects.toThrow(
      'valid idempotency key'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
