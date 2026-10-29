import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance, HttpError } from '@dwp-frontend/shared-utils';

import {
  createPer008AxiosTransport,
  createPerformanceFeedbackRequest,
  HCM_PERFORMANCE_FEEDBACK_MUTATION_API_CONTRACTS,
  submitPerformanceFeedbackResponse,
} from './per008-axios-adapter';

const SCOPE = 'tenant-a:user-a:role-a';
const CORRELATION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const IDS = {
  cycle: '11111111-1111-4111-8111-111111111111',
  worker: '22222222-2222-4222-8222-222222222222',
  assignment: '33333333-3333-4333-8333-333333333333',
  template: '44444444-4444-4444-8444-444444444444',
  request: '55555555-5555-4555-8555-555555555555',
  receipt: '66666666-6666-4666-8666-666666666666',
  question: '77777777-7777-4777-8777-777777777777',
} as const;

function transport() {
  return createPer008AxiosTransport({
    contextScopeKey: SCOPE,
    signal: new AbortController().signal,
    timeoutMs: 3210,
    mutationAuthority: () => ({
      mode: 'SECURE',
      rolloutState: '110',
      contextKey: 'per008:create',
      contextScopeKey: SCOPE,
      expectedDecisionRevision: 'auth-1',
      idempotencyKey: 'per008-command-key-0001',
    }),
  });
}

describe('PER-008 shared axios adapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('applies read scope and unwraps the standard ApiResponse exactly once', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({
      data: { status: 'SUCCESS', data: { schemaVersion: '1' } },
    });
    await expect(transport()('/api/owner', { method: 'GET', headers: {} })).resolves.toEqual({
      status: 200,
      data: { schemaVersion: '1' },
    });
    expect(get).toHaveBeenCalledWith(
      '/api/owner',
      expect.objectContaining({
        contextScopeKey: SCOPE,
        timeoutMs: 3210,
      })
    );
  });

  it('preserves status, problem code and correlation from a standard error envelope', async () => {
    vi.spyOn(axiosInstance, 'get').mockRejectedValue(
      new HttpError('threshold', 422, {
        status: 'ERROR',
        message: 'suppressed',
        data: null,
        errorCode: 'FEEDBACK_RELEASE_THRESHOLD_NOT_MET',
        correlationId: CORRELATION,
      })
    );
    await expect(transport()('/api/owner', { method: 'GET', headers: {} })).resolves.toEqual({
      status: 422,
      data: {
        code: 'FEEDBACK_RELEASE_THRESHOLD_NOT_MET',
        correlationId: CORRELATION,
        retryable: false,
      },
    });
  });

  it('rejects authority/header drift before dispatching a governed mutation', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    await expect(
      transport()('/api/owner', {
        method: 'POST',
        headers: {
          'Idempotency-Key': 'different-key-0000001',
          'X-DWP-Expected-Decision-Revision': 'auth-1',
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    ).rejects.toThrow('PER008_GOVERNED_MUTATION_AUTHORITY_MISMATCH');
    expect(post).not.toHaveBeenCalled();
  });

  it('binds both production mutations to the same governed execution authority', async () => {
    expect(HCM_PERFORMANCE_FEEDBACK_MUTATION_API_CONTRACTS).toHaveLength(2);
    const post = vi
      .spyOn(axiosInstance, 'post')
      .mockResolvedValueOnce({
        data: {
          status: 'SUCCESS',
          data: {
            receiptId: IDS.receipt,
            requestId: IDS.request,
            state: 'DRAFT',
            version: 1,
            occurredAt: '2026-10-29T01:00:00Z',
            replayed: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 'SUCCESS',
          data: {
            receiptId: IDS.receipt,
            requestId: IDS.request,
            assignmentId: IDS.assignment,
            assignmentState: 'SUBMITTED',
            version: 2,
            submittedAt: '2026-10-29T01:00:00Z',
            replayed: false,
          },
        },
      });
    const execution = {
      authority: {
        mode: 'SECURE' as const,
        rolloutState: '110' as const,
        contextKey: 'per008:feedback',
        contextScopeKey: SCOPE,
        expectedDecisionRevision: 'auth-1',
        idempotencyKey: 'per008-command-key-0001',
      },
      signal: new AbortController().signal,
      timeoutMs: 3210,
    };
    await createPerformanceFeedbackRequest(
      {
        cycleVersionId: IDS.cycle,
        subjectWorkerPublicId: IDS.worker,
        subjectAssignmentPublicId: IDS.assignment,
        templateVersionId: IDS.template,
        anonymityMode: 'MASKED',
        minimumReleaseCount: 3,
        opensAt: '2026-10-29T01:00:00Z',
        closesAt: '2026-11-05T01:00:00Z',
      },
      execution
    );
    await submitPerformanceFeedbackResponse(
      IDS.assignment,
      {
        expectedRequestVersion: 1,
        templateContentHash: 'a'.repeat(64),
        response: {
          schemaKey: 'PerformanceFeedbackResponse.v1',
          answers: [
            {
              questionPublicId: IDS.question,
              answerType: 'TEXT',
              textValue: 'Clear priorities',
              numberValue: null,
              choiceOptionPublicIds: [],
            },
          ],
        },
      },
      execution
    );
    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/people/v1/hris/performance/feedback-requests',
      expect.any(Object),
      expect.objectContaining({
        contextScopeKey: SCOPE,
        csrfReplay: 'NEVER',
        timeoutMs: 3210,
        headers: expect.objectContaining({
          'Idempotency-Key': execution.authority.idempotencyKey,
          'X-DWP-Expected-Decision-Revision': execution.authority.expectedDecisionRevision,
        }),
      })
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/api/people/v1/hris/performance/feedback-assignments/${IDS.assignment}/responses`,
      expect.any(Object),
      expect.objectContaining({ csrfReplay: 'NEVER', contextScopeKey: SCOPE })
    );
  });
});
