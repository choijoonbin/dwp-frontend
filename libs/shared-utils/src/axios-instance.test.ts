import { it, vi, expect, describe, afterEach } from 'vitest';

import { axiosInstance, resetCsrfToken } from './axios-instance';

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('axiosInstance browser session contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
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
});
