import { describe, expect, it } from 'vitest';

import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';

import {
  ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  PRODUCT_LEGACY_ROUTE_SOURCE,
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
} from './product-page-route-contracts';
import { DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './draft-product-page-route-contracts';
import { buildProductPageRouteContractSource } from './draft-product-page-route-contract-source';
import {
  PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS,
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  PRODUCT_SURFACE_ROLLOUT_PRODUCTS,
} from './product-surface-authorization.generated';
import { resolveProductLegacyRoute } from './product-route-contract-source';

const MAIL_ORGANIZATION_PAGE_ROUTE_KEYS = [
  'route.mail.work.archive.page',
  'route.mail.work.spam.page',
  'route.mail.work.trash.page',
  'route.mail.work.folders.page',
  'route.mail.work.organization.page',
] as const;

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
        version: 4,
        checksum: 'a9cd08260fd9a11dd7c612f2db6f03bb312f1e7843a2eb10b4082660da151137',
      })
    );
    expect(PRODUCT_SURFACE_ROLLOUT_PRODUCTS).toEqual([
      'approvals',
      'calendar',
      'communications',
      'dwaion',
      'hcm',
      'mail',
      'meetings',
      'messaging',
      'notifications',
      'services',
      'spaces',
      'workplace',
    ]);
    expect(router).toHaveLength(66);
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

    expect(PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS).toHaveLength(155);
    expect(countByKind).toEqual({ ACTION: 67, DATA: 22, PAGE: 66 });
    expect(nonPages).toHaveLength(89);
    expect(nonPages.every((route) => route.routeId === null && route.pattern === null)).toBe(true);
    expect(DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE).toHaveLength(84);
    expect(ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE).toHaveLength(150);
    expect(REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG).toHaveLength(150);
    expect(REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.every((route) => route.routeKind === 'PAGE')).toBe(
      true
    );
    expect(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
        (route) => route.routeContractKey === 'route.dwaion.work.activity.page'
      )
    ).toBe(false);
    expect(
      DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
        (route) => route.routeContractKey === 'route.dwaion.work.activity.page'
      )
    ).toEqual([
      {
        routeId: 'dwaion.work.activity',
        pattern: '/dwaion/activity',
        productId: 'dwaion',
        surfaceId: 'dwaion.work',
        routeContractKey: 'route.dwaion.work.activity.page',
      },
    ]);
  });

  it('mounts a representative official PAGE without hiding the remaining product routes', () => {
    const messagingRoutes = buildProductPageRouteContractSource(
      [MESSAGING_PRODUCT_MANIFEST],
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
    );

    expect(
      messagingRoutes.filter((route) => route.routeContractKey === 'route.messaging.work.home.page')
    ).toEqual([
      {
        routeContractKey: 'route.messaging.work.home.page',
        routeId: 'messaging.work.home',
        pattern: '/messages/home',
        productId: 'messaging',
        surfaceId: 'messaging.work',
      },
    ]);
    expect(messagingRoutes.some((route) => route.pattern === '/messages/inbox')).toBe(true);
    expect(messagingRoutes.some((route) => route.pattern === '/messages/admin/overview')).toBe(
      true
    );
  });

  it('keeps the five Mail organization routes as frontend-owned PAGE records only', () => {
    const mailRouteKeys = new Set<string>(MAIL_ORGANIZATION_PAGE_ROUTE_KEYS);
    const draftRoutes = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) =>
      mailRouteKeys.has(route.routeContractKey)
    );
    const registeredRoutes = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter((route) =>
      mailRouteKeys.has(route.routeContractKey)
    );

    expect(draftRoutes.map((route) => route.routeContractKey).sort()).toEqual(
      [...MAIL_ORGANIZATION_PAGE_ROUTE_KEYS].sort()
    );
    expect(registeredRoutes.map((route) => route.routeContractKey).sort()).toEqual(
      [...MAIL_ORGANIZATION_PAGE_ROUTE_KEYS].sort()
    );
    expect(registeredRoutes.every((route) => route.routeKind === 'PAGE')).toBe(true);
    expect(
      PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter((route) =>
        mailRouteKeys.has(route.routeContractKey)
      )
    ).toEqual([]);
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

  it('keeps all 14 central aliases registry-owned, URL-preserving, and one-hop only', () => {
    expect(PRODUCT_LEGACY_ROUTE_SOURCE).toHaveLength(14);
    expect(
      PRODUCT_LEGACY_ROUTE_SOURCE.every(
        (redirect) => redirect.maxHops === 1 && redirect.preserveQuery && redirect.preserveHash
      )
    ).toBe(true);
    for (const redirect of PRODUCT_LEGACY_ROUTE_SOURCE) {
      const target = ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.find(
        (route) => route.routeContractKey === redirect.targetRouteContractKey
      );
      expect(target, redirect.redirectId).toBeDefined();
      const draftTarget = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
        (route) => route.routeContractKey === redirect.targetRouteContractKey
      );
      expect(redirect.targetLifecycle === 'DRAFT', redirect.redirectId).toBe(draftTarget);
      expect(redirect.targetPath, redirect.redirectId).toBe(
        draftTarget ? target!.pattern : undefined
      );
      expect(
        resolveProductLegacyRoute(
          redirect.sourcePath,
          '?scope=scope-1',
          '#history',
          PRODUCT_LEGACY_ROUTE_SOURCE,
          ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
        ),
        redirect.redirectId
      ).toEqual({
        redirectId: redirect.redirectId,
        target: `${target!.pattern}?scope=scope-1#history`,
        maxHops: 1,
      });
    }
  });
});
