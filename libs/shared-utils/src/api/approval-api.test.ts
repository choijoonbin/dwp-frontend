import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  claimApprovalTask,
  createApprovalRequest,
  createApprovalDelegation,
  decideApprovalTask,
  getApprovalDelegations,
  getApprovalHome,
  getApprovalRequest,
  getApprovalTask,
  getApprovalRequestDetail,
  getApprovalRequests,
  getApprovalTasks,
  getApprovalWorkflows,
  getPublishedApprovalForms,
  getPublishedApprovalFormTemplate,
  getPublishedApprovalWorkflows,
  getPublishedApprovalWorkflowTemplate,
  respondToApprovalInformationRequest,
  retryApprovalIntegrationDelivery,
  searchApprovalDelegationCandidates,
  updateApprovalDraft,
} from './approval-api';
import { updateApprovalDelegation } from './approval-delegation-api';

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

  it('checks delivery source before and after CSRF and never sends a stale retry', async () => {
    let valid = true;
    const fetchMock = vi.fn().mockImplementation(async () => {
      valid = false;
      return jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      retryApprovalIntegrationDelivery('outbox-1', 7, legacy, {
        beforeDispatch: () => {
          if (!valid) throw new Error('Source expired');
        },
      })
    ).rejects.toThrow('Source expired');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/csrf');
  });

  it('does not automatically replay a bodyless delivery command on an empty 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(new Response('', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(retryApprovalIntegrationDelivery('outbox-1', 7, legacy)).rejects.toMatchObject({
      status: 403,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/retry'))).toHaveLength(1);
  });

  it('discards a late delivery response after source revocation instead of reporting success', async () => {
    let valid = true;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockImplementationOnce(async () => {
        valid = false;
        return jsonResponse({ generatedAt: '2026-09-14T10:00:00Z', integrationDeliveries: [] });
      });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      retryApprovalIntegrationDelivery('outbox-1', 7, legacy, {
        beforeDispatch: () => {
          if (!valid) throw new Error('Source revoked');
        },
      })
    ).rejects.toThrow('Source revoked');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['000', '100'] as const)(
    'preserves draft command identity in rollout %s',
    async (rolloutState) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
        .mockResolvedValue(jsonResponse({ requestId: 'request-1' }));
      vi.stubGlobal('fetch', fetchMock);
      const input = {
        workflowId: 'workflow-1',
        formId: 'form-1',
        title: 'Draft',
        summary: '',
        priority: 'NORMAL' as const,
        payload: {},
      };
      const execution = { mode: 'LEGACY_COMPATIBILITY' as const, rolloutState };
      await createApprovalRequest(input, execution, { idempotencyKey: 'draft-command-1' });
      await updateApprovalDraft('request-1', { ...input, expectedVersion: 1 }, execution, {
        idempotencyKey: 'draft-command-2',
      });
      const commands = fetchMock.mock.calls.filter(([, init]) =>
        ['POST', 'PUT'].includes(init.method)
      );
      expect(commands.map(([, init]) => init.headers['Idempotency-Key'])).toEqual([
        'draft-command-1',
        'draft-command-2',
      ]);
    }
  );

  it('rejects malformed or mismatched draft command keys before any network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      workflowId: 'workflow-1',
      formId: 'form-1',
      title: 'Draft',
      summary: '',
      priority: 'NORMAL' as const,
      payload: {},
    };
    await expect(
      createApprovalRequest(input, legacy, { idempotencyKey: 'bad key' })
    ).rejects.toThrow();
    await expect(
      createApprovalRequest(
        input,
        {
          mode: 'SECURE',
          rolloutState: '110',
          expectedDecisionRevision: 'rev-1',
          contextKey: 'context-1',
          contextScopeKey: 'scope-1',
          idempotencyKey: 'governed-key',
        },
        { idempotencyKey: 'different-key' }
      )
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
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

    const controller = new AbortController();
    await expect(getApprovalTasks('INBOX', 'scope-decision-a')).resolves.toEqual([]);
    await expect(getApprovalTask('task-1', 'scope-decision-a', controller.signal)).resolves.toEqual(
      {
        task: { taskId: 'task-1' },
      }
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/approvals/v1/tasks?view=INBOX&contextScopeKey=scope-decision-a'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/approvals/v1/tasks/task-1?contextScopeKey=scope-decision-a'
    );
    const requestSignal = (fetchMock.mock.calls[1]?.[1] as RequestInit).signal;
    expect(requestSignal).toBeInstanceOf(AbortSignal);
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

  it('cancels a requester detail read when its Work selection is abandoned', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          );
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const read = getApprovalRequestDetail('request-1', 'scope-requester', controller.signal);
    const rejection = expect(read).rejects.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/approvals/v1/requests/request-1/detail?contextScopeKey=scope-requester'
    );
    const requestSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal!;
    expect(requestSignal.aborted).toBe(false);
    controller.abort();
    await rejection;
    expect(requestSignal.aborted).toBe(true);
  });

  it('binds requester, catalog, and delegation reads to the active scope and abort signal', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          jsonResponse(
            url.includes('/template') ? { form: { schema: { schemaVersion: 1, fields: [] } } } : []
          )
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const scope = 'scope-requester-a';

    await getApprovalRequests('SUBMITTED', scope, controller.signal);
    await getApprovalRequest('request-1', scope, controller.signal);
    await getPublishedApprovalWorkflows(scope, controller.signal);
    await getPublishedApprovalWorkflowTemplate('workflow-1', scope, controller.signal);
    await getPublishedApprovalForms(scope, controller.signal);
    await getPublishedApprovalFormTemplate('form-1', scope, controller.signal);
    await getApprovalDelegations(scope, controller.signal);
    await searchApprovalDelegationCandidates('kim', 12, scope, controller.signal);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/approvals/v1/requests?view=SUBMITTED&contextScopeKey=scope-requester-a',
      '/api/approvals/v1/requests/request-1?contextScopeKey=scope-requester-a',
      '/api/approvals/v1/workflows/published?contextScopeKey=scope-requester-a',
      '/api/approvals/v1/workflows/published/workflow-1/template?contextScopeKey=scope-requester-a',
      '/api/approvals/v1/catalog/forms?contextScopeKey=scope-requester-a',
      '/api/approvals/v1/catalog/forms/form-1/template?contextScopeKey=scope-requester-a',
      '/api/approvals/v1/delegations?contextScopeKey=scope-requester-a',
      '/api/approvals/v1/delegations/candidates?query=kim&limit=12&contextScopeKey=scope-requester-a',
    ]);
    const requestSignals = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit).signal as AbortSignal
    );
    requestSignals.forEach((signal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });
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

  it('updates a delegation with the exact object version and stable idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateApprovalDelegation(
        'delegation-1',
        {
          delegateUserId: 2,
          scopeType: 'ALL',
          startsAt: '2026-08-25T00:00:00.000Z',
          endsAt: '2026-08-31T00:00:00.000Z',
          reason: 'Updated planned coverage for the approval queue.',
          expectedVersion: 4,
        },
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: 'delegation-update-revision',
          contextKey: 'approvals-work',
          contextScopeKey: 'scope-delegation',
          objectVersion: 4,
          idempotencyKey: 'delegation-update-4',
        }
      )
    ).resolves.toEqual([]);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/approvals/v1/delegations/delegation-1?contextScopeKey=scope-delegation'
    );
    expect(request.method).toBe('PUT');
    expect(request.headers).toEqual(
      expect.objectContaining({
        'X-DWP-Expected-Decision-Revision': 'delegation-update-revision',
        'X-DWP-Expected-Object-Version': '4',
        'Idempotency-Key': 'delegation-update-4',
      })
    );
    expect(JSON.parse(String(request.body))).toEqual({
      delegateUserId: 2,
      scopeType: 'ALL',
      startsAt: '2026-08-25T00:00:00.000Z',
      endsAt: '2026-08-31T00:00:00.000Z',
      reason: 'Updated planned coverage for the approval queue.',
      expectedVersion: 4,
    });
  });

  it('keeps delegation update idempotency in legacy rollout and rejects version drift locally', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      delegateUserId: 2,
      scopeType: 'ALL' as const,
      startsAt: '2026-08-25T00:00:00.000Z',
      endsAt: '2026-08-31T00:00:00.000Z',
      reason: 'Updated planned coverage for the approval queue.',
      expectedVersion: 4,
    };

    await updateApprovalDelegation('delegation-1', input, {
      ...legacy,
      idempotencyKey: 'delegation-update-legacy-4',
    });

    const headers = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'delegation-update-legacy-4' })
    );
    expect(headers).not.toHaveProperty('X-DWP-Expected-Decision-Revision');
    expect(headers).not.toHaveProperty('X-DWP-Expected-Object-Version');
    await expect(
      updateApprovalDelegation('delegation-1', input, {
        mode: 'SECURE',
        rolloutState: '111',
        expectedDecisionRevision: 'delegation-update-revision',
        contextKey: 'approvals-work',
        contextScopeKey: 'scope-delegation',
        objectVersion: 3,
        idempotencyKey: 'delegation-update-version-drift',
      })
    ).rejects.toThrow('Invalid approval delegation update identity');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([403, 409, 503])(
    'surfaces delegation update HTTP %s without replaying the mutation',
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
        .mockResolvedValueOnce(new Response('', { status }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        updateApprovalDelegation(
          'delegation-1',
          {
            delegateUserId: 2,
            scopeType: 'ALL',
            startsAt: '2026-08-25T00:00:00.000Z',
            endsAt: '2026-08-31T00:00:00.000Z',
            reason: 'Updated planned coverage for the approval queue.',
            expectedVersion: 4,
          },
          { ...legacy, idempotencyKey: `delegation-update-${status}` }
        )
      ).rejects.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).includes('/api/approvals/v1/delegations/delegation-1')
        )
      ).toHaveLength(1);
    }
  );

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
