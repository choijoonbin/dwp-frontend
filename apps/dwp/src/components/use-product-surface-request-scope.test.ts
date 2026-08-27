import { describe, expect, it } from 'vitest';

import { resolveProductSurfaceRequestScope } from './use-product-surface-request-scope';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

const REVISION = 'psr-current';

function decision(scopeKey = 'scope:non-default'): AllowedSurfaceDecision {
  const scope = {
    key: scopeKey,
    kind: 'RESOURCE_SET' as const,
    displayName: 'Selected scope',
    isDefault: false,
    readOnly: false,
  };
  return {
    state: 'allowed',
    context: {
      contextKey: 'communications-management',
      productKey: 'communications',
      surfaceKey: 'communications.management',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.COMMUNICATIONS',
      effectiveGrants: [],
      scopes: [scope],
      revalidateAt: '2030-01-01T00:00:00Z',
    },
    routeGrantRef: 'page-read',
    scope,
    effectiveReadOnly: false,
    revalidateAt: '2030-01-01T00:00:00Z',
    decisionRevision: REVISION,
  };
}

function snapshot(scopeKey = 'scope:non-default'): ProductSurfaceAuthoritySnapshot {
  return {
    envelope: {
      contractVersion: '3',
      decisionRevision: REVISION,
      sourceRevisions: { auth: 'auth-1' },
      activeAccessMode: 'NORMAL',
      generatedAt: '2029-01-01T00:00:00Z',
      contexts: [
        {
          contextKey: 'communications-management',
          productKey: 'communications',
          surfaceKey: 'communications.management',
          plane: 'management',
          accessMode: 'NORMAL',
          accessSource: 'MANAGEMENT',
          appResourceKey: 'APP.COMMUNICATIONS',
          effectiveGrants: [],
          scopes: [
            {
              key: scopeKey,
              kind: 'RESOURCE_SET',
              displayName: 'Selected scope',
              isDefault: false,
              readOnly: false,
              validUntil: null,
            },
          ],
          revalidateAt: '2030-01-01T00:00:00Z',
        },
      ],
      rollouts: [],
    },
    receivedAtMs: Date.parse('2029-01-01T00:00:00Z'),
    clockOffsetMs: 0,
    earliestRevalidateAtMs: Date.parse('2030-01-01T00:00:00Z'),
  };
}

const identity = {
  tenantId: 'tenant-7',
  actorId: 'actor-9',
  productKey: 'communications',
  surfaceKey: 'communications.management',
};

describe('resolveProductSurfaceRequestScope', () => {
  it('binds a non-default selected scope and every cache identity dimension', () => {
    const resolved = resolveProductSurfaceRequestScope({
      ...identity,
      decision: decision(),
      snapshot: snapshot(),
    });

    expect(resolved).toEqual({
      governed: true,
      ready: true,
      contextScopeKey: 'scope:non-default',
      cacheKey: [
        'tenant-7',
        'actor-9',
        'NORMAL',
        'communications.management',
        'scope:non-default',
        REVISION,
      ],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-7',
        actorId: 'actor-9',
        accessMode: 'NORMAL',
        productId: 'communications',
        surfaceId: 'communications.management',
        contextScopeKey: 'scope:non-default',
        decisionRevision: REVISION,
      },
    });
  });

  it('fails closed when the canonical context has a different selected scope', () => {
    const resolved = resolveProductSurfaceRequestScope({
      ...identity,
      decision: decision(),
      snapshot: snapshot('scope:other'),
    });
    expect(resolved).toMatchObject({ governed: true, ready: false });
    expect(resolved.contextScopeKey).toBeUndefined();
  });

  it('uses the direct PAGE revision in the cache when list and direct revisions differ', () => {
    const listSnapshot = snapshot();
    listSnapshot.envelope.decisionRevision = 'psr-list-with-rollout-digest';
    const resolved = resolveProductSurfaceRequestScope({
      ...identity,
      decision: decision(),
      snapshot: listSnapshot,
    });

    expect(resolved).toMatchObject({
      governed: true,
      ready: true,
      contextScopeKey: 'scope:non-default',
    });
    expect(resolved.cacheKey.at(-1)).toBe(REVISION);
  });

  it('binds a direct PAGE scope to a unique entry context with a different opaque key', () => {
    const listSnapshot = snapshot();
    listSnapshot.envelope.contexts[0]!.contextKey = 'communications-management-entry';

    const resolved = resolveProductSurfaceRequestScope({
      ...identity,
      decision: decision(),
      snapshot: listSnapshot,
    });

    expect(resolved).toMatchObject({
      governed: true,
      ready: true,
      contextScopeKey: 'scope:non-default',
    });
  });

  it('preserves the legacy fallback contract without a governed PAGE decision', () => {
    expect(
      resolveProductSurfaceRequestScope({ ...identity, decision: null, snapshot: undefined })
    ).toEqual({
      governed: false,
      ready: true,
      cacheKey: ['tenant-7', 'actor-9', 'LEGACY', 'communications.management.legacy', '', ''],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-7',
        actorId: 'actor-9',
        accessMode: 'LEGACY',
        productId: 'communications',
        surfaceId: 'communications.management',
        decisionRevision: '',
      },
    });
  });
});
