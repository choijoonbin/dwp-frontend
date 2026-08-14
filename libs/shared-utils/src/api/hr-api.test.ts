import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { withdrawHrLeaveRequest } from './hr-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('HR API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('withdraws a leave request with evidence and optimistic-lock version', async () => {
    const workspace = { employee: { personId: 'person-1' }, requests: [], teamCalendar: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(workspace));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      withdrawHrLeaveRequest('leave/1', { note: 'Plans changed', version: 4 })
    ).resolves.toEqual(workspace);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/people/v1/hr/absence/requests/leave%2F1/withdraw'
    );
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual({ note: 'Plans changed', version: 4 });
  });
});
