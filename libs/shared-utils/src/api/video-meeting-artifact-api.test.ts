import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createVideoMeetingArtifactAccessTicket,
  normalizeVideoMeetingArtifactAccessTicket,
} from './video-meeting-artifact-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

const artifactId = '84000000-0000-0000-0000-000000000401';
const ticket = {
  artifactId,
  artifactVersion: 7,
  accessUrl: 'https://media.dwp.example/opaque/ticket-1',
  expiresAt: '2026-08-31T05:02:00Z',
  contentType: 'video/mp4',
};

describe('video meeting artifact access API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts the optimistic artifact version to the canonical access-ticket path', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T05:00:00Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(ticket));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createVideoMeetingArtifactAccessTicket(
        'meeting/1',
        artifactId,
        7,
        'video/mp4',
        '2026-09-01T00:00:00Z'
      )
    ).resolves.toEqual(ticket);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/meetings/v1/meetings/meeting%2F1/artifacts/${artifactId}/access-ticket`
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      expectedArtifactVersion: 7,
    });
  });

  it.each([
    [{ ...ticket, artifactId: 'other' }, 'artifact identity'],
    [{ ...ticket, artifactVersion: 8 }, 'artifact version'],
    [{ ...ticket, accessUrl: 'http://media.dwp.example/ticket' }, 'HTTPS'],
    [{ ...ticket, accessUrl: 'https://127.0.0.1/ticket' }, 'public host'],
    [{ ...ticket, accessUrl: 'https://user:secret@media.dwp.example/ticket' }, 'credentials'],
    [{ ...ticket, accessUrl: 'https://media.dwp.example/ticket#object-key' }, 'fragment'],
    [{ ...ticket, expiresAt: '2026-08-31T04:59:59Z' }, 'future expiry'],
    [{ ...ticket, expiresAt: '2026-09-02T00:00:00Z' }, 'retention boundary'],
    [{ ...ticket, contentType: 'application/json' }, 'playable media'],
    [{ ...ticket, contentType: 'audio/webm' }, 'artifact media binding'],
  ])('fails closed when the %s binding is invalid (%s)', (candidate) => {
    expect(() =>
      normalizeVideoMeetingArtifactAccessTicket(
        candidate,
        artifactId,
        7,
        'video/mp4',
        '2026-09-01T00:00:00Z',
        Date.parse('2026-08-31T05:00:00Z')
      )
    ).toThrow('access ticket is invalid');
  });
});
