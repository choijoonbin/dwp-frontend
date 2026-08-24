import { describe, expect, it } from 'vitest';

import { toPilotRouteFixture } from '@dwp-frontend/shared-utils/test-utils/pilot-authorization-fixture-adapter';

import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import {
  SERVICES_MANAGEMENT_NAVIGATION,
  SERVICES_WORK_NAVIGATION,
} from '../features/services/services-navigation';
import { resolveProductSurface } from '../features/shell/product-surface-resolver';
import {
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
} from './product-page-route-contracts';
import { resolveFirstAllowedCanaryRoute } from './product-surface-canary-routes';
import { servicesRoutes } from './services-routes';

import type {
  AllowedSurfaceDecision,
  EffectiveProductSurfaceContext,
} from '../features/shell/product-surface-context';
import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';

const fixedClock = Date.parse(toPilotRouteFixture({ testId: 'PS-C005' }).fixedClock);

const managementContext: EffectiveProductSurfaceContext = {
  contextKey: 'ctx-services-management',
  productKey: 'services',
  surfaceKey: 'services.management',
  plane: 'management',
  accessMode: 'NORMAL',
  accessSource: 'MANAGEMENT',
  appResourceKey: 'APP.EMPLOYEE_SERVICES',
  effectiveGrants: [],
  scopes: [
    {
      key: 'scope-services',
      kind: 'RESOURCE_SET',
      displayName: 'Services',
      isDefault: true,
      readOnly: false,
    },
  ],
  revalidateAt: '2026-12-31T15:00:00Z',
};

const allowed = (routeGrantRef: string): AllowedSurfaceDecision => ({
  state: 'allowed',
  context: managementContext,
  routeGrantRef,
  scope: managementContext.scopes[0]!,
  effectiveReadOnly: false,
  revalidateAt: managementContext.revalidateAt,
  decisionRevision: 'revision-canary',
});

function authority(
  routeDecisions: ProductSurfaceCanaryAuthority['routeDecisions']
): ProductSurfaceCanaryAuthority {
  return {
    flags: {
      contextShadow: true,
      capabilityEnforcement: true,
      surfaceUi: true,
      surfaceUiEvaluation: 'resolved',
    },
    serverNowMs: fixedClock,
    envelope: {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'revision-canary',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: new Date(fixedClock).toISOString(),
      contexts: [managementContext],
    },
    routeDecisions,
  };
}

const candidates = [
  {
    routeContractKey: 'route.services.management.catalog.page',
    path: '/services/admin/catalog',
  },
  {
    routeContractKey: 'route.services.management.operations.page',
    path: '/services/admin/operations',
  },
] as const;

describe('Services product surface Canary routes', () => {
  it('uses only the canonical Services Canary fixture cases', () => {
    const cases = ['PS-C005', 'PS-C006', 'PS-C007', 'PS-C008', 'PS-C011', 'PS-C012'].map((testId) =>
      toPilotRouteFixture({ testId })
    );

    expect(cases.map((fixture) => fixture.testCase.expected)).toEqual([
      'SERVICES_WORK_4',
      'CATALOG_ONLY',
      'OPERATIONS_ONLY',
      'MANAGEMENT_2_FIRST_ALLOWED',
      'CATALOG_CREATE_BOUND_UPDATE',
      'ASSIGNED_TRANSITION_ONLY',
    ]);
    expect(cases.every((fixture) => fixture.testCase.group === 'CANARY')).toBe(true);
  });

  it('separates Work 4 and Management 2 navigation into sibling route branches', () => {
    expect(SERVICES_WORK_NAVIGATION.reduce((count, group) => count + group.items.length, 0)).toBe(
      4
    );
    expect(
      SERVICES_MANAGEMENT_NAVIGATION.reduce((count, group) => count + group.items.length, 0)
    ).toBe(2);
    expect(SERVICES_PRODUCT_MANIFEST.surfaces.map((surface) => surface.id)).toEqual([
      'services.work',
      'services.management',
    ]);
    expect(servicesRoutes[0]?.children?.find((route) => route.path === 'admin')).toBeDefined();
    const routerKeys = servicesRoutes
      .flatMap(function collect(route): string[] {
        const key = (route.handle as { routeContractKey?: string } | undefined)?.routeContractKey;
        return [...(key ? [key] : []), ...(route.children?.flatMap(collect) ?? [])];
      })
      .sort();
    expect(routerKeys).toEqual(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) => route.productId === 'services')
        .map((route) => route.routeContractKey)
        .sort()
    );
  });

  it('registers the exact dynamic PAGE 2 allowlist and keeps controls in their local 404 surface', () => {
    for (const path of ['/services/my/request-1', '/services/drafts/request-1']) {
      expect(
        resolveProductSurface(
          path,
          [SERVICES_PRODUCT_MANIFEST],
          REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
        )
      ).toEqual(expect.objectContaining({ type: 'known-route', surfaceId: 'services.work' }));
    }
    expect(
      resolveProductSurface(
        '/services/admin/foo',
        [SERVICES_PRODUCT_MANIFEST],
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toEqual({
      type: 'unknown-surface-path',
      productId: 'services',
      surfaceId: 'services.management',
    });
    for (const path of ['/services/bogus/ID', '/services/discover/ID']) {
      expect(
        resolveProductSurface(
          path,
          [SERVICES_PRODUCT_MANIFEST],
          REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
        )
      ).toEqual({
        type: 'unknown-surface-path',
        productId: 'services',
        surfaceId: 'services.work',
      });
    }
  });

  it('uses exact server route decisions for first-allowed and direct deny without MANAGE fallback', () => {
    const catalogAllowed = allowed('services.catalog.read');
    const operationsAllowed = allowed('services.operations.read');

    expect(toPilotRouteFixture({ testId: 'PS-C006' }).expectedOutcome).toBe('CATALOG_ONLY');
    expect(
      resolveFirstAllowedCanaryRoute(
        authority({
          'route.services.management.catalog.page': catalogAllowed,
          'route.services.management.operations.page': { state: 'route-denied' },
        }),
        { productId: 'services', surfaceId: 'services.management', candidates }
      )
    ).toBe('/services/admin/catalog');
    expect(toPilotRouteFixture({ testId: 'PS-C007' }).expectedOutcome).toBe('OPERATIONS_ONLY');
    expect(
      resolveFirstAllowedCanaryRoute(
        authority({
          'route.services.management.catalog.page': { state: 'route-denied' },
          'route.services.management.operations.page': operationsAllowed,
        }),
        { productId: 'services', surfaceId: 'services.management', candidates }
      )
    ).toBe('/services/admin/operations');
    expect(
      resolveFirstAllowedCanaryRoute(
        authority({
          'route.services.management.catalog.page': catalogAllowed,
          'route.services.management.operations.page': operationsAllowed,
        }),
        { productId: 'services', surfaceId: 'services.management', candidates }
      )
    ).toBe('/services/admin/catalog');
  });
});
