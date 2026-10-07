import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionHttp, setUnauthorizedHandler } from './axios-instance';
import { HttpTransportError } from './http-error';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function pendingBody(responseType: 'json' | 'blob', cooperative = true) {
  const body = deferred<string | Blob>();
  const started = deferred<void>();
  let signal: AbortSignal | undefined;
  const read = vi.fn(() => {
    started.resolve();
    if (cooperative) {
      signal?.addEventListener('abort', () => {
        body.reject(new DOMException('The body read was aborted.', 'AbortError'));
      });
    }
    return body.promise;
  });
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      [responseType === 'json' ? 'text' : 'blob']: read,
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { body, started, fetchMock, signal: () => signal };
}

describe('HTTP response-body cancellation lifespan', () => {
  afterEach(() => {
    vi.useRealTimers();
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['json', 'blob'] as const)(
    'keeps caller cancellation connected while reading the %s body',
    async (responseType) => {
      const response = pendingBody(responseType);
      const caller = new AbortController();
      const request = sessionHttp
        .get('/api/body-query', { signal: caller.signal, responseType })
        .catch((error: unknown) => error);
      await response.started.promise;
      caller.abort('scope-replaced');
      response.body.resolve(responseType === 'json' ? '{"data":"old-scope"}' : new Blob());

      await expect(request).resolves.toBeInstanceOf(HttpTransportError);
      await expect(request).resolves.toMatchObject({ reason: 'ABORT' });
      expect(response.signal()?.aborted).toBe(true);
    }
  );

  it('keeps the configured timeout active until body parsing completes', async () => {
    vi.useFakeTimers();
    const response = pendingBody('json');
    const request = sessionHttp
      .get('/api/body-query', { timeoutMs: 25 })
      .catch((error: unknown) => error);
    await response.started.promise;
    await vi.advanceTimersByTimeAsync(25);
    response.body.resolve('{"data":"late-body"}');

    await expect(request).resolves.toBeInstanceOf(HttpTransportError);
    await expect(request).resolves.toMatchObject({ reason: 'TIMEOUT' });
    expect(response.signal()?.aborted).toBe(true);
  });

  it('does not publish a body that resolves after its caller has cancelled', async () => {
    const response = pendingBody('json', false);
    const caller = new AbortController();
    const request = sessionHttp
      .get('/api/body-query', { signal: caller.signal })
      .catch((error: unknown) => error);
    await response.started.promise;
    caller.abort('scope-replaced');
    response.body.resolve('{"data":"late-old-scope"}');

    await expect(request).resolves.toBeInstanceOf(HttpTransportError);
    await expect(request).resolves.toMatchObject({ reason: 'ABORT' });
  });

  it('classifies a body-read network failure without notifying the session boundary', async () => {
    const response = pendingBody('json');
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    const request = sessionHttp.get('/api/body-query').catch((error: unknown) => error);
    await response.started.promise;
    response.body.reject(new TypeError('Body stream failed.'));

    await expect(request).resolves.toBeInstanceOf(HttpTransportError);
    await expect(request).resolves.toMatchObject({ reason: 'NETWORK' });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('removes its caller listener and timer only after successful body completion', async () => {
    vi.useFakeTimers();
    const response = pendingBody('json');
    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, 'removeEventListener');
    const request = sessionHttp.get('/api/body-query', { signal: caller.signal, timeoutMs: 25 });
    await response.started.promise;
    expect(remove).not.toHaveBeenCalled();
    response.body.resolve('{"data":"current-scope"}');

    await expect(request).resolves.toMatchObject({ data: { data: 'current-scope' } });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    caller.abort('after-completion');
    await vi.advanceTimersByTimeAsync(25);
    expect(response.signal()?.aborted).toBe(false);
  });
});
