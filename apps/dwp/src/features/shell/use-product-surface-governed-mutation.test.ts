import { describe, expect, it } from 'vitest';

import {
  buildProductSurfaceMutationEvaluationRequest,
  classifyProductSurfaceTaskFailure,
  ProductSurfaceMutationAuthorityError,
  resolveProductSurfaceMutationEntryBinding,
  secureProductSurfaceMutationAuthority,
} from '../../components/use-product-surface-governed-mutation';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import type {
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils';

const binding = {
  productKey: 'approvals',
  surfaceKey: 'approvals.admin',
  routeContractKey: 'route.approvals.admin.workflow-update.action',
  taskKind: 'ADMINISTRATION',
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
  const entryContext = snapshot().envelope.contexts[0]!;
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
    context: {
      ...entryContext,
      contextKey: 'approvals-action-direct',
      appResourceKey: 'ACTION.APPROVAL_WORKFLOW_UPDATE',
      scopes: [{ ...entryContext.scopes[0]! }],
      effectiveGrants: [
        {
          grantKind: 'CAPABILITY',
          capabilityContractKey: 'approvals.workflow.update',
          resolvedCapabilityCode: 'ACTION.APPROVAL_WORKFLOW:UPDATE',
          authorityMode: 'PERMISSION',
          predicatePolicyKeys: [],
          responsibilityRequirement: 'REQUIRED',
          responsibility: {
            code: 'APPROVAL_DESIGN_ADMIN',
            resourceSetKey: 'RS_APPROVAL_DESIGN',
          },
          scopeKeys: ['scope-1'],
          requiresProductEntitlement: false,
          readOnly: false,
          activationState: 'ACTIVE',
        },
      ],
    },
  };
}

describe('product surface governed mutation authority', () => {
  it('maps task failures to the closed privacy-safe telemetry reasons', () => {
    expect(classifyProductSurfaceTaskFailure(new ProductSurfaceMutationAuthorityError())).toEqual({
      kind: 'failed',
      reasonCode: 'AUTHORITY_UNAVAILABLE',
    });
    expect(
      classifyProductSurfaceTaskFailure(
        new HttpError('stale', 409, { errorCode: 'DECISION_REVISION_CONFLICT' })
      )
    ).toEqual({ kind: 'failed', reasonCode: 'AUTHORITY_UNAVAILABLE' });
    expect(
      classifyProductSurfaceTaskFailure(
        new HttpError('step up', 403, { errorCode: 'STEP_UP_REQUIRED' })
      )
    ).toEqual({ kind: 'failed', reasonCode: 'STEP_UP_REQUIRED' });
    expect(classifyProductSurfaceTaskFailure(new HttpTransportError('ABORT'))).toEqual({
      kind: 'abandoned',
    });
    expect(classifyProductSurfaceTaskFailure(new HttpTransportError('TIMEOUT'))).toEqual({
      kind: 'failed',
      reasonCode: 'NETWORK_ERROR',
    });
  });

  it('selects the entry context with the trusted server clock, not the local clock', () => {
    expect(
      resolveProductSurfaceMutationEntryBinding(
        snapshot(),
        binding,
        'scope-1',
        Date.parse('2026-08-24T00:59:50Z')
      )
    ).toMatchObject({
      contextScopeKey: 'scope-1',
      contextScopeKind: 'RESOURCE_SET',
      accessMode: 'NORMAL',
      plane: 'management',
    });
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
    ).toMatchObject({ contextScopeKey: 'scope-2', contextScopeKind: 'RESOURCE_SET' });
  });

  it('fails closed when canonical or direct authority returns an unknown scope kind', () => {
    const unknownCanonical = snapshot();
    unknownCanonical.envelope.contexts[0]!.scopes[0]!.kind = 'UNKNOWN_SCOPE';
    expect(
      resolveProductSurfaceMutationEntryBinding(
        unknownCanonical,
        binding,
        'scope-1',
        Date.parse('2026-08-24T00:59:50Z')
      )
    ).toBeNull();

    const entry = resolveProductSurfaceMutationEntryBinding(
      snapshot(),
      binding,
      'scope-1',
      Date.parse('2026-08-24T00:59:50Z')
    )!;
    const unknownDirect = evaluation();
    unknownDirect.context!.scopes[0]!.kind = 'UNKNOWN_SCOPE';
    unknownDirect.scope!.kind = 'UNKNOWN_SCOPE';
    expect(
      secureProductSurfaceMutationAuthority(
        '111',
        binding,
        {
          ...entry,
          contextScopeKind: 'UNKNOWN_SCOPE',
          canonicalScopes: [{ key: 'scope-1', kind: 'UNKNOWN_SCOPE' }],
        },
        unknownDirect,
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toBeNull();
  });

  it('fails closed without throwing for malformed direct scope and grant collections', () => {
    const entry = resolveProductSurfaceMutationEntryBinding(
      snapshot(),
      binding,
      'scope-1',
      Date.parse('2026-08-24T00:59:50Z')
    )!;
    const assertFailsClosed = (candidate: ProductSurfaceEvaluationData) => {
      expect(
        secureProductSurfaceMutationAuthority(
          '111',
          binding,
          entry,
          candidate,
          Date.parse('2026-08-24T01:00:00Z')
        )
      ).toBeNull();
    };

    for (const scopes of [undefined, null, {}, [null], [42]]) {
      const malformed = evaluation();
      (malformed.context as unknown as Record<string, unknown>).scopes = scopes;
      assertFailsClosed(malformed);
    }
    for (const effectiveGrants of [undefined, null, {}, [null], [42]]) {
      const malformed = evaluation();
      (malformed.context as unknown as Record<string, unknown>).effectiveGrants = effectiveGrants;
      assertFailsClosed(malformed);
    }
    for (const scopeKeys of [undefined, null, 'scope-1', [42]]) {
      const malformed = evaluation();
      (malformed.context!.effectiveGrants[0] as unknown as Record<string, unknown>).scopeKeys =
        scopeKeys;
      assertFailsClosed(malformed);
    }
    const unknownDiscriminator = evaluation();
    (
      unknownDiscriminator.context!.effectiveGrants[0] as unknown as Record<string, unknown>
    ).grantKind = 'UNKNOWN';
    assertFailsClosed(unknownDiscriminator);
  });

  it('evaluates only the selected scope and never reuses the aggregate entry context key', () => {
    const entry = resolveProductSurfaceMutationEntryBinding(
      snapshot(),
      binding,
      'scope-1',
      Date.parse('2026-08-24T00:59:50Z')
    )!;

    expect(buildProductSurfaceMutationEvaluationRequest(binding, entry)).toEqual({
      subject: { type: 'PRODUCT', productKey: 'approvals', surfaceKey: 'approvals.admin' },
      routeContractKey: 'route.approvals.admin.workflow-update.action',
      contextScopeKey: 'scope-1',
    });
  });

  it('uses the exact ACTION context and direct revision as the secure mutation precondition', () => {
    const entry = resolveProductSurfaceMutationEntryBinding(
      snapshot(),
      binding,
      'scope-1',
      Date.parse('2026-08-24T00:59:50Z')
    )!;
    expect(
      secureProductSurfaceMutationAuthority(
        '110',
        binding,
        entry,
        evaluation(),
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toMatchObject({
      mode: 'SECURE',
      rolloutState: '110',
      expectedDecisionRevision: 'direct-action-revision',
      contextKey: 'approvals-action-direct',
      contextScopeKey: 'scope-1',
    });
    expect(
      secureProductSurfaceMutationAuthority(
        '111',
        binding,
        entry,
        { ...evaluation(), decisionRevision: 'snapshot-cache-revision', effectiveReadOnly: true },
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toBeNull();

    const duplicateDirectScope = evaluation();
    duplicateDirectScope.context!.scopes = [
      ...duplicateDirectScope.context!.scopes,
      { ...duplicateDirectScope.context!.scopes[0]! },
    ];
    expect(
      secureProductSurfaceMutationAuthority(
        '111',
        binding,
        entry,
        duplicateDirectScope,
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toBeNull();

    const wrongMode = evaluation();
    wrongMode.context = { ...wrongMode.context!, accessMode: 'ELEVATED' };
    expect(
      secureProductSurfaceMutationAuthority(
        '111',
        binding,
        entry,
        wrongMode,
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toBeNull();

    for (const grantOverride of [
      { readOnly: true },
      { activationState: 'ELIGIBLE' },
      { scopeKeys: ['scope-foreign'] },
      { validUntil: '2026-08-24T00:59:59Z' },
    ]) {
      const untrustedGrant = evaluation();
      untrustedGrant.context!.effectiveGrants = [
        { ...untrustedGrant.context!.effectiveGrants[0]!, ...grantOverride },
      ];
      expect(
        secureProductSurfaceMutationAuthority(
          '111',
          binding,
          entry,
          untrustedGrant,
          Date.parse('2026-08-24T01:00:00Z')
        )
      ).toBeNull();
    }

    const policyAction = evaluation();
    policyAction.context!.effectiveGrants = [
      {
        grantKind: 'POLICY',
        accessPolicyKey: 'hcm.personal-home-preference-update.v1',
        policyDecisionRef: 'policy-decision-home-preference',
        authorityMode: 'ENTITLEMENT',
        scopeKeys: ['scope-1'],
        requiresProductEntitlement: false,
        readOnly: false,
      },
    ];
    expect(
      secureProductSurfaceMutationAuthority(
        '111',
        binding,
        entry,
        policyAction,
        Date.parse('2026-08-24T01:00:00Z')
      )
    ).toMatchObject({ contextKey: 'approvals-action-direct' });

    for (const grantOverride of [
      { readOnly: true },
      { scopeKeys: ['scope-foreign'] },
      { validUntil: '2026-08-24T00:59:59Z' },
    ]) {
      const untrustedPolicy = evaluation();
      untrustedPolicy.context!.effectiveGrants = [
        { ...policyAction.context!.effectiveGrants[0]!, ...grantOverride },
      ];
      expect(
        secureProductSurfaceMutationAuthority(
          '111',
          binding,
          entry,
          untrustedPolicy,
          Date.parse('2026-08-24T01:00:00Z')
        )
      ).toBeNull();
    }
  });
});
