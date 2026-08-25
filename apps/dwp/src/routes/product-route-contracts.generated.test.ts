import { describe, expect, it } from 'vitest';

import {
  ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  PRODUCT_LEGACY_ROUTE_SOURCE,
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
} from './product-page-route-contracts';
import { DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './draft-product-page-route-contracts';
import {
  PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS,
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  PRODUCT_SURFACE_ROLLOUT_PRODUCTS,
} from './product-surface-authorization.generated';
import { resolveProductLegacyRoute } from './product-route-contract-source';

describe('generated product route authorization contracts', () => {
  it('closes PAGE Router source and Registry projections in both directions', () => {
    const router = [...PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE].sort((left, right) =>
      left.routeContractKey.localeCompare(right.routeContractKey)
    );
    const registry = PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS.map((route) => ({
      routeContractKey: route.routeContractKey,
      routeId: route.routeId,
      pattern: route.pattern,
      productId: route.productId,
      surfaceId: route.surfaceId,
    })).sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));

    expect(PRODUCT_AUTHORIZATION_REGISTRY_REVISION).toEqual(
      expect.objectContaining({
        version: 3,
        checksum: 'f90c4e3a734204a4619ae77d3476ebc7cc802c43ed8574fcf4f3fc85def67a8e',
      })
    );
    expect(PRODUCT_SURFACE_ROLLOUT_PRODUCTS).toEqual([
      'approvals',
      'calendar',
      'communications',
      'dwaion',
      'hcm',
      'mail',
      'messaging',
      'notifications',
      'services',
      'spaces',
      'workplace',
    ]);
    expect(router).toHaveLength(58);
    expect(registry).toEqual(router);
  });

  it('never turns DATA or ACTION registry records into browser routes', () => {
    const nonPages = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.routeKind !== 'PAGE'
    );
    const countByKind = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.reduce<Record<string, number>>(
      (counts, route) => ({ ...counts, [route.routeKind]: (counts[route.routeKind] ?? 0) + 1 }),
      {}
    );

    expect(PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS).toHaveLength(129);
    expect(countByKind).toEqual({ ACTION: 59, DATA: 12, PAGE: 58 });
    expect(nonPages).toHaveLength(71);
    expect(nonPages.every((route) => route.routeId === null && route.pattern === null)).toBe(true);
    expect(DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE).toHaveLength(73);
    expect(ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE).toHaveLength(131);
    expect(REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG).toHaveLength(131);
    expect(REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.every((route) => route.routeKind === 'PAGE')).toBe(
      true
    );
  });

  it('owns only the exact Canary dynamic PAGE 4+2 allowlist', () => {
    const dynamic = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) => route.productId === 'communications' || route.productId === 'services'
    )
      .filter((route) => route.pattern.includes(':'))
      .map((route) => route.pattern)
      .sort();

    expect(dynamic).toEqual([
      '/communications/all/:storyId',
      '/communications/for-you/:storyId',
      '/communications/required/:storyId',
      '/communications/saved/:storyId',
      '/services/drafts/:requestId',
      '/services/my/:requestId',
    ]);
  });

  it('keeps the three central aliases URL-preserving and one-hop only', () => {
    expect(PRODUCT_LEGACY_ROUTE_SOURCE).toHaveLength(3);
    expect(
      PRODUCT_LEGACY_ROUTE_SOURCE.every(
        (redirect) => redirect.maxHops === 1 && redirect.preserveQuery && redirect.preserveHash
      )
    ).toBe(true);
    expect(
      PRODUCT_LEGACY_ROUTE_SOURCE.map((redirect) =>
        resolveProductLegacyRoute(
          redirect.sourcePath,
          '?scope=scope-1',
          '#history',
          PRODUCT_LEGACY_ROUTE_SOURCE,
          PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
        )
      )
    ).toEqual([
      {
        redirectId: 'communications-management-announcements-v1',
        target: '/communications/admin/content?scope=scope-1#history',
        maxHops: 1,
      },
      {
        redirectId: 'services-management-catalog-v1',
        target: '/services/admin/catalog?scope=scope-1#history',
        maxHops: 1,
      },
      {
        redirectId: 'services-management-operations-v1',
        target: '/services/admin/operations?scope=scope-1#history',
        maxHops: 1,
      },
    ]);
  });
});
