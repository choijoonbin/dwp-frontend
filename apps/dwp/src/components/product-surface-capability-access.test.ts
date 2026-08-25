import { describe, expect, it } from 'vitest';

import {
  hasWritableProductSurfaceCapability,
  resolveCanonicalProductSurfaceContext,
} from './product-surface-capability-access';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';
import type { CanonicalProductSurfaceContext } from './product-surface-capability-access';

const REVISION = `psr-${'a'.repeat(64)}`;
const FUTURE = '2030-01-01T00:00:00Z';
const NOW = Date.parse('2029-01-01T00:00:00Z');

function decision(
  overrides: Partial<{
    decisionRevision: string;
    effectiveReadOnly: boolean;
    scopeReadOnly: boolean;
  }> = {}
): AllowedSurfaceDecision {
  return {
    state: 'allowed',
    routeGrantRef: 'grant:page',
    effectiveReadOnly: overrides.effectiveReadOnly ?? false,
    revalidateAt: FUTURE,
    decisionRevision: overrides.decisionRevision ?? REVISION,
    scope: {
      key: 'scope:selected',
      kind: 'RESOURCE_SET',
      displayName: 'Selected',
      isDefault: true,
      readOnly: overrides.scopeReadOnly ?? false,
    },
    context: {
      contextKey: 'context:hcm-management',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.HCM',
      scopes: [
        {
          key: 'scope:selected',
          kind: 'RESOURCE_SET',
          displayName: 'Selected',
          isDefault: true,
          readOnly: false,
        },
      ],
      effectiveGrants: [
        {
          grantKind: 'CAPABILITY',
          capabilityContractKey: 'hcm.controlled-export.read',
          resolvedCapabilityCode: 'ACTION.WORKFORCE_DATA_OPERATIONS:VIEW',
          authorityMode: 'PERMISSION',
          responsibilityRequirement: 'REQUIRED',
          scopeKeys: ['scope:selected'],
          requiresProductEntitlement: false,
          readOnly: true,
          activationState: 'ACTIVE',
        },
      ],
      revalidateAt: FUTURE,
    },
  };
}

function entryContext(
  capabilityContractKey: string,
  overrides: Partial<{
    activationState: string;
    grantReadOnly: boolean;
    scopeReadOnly: boolean;
    scopeKeys: string[];
    validUntil: string;
  }> = {}
): CanonicalProductSurfaceContext {
  return {
    contextKey: 'context:hcm-management',
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
    plane: 'management',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    appResourceKey: 'APP.HCM',
    scopes: [
      {
        key: 'scope:selected',
        kind: 'RESOURCE_SET',
        displayName: 'Selected',
        isDefault: true,
        readOnly: overrides.scopeReadOnly ?? false,
        validUntil: null,
      },
      {
        key: 'scope:other',
        kind: 'RESOURCE_SET',
        displayName: 'Other',
        isDefault: false,
        readOnly: false,
        validUntil: null,
      },
    ],
    effectiveGrants: [
      {
        grantKind: 'CAPABILITY',
        capabilityContractKey,
        resolvedCapabilityCode: 'ACTION.WORKFORCE_DATA_OPERATIONS:UPDATE',
        authorityMode: 'PERMISSION',
        predicatePolicyKeys: [],
        responsibilityRequirement: 'REQUIRED',
        responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'RS_HCM_CONFIG' },
        scopeKeys: overrides.scopeKeys ?? ['scope:selected'],
        requiresProductEntitlement: false,
        readOnly: overrides.grantReadOnly ?? false,
        activationState: overrides.activationState ?? 'ACTIVE',
        validUntil: overrides.validUntil ?? null,
      },
    ],
    revalidateAt: FUTURE,
  };
}

function snapshot(context: CanonicalProductSurfaceContext): ProductSurfaceAuthoritySnapshot {
  return {
    envelope: {
      contractVersion: '3',
      decisionRevision: REVISION,
      sourceRevisions: { auth: 'auth-1' },
      activeAccessMode: 'NORMAL',
      generatedAt: '2029-01-01T00:00:00Z',
      contexts: [context],
      rollouts: [],
    },
    receivedAtMs: NOW,
    clockOffsetMs: 0,
    earliestRevalidateAtMs: Date.parse(FUTURE),
  };
}

describe('hasWritableProductSurfaceCapability', () => {
  it('uses the canonical entry context instead of the PAGE decision grants', () => {
    const pageDecision = decision();
    const canonical = resolveCanonicalProductSurfaceContext(
      pageDecision,
      snapshot(entryContext('hcm.integration.update'))
    );

    expect(pageDecision.context.effectiveGrants).not.toContainEqual(
      expect.objectContaining({ capabilityContractKey: 'hcm.integration.update' })
    );
    expect(
      hasWritableProductSurfaceCapability(pageDecision, canonical, 'hcm.integration.update', NOW)
    ).toBe(true);
  });

  it('fails closed for a missing capability or a grant bound to another scope', () => {
    const pageDecision = decision();
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        entryContext('hcm.integration.create'),
        'hcm.integration.update',
        NOW
      )
    ).toBe(false);
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        entryContext('hcm.integration.update', { scopeKeys: ['scope:other'] }),
        'hcm.integration.update',
        NOW
      )
    ).toBe(false);
  });

  it('requires an exact context, surface, and selected-scope identity', () => {
    const pageDecision = decision();
    const wrongSurface = entryContext('hcm.integration.update');
    wrongSurface.surfaceKey = 'hcm.work';
    expect(resolveCanonicalProductSurfaceContext(pageDecision, snapshot(wrongSurface))).toBeNull();

    const wrongScope = entryContext('hcm.integration.update');
    wrongScope.scopes = wrongScope.scopes.filter((scope) => scope.key !== 'scope:selected');
    expect(resolveCanonicalProductSurfaceContext(pageDecision, snapshot(wrongScope))).toBeNull();
  });

  it('admits exact canonical grants when list and direct decision revisions differ', () => {
    const pageDecision = decision({ decisionRevision: 'psr-direct-route-evaluation' });
    const listSnapshot = snapshot(entryContext('hcm.integration.update'));
    listSnapshot.envelope.decisionRevision = 'psr-list-with-rollout-digest';
    const canonical = resolveCanonicalProductSurfaceContext(pageDecision, listSnapshot);

    expect(
      hasWritableProductSurfaceCapability(pageDecision, canonical, 'hcm.integration.update', NOW)
    ).toBe(true);
    expect(pageDecision.decisionRevision).toBe('psr-direct-route-evaluation');
  });

  it('allows ACTIVE and ELIGIBLE only, rejecting production-unknown REQUIRED', () => {
    const pageDecision = decision();
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        entryContext('hcm.integration.execute', { activationState: 'ELIGIBLE' }),
        'hcm.integration.execute',
        NOW
      )
    ).toBe(true);
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        entryContext('hcm.integration.execute', { activationState: 'REQUIRED' }),
        'hcm.integration.execute',
        NOW
      )
    ).toBe(false);
  });

  it('does not let one exact capability disclose a sibling action', () => {
    const pageDecision = decision();
    const createOnly = entryContext('communications.content.create');
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        createOnly,
        'communications.content.create',
        NOW
      )
    ).toBe(true);
    expect(
      [
        'communications.content.update',
        'communications.content.publish',
        'communications.content.archive',
        'services.catalog.create',
        'services.catalog.update',
        'services.operations.update',
        'hcm.controlled-export.create',
        'hcm.controlled-export.cancel',
        'hcm.controlled-export.retry',
      ].every(
        (capability) =>
          !hasWritableProductSurfaceCapability(pageDecision, createOnly, capability, NOW)
      )
    ).toBe(true);
  });

  it('fails closed for read-only or expired authority evidence', () => {
    const pageDecision = decision();
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        entryContext('hcm.integration.update', { grantReadOnly: true }),
        'hcm.integration.update',
        NOW
      )
    ).toBe(false);
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        entryContext('hcm.integration.update', { scopeReadOnly: true }),
        'hcm.integration.update',
        NOW
      )
    ).toBe(false);
    expect(
      hasWritableProductSurfaceCapability(
        pageDecision,
        entryContext('hcm.integration.update', { validUntil: '2028-01-01T00:00:00Z' }),
        'hcm.integration.update',
        NOW
      )
    ).toBe(false);
    expect(
      hasWritableProductSurfaceCapability(
        decision({ effectiveReadOnly: true }),
        entryContext('hcm.integration.update'),
        'hcm.integration.update',
        NOW
      )
    ).toBe(false);
  });
});
