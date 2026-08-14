import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { decideApprovalTask, getApprovalHome, updateApprovalDraft } from './approval-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('approval API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads the decision hub from its product service route', async () => {
    const home = { generatedAt: '2026-08-14T00:00:00Z', focusQueue: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(home));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getApprovalHome()).resolves.toEqual(home);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/approvals/v1/home',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('sends a versioned decision through the shared CSRF contract', async () => {
    const detail = { task: { taskId: 'task-1', status: 'APPROVED' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(detail));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      decideApprovalTask('task-1', {
        decision: 'APPROVE',
        comment: 'Evidence reviewed',
        expectedVersion: 3,
      })
    ).resolves.toEqual(detail);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/approvals/v1/tasks/task-1/decisions');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual({
      decision: 'APPROVE',
      comment: 'Evidence reviewed',
      expectedVersion: 3,
    });
  });

  it('updates an owned draft with its optimistic concurrency version', async () => {
    const detail = { request: { requestId: 'request-1', status: 'DRAFT', version: 5 } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(detail));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateApprovalDraft('request-1', {
        workflowId: 'workflow-1',
        title: 'Updated request',
        summary: 'Updated decision context',
        priority: 'HIGH',
        payload: { amount: '1250000', currency: 'KRW' },
        expectedVersion: 4,
      })
    ).resolves.toEqual(detail);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/approvals/v1/requests/request-1/draft');
    expect(request.method).toBe('PUT');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({ expectedVersion: 4, priority: 'HIGH' })
    );
  });
});
