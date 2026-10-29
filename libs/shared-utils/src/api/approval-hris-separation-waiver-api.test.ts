import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { approveApprovalHrisSeparationWaiverTask } from './approval-hris-separation-waiver-api';
import { snapshotApprovalHrisSeparationWaiverTaskApproveInput } from './approval-hris-separation-waiver-contract';

const taskId = '10000000-0000-4000-8000-000000000001';
const correlationId = '10000000-0000-4000-8000-000000000002';
const idempotencyKey = '10000000-0000-4000-8000-000000000003';
const input = {
  decision: 'APPROVE',
  comment: 'Reviewed HRIS separation evidence',
  expectedVersion: 7,
  quorum: {
    expectedRequestVersion: 11,
    generation: 2,
    expectedStageVersion: 3,
    pins: {
      workflowVersionId: '20000000-0000-4000-8000-000000000001',
      workflowVersion: 4,
      workflowDefinitionSha256: 'a'.repeat(64),
      formSchemaSha256: 'b'.repeat(64),
      policyVersion: 5,
      policySha256: 'c'.repeat(64),
    },
    payloadRevision: 6,
    payloadSha256: 'd'.repeat(64),
  },
} as const;
const execution = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'decision-revision-62',
  contextKey: 'approvals-work',
  contextScopeKey: 'decidable-task-scope',
  objectVersion: input.expectedVersion,
  idempotencyKey,
  stepUp: {
    challenge: 'signed-step-up-challenge',
    challengeId: '30000000-0000-4000-8000-000000000001',
    decisionRevision: 'decision-revision-62',
    expiresAt: '2099-10-29T00:00:00Z',
  },
} as const;

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => (data === undefined ? '' : JSON.stringify(data)),
  } as Response;
}

describe('HRIS separation-waiver Approval API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('dispatches the exact HIGH body with all bound evidence headers once', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        response(
          url.includes('/csrf')
            ? { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } }
            : {
                data: {
                  task: { taskId },
                  payload: {},
                  timeline: [],
                  canClaim: false,
                  canDecide: false,
                  selfApprovalBlocked: false,
                  contentAccess: {
                    state: 'FULL',
                    reason: 'CURRENT_AUTHORITY_VERIFIED',
                    evaluatedAt: '2026-10-29T00:00:00Z',
                  },
                },
              }
        )
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const beforeDispatch = vi.fn();

    await approveApprovalHrisSeparationWaiverTask(
      taskId,
      input,
      execution,
      correlationId,
      beforeDispatch
    );

    const command = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(command?.[0]).toContain(
      `/api/approvals/v1/hris/separation-waiver-tasks/${taskId}/approve`
    );
    expect(command?.[1]?.body).toBe(
      JSON.stringify(snapshotApprovalHrisSeparationWaiverTaskApproveInput(input))
    );
    expect(command?.[1]?.headers).toMatchObject({
      'X-Correlation-ID': correlationId,
      'X-DWP-Expected-Decision-Revision': execution.expectedDecisionRevision,
      'X-DWP-Expected-Object-Version': String(input.expectedVersion),
      'X-DWP-Step-Up-Challenge': execution.stepUp.challenge,
      'Idempotency-Key': idempotencyKey,
      'X-XSRF-TOKEN': 'csrf-token',
    });
    expect(beforeDispatch).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('rejects legacy, version drift, malformed correlation, and missing quorum before dispatch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      approveApprovalHrisSeparationWaiverTask(
        taskId,
        input,
        { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
        correlationId
      )
    ).rejects.toThrow('HIGH command authority');
    await expect(
      approveApprovalHrisSeparationWaiverTask(
        taskId,
        input,
        { ...execution, objectVersion: input.expectedVersion + 1 },
        correlationId
      )
    ).rejects.toThrow('HIGH command authority');
    await expect(
      approveApprovalHrisSeparationWaiverTask(taskId, input, execution, 'NOT-A-UUID')
    ).rejects.toThrow('HIGH command authority');
    await expect(
      approveApprovalHrisSeparationWaiverTask(
        taskId,
        { ...input, quorum: undefined } as never,
        execution,
        correlationId
      )
    ).rejects.toThrow('quorum');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not replay a HIGH command after a CSRF rejection', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.includes('/csrf')
            ? response({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
            : response(undefined, 403)
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      approveApprovalHrisSeparationWaiverTask(taskId, input, execution, correlationId)
    ).rejects.toMatchObject({ status: 403 });

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'GET')).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
});
