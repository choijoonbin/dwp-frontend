import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  endMessagingMeeting,
  getCurrentMessagingMeeting,
  isTrustedMeetingServerUrl,
  issueMessagingMeetingToken,
  startMessagingMeeting,
} from './messaging-meeting-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('messaging meeting API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads the current session through the conversation-scoped gateway route', async () => {
    const session = { sessionId: 'session-1', lifecycleState: 'ACTIVE' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ session }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCurrentMessagingMeeting('conversation/a')).resolves.toEqual(session);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/messaging/v1/conversations/conversation%2Fa/meetings/current',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('starts a meeting with CSRF protection and no client-supplied provider data', async () => {
    const session = { sessionId: 'session-1', lifecycleState: 'ACTIVE' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(session));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startMessagingMeeting('conversation-1')).resolves.toEqual(session);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/meetings/start'
    );
    expect(request.method).toBe('POST');
    expect(JSON.parse(String(request.body))).toEqual({});
  });

  it('ends a meeting through the conversation-scoped endpoint without provider input', async () => {
    const session = { sessionId: 'session-1', lifecycleState: 'ENDED' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(session));
    vi.stubGlobal('fetch', fetchMock);

    await expect(endMessagingMeeting('conversation-1')).resolves.toEqual(session);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/meetings/end'
    );
    expect(request.method).toBe('POST');
    expect(JSON.parse(String(request.body))).toEqual({});
  });

  it('accepts secure endpoints and local development websocket endpoints only', async () => {
    expect(isTrustedMeetingServerUrl('wss://meet.example.com')).toBe(true);
    expect(isTrustedMeetingServerUrl('ws://localhost:7880')).toBe(true);
    expect(isTrustedMeetingServerUrl('ws://192.168.1.20:7880')).toBe(false);
    expect(isTrustedMeetingServerUrl('https://meet.example.com')).toBe(false);

    const credential = {
      sessionId: 'session-1',
      provider: 'LIVEKIT',
      serverUrl: 'ws://untrusted.example.com',
      participantToken: 'secret-token',
      expiresAt: '2026-08-19T10:35:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(credential));
    vi.stubGlobal('fetch', fetchMock);

    await expect(issueMessagingMeetingToken('conversation-1')).rejects.toThrow(
      'untrusted realtime endpoint'
    );
  });
});
