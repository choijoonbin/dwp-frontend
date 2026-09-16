import { describe, expect, it } from 'vitest';

import {
  hasContextualProductSurfaceCapability,
  resolveContextualProductSurfaceScopeKey,
} from './use-contextual-product-action-mutation';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

const NOW = Date.parse('2029-01-01T00:00:00Z');
const binding = { productKey: 'services', surfaceKey: 'services.work' };

function scope(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    kind: 'SELF' as const,
    displayName: key,
    isDefault: false,
    readOnly: false,
    ...overrides,
  };
}

function grant(scopeKey = 'services-self', overrides: Record<string, unknown> = {}) {
  return {
    grantKind: 'CAPABILITY' as const,
    capabilityContractKey: 'services.request.respond',
    resolvedCapabilityCode: 'APP.EMPLOYEE_SERVICES:UPDATE',
    authorityMode: 'PERMISSION_AND_RELATIONSHIP' as const,
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED' as const,
    responsibility: null,
    scopeKeys: [scopeKey],
    requiresProductEntitlement: true,
    readOnly: false,
    activationState: 'ACTIVE' as const,
    validUntil: null,
    ...overrides,
  };
}

function snapshot(
  scopes = [scope('services-self', { isDefault: true })],
  grants = [grant()]
): ProductSurfaceAuthoritySnapshot {
  return {
    envelope: {
      contractVersion: '3',
      decisionRevision: 'revision-1',
      sourceRevisions: { auth: 'auth-1' },
      activeAccessMode: 'NORMAL',
      generatedAt: '2029-01-01T00:00:00Z',
      contexts: [
        {
          contextKey: 'services-work',
          productKey: 'services',
          surfaceKey: 'services.work',
          plane: 'work',
          accessMode: 'NORMAL',
          accessSource: 'ENTITLEMENT',
          appResourceKey: 'APP.EMPLOYEE_SERVICES',
          effectiveGrants: grants,
          scopes,
          revalidateAt: '2030-01-01T00:00:00Z',
        },
      ],
      rollouts: [],
    },
    receivedAtMs: NOW,
    clockOffsetMs: 0,
    earliestRevalidateAtMs: Date.parse('2030-01-01T00:00:00Z'),
  };
}

function workDecision(): AllowedSurfaceDecision {
  const selected = scope('work-self', { displayName: 'Work self' });
  return {
    state: 'allowed',
    context: {
      contextKey: 'work',
      productKey: 'work',
      surfaceKey: 'work.work',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'ENTITLEMENT',
      appResourceKey: 'APP.WORK',
      effectiveGrants: [],
      scopes: [selected],
      revalidateAt: '2030-01-01T00:00:00Z',
    },
    routeGrantRef: 'work-page',
    scope: selected,
    effectiveReadOnly: false,
    revalidateAt: '2030-01-01T00:00:00Z',
    decisionRevision: 'revision-1',
  };
}

describe('contextual product action authority', () => {
  it('ignores the host Work scope and selects the Services SELF scope', () => {
    expect(
      resolveContextualProductSurfaceScopeKey(snapshot(), binding, workDecision(), 'SELF', NOW)
    ).toBe('services-self');
  });

  it('selects one default SELF scope and rejects ambiguous or foreign scopes', () => {
    expect(
      resolveContextualProductSurfaceScopeKey(
        snapshot([
          scope('first'),
          scope('second', { isDefault: true }),
          scope('resource', { kind: 'RESOURCE_SET', isDefault: true }),
        ]),
        binding,
        null,
        'SELF',
        NOW
      )
    ).toBe('second');
    expect(
      resolveContextualProductSurfaceScopeKey(
        snapshot([scope('first'), scope('second')]),
        binding,
        null,
        'SELF',
        NOW
      )
    ).toBeUndefined();
    expect(
      resolveContextualProductSurfaceScopeKey(
        snapshot([scope('readonly', { readOnly: true, isDefault: true })]),
        binding,
        null,
        'SELF',
        NOW
      )
    ).toBeUndefined();
  });

  it('requires one fresh ACTIVE capability for the selected scope', () => {
    const current = snapshot();
    expect(
      hasContextualProductSurfaceCapability(
        current,
        binding,
        'services-self',
        'services.request.respond',
        NOW
      )
    ).toBe(true);
    expect(
      hasContextualProductSurfaceCapability(
        snapshot(undefined, [grant('services-self', { activationState: 'ELIGIBLE' })]),
        binding,
        'services-self',
        'services.request.respond',
        NOW
      )
    ).toBe(false);
    expect(
      hasContextualProductSurfaceCapability(
        snapshot(undefined, [grant(), grant()]),
        binding,
        'services-self',
        'services.request.respond',
        NOW
      )
    ).toBe(false);
  });
});
