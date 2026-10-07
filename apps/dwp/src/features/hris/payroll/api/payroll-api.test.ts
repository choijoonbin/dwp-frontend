import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import { HttpTransportError } from '@dwp-frontend/shared-utils';

import { getHrisPayrollWorkspace } from './payroll-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('getHrisPayrollWorkspace', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('binds the personal HR scope to the Gateway GET', async () => {
    const response = { employee: { personId: 'person-1' }, statements: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(
      getHrisPayrollWorkspace('scope:hcm/personal-pay', controller.signal)
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/people/v1/hr/pay?contextScopeKey=scope%3Ahcm%2Fpersonal-pay'
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('propagates React Query cancellation to the active Gateway request', async () => {
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

    const request = getHrisPayrollWorkspace('scope:hcm/personal-pay', controller.signal).then(
      () => undefined,
      (error: unknown) => error
    );
    controller.abort('scope-changed');

    await expect(request).resolves.toEqual(expect.any(HttpTransportError));
    await expect(request).resolves.toMatchObject({ reason: 'ABORT' });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
