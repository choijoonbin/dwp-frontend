import { describe, expect, it } from 'vitest';

import { toPilotRouteFixture } from '@dwp-frontend/shared-utils/test-utils/pilot-authorization-fixture-adapter';

import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import {
  APPROVAL_MANAGEMENT_NAVIGATION,
  APPROVAL_WORK_NAVIGATION,
} from '../features/approvals/approval-navigation';
import { resolveProductRoot } from '../features/shell/product-root-resolver';
import { resolveProductSurface } from '../features/shell/product-surface-resolver';
import {
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
} from './product-page-route-contracts';
import { approvalsRoutes } from './approvals-routes';

import type { EffectiveProductSurfaceContext } from '../features/shell/product-surface-context';
import type { ProductSurfaceNavigationGroup } from '../components/product-manifest';

function flattenSurfaceItems(groups: readonly ProductSurfaceNavigationGroup[]) {
  return groups.flatMap((group) => group.items);
}

function managementContext(): EffectiveProductSurfaceContext {
  return {
    contextKey: 'ctx-approvals-management',
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    plane: 'management',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    appResourceKey: 'APP.APPROVALS',
    effectiveGrants: [],
    scopes: [
      {
        key: 'scope-approvals',
        kind: 'RESOURCE_SET',
        displayName: 'Approvals',
        isDefault: true,
        readOnly: false,
      },
    ],
    revalidateAt: '2029-01-01T01:00:00Z',
  };
}

describe('Approvals product surface routes', () => {
  it('binds all 18 canonical Approval pilot cases', () => {
    const fixtures = Array.from({ length: 18 }, (_, index) =>
      toPilotRouteFixture({ testId: `PS-A${String(index + 1).padStart(3, '0')}` })
    );

    expect(fixtures).toHaveLength(18);
    expect(fixtures.every((fixture) => fixture.testCase.group === 'APPROVALS')).toBe(true);
    expect(fixtures.map((fixture) => fixture.testCase.expected)).toContain('SOD_CONFLICT');
  });

  it('owns exactly nine Work and six Management PAGE routes', () => {
    expect(flattenSurfaceItems(APPROVAL_WORK_NAVIGATION)).toHaveLength(9);
    expect(flattenSurfaceItems(APPROVAL_MANAGEMENT_NAVIGATION)).toHaveLength(6);
    expect(approvalsRoutes[0]?.children?.find((route) => route.path === 'admin')).toBeDefined();

    const routerKeys = approvalsRoutes
      .flatMap(function collect(route): string[] {
        const key = (route.handle as { routeContractKey?: string } | undefined)?.routeContractKey;
        return [...(key ? [key] : []), ...(route.children?.flatMap(collect) ?? [])];
      })
      .sort();
    expect(routerKeys).toEqual(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) => route.productId === 'approvals')
        .map((route) => route.routeContractKey)
        .sort()
    );
  });

  it('routes a management-only actor without requiring the Work app entitlement', () => {
    expect(
      resolveProductRoot(
        APPROVAL_PRODUCT_MANIFEST,
        {
          contexts: [managementContext()],
          activeAccessMode: 'NORMAL',
          decisionRevision: 'revision-approval-v2',
        },
        { nowMs: Date.parse('2029-01-01T00:00:00Z') }
      )
    ).toEqual(
      expect.objectContaining({
        type: 'redirect',
        surfaceId: 'approvals.admin',
        to: '/approvals/admin?scope=scope-approvals',
      })
    );
  });

  it('keeps unknown management and work URLs in their local 404 surface', () => {
    expect(
      resolveProductSurface(
        '/approvals/admin/unknown',
        [APPROVAL_PRODUCT_MANIFEST],
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toEqual({
      type: 'unknown-surface-path',
      productId: 'approvals',
      surfaceId: 'approvals.admin',
    });
    expect(
      resolveProductSurface(
        '/approvals/requests/unknown',
        [APPROVAL_PRODUCT_MANIFEST],
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG
      )
    ).toEqual({
      type: 'unknown-surface-path',
      productId: 'approvals',
      surfaceId: 'approvals.work',
    });
  });
});
