import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  ApprovalPolicyCreateResponseError,
  createApprovalPolicyDraft,
} from './approval-policy-create-api';

import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalPolicyCreateInput } from './approval-policy-create-api';

const input = {
  policyKey: 'SOD.FINANCE.REQUESTER_MAKER',
  nameKo: '재무 기안자와 게시자 분리',
  nameEn: 'Finance requester and publisher separation',
  policyType: 'SEGREGATION_OF_DUTIES',
  enforcementMode: 'BLOCK',
  severity: 'CRITICAL',
  lifecycleState: 'ACTIVE',
  rule: { requesterCannotPublish: true, minimumReviewers: 2 },
  changeReason: '재무 결재의 기안자와 게시자를 독립된 사용자로 분리합니다.',
} as const satisfies ApprovalPolicyCreateInput;
const created = {
  policyId: '11111111-1111-4111-8111-111111111111',
  policyKey: input.policyKey,
  nameKo: input.nameKo,
  nameEn: input.nameEn,
  policyType: input.policyType,
  enforcementMode: 'MONITOR',
  severity: 'LOW',
  lifecycleState: 'DISABLED',
  rule: input.rule,
  version: 0,
  pendingReview: true,
  pendingEnforcementMode: input.enforcementMode,
  pendingSeverity: input.severity,
  pendingLifecycleState: input.lifecycleState,
  pendingRule: input.rule,
  pendingChangeReason: input.changeReason,
  pendingBy: 7,
  pendingAt: '2026-09-15T01:00:00Z',
};
const execution = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: `psr-${'a'.repeat(64)}`,
  contextKey: 'ctx:approvals:admin',
  contextScopeKey: 'scope:approvals:tenant',
} as const;

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function options(overrides: Partial<Parameters<typeof createApprovalPolicyDraft>[2]> = {}) {
  return {
    contextScopeKey: execution.contextScopeKey,
    expectedMakerId: '7',
    idempotencyKey: 'approval-policy-create-original-1',
    beforeDispatch: vi.fn(),
    onDispatch: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('approval policy draft creation API', () => {
  it('posts one immutable maker draft with current scope, decision and stable idempotency evidence', async () => {
    const fetch = vi.fn(async (request: string | URL | Request, _config?: RequestInit) =>
      String(request).includes('/csrf')
        ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
        : response(created)
    );
    vi.stubGlobal('fetch', fetch);
    const dispatch = options();

    await expect(createApprovalPolicyDraft(input, execution, dispatch)).resolves.toEqual(created);

    const request = fetch.mock.calls[1];
    expect(request?.[0]).toBe(
      '/api/approvals/v1/admin/policies?contextScopeKey=scope%3Aapprovals%3Atenant'
    );
    const config = request?.[1] as RequestInit;
    expect(config.method).toBe('POST');
    expect(new Headers(config.headers).get('Idempotency-Key')).toBe(dispatch.idempotencyKey);
    expect(new Headers(config.headers).get('X-DWP-Expected-Decision-Revision')).toBe(
      execution.expectedDecisionRevision
    );
    expect(new Headers(config.headers).get('X-DWP-Expected-Object-Version')).toBeNull();
    expect(JSON.parse(String(config.body))).toEqual(input);
    expect(dispatch.onDispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.beforeDispatch).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed schemas and borrowed authority before CSRF or POST', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const invalidInputs = [
      { ...input, policyKey: 'lowercase' },
      { ...input, nameKo: ' ' },
      { ...input, policyType: 'OTHER' },
      { ...input, rule: {} },
      { ...input, rule: { fraction: 1.5 } },
      { ...input, changeReason: 'short' },
    ];
    for (const candidate of invalidInputs) {
      await expect(
        createApprovalPolicyDraft(candidate as ApprovalPolicyCreateInput, execution, options())
      ).rejects.toThrow('Invalid approval policy draft creation contract');
    }
    for (const authority of [
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
      { ...execution, contextScopeKey: 'scope:other' },
      { ...execution, objectVersion: 0 },
      { ...execution, idempotencyKey: 'borrowed' },
    ]) {
      await expect(
        createApprovalPolicyDraft(input, authority as ApprovalMutationExecution, options())
      ).rejects.toThrow('Invalid approval policy draft creation contract');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechecks current authority after deferred CSRF and does not send a revoked draft', async () => {
    let finishCsrf!: (value: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finishCsrf = resolve;
        })
    );
    vi.stubGlobal('fetch', fetch);
    let current = true;
    const dispatch = options({
      beforeDispatch: () => {
        if (!current) throw new Error('authority-revoked');
      },
    });
    const pending = createApprovalPolicyDraft(input, execution, dispatch);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    current = false;
    finishCsrf(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));

    await expect(pending).rejects.toThrow('authority-revoked');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(dispatch.onDispatch).not.toHaveBeenCalled();
  });

  it.each([
    ['maker', { ...created, pendingBy: 8 }],
    ['pending rule', { ...created, pendingRule: { requesterCannotPublish: false } }],
    ['published state', { ...created, lifecycleState: 'ACTIVE' }],
    ['pending target', { ...created, pendingSeverity: 'HIGH' }],
  ])('does not adopt a 200 response with mismatched %s evidence', async (_label, payload) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: string | URL | Request) =>
        String(request).includes('/csrf')
          ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
          : response(payload)
      )
    );
    await expect(createApprovalPolicyDraft(input, execution, options())).rejects.toBeInstanceOf(
      ApprovalPolicyCreateResponseError
    );
  });
});
