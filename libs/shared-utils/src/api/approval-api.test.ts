import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  claimApprovalTask,
  createApprovalDelegation,
  decideApprovalTask,
  getApprovalHome,
  getApprovalTask,
  getApprovalTasks,
  getApprovalWorkflows,
  respondToApprovalInformationRequest,
  retryApprovalIntegrationDelivery,
  updateApprovalDraft,
} from './approval-api';

const legacy = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const;

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

    await expect(getApprovalHome('scope-self')).resolves.toEqual(home);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/approvals/v1/home?contextScopeKey=scope-self',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('binds task list and detail reads to the selected opaque scope query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ task: { taskId: 'task-1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getApprovalTasks('INBOX', 'scope-decision-a')).resolves.toEqual([]);
    await expect(getApprovalTask('task-1', 'scope-decision-a')).resolves.toEqual({
      task: { taskId: 'task-1' },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/approvals/v1/tasks?view=INBOX&contextScopeKey=scope-decision-a'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/approvals/v1/tasks/task-1?contextScopeKey=scope-decision-a'
    );
  });

  it('binds management reads to the selected opaque scope query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(getApprovalWorkflows('scope-management-a', controller.signal)).resolves.toEqual(
      []
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/approvals/v1/admin/workflows?contextScopeKey=scope-management-a'
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.headers).not.toHaveProperty('X-DWP-Context-Scope');
    expect(request.headers).not.toHaveProperty('X-DWP-Scope');
  });

  it('sends a versioned decision through the shared CSRF contract', async () => {
    const detail = { task: { taskId: 'task-1', status: 'APPROVED' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(detail));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      decideApprovalTask(
        'task-1',
        {
          decision: 'APPROVE',
          comment: 'Evidence reviewed',
          expectedVersion: 3,
        },
        legacy
      )
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

  it('claims a candidate task with optimistic concurrency evidence', async () => {
    const detail = { task: { taskId: 'task-1', status: 'CLAIMED', version: 4 } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(detail));
    vi.stubGlobal('fetch', fetchMock);

    await expect(claimApprovalTask('task-1', 3, legacy)).resolves.toEqual(detail);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/approvals/v1/tasks/task-1/claim');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual({ expectedVersion: 3 });
  });

  it('updates an owned draft with its optimistic concurrency version', async () => {
    const detail = { request: { requestId: 'request-1', status: 'DRAFT', version: 5 } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(detail));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateApprovalDraft(
        'request-1',
        {
          workflowId: 'workflow-1',
          formId: 'form-1',
          title: 'Updated request',
          summary: 'Updated decision context',
          priority: 'HIGH',
          payload: { amount: '1250000', currency: 'KRW' },
          expectedVersion: 4,
        },
        legacy
      )
    ).resolves.toEqual(detail);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/approvals/v1/requests/request-1/draft');
    expect(request.method).toBe('PUT');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({ expectedVersion: 4, priority: 'HIGH' })
    );
  });

  it('submits an information response with the reviewed payload revision', async () => {
    const requestSummary = { requestId: 'request-1', status: 'IN_REVIEW', version: 6 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(requestSummary));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      respondToApprovalInformationRequest(
        'request-1',
        'Added the requested evidence.',
        { summary: 'Updated context', amount: '1250000' },
        5,
        legacy
      )
    ).resolves.toEqual(requestSummary);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/approvals/v1/requests/request-1/information-response'
    );
    expect(JSON.parse(String(request.body))).toEqual({
      message: 'Added the requested evidence.',
      payload: { summary: 'Updated context', amount: '1250000' },
      expectedVersion: 5,
    });
  });

  it('creates a workflow delegation with immutable workflowId and never sends workflowKey identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createApprovalDelegation(
        {
          delegateUserId: 2,
          scopeType: 'WORKFLOW',
          workflowId: '22222222-2222-4222-8222-222222222222',
          startsAt: '2026-08-25T00:00:00.000Z',
          endsAt: '2026-08-31T00:00:00.000Z',
          reason: 'Planned coverage for the approval queue.',
        },
        legacy
      )
    ).resolves.toEqual([]);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/approvals/v1/delegations');
    expect(JSON.parse(String(request.body))).toEqual({
      delegateUserId: 2,
      scopeType: 'WORKFLOW',
      workflowId: '22222222-2222-4222-8222-222222222222',
      startsAt: '2026-08-25T00:00:00.000Z',
      endsAt: '2026-08-31T00:00:00.000Z',
      reason: 'Planned coverage for the approval queue.',
    });
    expect(String(request.body)).not.toContain('workflowKey');
  });

  it.each(['000', '100'] as const)(
    'keeps rollout %s delivery retry on the bodyless, headerless legacy wire',
    async (rolloutState) => {
      const operations = { generatedAt: '2026-08-19T00:00:00Z', integrationDeliveries: [] };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
        .mockResolvedValueOnce(jsonResponse(operations));
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        retryApprovalIntegrationDelivery('outbox-1', 7, {
          mode: 'LEGACY_COMPATIBILITY',
          rolloutState,
        })
      ).resolves.toEqual(operations);

      const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
      expect(fetchMock.mock.calls[1]?.[0]).toBe(
        '/api/approvals/v1/admin/operations/events/outbox-1/retry'
      );
      expect(request.method).toBe('POST');
      expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
      expect(request.body).toBeUndefined();
      expect(request.headers).not.toHaveProperty('Content-Type');
      for (const header of [
        'X-DWP-Expected-Object-Version',
        'X-DWP-Expected-Decision-Revision',
        'X-DWP-Step-Up-Challenge',
        'Idempotency-Key',
      ]) {
        expect(request.headers).not.toHaveProperty(header);
      }
    }
  );

  it.each(['110', '111'] as const)(
    'binds rollout %s HIGH retry to the selected scope, direct revision, attempt, proof and object version',
    async (rolloutState) => {
      const operations = { generatedAt: '2026-08-19T00:00:00Z', integrationDeliveries: [] };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
        .mockResolvedValueOnce(jsonResponse(operations));
      vi.stubGlobal('fetch', fetchMock);

      await retryApprovalIntegrationDelivery('outbox-1', 7, {
        mode: 'SECURE',
        rolloutState,
        expectedDecisionRevision: 'direct-action-revision',
        contextKey: 'context-never-on-wire',
        contextScopeKey: 'scope-never-on-wire',
        objectVersion: 7,
        idempotencyKey: 'stable-attempt-key',
        stepUp: {
          challenge: 'signed-step-up-jwt',
          challengeId: 'challenge-jti-never-on-wire',
          decisionRevision: 'direct-action-revision',
          expiresAt: '2026-08-24T01:05:00Z',
        },
      });

      const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
      expect(fetchMock.mock.calls[1]?.[0]).toBe(
        '/api/approvals/v1/admin/operations/events/outbox-1/retry?contextScopeKey=scope-never-on-wire'
      );
      expect(request.headers).toEqual(
        expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'direct-action-revision',
          'X-DWP-Expected-Object-Version': '7',
          'X-DWP-Step-Up-Challenge': 'signed-step-up-jwt',
          'Idempotency-Key': 'stable-attempt-key',
        })
      );
      expect(request.headers).not.toHaveProperty('X-DWP-Context-Scope');
      expect(request.headers).not.toHaveProperty('X-DWP-Scope');
      const serialized = JSON.stringify(request.headers);
      expect(serialized).not.toContain('context-never-on-wire');
      expect(serialized).not.toContain('scope-never-on-wire');
      expect(serialized).not.toContain('challenge-jti-never-on-wire');
      expect(request.body).toBeUndefined();
      expect(request.headers).not.toHaveProperty('Content-Type');
    }
  );

  it('rejects a HIGH retry when the direct version and governed header version drift', async () => {
    await expect(
      retryApprovalIntegrationDelivery('outbox-1', 7, {
        mode: 'SECURE',
        rolloutState: '111',
        expectedDecisionRevision: 'direct-action-revision',
        contextKey: 'context-key',
        contextScopeKey: 'scope-key',
        objectVersion: 8,
      })
    ).rejects.toThrowError('Approval delivery retry version does not match governed authority.');
  });
});
