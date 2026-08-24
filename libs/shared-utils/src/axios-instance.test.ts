import { it, vi, expect, describe, afterEach } from 'vitest';

import { axiosInstance, resetCsrfToken, setUnauthorizedHandler } from './axios-instance';
import { HttpTransportError } from './http-error';

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('axiosInstance browser session contract', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetCsrfToken();
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('keeps the authenticated session when an authorized route returns forbidden', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { message: 'Forbidden' })));

    await expect(axiosInstance.get('/api/restricted')).rejects.toMatchObject({ status: 403 });

    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('sends an opaque scope only as the standard query parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await axiosInstance.get('/api/approvals/v1/admin/workflows?view=active', {
      contextScopeKey: 'scope-a/b',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/approvals/v1/admin/workflows?view=active&contextScopeKey=scope-a%2Fb'
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.stringify(request.headers)).not.toContain('scope-a/b');
  });

  it.each([
    ['', '/api/example'],
    [' scope-1', '/api/example'],
    ['scope-1', '/api/example?contextScopeKey=scope-2'],
    ['scope-1', '/api/example#fragment'],
  ])('rejects an ambiguous or malformed product scope', async (contextScopeKey, url) => {
    vi.stubGlobal('fetch', vi.fn());

    await expect(axiosInstance.get(url, { contextScopeKey })).rejects.toThrowError(
      'Product surface context scope is invalid.'
    );
  });

  it('uses credentials and adds an in-memory CSRF token to mutations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { updated: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await axiosInstance.post('/api/example', { value: 'next' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/csrf',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/example',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'X-XSRF-TOKEN': 'csrf-token',
        }),
      })
    );
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.headers).not.toHaveProperty('Authorization');
  });

  it('keeps the CSRF bootstrap alive for unload-safe mutations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(204, undefined));
    vi.stubGlobal('fetch', fetchMock);

    await axiosInstance.post('/api/telemetry', { name: 'LCP' }, { keepalive: true });

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ keepalive: true }));
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ keepalive: true }));
  });

  it('requests a new CSRF token after the in-memory token is reset', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'first-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: {} }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'second-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await axiosInstance.post('/api/first', undefined);
    resetCsrfToken();
    await axiosInstance.post('/api/second', undefined);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const secondMutation = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(secondMutation.headers).toEqual(
      expect.objectContaining({ 'X-XSRF-TOKEN': 'second-token' })
    );
  });

  it('refreshes a stale CSRF token once when the gateway rejects a mutation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'stale-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => '',
      } as Response)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'fresh-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { updated: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await axiosInstance.post('/api/example', { value: 'next' });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retriedMutation = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(retriedMutation.headers).toEqual(
      expect.objectContaining({ 'X-XSRF-TOKEN': 'fresh-token' })
    );
  });

  it('lets the browser set the multipart boundary for FormData mutations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.set('file', new Blob(['image-bytes'], { type: 'image/png' }), 'home.png');

    await axiosInstance.post('/api/upload', form);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.body).toBe(form);
    expect(request.headers).not.toHaveProperty('Content-Type');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
  });

  it('sends Blob mutations without JSON serialization', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: { status: 'CLEAN' } }));
    vi.stubGlobal('fetch', fetchMock);
    const content = new Blob(['report'], { type: 'application/pdf' });

    await axiosInstance.put('/api/messaging/upload', content, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.body).toBe(content);
    expect(request.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/octet-stream',
        'X-XSRF-TOKEN': 'csrf-token',
      })
    );
  });

  it('returns binary downloads as Blob without text parsing', async () => {
    const download = new Blob(['audit-export'], { type: 'text/csv' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => download,
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const response = await axiosInstance.get<Blob>('/api/audit/export', {
      responseType: 'blob',
    });

    expect(response.data).toBe(download);
  });

  it('aborts non-essential requests after their configured timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = axiosInstance.get('/api/optional-preference', { timeoutMs: 25 }).then(
      () => undefined,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(25);

    await expect(request).resolves.toEqual(expect.any(HttpTransportError));
    await expect(request).resolves.toMatchObject({ reason: 'TIMEOUT' });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal?.aborted).toBe(true);
  });

  it('propagates caller cancellation to the active browser request', async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const request = axiosInstance
      .get('/api/long-running-query', { signal: controller.signal })
      .then(
        () => undefined,
        (error: unknown) => error
      );
    controller.abort('superseded');

    await expect(request).resolves.toEqual(expect.any(HttpTransportError));
    await expect(request).resolves.toMatchObject({ reason: 'ABORT' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
