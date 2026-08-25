import { describe, expect, it } from 'vitest';

import {
  GOVERNED_SURFACE_PAGE_ROUTES,
  GOVERNED_SURFACE_PRODUCT_IDS,
  observeProductSurfaceLocationChange,
  resolveActiveGovernedProductId,
  resolveActiveGovernedPageRoute,
  resolveActiveGovernedSurfaceId,
  resolveGovernedPageEvaluationRoutes,
  resolveGovernedSurfaceOperationTarget,
  resolveProductSurfaceEvaluationScopeKey,
} from './product-surface-authority-bridge';
import { governedProductManifest } from '../../components/product-manifest-registry';
import { PRODUCT_MENU_ROUTES } from '../../routes/product-menu-manifest';
import { PRODUCT_LEGACY_ROUTE_SOURCE } from '../../routes/product-page-route-contracts';
import {
  ProductSurfaceOperationCancelledError,
  productSurfaceOperationCoordinator,
} from '../../components/product-surface-operation-coordinator';

const routes = [
  { pattern: '/sample/work', surfaceId: 'sample.work' },
  { pattern: '/sample/work/:itemId', surfaceId: 'sample.work' },
  { pattern: '/sample/admin', surfaceId: 'sample.management' },
] as const;

describe('product surface authority bridge routing', () => {
  it('registers all 11 governed products against the complete official plus DRAFT PAGE source', () => {
    expect(GOVERNED_SURFACE_PRODUCT_IDS).toHaveLength(11);
    expect(new Set(GOVERNED_SURFACE_PRODUCT_IDS).size).toBe(11);
    expect(GOVERNED_SURFACE_PAGE_ROUTES).toHaveLength(131);
    expect(new Set(GOVERNED_SURFACE_PAGE_ROUTES.map((route) => route.routeContractKey)).size).toBe(
      131
    );
    expect(
      Math.max(
        ...GOVERNED_SURFACE_PRODUCT_IDS.map(
          (productId) =>
            GOVERNED_SURFACE_PAGE_ROUTES.filter((route) => route.productId === productId).length
        )
      )
    ).toBe(25);
  });

  it('evaluates PAGE authority only for the product that owns the current location', () => {
    const approvals = resolveGovernedPageEvaluationRoutes(
      '/approvals/home',
      GOVERNED_SURFACE_PAGE_ROUTES
    );
    expect(approvals).not.toHaveLength(0);
    expect(new Set(approvals.map((route) => route.productId))).toEqual(new Set(['approvals']));
    expect(approvals.length).toBeLessThan(GOVERNED_SURFACE_PAGE_ROUTES.length);
    expect(resolveActiveGovernedProductId('/approvals/%68ome')).toBe('approvals');
  });

  it('uses a product base index for bounded evaluation but sends no PAGE requests from global pages', () => {
    const spaces = governedProductManifest('spaces');
    expect(spaces).toBeDefined();
    if (!spaces) throw new Error('Spaces manifest is required by this routing contract.');

    const atProductRoot = resolveGovernedPageEvaluationRoutes(
      '/spaces',
      GOVERNED_SURFACE_PAGE_ROUTES,
      [spaces]
    );
    expect(atProductRoot.length).toBeGreaterThan(0);
    expect(atProductRoot.every((route) => route.productId === 'spaces')).toBe(true);
    expect(resolveGovernedPageEvaluationRoutes('/apps', GOVERNED_SURFACE_PAGE_ROUTES)).toEqual([]);
    expect(resolveGovernedPageEvaluationRoutes('/', GOVERNED_SURFACE_PAGE_ROUTES)).toEqual([]);
  });

  it('plans mixed-case product roots and Surface indexes with Router-equivalent ownership', () => {
    const approvals = governedProductManifest('approvals');
    const spaces = governedProductManifest('spaces');
    expect(approvals).toBeDefined();
    expect(spaces).toBeDefined();
    if (!approvals || !spaces) {
      throw new Error('Approvals and Spaces manifests are required by this routing contract.');
    }

    const mixedCaseRoot = resolveGovernedPageEvaluationRoutes(
      '/APPROVALS',
      GOVERNED_SURFACE_PAGE_ROUTES,
      [approvals]
    );
    expect(mixedCaseRoot.length).toBeGreaterThan(0);
    expect(mixedCaseRoot.every((route) => route.productId === 'approvals')).toBe(true);
    expect(
      resolveActiveGovernedSurfaceId('/APPROVALS/ADMIN', GOVERNED_SURFACE_PAGE_ROUTES, [approvals])
    ).toBe('approvals.admin');
    expect(
      resolveActiveGovernedSurfaceId('/SPACES/ADMIN', GOVERNED_SURFACE_PAGE_ROUTES, [spaces])
    ).toBe('spaces.management');
  });

  it('keeps every registered legacy Deep Link inside its target product authority plan', () => {
    expect(PRODUCT_LEGACY_ROUTE_SOURCE).toHaveLength(3);
    for (const redirect of PRODUCT_LEGACY_ROUTE_SOURCE) {
      const target = GOVERNED_SURFACE_PAGE_ROUTES.find(
        (route) => route.routeContractKey === redirect.targetRouteContractKey
      );
      expect(target, redirect.redirectId).toBeDefined();
      const activeSurfaceId = resolveActiveGovernedSurfaceId(
        `${redirect.sourcePath.toUpperCase()}?scope=opaque-scope`,
        GOVERNED_SURFACE_PAGE_ROUTES
      );
      expect(activeSurfaceId, redirect.redirectId).toBe(target!.surfaceId);
      const planned = resolveGovernedPageEvaluationRoutes(
        redirect.sourcePath.toUpperCase(),
        GOVERNED_SURFACE_PAGE_ROUTES
      );
      expect(planned.length, redirect.redirectId).toBeGreaterThan(0);
      expect(new Set(planned.map((route) => route.productId)), redirect.redirectId).toEqual(
        new Set([target!.productId])
      );
      expect(
        resolveProductSurfaceEvaluationScopeKey(target!.surfaceId, activeSurfaceId, 'opaque-scope'),
        redirect.redirectId
      ).toBe('opaque-scope');
      const siblingSurface = planned.find((route) => route.surfaceId !== activeSurfaceId);
      if (siblingSurface) {
        expect(
          resolveProductSurfaceEvaluationScopeKey(
            siblingSurface.surfaceId,
            activeSurfaceId,
            'opaque-scope'
          ),
          redirect.redirectId
        ).toBeUndefined();
      }
    }
  });

  it('resolves every static Work menu through the same PAGE source used by last-route storage', () => {
    const workRoutes = PRODUCT_MENU_ROUTES.filter(
      (route) => route.productSurfaceId && route.plane === 'work'
    );
    expect(workRoutes).toHaveLength(64);
    for (const menu of workRoutes) {
      const route = resolveActiveGovernedPageRoute(menu.path);
      expect(route?.surfaceId, menu.id).toBe(menu.productSurfaceId);
      expect(route?.routeId, menu.id).toBeTruthy();
      expect(route?.pattern, menu.id).not.toContain(':');
    }
  });

  it('resolves one exact active surface so its sibling PAGE evaluations share the selected scope', () => {
    const active = resolveActiveGovernedSurfaceId('/sample/work/item-7', routes);
    const requestedScope = 'opaque-scope';
    expect(active).toBe('sample.work');
    expect(
      routes.map((route) => (route.surfaceId === active ? requestedScope : undefined))
    ).toEqual(['opaque-scope', 'opaque-scope', undefined]);
  });

  it('does not guess an active surface for an unknown path', () => {
    expect(resolveActiveGovernedSurfaceId('/sample/unknown', routes)).toBeUndefined();
  });

  it('prefers a static management PAGE over a colliding Work detail parameter', () => {
    const overlapping = [
      { pattern: '/spaces/:spaceKey/:tab', surfaceId: 'spaces.work' },
      { pattern: '/spaces/admin/overview', surfaceId: 'spaces.management' },
    ] as const;
    expect(resolveActiveGovernedSurfaceId('/spaces/admin/overview', overlapping)).toBe(
      'spaces.management'
    );
    expect(resolveActiveGovernedPageRoute('/spaces/admin/overview', overlapping)?.surfaceId).toBe(
      'spaces.management'
    );
  });

  it('reserves the admin segment before a management Surface index redirects', () => {
    const spaces = governedProductManifest('spaces');
    expect(spaces).toBeDefined();
    if (!spaces) throw new Error('Spaces manifest is required by this routing contract.');
    const overlapping = [
      { pattern: '/spaces/:spaceKey', surfaceId: 'spaces.work' },
      { pattern: '/spaces/admin/overview', surfaceId: 'spaces.management' },
    ] as const;
    expect(resolveActiveGovernedPageRoute('/spaces/admin', overlapping)).toBeUndefined();
    expect(resolveActiveGovernedSurfaceId('/spaces/admin', overlapping, [spaces])).toBe(
      'spaces.management'
    );
    expect(resolveActiveGovernedSurfaceId('/spaces/%61dmin', overlapping, [spaces])).toBe(
      'spaces.management'
    );
    expect(resolveActiveGovernedSurfaceId('/spaces/engineering', overlapping, [spaces])).toBe(
      'spaces.work'
    );
  });

  it('resolves a manifest-owned Surface index before its PAGE redirect runs', () => {
    const approvals = governedProductManifest('approvals');
    expect(approvals).toBeDefined();
    if (!approvals) throw new Error('Approvals manifest is required by this routing contract.');
    expect(resolveActiveGovernedSurfaceId('/approvals/admin', [], [approvals])).toBe(
      'approvals.admin'
    );
    expect(resolveActiveGovernedSurfaceId('/approvals', [], [approvals])).toBeUndefined();
  });

  it('resolves exactly one product owner for the active governed Surface', () => {
    expect(
      resolveGovernedSurfaceOperationTarget('sample.work', [
        { productId: 'sample', surfaceId: 'sample.work' },
        { productId: 'sample', surfaceId: 'sample.work' },
      ])
    ).toEqual({ productKey: 'sample', surfaceKey: 'sample.work' });
    expect(
      resolveGovernedSurfaceOperationTarget('shared.surface', [
        { productId: 'first', surfaceId: 'shared.surface' },
        { productId: 'second', surfaceId: 'shared.surface' },
      ])
    ).toBeUndefined();
  });

  it('invalidates PRE_FLIGHT work from the previous Surface even when pending authority unmounts it', () => {
    const target = { productKey: 'approvals', surfaceKey: 'approvals.admin' } as const;
    const operation = productSurfaceOperationCoordinator.beginOperation(target);

    observeProductSurfaceLocationChange(
      { locationKey: 'scope-a-entry', target },
      { locationKey: 'scope-b-entry', target },
      'scope-b'
    );

    expect(operation.signal.aborted).toBe(true);
    expect(() => operation.assertCurrent()).toThrow(ProductSurfaceOperationCancelledError);
  });

  it('does not misclassify the controlled expected-scope URL push as stale navigation', () => {
    const target = { productKey: 'approvals', surfaceKey: 'approvals.admin' } as const;
    const transition = productSurfaceOperationCoordinator.beginScopeTransition(target, 'scope-b');
    expect(transition.state).toBe('READY');
    if (transition.state !== 'READY') return;

    observeProductSurfaceLocationChange(
      { locationKey: 'scope-a-entry', target },
      { locationKey: 'scope-b-entry', target },
      'scope-b'
    );

    expect(transition.signal.aborted).toBe(false);
    expect(() => transition.assertCurrent()).not.toThrow();
    transition.finish(false);
  });
});
