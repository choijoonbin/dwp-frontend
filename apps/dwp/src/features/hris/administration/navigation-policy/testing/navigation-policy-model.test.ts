import { describe, expect, it } from 'vitest';

import { HR_OPERATIONS_NAVIGATION_CATALOG } from '../../../shell/navigation-policy/hr-operations-navigation-policy';
import {
  assertNavigationPolicyReceipt,
  createNavigationPolicyDraft,
  moveNavigationPolicyGroup,
  navigationPolicyActions,
  resolveNavigationPolicyViewState,
  setNavigationPolicyNodeEnabled,
  validateNavigationPolicyDraft,
} from '../model/navigation-policy-model';

import type { NavigationPolicyRevision } from '../model/navigation-policy-model';

describe('navigation-policy model', () => {
  it('creates a complete tenant baseline and exposes the governed lifecycle only', () => {
    const draft = createNavigationPolicyDraft({ scopeKind: 'TENANT', scopePublicId: TENANT_ID });
    expect(draft.groups).toHaveLength(7);
    expect(draft.groups.flatMap((group) => group.nodes)).toHaveLength(17);
    expect(validateNavigationPolicyDraft(draft)).toEqual([]);
    expect(navigationPolicyActions('DRAFT')).toEqual(['SAVE_DRAFT', 'VALIDATE']);
    expect(navigationPolicyActions('VALIDATED')).toEqual(['SUBMIT']);
    expect(navigationPolicyActions('PENDING_APPROVAL')).toEqual(['APPROVE']);
    expect(navigationPolicyActions('APPROVED')).toEqual(['PUBLISH']);
    expect(navigationPolicyActions('PUBLISHED')).toEqual(['RESTORE']);
  });

  it('makes the legal-entity baseline a restrictive ceiling', () => {
    const tenant = revision();
    const firstGroup = tenant.groups[0];
    const deniedNode = firstGroup.nodes[0].nodeId;
    const restrictedTenant = {
      ...tenant,
      groups: tenant.groups.map((group) =>
        group.groupId === firstGroup.groupId
          ? {
              ...group,
              nodes: group.nodes.map((node) =>
                node.nodeId === deniedNode ? { ...node, enabled: false } : node
              ),
              defaultNodeId: group.nodes[1].nodeId,
            }
          : group
      ),
    } satisfies NavigationPolicyRevision;
    const overlay = createNavigationPolicyDraft({
      scopeKind: 'LEGAL_ENTITY',
      scopePublicId: LEGAL_ENTITY_ID,
      tenantBaseline: restrictedTenant,
    });

    expect(overlay.groups[0].nodes.find((node) => node.nodeId === deniedNode)?.enabled).toBe(false);
    expect(() =>
      setNavigationPolicyNodeEnabled(
        overlay,
        firstGroup.groupId,
        deniedNode,
        true,
        restrictedTenant
      )
    ).toThrow('cannot re-enable');
  });

  it('keeps canonical order moves deterministic without changing node identity', () => {
    const draft = createNavigationPolicyDraft({ scopeKind: 'TENANT', scopePublicId: TENANT_ID });
    const moved = moveNavigationPolicyGroup(draft, 'HROPS-02', -1);
    expect(moved.groups.map((group) => group.groupId).slice(0, 2)).toEqual([
      'HROPS-02',
      'HROPS-01',
    ]);
    expect(
      new Set(moved.groups.flatMap((group) => group.nodes.map((node) => node.nodeId))).size
    ).toBe(17);
  });

  it('keeps loading, empty, partial, stale, denied, and unavailable states distinct', () => {
    expect(viewState({ loading: true })).toBe('LOADING');
    expect(viewState({ denied: true, failed: true })).toBe('DENIED');
    expect(viewState({ failed: true })).toBe('ERROR');
    expect(viewState({ workspace: workspace('EMPTY', 'CURRENT') })).toBe('EMPTY');
    expect(viewState({ workspace: workspace('PARTIAL', 'CURRENT') })).toBe('PARTIAL');
    expect(viewState({ workspace: workspace('COMPLETE', 'STALE') })).toBe('STALE');
    expect(viewState({ workspace: workspace('UNAVAILABLE', 'UNAVAILABLE') })).toBe('UNAVAILABLE');
  });

  it('accepts only an immutable receipt matching the sealed action and request digest', () => {
    const receipt = {
      receiptId: '30000000-0000-4000-8000-000000000001',
      policyId: '60000000-0000-4000-8000-000000000001',
      revisionId: REVISION_ID,
      revision: 3,
      objectVersion: 7,
      lifecycleState: 'PUBLISHED',
      status: 'SUCCEEDED',
      commandType: 'PUBLISH',
      requestDigest: 'b'.repeat(64),
      correlationId: '40000000-0000-4000-8000-000000000001',
      createdAt: '2026-10-14T03:00:00Z',
    };
    expect(
      assertNavigationPolicyReceipt(receipt, {
        action: 'PUBLISH',
        requestDigest: 'b'.repeat(64),
      }).objectVersion
    ).toBe(7);
    expect(() =>
      assertNavigationPolicyReceipt(
        { ...receipt, requestDigest: 'c'.repeat(64) },
        { action: 'PUBLISH', requestDigest: 'b'.repeat(64) }
      )
    ).toThrow('does not match');
  });
});

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const LEGAL_ENTITY_ID = '20000000-0000-4000-8000-000000000001';
const REVISION_ID = '50000000-0000-4000-8000-000000000001';

function revision(): NavigationPolicyRevision {
  return {
    policyId: '60000000-0000-4000-8000-000000000001',
    revisionId: REVISION_ID,
    revision: 2,
    objectVersion: 4,
    status: 'PUBLISHED',
    scopeKind: 'TENANT',
    scopePublicId: null,
    legalEntityPublicId: null,
    rolloutMode: 'ENFORCED',
    workbenchId: 'HRIS-WB-HR-OPERATIONS',
    groups: HR_OPERATIONS_NAVIGATION_CATALOG,
    digest: 'a'.repeat(64),
    authorPrincipalId: 71,
    approvedByPrincipalId: 72,
    restoredFromRevisionId: null,
    restoredFromDigest: null,
    createdAt: '2026-10-14T01:00:00Z',
    updatedAt: '2026-10-14T02:00:00Z',
  };
}

function workspace(
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE',
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE'
) {
  return {
    projectionVersion: '1' as const,
    asOf: '2026-10-14T03:00:00Z',
    queryState: {
      state,
      freshness,
      scopeDecisionRevision: 'decision-1',
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'legal-overlay',
                errorCode: 'OWNER_TIMEOUT',
                correlationId: '80000000-0000-4000-8000-000000000001',
                retryable: true,
              },
            ]
          : [],
    },
    scope: { scopeKind: 'TENANT' as const, scopePublicId: TENANT_ID, displayName: 'SKAX' },
    tenantBaseline: null,
    activeRevision: null,
    draft: null,
  };
}

function viewState(overrides: Partial<Parameters<typeof resolveNavigationPolicyViewState>[0]>) {
  return resolveNavigationPolicyViewState({
    loading: false,
    denied: false,
    failed: false,
    ...overrides,
  });
}
