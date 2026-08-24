import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import { isAppResourceEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';

import {
  resolveProductCanaryBoundaryStrategy,
  isProductCanaryBoundaryPending,
  preserveProductRouteLocation,
  type ProductCanaryBoundaryStrategy,
} from './product-surface-canary-routes';

import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';

function strategy(
  contextShadow: boolean,
  capabilityEnforcement: boolean,
  surfaceUi: boolean
): ProductCanaryBoundaryStrategy {
  const authority: ProductSurfaceCanaryAuthority = {
    flags: {
      contextShadow,
      capabilityEnforcement,
      surfaceUi,
      surfaceUiEvaluation: 'resolved',
    },
  };
  return resolveProductCanaryBoundaryStrategy(authority);
}

describe('Canary authorization boundary', () => {
  it('preserves opaque scope/query/hash through an index PAGE redirect', () => {
    expect(
      preserveProductRouteLocation('/approvals/admin/overview', {
        search: '?scope=S2&view=exceptions',
        hash: '#queue',
      })
    ).toBe('/approvals/admin/overview?scope=S2&view=exceptions#queue');
  });
  it('shows a neutral pending state until direct evaluation settles', () => {
    const authority: ProductSurfaceCanaryAuthority = {
      flags: {
        contextShadow: true,
        capabilityEnforcement: true,
        surfaceUi: true,
        surfaceUiEvaluation: 'resolved',
      },
      pendingSurfaces: { 'communications.work': true },
      pendingRoutes: { 'route.communications.work.home.page': true },
    };
    expect(isProductCanaryBoundaryPending(authority, { surfaceId: 'communications.work' })).toBe(
      true
    );
    expect(
      isProductCanaryBoundaryPending(authority, {
        surfaceId: 'communications.work',
        routeContractKey: 'route.communications.work.home.page',
      })
    ).toBe(true);
  });

  it('keeps the neutral fallback while the authority envelope itself is loading', () => {
    const authority: ProductSurfaceCanaryAuthority = {
      flags: {
        contextShadow: false,
        capabilityEnforcement: true,
        surfaceUi: false,
        surfaceUiEvaluation: 'unavailable',
      },
      authorityPending: true,
    };
    expect(isProductCanaryBoundaryPending(authority, { surfaceId: 'communications.work' })).toBe(
      true
    );
  });

  it('uses compatibility only before enforcement and server decisions throughout the Pilot boundary', () => {
    expect(strategy(false, false, false)).toBe('legacy');
    expect(strategy(true, false, false)).toBe('legacy');
    expect(strategy(true, true, false)).toBe('server');
    expect(strategy(true, true, true)).toBe('server');
    expect(strategy(false, true, false)).toBe('fail-closed');
  });

  it('does not invoke empty entitlement fail-open or global MANAGE fallback in the enforced boundary', () => {
    expect(isAppResourceEntitled('APP.CANARY', [])).toBe(true);
    expect(strategy(true, true, false)).toBe('server');

    const source = fs.readFileSync(
      new URL('./product-surface-canary-routes.tsx', import.meta.url),
      'utf8'
    );
    expect(source).not.toContain('isAppResourceEntitled');
    expect(source).not.toContain("'MANAGE'");
    expect(source).not.toContain('hasPermission(');
    expect(source).not.toContain('AppRouteGuard');
    expect(source).not.toContain('ProductRouteGuard');
  });
});
