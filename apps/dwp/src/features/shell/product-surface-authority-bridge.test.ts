import { describe, expect, it } from 'vitest';

import {
  observeProductSurfaceLocationChange,
  resolveActiveGovernedSurfaceId,
  resolveGovernedSurfaceOperationTarget,
} from './product-surface-authority-bridge';
import { governedProductManifest } from '../../components/product-manifest-registry';
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
