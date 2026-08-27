import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { synthesizeDwaionSpeech, transcribeDwaionVoice } from './agent-voice-api';

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('Agent voice API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('sends an ephemeral audio blob and returns a reviewable transcript', async () => {
    const recording = new Blob(['voice'], { type: 'audio/webm' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { text: '오늘 우선순위를 알려주세요.', language: 'ko-KR' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(transcribeDwaionVoice(recording, 'ko-KR')).resolves.toEqual({
      text: '오늘 우선순위를 알려주세요.',
      language: 'ko-KR',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/voice/transcriptions',
      expect.objectContaining({
        method: 'POST',
        body: recording,
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'audio/webm',
          'X-DWP-Voice-Locale': 'ko-KR',
        }),
      })
    );
  });

  it('accepts browser codec parameters on an approved recording media type', async () => {
    const recording = new Blob(['voice'], { type: 'audio/webm;codecs=opus' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { text: 'Review my work.', language: 'en-US' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(transcribeDwaionVoice(recording, 'en-US')).resolves.toMatchObject({
      text: 'Review my work.',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/voice/transcriptions',
      expect.objectContaining({ body: recording })
    );
  });

  it('returns verified audio and rejects malformed inputs', async () => {
    const audio = new Blob(['mp3'], { type: 'audio/mpeg' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => audio,
        headers: new Headers({ 'Content-Type': 'audio/mpeg' }),
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(synthesizeDwaionSpeech('검증된 답변입니다.', 'ko-KR')).resolves.toBe(audio);
    await expect(
      transcribeDwaionVoice(new Blob(['voice'], { type: 'audio/aac' }), 'ko-KR')
    ).rejects.toBeInstanceOf(TypeError);
    await expect(synthesizeDwaionSpeech('answer', 'invalid_locale!')).rejects.toBeInstanceOf(
      TypeError
    );
  });
});
