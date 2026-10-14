import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import {
  NAVIGATION_POLICY_OPERATION_BINDINGS,
  publishNavigationPolicyRevision,
  readNavigationPolicyWorkspace,
  restoreNavigationPolicyRevision,
  updateNavigationPolicyDraftRevision,
} from '../api/navigation-policy-api';
import { HR_OPERATIONS_NAVIGATION_CATALOG } from '../../../shell/navigation-policy/hr-operations-navigation-policy';

describe('navigation-policy API', () => {
  beforeEach(() => {
    transport.get.mockReset();
    transport.post.mockReset();
    transport.put.mockReset();
  });

  it('binds the sealed workspace, lifecycle, restore, and runtime operations exactly once', () => {
    expect(NAVIGATION_POLICY_OPERATION_BINDINGS).toHaveLength(9);
    expect(
      new Set(NAVIGATION_POLICY_OPERATION_BINDINGS.map(([method, path]) => `${method} ${path}`))
        .size
    ).toBe(9);
    expect(JSON.stringify(NAVIGATION_POLICY_OPERATION_BINDINGS)).toContain(
      '/api/platform/v1/hris/navigation/projection'
    );
  });

  it('reads a server-scoped workspace with no browser-derived tenant header', async () => {
    transport.get.mockResolvedValue({ data: { data: workspaceDto() } });
    const signal = new AbortController().signal;
    const result = await readNavigationPolicyWorkspace({
      scopeKind: 'TENANT',
      contextScopeKey: 'opaque-context-scope',
      correlationId: CORRELATION_ID,
      signal,
    });
    expect(result.scope).toEqual({
      scopeKind: 'TENANT',
      scopePublicId: null,
      displayName: 'Tenant baseline',
    });
    expect(result.queryState.state).toBe('EMPTY');

    const requested = new URL(transport.get.mock.calls[0][0], 'http://test.invalid');
    expect(requested.pathname).toBe('/api/platform/v1/admin/hris/navigation-policies/workspace');
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      workbenchId: 'HRIS-WB-HR-OPERATIONS',
      scopeKind: 'TENANT',
    });
    expect(transport.get.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        contextScopeKey: 'opaque-context-scope',
        signal,
        headers: {
          'X-Correlation-ID': CORRELATION_ID,
        },
      })
    );
    expect(JSON.stringify(transport.get.mock.calls[0][1].headers)).not.toContain('Tenant-ID');
    expect(JSON.stringify(transport.get.mock.calls[0][1].headers)).not.toContain('Purpose-Code');
  });

  it('sends request-digest, CAS, idempotency and step-up evidence on the correct transports', async () => {
    transport.put.mockResolvedValue({ data: { data: receipt('UPDATE_DRAFT', 'DRAFT') } });
    transport.post
      .mockResolvedValueOnce({ data: { data: receipt('PUBLISH', 'PUBLISHED') } })
      .mockResolvedValueOnce({ data: { data: receipt('RESTORE', 'PUBLISHED') } });
    const envelope = {
      body: draftBody(),
      expectedVersion: 7,
      requestDigest: DIGEST,
      idempotencyKey: IDEMPOTENCY_KEY,
      correlationId: CORRELATION_ID,
    };
    await updateNavigationPolicyDraftRevision(REVISION_ID, envelope, authority(false));
    await publishNavigationPolicyRevision(
      REVISION_ID,
      { ...envelope, body: { reason: 'approved change window' } },
      authority(true)
    );
    await restoreNavigationPolicyRevision(
      RESTORE_TARGET_ID,
      {
        ...envelope,
        body: {
          reason: 'restore approved prior menu policy',
        },
      },
      authority(true)
    );

    expect(transport.put.mock.calls[0][0]).toContain(`/drafts/${REVISION_ID}`);
    expect(transport.put.mock.calls[0][1]).toMatchObject({
      expectedVersion: 7,
      requestDigest: DIGEST,
      workbenchId: 'HRIS-WB-HR-OPERATIONS',
    });
    expect(transport.put.mock.calls[0][2].headers).toMatchObject({
      'Idempotency-Key': IDEMPOTENCY_KEY,
      'X-Correlation-ID': CORRELATION_ID,
      'X-DWP-Expected-Object-Version': '7',
    });
    expect(transport.post.mock.calls[0][2].headers).toMatchObject({
      'Idempotency-Key': IDEMPOTENCY_KEY,
      'X-DWP-Step-Up-Challenge': 'signed-step-up',
      'X-DWP-Expected-Object-Version': '7',
    });
    expect(transport.post.mock.calls[1][0]).toContain(`/revisions/${RESTORE_TARGET_ID}/restore`);
    expect(transport.post.mock.calls[1][1]).toMatchObject({
      expectedVersion: 7,
      reason: 'restore approved prior menu policy',
    });
  });

  it('adapts the owner DTO and loads the tenant ceiling for a legal-entity overlay', async () => {
    transport.get
      .mockResolvedValueOnce({
        data: {
          data: {
            workbenchId: 'HRIS-WB-HR-OPERATIONS',
            scopeKind: 'LEGAL_ENTITY',
            scopePublicId: LEGAL_ENTITY_ID,
            draft: null,
            published: revisionDto('LEGAL_ENTITY', LEGAL_ENTITY_ID, REVISION_ID, 8),
            restorableRevisions: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            workbenchId: 'HRIS-WB-HR-OPERATIONS',
            scopeKind: 'TENANT',
            draft: null,
            published: revisionDto('TENANT', null, RESTORE_TARGET_ID, 7),
            restorableRevisions: [],
          },
        },
      });

    const result = await readNavigationPolicyWorkspace({
      scopeKind: 'LEGAL_ENTITY',
      scopePublicId: LEGAL_ENTITY_ID,
      contextScopeKey: 'opaque-context-scope',
      correlationId: CORRELATION_ID,
    });
    expect(result.activeRevision).toMatchObject({
      revision: 8,
      scopeKind: 'LEGAL_ENTITY',
      legalEntityPublicId: LEGAL_ENTITY_ID,
      authorPrincipalId: 71,
    });
    expect(result.tenantBaseline).toMatchObject({ revision: 7, scopeKind: 'TENANT' });
    expect(
      new URL(transport.get.mock.calls[1][0], 'http://test.invalid').searchParams.has(
        'scopePublicId'
      )
    ).toBe(false);
  });

  it('rejects substituted CAS or idempotency authority before transport', async () => {
    await expect(
      updateNavigationPolicyDraftRevision(
        REVISION_ID,
        {
          body: draftBody(),
          expectedVersion: 7,
          requestDigest: DIGEST,
          idempotencyKey: IDEMPOTENCY_KEY,
          correlationId: CORRELATION_ID,
        },
        { ...authority(false), objectVersion: 8 }
      )
    ).rejects.toThrow('does not match');
    expect(transport.put).not.toHaveBeenCalled();
  });
});

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const LEGAL_ENTITY_ID = '20000000-0000-4000-8000-000000000001';
const REVISION_ID = '30000000-0000-4000-8000-000000000001';
const RESTORE_TARGET_ID = '30000000-0000-4000-8000-000000000002';
const CORRELATION_ID = '40000000-0000-4000-8000-000000000001';
const RECEIPT_ID = '50000000-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = 'navigation-policy-idem-1';
const DIGEST = 'a'.repeat(64);

function authority(
  highRisk: boolean
): Extract<ProductSurfaceGovernedMutationAuthority, { mode: 'SECURE' }> {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-9',
    contextKey: 'hcm.management.navigation-policy',
    contextScopeKey: 'opaque-context-scope',
    objectVersion: 7,
    idempotencyKey: IDEMPOTENCY_KEY,
    ...(highRisk
      ? {
          stepUp: {
            challenge: 'signed-step-up',
            challengeId: 'challenge-1',
            decisionRevision: 'decision-9',
            expiresAt: '2099-01-01T00:00:00Z',
          },
        }
      : {}),
  };
}

function workspaceDto() {
  return {
    workbenchId: 'HRIS-WB-HR-OPERATIONS',
    scopeKind: 'TENANT',
    draft: null,
    published: null,
    restorableRevisions: [],
  };
}

function draftBody() {
  return {
    scopeKind: 'TENANT' as const,
    legalEntityPublicId: null,
    rolloutMode: 'SHADOW' as const,
    workbenchId: 'HRIS-WB-HR-OPERATIONS' as const,
    groups: [],
  };
}

function receipt(
  commandType: 'UPDATE_DRAFT' | 'PUBLISH' | 'RESTORE',
  lifecycleState: 'DRAFT' | 'PUBLISHED'
) {
  return {
    receiptId: RECEIPT_ID,
    policyId: TENANT_ID,
    revisionId: REVISION_ID,
    revisionNumber: 3,
    objectVersion: 8,
    lifecycleState,
    commandType,
    requestDigest: DIGEST,
    correlationId: CORRELATION_ID,
    createdAt: '2026-10-14T03:00:00Z',
  };
}

function revisionDto(
  scopeKind: 'TENANT' | 'LEGAL_ENTITY',
  legalEntityPublicId: string | null,
  revisionId: string,
  revisionNumber: number
) {
  return {
    policyId: TENANT_ID,
    revisionId,
    revisionNumber,
    lifecycleState: 'PUBLISHED',
    rolloutMode: 'ENFORCED',
    policy: {
      scopeKind,
      legalEntityPublicId,
      rolloutMode: 'ENFORCED',
      workbenchId: 'HRIS-WB-HR-OPERATIONS',
      groups: HR_OPERATIONS_NAVIGATION_CATALOG.map((group) => ({
        groupId: group.groupId,
        displayOrder: group.displayOrder,
        enabled: group.enabled,
        defaultNodeId: group.defaultNodeId,
        nodes: group.nodes.map((node) => ({
          nodeId: node.nodeId,
          displayOrder: node.displayOrder,
          enabled: node.enabled,
        })),
      })),
    },
    payloadDigest: 'a'.repeat(64),
    objectVersion: 4,
    authoredBy: 71,
    approvedBy: 72,
    restoredFromRevisionId: null,
    restoredFromDigest: null,
    createdAt: '2026-10-14T01:00:00Z',
    updatedAt: '2026-10-14T02:00:00Z',
  };
}
