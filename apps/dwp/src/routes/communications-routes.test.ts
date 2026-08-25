import { describe, expect, it } from 'vitest';

import { toPilotRouteFixture } from '@dwp-frontend/shared-utils/test-utils/pilot-authorization-fixture-adapter';

import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import {
  COMMUNICATIONS_MANAGEMENT_NAVIGATION,
  COMMUNICATIONS_WORK_NAVIGATION,
} from '../features/communications/communications-navigation';
import { resolveProductRoot } from '../features/shell/product-root-resolver';
import { resolveCanaryRouteDecision } from '../features/shell/product-surface-canary-runtime';
import { canContextAccessNavigation } from '../features/shell/product-surface-context';
import { resolveProductSurface } from '../features/shell/product-surface-resolver';
import {
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
} from './product-page-route-contracts';
import { communicationsRoutes } from './communications-routes';

import type {
  AllowedSurfaceDecision,
  EffectiveProductSurfaceContext,
} from '../features/shell/product-surface-context';

const fixedClock = Date.parse(toPilotRouteFixture({ testId: 'PS-C001' }).fixedClock);

function context(
  surfaceKey: 'communications.work' | 'communications.management',
  accessMode: 'NORMAL' | 'PROVIDER_SUPPORT' = 'NORMAL'
): EffectiveProductSurfaceContext {
  const management = surfaceKey === 'communications.management';
  return {
    contextKey: `ctx-${surfaceKey}-${accessMode}`,
    productKey: 'communications',
    surfaceKey,
    plane: management ? 'management' : 'work',
    accessMode,
    accessSource:
      accessMode === 'PROVIDER_SUPPORT' ? 'SUPPORT' : management ? 'MANAGEMENT' : 'ENTITLEMENT',
    appResourceKey: 'APP.COMMUNICATIONS',
    effectiveGrants:
      accessMode === 'PROVIDER_SUPPORT'
        ? [
            {
              grantKind: 'POLICY',
              accessPolicyKey: 'communications.management-entry.v1',
              policyDecisionRef: 'support-decision-communications-1',
              authorityMode: 'SUPPORT_SESSION',
              scopeKeys: [management ? 'scope-communications' : 'scope-self'],
              requiresProductEntitlement: false,
              readOnly: true,
            },
          ]
        : [],
    scopes: [
      {
        key: management ? 'scope-communications' : 'scope-self',
        kind:
          accessMode === 'PROVIDER_SUPPORT'
            ? 'SUPPORT_SESSION'
            : management
              ? 'RESOURCE_SET'
              : 'SELF',
        displayName: management ? 'Communications' : 'Self',
        isDefault: true,
        readOnly: accessMode === 'PROVIDER_SUPPORT',
      },
    ],
    revalidateAt: '2026-12-31T15:00:00Z',
  };
}

function allowed(routeContext: EffectiveProductSurfaceContext): AllowedSurfaceDecision {
  return {
    state: 'allowed',
    context: routeContext,
    routeGrantRef: 'communications.content-route-access.v1',
    scope: routeContext.scopes[0]!,
    effectiveReadOnly: routeContext.accessMode === 'PROVIDER_SUPPORT',
    revalidateAt: routeContext.revalidateAt,
    decisionRevision: 'revision-canary',
  };
}

describe('Communications product surface Canary routes', () => {
  it('uses only the canonical Communications Canary fixture cases', () => {
    const cases = ['PS-C001', 'PS-C002', 'PS-C003', 'PS-C004', 'PS-C009', 'PS-C010'].map((testId) =>
      toPilotRouteFixture({ testId })
    );

    expect(cases.map((fixture) => fixture.testCase.expected)).toEqual([
      'COMM_WORK_5',
      'COMM_MANAGEMENT_1_WORK_DENIED',
      'SUPPORT_SCOPE_READ_ONLY',
      'PRODUCT_DENIED',
      'READER_CREATE_UPDATE_NO_PUBLISH',
      'PUBLISH_ARCHIVE_ONLY',
    ]);
    expect(cases.every((fixture) => fixture.testCase.group === 'CANARY')).toBe(true);
  });

  it('separates Work 5 and Management 1 navigation under longest-match sibling surfaces', () => {
    expect(
      COMMUNICATIONS_WORK_NAVIGATION.reduce((count, group) => count + group.items.length, 0)
    ).toBe(5);
    expect(
      COMMUNICATIONS_MANAGEMENT_NAVIGATION.reduce((count, group) => count + group.items.length, 0)
    ).toBe(1);
    expect(COMMUNICATIONS_PRODUCT_MANIFEST.surfaces.map((surface) => surface.id)).toEqual([
      'communications.work',
      'communications.management',
    ]);
    expect(
      COMMUNICATIONS_PRODUCT_MANIFEST.surfaces.find(
        (surface) => surface.id === 'communications.management'
      )?.supportedScopeKinds
    ).toEqual(['RESOURCE_SET', 'SUPPORT_SESSION']);
    expect(
      communicationsRoutes[0]?.children?.find((route) => route.path === 'admin')
    ).toBeDefined();
    const routerKeys = communicationsRoutes
      .flatMap(function collect(route): string[] {
        const key = (route.handle as { routeContractKey?: string } | undefined)?.routeContractKey;
        return [...(key ? [key] : []), ...(route.children?.flatMap(collect) ?? [])];
      })
      .sort();
    expect(routerKeys).toEqual(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) => route.productId === 'communications')
        .map((route) => route.routeContractKey)
        .sort()
    );
  });

  it('projects the management item from the exact server capability grant', () => {
    const management = context('communications.management');
    management.effectiveGrants = [
      {
        grantKind: 'CAPABILITY',
        capabilityContractKey: 'communications.content.read',
        resolvedCapabilityCode: 'ADMIN.COMMUNICATIONS:VIEW',
        authorityMode: 'PERMISSION',
        predicatePolicyKeys: [],
        responsibilityRequirement: 'REQUIRED',
        responsibility: {
          code: 'APP_CONFIG_ADMIN',
          resourceSetKey: 'RS_COMMUNICATIONS',
        },
        scopeKeys: ['scope-communications'],
        requiresProductEntitlement: false,
        readOnly: false,
        activationState: 'ACTIVE',
      },
    ];
    const item = COMMUNICATIONS_MANAGEMENT_NAVIGATION[0].items[0];

    expect(item.access).toEqual({
      type: 'capability',
      capabilityContractKey: 'communications.content.read',
    });
    expect(
      canContextAccessNavigation(item.access, management, 'scope-communications', fixedClock)
    ).toBe(true);
  });

  it('registers the exact dynamic PAGE 4 allowlist and keeps controls in their local 404 surface', () => {
    for (const path of [
      '/communications/for-you/story-1',
      '/communications/all/story-1',
      '/communications/required/story-1',
      '/communications/saved/story-1',
    ]) {
      expect(
        resolveProductSurface(
          path,
          [COMMUNICATIONS_PRODUCT_MANIFEST],
          REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
        )
      ).toEqual(expect.objectContaining({ type: 'known-route', surfaceId: 'communications.work' }));
    }
    expect(
      resolveProductSurface(
        '/communications/admin/foo',
        [COMMUNICATIONS_PRODUCT_MANIFEST],
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toEqual({
      type: 'unknown-surface-path',
      productId: 'communications',
      surfaceId: 'communications.management',
    });
    for (const path of ['/communications/bogus/ID', '/communications/home/ID']) {
      expect(
        resolveProductSurface(
          path,
          [COMMUNICATIONS_PRODUCT_MANIFEST],
          REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
        )
      ).toEqual({
        type: 'unknown-surface-path',
        productId: 'communications',
        surfaceId: 'communications.work',
      });
    }
  });

  it('routes a management-only persona to Management without requiring Work entitlement', () => {
    const management = context('communications.management');
    const fixture = toPilotRouteFixture({ testId: 'PS-C002' });

    expect(fixture.expectedOutcome).toBe('COMM_MANAGEMENT_1_WORK_DENIED');
    expect(
      resolveProductRoot(
        COMMUNICATIONS_PRODUCT_MANIFEST,
        {
          contexts: [management],
          activeAccessMode: 'NORMAL',
          decisionRevision: 'revision-canary',
        },
        { nowMs: fixedClock }
      )
    ).toEqual(
      expect.objectContaining({
        type: 'redirect',
        surfaceId: 'communications.management',
        to: '/communications/admin/content?scope=scope-communications',
      })
    );
  });

  it('keeps Support exclusive and fails closed when NORMAL context is mixed into the session', () => {
    const support = context('communications.management', 'PROVIDER_SUPPORT');
    const routeDecision = allowed(support);
    const routeContractKey = 'route.communications.management.content.page';
    const expected = {
      productId: 'communications',
      surfaceId: 'communications.management',
      routeContractKey,
    };
    const authority = {
      flags: {
        contextShadow: true,
        capabilityEnforcement: true,
        surfaceUi: true,
        surfaceUiEvaluation: 'resolved' as const,
      },
      serverNowMs: fixedClock,
      envelope: {
        contractVersion: 'product-surfaces/v3',
        decisionRevision: 'revision-canary',
        sourceRevisions: {},
        activeAccessMode: 'PROVIDER_SUPPORT' as const,
        generatedAt: new Date(fixedClock).toISOString(),
        contexts: [support],
      },
      routeDecisions: { [routeContractKey]: routeDecision },
    };

    expect(toPilotRouteFixture({ testId: 'PS-C003' }).activeAccessMode).toBe('PROVIDER_SUPPORT');
    expect(resolveCanaryRouteDecision(authority, expected)).toEqual(routeDecision);
    expect(
      resolveCanaryRouteDecision(
        {
          ...authority,
          envelope: { ...authority.envelope, contexts: [support, context('communications.work')] },
        },
        expected
      )
    ).toEqual({ state: 'authority-unavailable' });
  });
});
