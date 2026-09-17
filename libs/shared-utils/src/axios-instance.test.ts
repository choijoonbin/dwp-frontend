import { it, vi, expect, describe, afterEach } from 'vitest';

import {
  axiosInstance,
  classifyAuthorizationAccessFailure,
  getEventStream,
  resetCsrfToken,
  sessionHttp,
  sessionNeutralHttp,
  setAuthorizationAccessFailureHandler,
  setUnauthorizedHandler,
} from './axios-instance';
import { HttpTransportError } from './http-error';

function jsonResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: async () => JSON.stringify(payload),
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('axiosInstance browser session contract', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetCsrfToken();
    setAuthorizationAccessFailureHandler(null);
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('rejects a changed source before requesting CSRF without a transport failure', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const failure = new Error('source-changed');
    await expect(
      axiosInstance.put(
        '/api/mutation',
        {},
        {
          beforeDispatch: () => {
            throw failure;
          },
        }
      )
    ).rejects.toBe(failure);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechecks the source after asynchronous CSRF and sends no mutation when it changed', async () => {
    const csrf = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(csrf.promise);
    vi.stubGlobal('fetch', fetchMock);
    let current = true;
    const failure = new Error('source-changed-during-csrf');
    const pending = axiosInstance.put(
      '/api/mutation',
      {},
      {
        beforeDispatch: () => {
          if (!current) throw failure;
        },
      }
    );
    current = false;
    csrf.resolve(jsonResponse(200, { data: { token: 'csrf', headerName: 'X-CSRF' } }));
    await expect(pending).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/auth/csrf');
  });

  it('keeps a valid source guard synchronous and dispatches normally', async () => {
    const guard = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'csrf', headerName: 'X-CSRF' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { version: 5 } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      axiosInstance.put('/api/mutation', {}, { beforeDispatch: guard })
    ).resolves.toMatchObject({ data: { data: { version: 5 } } });
    expect(guard).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('classifies an interrupted response body as a transport failure after dispatch', async () => {
    const response = {
      ok: true,
      status: 202,
      headers: new Headers(),
      text: vi.fn().mockRejectedValue(new Error('stream reset after headers')),
    } as unknown as Response;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'csrf', headerName: 'X-CSRF' } }))
      .mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(sessionHttp.post('/api/command', { command: true })).rejects.toMatchObject({
      name: 'HttpTransportError',
      reason: 'NETWORK',
    });
    expect(response.text).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the authenticated session when an authorized route returns forbidden', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(403, { message: 'Forbidden' })));

    await expect(axiosInstance.get('/api/restricted')).rejects.toMatchObject({ status: 403 });

    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('returns a neutral 401 without notifying the session boundary', async () => {
    const unauthorized = vi.fn();
    const accessFailure = vi.fn();
    setUnauthorizedHandler(unauthorized);
    setAuthorizationAccessFailureHandler(accessFailure);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { errorCode: 'AUTHENTICATION_REQUIRED' }))
    );

    await expect(sessionNeutralHttp.get('/api/public-or-lifecycle')).rejects.toMatchObject({
      status: 401,
    });

    expect(unauthorized).not.toHaveBeenCalled();
    expect(accessFailure).not.toHaveBeenCalled();
  });

  it('returns a neutral authority error without notifying the authorization boundary', async () => {
    const accessFailure = vi.fn();
    setAuthorizationAccessFailureHandler(accessFailure);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(409, { errorCode: 'DECISION_REVISION_CONFLICT' }))
    );

    await expect(sessionNeutralHttp.get('/api/best-effort')).rejects.toMatchObject({
      status: 409,
    });

    expect(accessFailure).not.toHaveBeenCalled();
  });

  it('posts authenticated neutral telemetry without notifying session observers', async () => {
    const unauthorized = vi.fn();
    const accessFailure = vi.fn();
    setUnauthorizedHandler(unauthorized);
    setAuthorizationAccessFailureHandler(accessFailure);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(401, { errorCode: 'AUTHENTICATION_REQUIRED' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sessionNeutralHttp.post(
        '/api/platform/v1/observability/web-vitals',
        { name: 'LCP' },
        {
          keepalive: true,
        }
      )
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/observability/web-vitals',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }),
      })
    );
    expect(unauthorized).not.toHaveBeenCalled();
    expect(accessFailure).not.toHaveBeenCalled();
  });

  it('notifies the session boundary for an authoritative 401', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { errorCode: 'AUTHENTICATION_REQUIRED' }))
    );

    await expect(sessionHttp.get('/api/session-required')).rejects.toMatchObject({ status: 401 });

    expect(unauthorized).toHaveBeenCalledOnce();
    expect(unauthorized).toHaveBeenCalledWith(401);
  });

  it('does not deliver a late authoritative 401 to a replacement session observer', async () => {
    const response = deferred<Response>();
    const previousUnauthorized = vi.fn();
    const currentUnauthorized = vi.fn();
    setUnauthorizedHandler(previousUnauthorized);
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise));

    const pendingRequest = sessionHttp.get('/api/session-required');
    setUnauthorizedHandler(currentUnauthorized);
    response.resolve(jsonResponse(401, { errorCode: 'AUTHENTICATION_REQUIRED' }));

    await expect(pendingRequest).rejects.toMatchObject({ status: 401 });
    expect(previousUnauthorized).not.toHaveBeenCalled();
    expect(currentUnauthorized).not.toHaveBeenCalled();
  });

  it.each([
    [403, { errorCode: 'ROUTE_CAPABILITY_REQUIRED' }, false],
    [403, { errorCode: 'SCOPE_SELECTION_REQUIRED' }, false],
    [403, { code: 'E2001' }, false],
    [403, { message: 'Forbidden' }, false],
    [403, { errorCode: 'STEP_UP_REQUIRED' }, false],
    [403, { errorCode: 'STEP_UP_CHALLENGE_EXPIRED' }, false],
    [403, { errorCode: 'SOD_CONFLICT' }, false],
    [403, { errorCode: 'SCOPE_CONTEXT_EXPIRED' }, true],
    [409, { errorCode: 'DECISION_REVISION_CONFLICT' }, true],
    [409, { errorCode: 'SCOPE_CONTEXT_EXPIRED' }, true],
    [409, { errorCode: 'OBJECT_VERSION_CONFLICT' }, false],
    [409, { errorCode: 'STEP_UP_CHALLENGE_REPLAY' }, false],
    [409, { code: 'E1009' }, false],
    [503, { errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE' }, true],
    [503, { errorCode: 'UPSTREAM_UNAVAILABLE' }, false],
    [401, { errorCode: 'AUTHENTICATION_REQUIRED' }, false],
  ])('classifies only an authorization freshness failure (%s, %o)', (status, payload, expected) => {
    expect(Boolean(classifyAuthorizationAccessFailure(status, payload))).toBe(expected);
  });

  it('notifies the authority boundary without replacing the original access error', async () => {
    const accessFailure = vi.fn();
    setAuthorizationAccessFailureHandler(accessFailure);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          409,
          {
            errorCode: 'DECISION_REVISION_CONFLICT',
            message: 'Authority revision changed.',
          },
          { 'X-DWP-Decision-Revision': 'decision-revision-8' }
        )
      )
    );

    await expect(
      axiosInstance.get('/api/governed-resource', {
        headers: { 'x-dwp-expected-decision-revision': 'decision-revision-7' },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'Authority revision changed.',
    });

    expect(accessFailure).toHaveBeenCalledWith({
      status: 409,
      reasonCode: 'DECISION_REVISION_CONFLICT',
      rejectedDecisionRevision: 'decision-revision-7',
      serverDecisionRevision: 'decision-revision-8',
    });
  });

  it('notifies the authority boundary when an issued scope has expired', async () => {
    const accessFailure = vi.fn();
    setAuthorizationAccessFailureHandler(accessFailure);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(403, {
          errorCode: 'SCOPE_CONTEXT_EXPIRED',
          message: 'The issued scope is no longer valid.',
        })
      )
    );

    await expect(
      axiosInstance.get('/api/governed-resource', { contextScopeKey: 'scope-expired' })
    ).rejects.toMatchObject({
      status: 403,
      message: 'The issued scope is no longer valid.',
    });

    expect(accessFailure).toHaveBeenCalledWith({
      status: 403,
      reasonCode: 'SCOPE_CONTEXT_EXPIRED',
      contextScopeKey: 'scope-expired',
    });
  });

  it('does not deliver a late access failure to a replacement session observer', async () => {
    const response = deferred<Response>();
    const previousSessionFailure = vi.fn();
    const currentSessionFailure = vi.fn();
    setAuthorizationAccessFailureHandler(previousSessionFailure);
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise));

    const pendingRequest = axiosInstance.get('/api/governed-resource', {
      headers: { 'X-DWP-Expected-Decision-Revision': 'shared-revision' },
    });
    setAuthorizationAccessFailureHandler(currentSessionFailure);
    response.resolve(
      jsonResponse(409, {
        errorCode: 'DECISION_REVISION_CONFLICT',
        message: 'Authority revision changed.',
      })
    );

    await expect(pendingRequest).rejects.toMatchObject({ status: 409 });
    expect(previousSessionFailure).not.toHaveBeenCalled();
    expect(currentSessionFailure).not.toHaveBeenCalled();
  });

  it('does not notify the authority boundary for authoritative denials or a 401 session', async () => {
    const accessFailure = vi.fn();
    const unauthorized = vi.fn();
    setAuthorizationAccessFailureHandler(accessFailure);
    setUnauthorizedHandler(unauthorized);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(403, { errorCode: 'ROUTE_CAPABILITY_REQUIRED' }))
        .mockResolvedValueOnce(jsonResponse(403, { errorCode: 'SCOPE_SELECTION_REQUIRED' }))
        .mockResolvedValueOnce(jsonResponse(403, { errorCode: 'E2001' }))
        .mockResolvedValueOnce(jsonResponse(403, { errorCode: 'STEP_UP_REQUIRED' }))
        .mockResolvedValueOnce(jsonResponse(403, { errorCode: 'SOD_CONFLICT' }))
        .mockResolvedValueOnce(jsonResponse(409, { errorCode: 'OBJECT_VERSION_CONFLICT' }))
        .mockResolvedValueOnce(jsonResponse(401, { errorCode: 'AUTHENTICATION_REQUIRED' }))
    );

    await expect(axiosInstance.get('/api/route-denied')).rejects.toMatchObject({ status: 403 });
    await expect(axiosInstance.get('/api/scope-required')).rejects.toMatchObject({ status: 403 });
    await expect(axiosInstance.get('/api/forbidden')).rejects.toMatchObject({ status: 403 });
    await expect(axiosInstance.get('/api/step-up')).rejects.toMatchObject({ status: 403 });
    await expect(axiosInstance.get('/api/sod')).rejects.toMatchObject({ status: 403 });
    await expect(axiosInstance.get('/api/version')).rejects.toMatchObject({ status: 409 });
    await expect(axiosInstance.get('/api/session')).rejects.toMatchObject({ status: 401 });

    expect(accessFailure).not.toHaveBeenCalled();
    expect(unauthorized).toHaveBeenCalledOnce();
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
    const accessFailure = vi.fn();
    setAuthorizationAccessFailureHandler(accessFailure);
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
    expect(accessFailure).not.toHaveBeenCalled();
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

  it('revalidates a caller-owned snapshot with If-None-Match and accepts 304', async () => {
    const privateData = { value: 'recipient-scoped' };
    const first = jsonResponse(200, privateData, { ETag: '"authority-revision-7"' });
    const notModified = jsonResponse(304, undefined, { ETag: '"authority-revision-7"' });
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(notModified);
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await sessionHttp.getConditional<typeof privateData>('/api/private-home');
    const revalidated = await sessionHttp.getConditional('/api/private-home', loaded.snapshot);

    expect(loaded).toEqual({
      headers: first.headers,
      snapshot: { data: privateData, etag: '"authority-revision-7"' },
      status: 200,
      notModified: false,
    });
    expect(revalidated).toEqual({
      headers: notModified.headers,
      snapshot: loaded.snapshot,
      status: 304,
      notModified: true,
    });
    expect(revalidated.snapshot).toBe(loaded.snapshot);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('If-None-Match');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual(
      expect.objectContaining({ 'If-None-Match': '"authority-revision-7"' })
    );
  });

  it('does not retain or resend an entity tag without an explicit snapshot', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { value: 'first' }, { ETag: '"revision-1"' }))
      .mockResolvedValueOnce(jsonResponse(200, { value: 'second' }, { ETag: '"revision-2"' }));
    vi.stubGlobal('fetch', fetchMock);

    await sessionHttp.getConditional('/api/private-home');
    await sessionHttp.getConditional('/api/private-home');

    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('If-None-Match');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).not.toHaveProperty('If-None-Match');
  });

  it('rejects an unsafe snapshot validator without dispatching a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sessionHttp.getConditional('/api/private-home', {
        data: { private: true },
        etag: '"revision"\r\nX-Injected: true',
      })
    ).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('reports an event stream as open after the response body is accepted', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: notification.connected\ndata: {"changeVersion":"0","changedIds":[],"arrivalIds":[]}\n\n'
          )
        );
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body } as Response));
    const onOpen = vi.fn();
    const onMessage = vi.fn();

    await getEventStream('/api/notifications/v1/stream', { onOpen, onMessage });

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith({
      event: 'notification.connected',
      data: { changeVersion: '0', changedIds: [], arrivalIds: [] },
    });
  });
});
