import { describe, expect, it } from 'vitest';

import {
  GOVERNED_SURFACE_PAGE_ROUTES,
  GOVERNED_SURFACE_PRODUCT_IDS,
  observeProductSurfaceLocationChange,
  resolveActiveGovernedPageRoute,
  resolveActiveGovernedSurfaceId,
  resolveGovernedSurfaceOperationTarget,
} from './product-surface-authority-bridge';
import { governedProductManifest } from '../../components/product-manifest-registry';
import { PRODUCT_MENU_ROUTES } from '../../routes/product-menu-manifest';
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
  it('evaluates all 11 governed products against the complete official plus DRAFT PAGE source', () => {
    expect(GOVERNED_SURFACE_PRODUCT_IDS).toHaveLength(11);
    expect(new Set(GOVERNED_SURFACE_PRODUCT_IDS).size).toBe(11);
    expect(GOVERNED_SURFACE_PAGE_ROUTES).toHaveLength(131);
    expect(new Set(GOVERNED_SURFACE_PAGE_ROUTES.map((route) => route.routeContractKey)).size).toBe(
      131
    );
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
