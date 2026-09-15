import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import { createApprovalResubmitDraft } from './approval-resubmit-draft-api';

const sourceId = '11111111-1111-4111-8111-111111111111';
const draftId = '22222222-2222-4222-8222-222222222222';
const legacy = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const secure = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'psr-resubmit-current',
  contextKey: 'context:approvals-work',
  contextScopeKey: 'opaque-approval-scope',
} as const;
const draft = {
  requestId: draftId,
  requestNumber: 'APR-DRAFT-2',
  title: 'Copied request',
  summary: 'Review and resubmit',
  workflowNameKo: '표준 결재',
  workflowNameEn: 'Standard approval',
  currentStepKey: null,
  currentStepName: null,
  currentStepSequence: null,
  totalSteps: 2,
  status: 'DRAFT',
  priority: 'HIGH',
  dataClassification: 'INTERNAL',
  latestInformationRequest: null,
  submittedAt: null,
  dueAt: null,
  completedAt: null,
  version: 0,
};

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('approval resubmission draft API', () => {
  it('sends the exact source version with one stable idempotency key and scope', async () => {
    const guard = vi.fn();
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init;
      return String(input).includes('/csrf')
        ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
        : response({ draft, sourceRequestId: sourceId, sourceVersion: 7 });
    });
    vi.stubGlobal('fetch', fetch);

    await expect(
      createApprovalResubmitDraft(sourceId, 7, secure, {
        idempotencyKey: 'resubmit:stable-key',
        contextScopeKey: 'opaque-approval-scope',
        beforeDispatch: guard,
      })
    ).resolves.toEqual({ draft, sourceRequestId: sourceId, sourceVersion: 7 });

    const call = fetch.mock.calls.find(([url]) => String(url).includes('/resubmit-draft'));
    expect(call?.[1]?.method).toBe('POST');
    expect(new Headers(call?.[1]?.headers).get('Idempotency-Key')).toBe('resubmit:stable-key');
    expect(new Headers(call?.[1]?.headers).get('X-DWP-Expected-Decision-Revision')).toBe(
      'psr-resubmit-current'
    );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ expectedVersion: 7 });
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects malformed commands and response/source drift before exposing a draft', async () => {
    expect(() =>
      createApprovalResubmitDraft('not-a-request', 7, legacy, {
        idempotencyKey: 'valid-key',
        beforeDispatch: vi.fn(),
      })
    ).rejects.toThrow('Invalid approval resubmission draft contract');
    expect(() =>
      createApprovalResubmitDraft(sourceId, -1, legacy, {
        idempotencyKey: 'valid-key',
        beforeDispatch: vi.fn(),
      })
    ).rejects.toThrow('Invalid approval resubmission draft contract');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes('/csrf')
          ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
          : response({
              draft: { ...draft, status: 'APPROVED' },
              sourceRequestId: sourceId,
              sourceVersion: 8,
            })
      )
    );
    await expect(
      createApprovalResubmitDraft(sourceId, 7, legacy, {
        idempotencyKey: 'valid-key',
        beforeDispatch: vi.fn(),
      })
    ).rejects.toThrow('Invalid approval resubmission draft contract');
  });
});
