// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emptyApprovalPolicyCreateDraft,
  newApprovalPolicyCreateRule,
} from './approval-policy-create-model';
import { useApprovalPolicyCreate } from './use-approval-policy-create';

import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';
import type { ApprovalPolicyCreateDraft } from './approval-policy-create-model';

const api = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', () => {
  class HttpError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  }
  class HttpTransportError extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  }
  class ApprovalPolicyCreateResponseError extends Error {}
  return {
    ApprovalPolicyCreateResponseError,
    createApprovalPolicyDraft: api.create,
    getApprovalPolicies: api.get,
    HttpError,
    HttpTransportError,
  };
});

vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation: () => (execute: (authority: unknown) => Promise<unknown>) =>
    execute({
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'decision-current',
      contextKey: 'ctx:approvals:admin',
      contextScopeKey: 'scope:approvals:tenant',
    }),
}));

const existing: ApprovalPolicy = {
  policyId: '11111111-1111-4111-8111-111111111111',
  policyKey: 'EXISTING_POLICY',
  nameKo: '기존 정책',
  nameEn: 'Existing policy',
  policyType: 'DECISION',
  enforcementMode: 'BLOCK',
  severity: 'HIGH',
  lifecycleState: 'ACTIVE',
  rule: { minimumLength: 8 },
  version: 2,
  pendingReview: false,
  pendingRule: {},
};
const created: ApprovalPolicy = {
  policyId: '22222222-2222-4222-8222-222222222222',
  policyKey: 'SOD.FINANCE.REQUESTER_MAKER',
  nameKo: '재무 기안자와 게시자 분리',
  nameEn: 'Finance requester and publisher separation',
  policyType: 'SEGREGATION_OF_DUTIES',
  enforcementMode: 'MONITOR',
  severity: 'LOW',
  lifecycleState: 'DISABLED',
  rule: { requesterCannotPublish: true },
  version: 0,
  pendingReview: true,
  pendingEnforcementMode: 'BLOCK',
  pendingSeverity: 'HIGH',
  pendingLifecycleState: 'ACTIVE',
  pendingRule: { requesterCannotPublish: true },
  pendingChangeReason: '재무 결재의 기안자와 게시자를 독립된 사용자로 분리합니다.',
  pendingBy: 7,
  pendingAt: '2026-09-15T01:00:00Z',
};
const queryKey = [
  'approvals',
  'admin',
  'policies',
  '1',
  '7',
  'NORMAL',
  'approvals.admin',
  'scope:approvals:tenant',
  'decision-current',
] as const;
const requestScope = {
  contextScopeKey: 'scope:approvals:tenant',
  cacheKey: ['1', '7', 'NORMAL', 'approvals.admin', 'scope:approvals:tenant', 'decision-current'],
} as const;

function validDraft(): ApprovalPolicyCreateDraft {
  return {
    ...emptyApprovalPolicyCreateDraft(),
    policyKey: created.policyKey,
    nameKo: created.nameKo,
    nameEn: created.nameEn,
    rules: [{ ...newApprovalPolicyCreateRule(), key: 'requesterCannotPublish', value: 'true' }],
    changeReason: created.pendingChangeReason!,
  };
}

let node: HTMLDivElement;
let root: Root;
let client: QueryClient;
let controller: ReturnType<typeof useApprovalPolicyCreate>;
let selected: ApprovalPolicy | null;

function Harness() {
  controller = useApprovalPolicyCreate({
    requestScope,
    scopeReady: true,
    sourceReady: true,
    canCreate: true,
    policies: client.getQueryData<ApprovalPolicy[]>(queryKey) ?? [],
    policiesQueryKey: queryKey,
    onCreated: (policy) => {
      selected = policy;
    },
  });
  return null;
}

async function render() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );
  });
}

async function begin() {
  await act(async () => controller.openCreate());
  await act(async () => controller.setDraft(validDraft()));
  await act(async () => controller.submit());
}

describe('approval policy create controller', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    node = document.createElement('div');
    document.body.append(node);
    root = createRoot(node);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKey, [existing]);
    selected = null;
    api.get.mockResolvedValue([existing]);
    api.create.mockResolvedValue(created);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    node.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('checks the latest catalog, creates one draft and selects only the verified response', async () => {
    await render();
    await begin();
    await vi.waitFor(() => expect(selected).toEqual(created));

    expect(api.get).toHaveBeenCalledWith('scope:approvals:tenant', expect.any(AbortSignal));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        policyKey: created.policyKey,
        rule: created.pendingRule,
        changeReason: created.pendingChangeReason,
      })
    );
    expect(api.create.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        contextScopeKey: 'scope:approvals:tenant',
        expectedMakerId: '7',
        idempotencyKey: expect.stringMatching(/^approval-policy-create-/u),
      })
    );
    expect(client.getQueryData<ApprovalPolicy[]>(queryKey)?.[0]).toEqual(created);
    expect(controller.open).toBe(false);
  });

  it('locks a transport-unknown input and retries the exact original body and key', async () => {
    const originalDraft = validDraft();
    api.create.mockRejectedValueOnce(
      new (await import('@dwp-frontend/shared-utils')).HttpTransportError('NETWORK')
    );
    await render();
    await act(async () => controller.openCreate());
    await act(async () => controller.setDraft(originalDraft));
    await act(async () => controller.submit());
    await vi.waitFor(() => expect(controller.problem).toBe('UNAVAILABLE'));

    // The mocked transport fails before its onDispatch callback; mark the real dispatch boundary.
    const firstOptions = api.create.mock.calls[0]?.[2];
    await act(async () => firstOptions.onDispatch());
    api.create.mockRejectedValueOnce(
      new (await import('@dwp-frontend/shared-utils')).HttpTransportError('NETWORK')
    );
    await act(async () => controller.retryOriginal());
    await vi.waitFor(() => expect(controller.problem).toBe('UNKNOWN'));
    expect(controller.locked).toBe(true);
    expect(controller.draft).toEqual(originalDraft);

    api.create.mockResolvedValueOnce(created);
    await act(async () => controller.retryOriginal());
    await vi.waitFor(() => expect(selected).toEqual(created));
    const attempts = api.create.mock.calls;
    expect(attempts[1]?.[0]).toEqual(attempts[2]?.[0]);
    expect(attempts[1]?.[2].idempotencyKey).toBe(attempts[2]?.[2].idempotencyKey);
  });

  it('preserves a latest-catalog conflict without POST and requires explicit editing', async () => {
    api.get.mockResolvedValue([{ ...existing, policyKey: created.policyKey }]);
    await render();
    await begin();
    await vi.waitFor(() => expect(controller.problem).toBe('CONFLICT'));

    expect(api.create).not.toHaveBeenCalled();
    expect(controller.locked).toBe(true);
    expect(controller.canEditPreserved).toBe(true);
    expect(controller.draft.policyKey).toBe(created.policyKey);
    await act(async () => controller.editPreserved());
    expect(controller.locked).toBe(false);
    expect(controller.draft.policyKey).toBe(created.policyKey);
  });

  it('preserves a denied original and retries the same body and idempotency key explicitly', async () => {
    api.create.mockRejectedValueOnce(
      new (await import('@dwp-frontend/shared-utils')).HttpError('Forbidden', 403)
    );
    await render();
    const originalDraft = validDraft();
    await act(async () => controller.openCreate());
    await act(async () => controller.setDraft(originalDraft));
    await act(async () => controller.submit());
    await vi.waitFor(() => expect(controller.problem).toBe('DENIED'));

    const first = api.create.mock.calls[0]!;
    expect(controller.locked).toBe(true);
    expect(controller.canEditPreserved).toBe(true);
    expect(controller.draft).toEqual(originalDraft);

    api.create.mockResolvedValueOnce(created);
    await act(async () => controller.retryOriginal());
    await vi.waitFor(() => expect(selected).toEqual(created));
    expect(api.create.mock.calls[1]?.[0]).toEqual(first[0]);
    expect(api.create.mock.calls[1]?.[2].idempotencyKey).toBe(first[2].idempotencyKey);
  });
});
