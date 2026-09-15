// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApprovalFormPublishReviewAssignment } from './use-approval-form-publish-review';

import type {
  ApprovalFormPublishReviewCandidate,
  ApprovalFormPublishReviewCandidates,
  ApprovalFormPublishReviewRequest,
  ApprovalFormWorkspace,
} from '@dwp-frontend/shared-utils';

const api = vi.hoisted(() => ({
  workspace: vi.fn(),
  current: vi.fn(),
  candidates: vi.fn(),
  request: vi.fn(),
  changed: vi.fn(),
}));

const projections = vi.hoisted(() =>
  [
    [
      'form-publish-review-request.data',
      'GET',
      '/api/approvals/v1/admin/forms/{formId}/publish-review-request',
    ],
    [
      'form-publish-review-candidates.data',
      'GET',
      '/api/approvals/v1/admin/forms/publish-review-candidates',
    ],
    [
      'form-publish-review-request.action',
      'POST',
      '/api/approvals/v1/admin/forms/{formId}/publish-review-request',
    ],
  ].map(([leaf, method, path]) => ({
    routeContractKey: `route.approvals.admin.${leaf}`,
    routeKind: method === 'GET' ? 'DATA' : 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [{ method, path }],
  }))
);

vi.mock('../../routes/product-surface-authorization.generated', () => ({
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS: projections,
}));

vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getApprovalFormWorkspace: (...args: unknown[]) => api.workspace(...args),
  getApprovalFormPublishReviewRequest: (...args: unknown[]) => api.current(...args),
  searchApprovalFormPublishReviewCandidates: (...args: unknown[]) => api.candidates(...args),
  requestApprovalFormPublishReview: (...args: unknown[]) => api.request(...args),
  useProductSurfaceAuthority: () => ({ snapshot: null }),
}));

vi.mock('../../components/use-product-surface-governed-mutation', () => {
  class ProductSurfaceMutationAuthorityError extends Error {}
  return {
    ProductSurfaceMutationAuthorityError,
    useProductSurfaceGovernedMutation: () => (execute: (execution: unknown) => Promise<unknown>) =>
      execute({
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '110',
        contextKey: 'approval-management',
        contextScopeKey: 'scope:approvals:admin',
        expectedDecisionRevision: `psr-${'a'.repeat(64)}`,
      }),
  };
});

const formId = '11111111-1111-4111-8111-111111111111';
const draftId = '22222222-2222-4222-8222-222222222222';
const personId = '33333333-3333-4333-8333-333333333333';
const decisionRevision = `psr-${'a'.repeat(64)}`;
const requestScope = {
  contextScopeKey: 'scope:approvals:admin',
  cacheKey: ['1', '31', 'NORMAL', 'approvals.admin', 'scope:approvals:admin', decisionRevision],
} as const;
const workspace: ApprovalFormWorkspace = {
  formId,
  formRevision: 4,
  workspaceRevision: 2,
  catalogAvailability: 'ACTIVE',
  published: null,
  workingDraft: {
    formVersionId: draftId,
    versionNumber: 2,
    lifecycleState: 'DRAFT',
    sourceVersionId: null,
    basePublishedVersionId: null,
    schema: { schemaVersion: 2, fields: [] },
    schemaSha256: 'b'.repeat(64),
    metadata: {
      categoryId: formId,
      nameKo: '운영 요청',
      nameEn: 'Operations request',
      descriptionKo: '운영 변경',
      descriptionEn: 'Operations change',
      ownerGroupRef: 'group:operations',
      formKind: 'REQUEST',
    },
    route: { workflowId: formId },
    materialDigest: 'c'.repeat(64),
    metadataProvenance: 'AUTHORING_SNAPSHOT',
    capturedAt: '2026-09-15T00:00:00Z',
    capturedBy: 31,
    createdAt: '2026-09-15T00:00:00Z',
    createdBy: 31,
    publishedAt: null,
    publishedBy: null,
  },
  lastEditorUserId: 31,
  catalogPolicyEligible: false,
  observedAt: '2026-09-15T00:00:00Z',
};
const candidate: ApprovalFormPublishReviewCandidate = {
  userId: 32,
  personPublicId: personId,
  displayName: 'Independent Publisher',
  email: 'publisher@example.test',
  jobTitle: 'Compliance Publisher',
};
const candidateSource: ApprovalFormPublishReviewCandidates = {
  candidates: [candidate],
  mayBeTruncated: false,
  decisionRevision,
  authorityValidUntil: '2099-09-15T00:00:00Z',
};
const assigned: ApprovalFormPublishReviewRequest = {
  reviewRequestId: '44444444-4444-4444-8444-444444444444',
  formId,
  draftFormVersionId: draftId,
  basePublishedFormVersionId: null,
  status: 'PENDING',
  version: 0,
  makerUserId: 31,
  lastEditorUserId: 31,
  reviewerUserId: 32,
  reviewerPersonPublicId: personId,
  formRevision: 4,
  workspaceRevision: 2,
  schemaSha256: 'b'.repeat(64),
  reviewContentDigest: 'd'.repeat(64),
  requestReason: 'Please independently review this exact form.',
  requestedAt: '2026-09-15T00:00:00Z',
  decidedAt: null,
  decidedBy: null,
  decisionReason: null,
};

let node: HTMLDivElement;
let root: Root;
let client: QueryClient;
let controller: ReturnType<typeof useApprovalFormPublishReviewAssignment>;

function Harness() {
  controller = useApprovalFormPublishReviewAssignment({
    formId,
    workspace,
    requestScope,
    scopeReady: true,
    parentReady: true,
    canEdit: true,
    onChanged: api.changed,
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
  await vi.waitFor(() => expect(controller.currentState).toBe('READY'));
}

async function prepare() {
  await act(async () => controller.openRequest());
  await act(async () => controller.setCandidateQuery('publisher'));
  await vi.waitFor(() => expect(controller.candidateState).toBe('READY'));
  await act(async () => controller.setCandidate(candidate));
  await act(async () => controller.setReason('Please independently review this exact form.'));
  await vi.waitFor(() => expect(controller.canSubmit).toBe(true));
}

describe('approval form publish review assignment', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'original-command-key') });
    node = document.createElement('div');
    document.body.append(node);
    root = createRoot(node);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.workspace.mockResolvedValue(workspace);
    api.current.mockResolvedValue(null);
    api.candidates.mockResolvedValue(candidateSource);
    api.request.mockImplementation(async (...args: unknown[]) => {
      const options = args[3] as { beforeDispatch?: () => void };
      options.beforeDispatch?.();
      options.beforeDispatch?.();
      return assigned;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    node.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('revalidates all three sources and dispatches the exact reviewer and current-request CAS', async () => {
    await render();
    await prepare();
    await act(async () => controller.submit());
    await vi.waitFor(() => expect(api.changed).toHaveBeenCalledWith(formId));

    expect(api.workspace).toHaveBeenCalledWith(formId, requestScope.contextScopeKey);
    expect(api.current).toHaveBeenCalledWith(formId, requestScope.contextScopeKey);
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request.mock.calls[0]?.[1]).toEqual({
      draftFormVersionId: draftId,
      basePublishedVersionId: null,
      expectedFormRevision: 4,
      expectedWorkspaceRevision: 2,
      schemaSha256: 'b'.repeat(64),
      reviewerUserId: 32,
      reviewerPersonPublicId: personId,
      expectedReviewRequestId: null,
      expectedReviewRequestVersion: null,
      reason: 'Please independently review this exact form.',
    });
    expect(api.request.mock.calls[0]?.[3].idempotencyKey).toBe(
      'approval-form-publish-review-original-command-key'
    );
    expect(controller.open).toBe(false);
  });

  it('detects a changed latest workspace before transport and preserves the input for editing', async () => {
    await render();
    await prepare();
    api.workspace.mockResolvedValueOnce({ ...workspace, formRevision: 5 });
    await act(async () => controller.submit());
    await vi.waitFor(() => expect(controller.problem).toBe('CHANGED'));

    expect(api.request).not.toHaveBeenCalled();
    expect(controller.candidate).toEqual(candidate);
    expect(controller.reason).toContain('independently review');
    await act(async () => controller.editPreserved());
    expect(controller.locked).toBe(false);
  });

  it('locks a dispatched 503 and retries the exact original body and idempotency key', async () => {
    const { HttpError } = await import('@dwp-frontend/shared-utils');
    api.request.mockImplementationOnce(async (...args: unknown[]) => {
      const options = args[3] as { beforeDispatch?: () => void };
      options.beforeDispatch?.();
      options.beforeDispatch?.();
      throw new HttpError('Unavailable', 503);
    });
    await render();
    await prepare();
    await act(async () => controller.submit());
    await vi.waitFor(() => expect(controller.problem).toBe('UNKNOWN'));
    const original = api.request.mock.calls[0]!;
    expect(controller.locked).toBe(true);

    await act(async () => controller.retryOriginal());
    await vi.waitFor(() => expect(api.changed).toHaveBeenCalledWith(formId));
    expect(api.request.mock.calls[1]?.[1]).toEqual(original[1]);
    expect(api.request.mock.calls[1]?.[3].idempotencyKey).toBe(original[3].idempotencyKey);
  });

  it('keeps denied input explicit and never retargets its selected publisher', async () => {
    const { HttpError } = await import('@dwp-frontend/shared-utils');
    api.request.mockRejectedValueOnce(new HttpError('Forbidden', 403));
    await render();
    await prepare();
    await act(async () => controller.submit());
    await vi.waitFor(() => expect(controller.problem).toBe('DENIED'));

    expect(controller.locked).toBe(true);
    expect(controller.candidate).toEqual(candidate);
    expect(controller.reason).toBe('Please independently review this exact form.');
  });
});
