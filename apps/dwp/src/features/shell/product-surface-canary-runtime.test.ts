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

const context: EffectiveProductSurfaceContext = {
  contextKey: 'ctx-communications-support',
  productKey: 'communications',
  surfaceKey: 'communications.management',
  plane: 'management',
  accessMode: 'PROVIDER_SUPPORT',
  accessSource: 'SUPPORT',
  appResourceKey: 'APP.COMMUNICATIONS',
  effectiveGrants: [],
  scopes: [
    {
      key: 'scope-config',
      kind: 'RESOURCE_SET',
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
