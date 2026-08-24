import { describe, expect, it } from 'vitest';

import {
  resolveProductSurfaceMutationEntryBinding,
  secureProductSurfaceMutationAuthority,
} from '../../components/use-product-surface-governed-mutation';

import type {
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils';

const binding = {
  productKey: 'approvals',
  surfaceKey: 'approvals.admin',
  routeContractKey: 'route.approvals.admin.workflow-update.action',
} as const;

function snapshot(): ProductSurfaceAuthoritySnapshot {
  return {
    receivedAtMs: Date.parse('2026-08-24T00:59:50Z'),
    clockOffsetMs: 10_000,
    earliestRevalidateAtMs: Date.parse('2026-08-24T01:05:00Z'),
    envelope: {
      contractVersion: '1',
      decisionRevision: 'snapshot-cache-revision',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-08-24T01:00:00Z',
      rollouts: [],
      contexts: [
        {
          contextKey: 'approvals-management',
          productKey: 'approvals',
          surfaceKey: 'approvals.admin',
          plane: 'management',
          accessMode: 'NORMAL',
          accessSource: 'MANAGEMENT',
          appResourceKey: 'APP.APPROVALS',
          effectiveGrants: [],
          scopes: [
            {
              key: 'scope-1',
              kind: 'RESOURCE_SET',
              displayName: 'Approvals',
              isDefault: true,
              readOnly: false,
            },
          ],
          revalidateAt: '2026-08-24T01:05:00Z',
        },
      ],
    },
  };
}

function evaluation(): ProductSurfaceEvaluationData {
  return {
    decision: 'ALLOWED',
    decisionRevision: 'direct-action-revision',
    routeGrantRef: 'route-grant',
    effectiveReadOnly: false,
    revalidateAt: '2026-08-24T01:04:00Z',
    scope: {
      key: 'scope-1',
      kind: 'RESOURCE_SET',
      displayName: 'Approvals',
      isDefault: true,
      readOnly: false,
    },
    context: snapshot().envelope.contexts[0],
  };
}

describe('product surface governed mutation authority', () => {
  it('selects the entry context with the trusted server clock, not the local clock', () => {
    expect(
      resolveProductSurfaceMutationEntryBinding(
        snapshot(),
        binding,
        'scope-1',
        Date.parse('2026-08-24T00:59:50Z')
      )
    ).toEqual({ contextKey: 'approvals-management', contextScopeKey: 'scope-1' });
    expect(
      resolveProductSurfaceMutationEntryBinding(
        snapshot(),
        binding,
        'scope-1',
        Date.parse('2026-08-24T01:04:50Z')
      )
    ).toBeNull();
  });

  it('never implicitly selects a default when a mutation has multiple writable scopes', () => {
    const multipleScopes = snapshot();
    multipleScopes.envelope.contexts[0]!.scopes.push({
      key: 'scope-2',
      kind: 'RESOURCE_SET',
      displayName: 'Approvals 2',
      isDefault: false,
      readOnly: false,
    });

    expect(
      resolveProductSurfaceMutationEntryBinding(
        multipleScopes,
        binding,
        undefined,
        Date.parse('2026-08-24T00:59:50Z')
      )
    ).toBeNull();
    expect(
      resolveProductSurfaceMutationEntryBinding(
        multipleScopes,
        binding,
        'scope-2',
        Date.parse('2026-08-24T00:59:50Z')
      )
    ).toEqual({ contextKey: 'approvals-management', contextScopeKey: 'scope-2' });
  });

  it('uses only the exact ACTION direct revision as the secure mutation precondition', () => {
    expect(
      secureProductSurfaceMutationAuthority(
        '110',
        binding,
        { contextKey: 'approvals-management', contextScopeKey: 'scope-1' },
        evaluation(),
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toMatchObject({
      mode: 'SECURE',
      rolloutState: '110',
      expectedDecisionRevision: 'direct-action-revision',
    });
    expect(
      secureProductSurfaceMutationAuthority(
        '111',
        binding,
        { contextKey: 'approvals-management', contextScopeKey: 'scope-1' },
        { ...evaluation(), decisionRevision: 'snapshot-cache-revision', effectiveReadOnly: true },
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toBeNull();
  });
});
