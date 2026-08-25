import { describe, expect, it } from 'vitest';

import {
  isProductSurfaceEnforced,
  resolveCanaryProductFlags,
  resolveCanaryRouteDecision,
  resolveCanarySurfaceDecision,
  resolveProductSurfaceRolloutMode,
  type ProductSurfaceCanaryAuthority,
  type ProductSurfaceRolloutFlags,
} from './product-surface-canary-runtime';

import type {
  AllowedSurfaceDecision,
  EffectiveCapabilityGrant,
  EffectivePolicyGrant,
  EffectiveProductSurfaceContext,
} from './product-surface-context';

const flags = (
  contextShadow: boolean,
  capabilityEnforcement: boolean,
  surfaceUi: boolean,
  surfaceUiEvaluation: ProductSurfaceRolloutFlags['surfaceUiEvaluation'] = 'resolved'
): ProductSurfaceRolloutFlags => ({
  contextShadow,
  capabilityEnforcement,
  surfaceUi,
  surfaceUiEvaluation,
});

const supportGrant: EffectivePolicyGrant = {
  grantKind: 'POLICY',
  accessPolicyKey: 'communications.management-entry.v1',
  policyDecisionRef: 'support-decision-1',
  authorityMode: 'SUPPORT_SESSION',
  scopeKeys: ['scope-config'],
  requiresProductEntitlement: false,
  readOnly: true,
};

const context: EffectiveProductSurfaceContext = {
  contextKey: 'ctx-communications-support',
  productKey: 'communications',
  surfaceKey: 'communications.management',
  plane: 'management',
  accessMode: 'PROVIDER_SUPPORT',
  accessSource: 'SUPPORT',
  appResourceKey: 'APP.COMMUNICATIONS',
  effectiveGrants: [supportGrant],
  scopes: [
    {
      key: 'scope-config',
      kind: 'SUPPORT_SESSION',
      displayName: 'Configuration scope',
      isDefault: true,
      readOnly: true,
    },
  ],
  revalidateAt: '2030-01-01T00:00:00.000Z',
};

const allowed: AllowedSurfaceDecision = {
  state: 'allowed',
  context,
  routeGrantRef: 'communications.content-route-access.v1',
  scope: context.scopes[0]!,
  effectiveReadOnly: true,
  revalidateAt: context.revalidateAt,
  decisionRevision: 'revision-1',
};

function authority(
  overrides: Partial<ProductSurfaceCanaryAuthority> = {}
): ProductSurfaceCanaryAuthority {
  return {
    flags: flags(true, true, true),
    serverNowMs: Date.parse('2029-01-01T00:00:00.000Z'),
    envelope: {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'revision-1',
      sourceRevisions: {},
      activeAccessMode: 'PROVIDER_SUPPORT',
      generatedAt: '2029-01-01T00:00:00.000Z',
      contexts: [context],
    },
    routeDecisions: { 'route.communications.management.content.page': allowed },
    ...overrides,
  };
}

describe('product surface Canary rollout runtime', () => {
  it('accepts only the approved four rollout states', () => {
    expect(resolveProductSurfaceRolloutMode(flags(false, false, false))).toBe('baseline');
    expect(resolveProductSurfaceRolloutMode(flags(true, false, false))).toBe('shadow');
    expect(resolveProductSurfaceRolloutMode(flags(true, true, false))).toBe(
      'enforced-compatibility'
    );
    expect(resolveProductSurfaceRolloutMode(flags(true, true, true))).toBe('surface-ui');
    expect(resolveProductSurfaceRolloutMode(flags(false, true, false))).toBe('invalid');
    expect(resolveProductSurfaceRolloutMode(flags(true, false, true))).toBe('invalid');
  });

  it('falls back to enforced compatibility when only UI flag evaluation is unavailable', () => {
    const mode = resolveProductSurfaceRolloutMode(flags(true, true, true, 'unavailable'));

    expect(mode).toBe('enforced-compatibility');
    expect(isProductSurfaceEnforced(mode)).toBe(true);
  });

  it('does not downgrade a missing governed product rollout to global baseline flags', () => {
    const missingProduct = authority({
      flags: flags(false, false, false),
      productFlags: {
        communications: flags(true, true, false),
      },
    });

    expect(
      resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(missingProduct, 'services'))
    ).toBe('invalid');
    expect(
      resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(missingProduct, 'communications'))
    ).toBe('enforced-compatibility');
  });

  it('accepts route and surface decisions across list/direct revisions with exact identity', () => {
    const expected = {
      productId: 'communications',
      surfaceId: 'communications.management',
      routeContractKey: 'route.communications.management.content.page',
    };

    expect(resolveCanaryRouteDecision(authority(), expected)).toEqual(allowed);
    const splitRevision = authority({
      envelope: {
        ...authority().envelope!,
        decisionRevision: 'psr-list-with-rollout-digest',
      },
      routeDecisions: {
        [expected.routeContractKey]: {
          ...allowed,
          decisionRevision: 'psr-direct-route-evaluation',
        },
      },
      surfaceDecisions: {
        [expected.surfaceId]: {
          ...allowed,
          decisionRevision: 'psr-direct-surface-evaluation',
        },
      },
    });
    expect(resolveCanaryRouteDecision(splitRevision, expected)).toMatchObject({
      state: 'allowed',
      decisionRevision: 'psr-direct-route-evaluation',
    });
    expect(resolveCanarySurfaceDecision(splitRevision, expected)).toMatchObject({
      state: 'allowed',
      decisionRevision: 'psr-direct-surface-evaluation',
    });
    expect(
      resolveCanaryRouteDecision(
        authority({
          envelope: { ...authority().envelope!, activeAccessMode: 'NORMAL' },
        }),
        expected
      )
    ).toEqual({ state: 'authority-unavailable' });
  });

  it('rejects a writable route projection from an otherwise read-only support entry', () => {
    const expected = {
      productId: 'communications',
      surfaceId: 'communications.management',
      routeContractKey: 'route.communications.management.content.page',
    };
    const canonicalContext: EffectiveProductSurfaceContext = {
      ...context,
      contextKey: 'ctx-entry-communications-management',
      appResourceKey: 'ADMIN.COMMUNICATIONS.DESIGN',
      effectiveGrants: [
        {
          ...supportGrant,
          scopeKeys: ['scope-config', 'scope-other-support-session'],
        },
      ],
      scopes: [
        {
          ...context.scopes[0]!,
          isDefault: false,
          validUntil: '2036-01-01T00:00:00.000Z',
        },
        {
          key: 'scope-other-support-session',
          kind: 'SUPPORT_SESSION',
          displayName: 'Other configuration scope',
          isDefault: false,
          readOnly: true,
        },
      ],
    };
    const routeContext: EffectiveProductSurfaceContext = {
      ...context,
      contextKey: 'ctx-route-communications-content',
      appResourceKey: 'ADMIN.COMMUNICATIONS.OPERATIONS',
      scopes: [{ ...context.scopes[0]!, isDefault: true, readOnly: false }],
    };
    const routeDecision: AllowedSurfaceDecision = {
      ...allowed,
      context: routeContext,
      scope: routeContext.scopes[0]!,
      effectiveReadOnly: false,
      decisionRevision: 'revision-route-specific',
    };

    expect(
      resolveCanaryRouteDecision(
        authority({
          envelope: {
            ...authority().envelope!,
            contexts: [canonicalContext],
          },
          routeDecisions: { [expected.routeContractKey]: routeDecision },
        }),
        expected
      )
    ).toEqual({ state: 'authority-unavailable' });
  });

  it('fails provider support closed unless canonical and direct authority are an exclusive read-only session union', () => {
    const expected = {
      productId: 'communications',
      surfaceId: 'communications.management',
      routeContractKey: 'route.communications.management.content.page',
    };
    const capabilityGrant: EffectiveCapabilityGrant = {
      grantKind: 'CAPABILITY',
      capabilityContractKey: 'communications.content.read',
      resolvedCapabilityCode: 'RESOURCE.COMMUNICATION_CONTENT:VIEW',
      authorityMode: 'PERMISSION',
      responsibilityRequirement: 'NOT_REQUIRED',
      scopeKeys: ['scope-config'],
      requiresProductEntitlement: false,
      readOnly: true,
      activationState: 'ACTIVE',
    };
    const canonicalMutations: readonly ((candidate: EffectiveProductSurfaceContext) => void)[] = [
      (candidate) => {
        candidate.accessSource = 'MANAGEMENT';
      },
      (candidate) => {
        candidate.effectiveGrants = [capabilityGrant];
      },
      (candidate) => {
        candidate.effectiveGrants = [{ ...supportGrant, authorityMode: 'ENTITLEMENT' }];
      },
      (candidate) => {
        candidate.effectiveGrants = [{ ...supportGrant, readOnly: false }];
      },
      (candidate) => {
        candidate.effectiveGrants = [{ ...supportGrant, requiresProductEntitlement: true }];
      },
      (candidate) => {
        candidate.effectiveGrants = [];
      },
      (candidate) => {
        candidate.scopes = [{ ...candidate.scopes[0]!, readOnly: false }];
      },
      (candidate) => {
        candidate.scopes = [{ ...candidate.scopes[0]!, kind: 'RESOURCE_SET' }];
      },
      (candidate) => {
        candidate.effectiveGrants = [{ ...supportGrant, scopeKeys: [] }];
      },
    ];

    for (const mutate of canonicalMutations) {
      const malformed = structuredClone(context);
      mutate(malformed);
      expect(
        resolveCanaryRouteDecision(
          authority({ envelope: { ...authority().envelope!, contexts: [malformed] } }),
          expected
        )
      ).toEqual({ state: 'authority-unavailable' });
    }

    const directMutations: readonly ((candidate: AllowedSurfaceDecision) => void)[] = [
      (candidate) => {
        candidate.context = { ...candidate.context, accessSource: 'MANAGEMENT' };
      },
      (candidate) => {
        candidate.context = { ...candidate.context, effectiveGrants: [capabilityGrant] };
      },
      (candidate) => {
        candidate.context = {
          ...candidate.context,
          effectiveGrants: [{ ...supportGrant, authorityMode: 'ENTITLEMENT' }],
        };
      },
      (candidate) => {
        candidate.context = {
          ...candidate.context,
          effectiveGrants: [{ ...supportGrant, readOnly: false }],
        };
      },
      (candidate) => {
        candidate.context = {
          ...candidate.context,
          effectiveGrants: [{ ...supportGrant, requiresProductEntitlement: true }],
        };
      },
      (candidate) => {
        candidate.context = { ...candidate.context, effectiveGrants: [] };
      },
      (candidate) => {
        candidate.context = {
          ...candidate.context,
          scopes: [{ ...candidate.context.scopes[0]!, readOnly: false }],
        };
        candidate.scope = candidate.context.scopes[0]!;
      },
      (candidate) => {
        candidate.context = {
          ...candidate.context,
          scopes: [{ ...candidate.context.scopes[0]!, kind: 'RESOURCE_SET' }],
        };
        candidate.scope = candidate.context.scopes[0]!;
      },
      (candidate) => {
        candidate.context = { ...candidate.context, accessMode: 'NORMAL' };
      },
      (candidate) => {
        candidate.effectiveReadOnly = false;
      },
    ];

    for (const mutate of directMutations) {
      const malformed = structuredClone(allowed);
      mutate(malformed);
      expect(
        resolveCanaryRouteDecision(
          authority({ routeDecisions: { [expected.routeContractKey]: malformed } }),
          expected
        )
      ).toEqual({ state: 'authority-unavailable' });
    }
  });

  it('accepts a fresh exact route scope projected from the aggregate entry scope set', () => {
    const expected = {
      productId: 'approvals',
      surfaceId: 'approvals.work',
      routeContractKey: 'route.approvals.work.inbox.page',
    };
    const canonicalContext: EffectiveProductSurfaceContext = {
      ...context,
      contextKey: 'ctx-entry-approvals-work',
      productKey: 'approvals',
      surfaceKey: 'approvals.work',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'ENTITLEMENT',
      appResourceKey: 'APP.APPROVALS',
      effectiveGrants: [
        {
          grantKind: 'POLICY',
          accessPolicyKey: 'approvals.work-access.v1',
          policyDecisionRef: 'approvals-work-decision',
          authorityMode: 'ENTITLEMENT',
          scopeKeys: ['scope-self', 'scope-assigned-task-population'],
          requiresProductEntitlement: true,
          readOnly: false,
        },
      ],
      scopes: [
        {
          key: 'scope-self',
          kind: 'SELF',
          displayName: 'Self',
          isDefault: true,
          readOnly: false,
        },
        {
          key: 'scope-assigned-task-population',
          kind: 'TARGET_POPULATION' as EffectiveProductSurfaceContext['scopes'][number]['kind'],
          displayName: 'Assigned candidate and delegated tasks',
          isDefault: false,
          readOnly: true,
          validUntil: '2036-01-01T00:00:00.000Z',
        },
      ],
    };
    const routeContext: EffectiveProductSurfaceContext = {
      ...canonicalContext,
      contextKey: 'ctx-route-approvals-inbox',
      appResourceKey: 'ACTION.APPROVAL_TASK',
      effectiveGrants: [
        {
          grantKind: 'POLICY',
          accessPolicyKey: 'approvals.work-access.v1',
          policyDecisionRef: 'approvals-inbox-decision',
          authorityMode: 'ENTITLEMENT',
          scopeKeys: ['scope-assigned-task-population'],
          requiresProductEntitlement: true,
          readOnly: false,
        },
      ],
      scopes: [
        {
          key: 'scope-assigned-task-population',
          kind: 'TARGET_POPULATION' as EffectiveProductSurfaceContext['scopes'][number]['kind'],
          displayName: 'Assigned candidate and delegated tasks',
          isDefault: true,
          readOnly: false,
        },
      ],
    };
    const routeDecision: AllowedSurfaceDecision = {
      ...allowed,
      context: routeContext,
      scope: routeContext.scopes[0]!,
      effectiveReadOnly: false,
      revalidateAt: routeContext.revalidateAt,
      decisionRevision: 'psr-direct-inbox',
    };
    const actualAuthority = authority({
      envelope: {
        ...authority().envelope!,
        decisionRevision: 'psr-list-approvals',
        activeAccessMode: 'NORMAL',
        contexts: [canonicalContext],
      },
      routeDecisions: { [expected.routeContractKey]: routeDecision },
    });

    expect(resolveCanaryRouteDecision(actualAuthority, expected)).toEqual(routeDecision);
  });

  it('fails closed when route-specific identity or direct scope evidence is malformed', () => {
    const expected = {
      productId: 'communications',
      surfaceId: 'communications.management',
      routeContractKey: 'route.communications.management.content.page',
    };
    const canonicalContext: EffectiveProductSurfaceContext = {
      ...context,
      contextKey: 'ctx-entry-communications-management',
    };
    const routeContext: EffectiveProductSurfaceContext = {
      ...context,
      contextKey: 'ctx-route-communications-content',
    };
    const duplicateDirectScope = {
      key: routeContext.scopes[0]!.key,
      kind: 'RESOURCE_SET' as const,
      displayName: 'Duplicate direct scope',
      isDefault: false,
      readOnly: true,
    };
    const directCapabilityGrant: EffectiveCapabilityGrant = {
      grantKind: 'CAPABILITY',
      capabilityContractKey: 'communications.content.read',
      resolvedCapabilityCode: 'RESOURCE.COMMUNICATION_CONTENT:VIEW',
      authorityMode: 'PERMISSION',
      responsibilityRequirement: 'NOT_REQUIRED',
      scopeKeys: [routeContext.scopes[0]!.key],
      requiresProductEntitlement: false,
      readOnly: true,
      activationState: 'ACTIVE',
    };
    const withUntrustedGrants = (effectiveGrants: unknown): EffectiveProductSurfaceContext => ({
      ...routeContext,
      effectiveGrants:
        effectiveGrants as unknown as EffectiveProductSurfaceContext['effectiveGrants'],
    });
    const untrustedContexts: readonly EffectiveProductSurfaceContext[] = [
      { ...routeContext, contextKey: ' ' },
      { ...routeContext, plane: 'work' },
      {
        ...routeContext,
        accessSource: 'UNKNOWN' as EffectiveProductSurfaceContext['accessSource'],
      },
      { ...routeContext, appResourceKey: ' ' },
      ...([null, undefined, 42] as const).map((appResourceKey) => ({
        ...routeContext,
        appResourceKey: appResourceKey as unknown as string,
      })),
      { ...routeContext, scopes: [...routeContext.scopes, duplicateDirectScope] },
      {
        ...routeContext,
        scopes: [{ ...routeContext.scopes[0]!, key: ' ' }],
      },
      withUntrustedGrants(undefined),
      withUntrustedGrants({}),
      withUntrustedGrants([null]),
      withUntrustedGrants([{ ...directCapabilityGrant, grantKind: 'UNKNOWN' }]),
      withUntrustedGrants([{ ...directCapabilityGrant, scopeKeys: 'scope-config' }]),
      withUntrustedGrants([{ ...directCapabilityGrant, scopeKeys: [42] }]),
    ];

    for (const untrustedContext of untrustedContexts) {
      const routeDecision: AllowedSurfaceDecision = {
        ...allowed,
        context: untrustedContext,
        scope: untrustedContext.scopes[0]!,
      };
      expect(
        resolveCanaryRouteDecision(
          authority({
            envelope: {
              ...authority().envelope!,
              contexts: [canonicalContext],
            },
            routeDecisions: { [expected.routeContractKey]: routeDecision },
          }),
          expected
        )
      ).toEqual({ state: 'authority-unavailable' });
    }

    expect(
      resolveCanaryRouteDecision(
        authority({
          envelope: {
            ...authority().envelope!,
            contexts: [canonicalContext, { ...canonicalContext, contextKey: 'ctx-ambiguous' }],
          },
          routeDecisions: {
            [expected.routeContractKey]: {
              ...allowed,
              context: routeContext,
              scope: routeContext.scopes[0]!,
            },
          },
        }),
        expected
      )
    ).toEqual({ state: 'authority-unavailable' });
  });

  it('fails closed for expired direct or canonical authority evidence', () => {
    const expected = {
      productId: 'communications',
      surfaceId: 'communications.management',
      routeContractKey: 'route.communications.management.content.page',
    };
    expect(
      resolveCanaryRouteDecision(
        authority({
          routeDecisions: {
            [expected.routeContractKey]: {
              ...allowed,
              revalidateAt: '2028-01-01T00:00:00Z',
            },
          },
        }),
        expected
      )
    ).toEqual({ state: 'authority-unavailable' });
    expect(
      resolveCanaryRouteDecision(
        authority({
          envelope: {
            ...authority().envelope!,
            contexts: [{ ...context, revalidateAt: '2028-01-01T00:00:00Z' }],
          },
        }),
        expected
      )
    ).toEqual({ state: 'authority-unavailable' });
  });
});
