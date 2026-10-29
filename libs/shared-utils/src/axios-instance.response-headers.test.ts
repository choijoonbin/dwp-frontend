import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance, getEventStream, resetCsrfToken } from './axios-instance';
import { HttpError } from './http-error';

describe('axiosInstance response header contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('preserves response headers on a regular API failure for bounded support references', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errorCode: 'UNAVAILABLE' }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': 'corr-regular-503',
          },
        })
      )
    );

    const request = axiosInstance
      .get('/api/notifications/v1/summary')
      .catch((error: unknown) => error);

    await expect(request).resolves.toBeInstanceOf(HttpError);
    const error = (await request) as HttpError;
    expect(error.headers?.get('X-Correlation-ID')).toBe('corr-regular-503');
  });

  it('preserves response headers when an event stream request is rate limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errorCode: 'RATE_LIMITED' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '17',
          },
        })
      )
    );

    const request = getEventStream('/api/notifications/v1/stream', {
      onMessage: vi.fn(),
    }).catch((error: unknown) => error);

    await expect(request).resolves.toBeInstanceOf(HttpError);
    await expect(request).resolves.toMatchObject({ status: 429 });
    const error = (await request) as HttpError;
    expect(error.headers?.get('Retry-After')).toBe('17');
  });
});
