import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionHttp } from './axios-instance';
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

// Deliberately non-cooperative: the first native signal reason is authoritative,
// even when body settlement is delayed until after the other abort source fires.
function delayedBody(responseType: 'json' | 'blob' = 'json') {
  const body = deferred<string | Blob>();
  const started = deferred<void>();
  let signal: AbortSignal | undefined;
  const read = vi.fn(() => {
    started.resolve();
    return body.promise;
  });
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      [responseType === 'json' ? 'text' : 'blob']: read,
    } as unknown as Response;
  }));
  return { body, started, signal: () => signal };
}

describe('HTTP cancellation race preserves the first abort source', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['json', 'blob'] as const)(
    'preserves caller-first ABORT when a late %s body outlives the deadline',
    async (responseType) => {
      vi.useFakeTimers();
      const response = delayedBody(responseType);
      const caller = new AbortController();
      const remove = vi.spyOn(caller.signal, 'removeEventListener');
      const request = sessionHttp.get('/api/cancellation-race', {
        signal: caller.signal, timeoutMs: 25, responseType,
      }).catch((error: unknown) => error);
      await response.started.promise;
      await vi.advanceTimersByTimeAsync(5);
      caller.abort('scope-replaced');
      await vi.advanceTimersByTimeAsync(25);
      response.body.resolve(responseType === 'json' ? '{"data":"obsolete"}' : new Blob());

      const error = await request;
      expect(error).toBeInstanceOf(HttpTransportError);
      expect(response.signal()?.reason).toBe('scope-replaced');
      expect(remove).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(error).toMatchObject({ reason: 'ABORT' });
    }
  );

  it('does not relabel caller-first cancellation after a late body network rejection', async () => {
    vi.useFakeTimers();
    const response = delayedBody();
    const caller = new AbortController();
    const request = sessionHttp.get('/api/cancellation-race', {
      signal: caller.signal, timeoutMs: 25,
    }).catch((error: unknown) => error);
    await response.started.promise;
    caller.abort('scope-replaced');
    await vi.advanceTimersByTimeAsync(30);
    response.body.reject(new TypeError('late body failure'));

    const error = await request;
    expect(response.signal()?.reason).toBe('scope-replaced');
    expect(error).toBeInstanceOf(HttpTransportError);
    expect(error).toMatchObject({ reason: 'ABORT' });
  });

  it('preserves an already-aborted caller despite a later deadline', async () => {
    vi.useFakeTimers();
    const response = delayedBody();
    const caller = new AbortController();
    caller.abort('scope-replaced');
    const request = sessionHttp.get('/api/cancellation-race', {
      signal: caller.signal, timeoutMs: 25,
    }).catch((error: unknown) => error);
    await response.started.promise;
    await vi.advanceTimersByTimeAsync(30);
    response.body.resolve('{"data":"obsolete"}');

    expect(response.signal()?.reason).toBe('scope-replaced');
    await expect(request).resolves.toMatchObject({ reason: 'ABORT' });
  });

  it('preserves TIMEOUT when the deadline fires before caller cancellation', async () => {
    vi.useFakeTimers();
    const response = delayedBody();
    const caller = new AbortController();
    const request = sessionHttp.get('/api/cancellation-race', {
      signal: caller.signal, timeoutMs: 25,
    }).catch((error: unknown) => error);
    await response.started.promise;
    await vi.advanceTimersByTimeAsync(25);
    caller.abort('scope-replaced');
    response.body.resolve('{"data":"late"}');

    expect(response.signal()?.reason).toBe('request-timeout');
    await expect(request).resolves.toMatchObject({ reason: 'TIMEOUT' });
  });

  it('uses caller-first timer ordering at the same deadline', async () => {
    vi.useFakeTimers();
    const response = delayedBody();
    const caller = new AbortController();
    globalThis.setTimeout(() => caller.abort('scope-replaced'), 25);
    const request = sessionHttp.get('/api/cancellation-race', {
      signal: caller.signal, timeoutMs: 25,
    }).catch((error: unknown) => error);
    await response.started.promise;
    await vi.advanceTimersByTimeAsync(30);
    response.body.resolve('{"data":"obsolete"}');

    expect(response.signal()?.reason).toBe('scope-replaced');
    await expect(request).resolves.toMatchObject({ reason: 'ABORT' });
  });

  it('uses timeout-first timer ordering at the same deadline', async () => {
    vi.useFakeTimers();
    const response = delayedBody();
    const caller = new AbortController();
    const request = sessionHttp.get('/api/cancellation-race', {
      signal: caller.signal, timeoutMs: 25,
    }).catch((error: unknown) => error);
    await response.started.promise;
    globalThis.setTimeout(() => caller.abort('scope-replaced'), 25);
    await vi.advanceTimersByTimeAsync(30);
    response.body.resolve('{"data":"late"}');

    expect(response.signal()?.reason).toBe('request-timeout');
    await expect(request).resolves.toMatchObject({ reason: 'TIMEOUT' });
  });
});
