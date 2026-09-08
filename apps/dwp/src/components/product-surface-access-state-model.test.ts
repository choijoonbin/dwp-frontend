import { describe, expect, it } from 'vitest';

import { getProductSurfaceAccessPresentation } from './product-surface-access-state-model';

import type { SurfaceDeniedState } from '../features/shell/product-surface-context';

const states: readonly SurfaceDeniedState[] = [
  'app-denied',
  'surface-denied',
  'route-denied',
  'scope-selection-required',
  'scope-invalid',
  'expired',
  'activation-required',
  'step-up-required',
  'sod-conflict',
  'support-scope-denied',
  'authority-unavailable',
];

describe('product surface access presentation', () => {
  it('provides a stable presentation and safe action for every denied state', () => {
    for (const state of states) {
      const presentation = getProductSurfaceAccessPresentation(state);
      expect(presentation.titleKey).toMatch(/^productSurface\.access\./u);
      expect(presentation.descriptionKey).toMatch(/^productSurface\.access\./u);
      expect(presentation.primaryAction).toBeDefined();
    }
  });

  it('uses retry only for recoverable authority and assurance states', () => {
    expect(getProductSurfaceAccessPresentation('authority-unavailable').primaryAction).toBe(
      'retry'
    );
    expect(getProductSurfaceAccessPresentation('step-up-required').primaryAction).toBe('retry');
    expect(getProductSurfaceAccessPresentation('route-denied').primaryAction).toBe(
      'request-responsibility'
    );
    expect(getProductSurfaceAccessPresentation('activation-required').primaryAction).toBe(
      'activate-access'
    );
  });

  it('uses plane-specific surface denial copy and keeps an unknown plane neutral', () => {
    expect(getProductSurfaceAccessPresentation('surface-denied', 'work')).toMatchObject({
      titleKey: 'productSurface.access.surfaceDenied.work.title',
      primaryAction: 'return',
    });
    expect(getProductSurfaceAccessPresentation('surface-denied', 'management')).toMatchObject({
      titleKey: 'productSurface.access.surfaceDenied.management.title',
      primaryAction: 'request-responsibility',
      secondaryAction: 'return',
    });
    expect(getProductSurfaceAccessPresentation('surface-denied')).toMatchObject({
      titleKey: 'productSurface.access.surfaceDenied.title',
      primaryAction: 'return',
    });
  });
});
