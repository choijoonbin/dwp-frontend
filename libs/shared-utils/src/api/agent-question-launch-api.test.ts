import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { consumeQuestionLaunch, createQuestionLaunch } from './agent-question-launch-api';

const LAUNCH_ID = '00000000-0000-4000-8000-000000000016';

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('Agent question launch API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates an opaque server ticket without putting the question in the response contract', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T03:00:00Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          data: { launchId: LAUNCH_ID, expiresAt: '2026-08-27T03:01:00Z' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createQuestionLaunch('  confidential work question  ')).resolves.toEqual({
      launchId: LAUNCH_ID,
      expiresAt: '2026-08-27T03:01:00Z',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/question-launches',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ question: 'confidential work question' }),
      })
    );
  });

  it('consumes a ticket through the request body and returns the recovered question', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, data: { question: 'confidential work question' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(consumeQuestionLaunch(LAUNCH_ID)).resolves.toBe('confidential work question');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/question-launches/consume',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ launchId: LAUNCH_ID }),
      })
    );
  });

  it('fails closed for malformed requests and malformed responses', async () => {
    await expect(createQuestionLaunch('x')).rejects.toBeInstanceOf(TypeError);
    await expect(consumeQuestionLaunch('not-a-ticket')).rejects.toBeInstanceOf(TypeError);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse(201, { success: true, data: { launchId: 'invalid' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createQuestionLaunch('valid question')).rejects.toMatchObject({ status: 502 });
  });

  it('rejects stale or implausibly long-lived launch receipts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T03:00:00Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          data: { launchId: LAUNCH_ID, expiresAt: '2026-08-27T03:02:00Z' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createQuestionLaunch('valid question')).rejects.toMatchObject({ status: 502 });
  });
});
