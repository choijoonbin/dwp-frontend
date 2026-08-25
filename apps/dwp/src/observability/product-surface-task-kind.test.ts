import { describe, expect, it } from 'vitest';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../routes/product-surface-authorization.generated';
import { resolveProductSurfaceTaskKind } from './product-surface-task-kind';

const BACKEND_TASK_ALLOWLIST = {
  'approvals.admin': ['ADMINISTRATION', 'OPERATIONS'],
  'approvals.work': ['WORK'],
  'communications.management': ['OPERATIONS'],
  'communications.work': ['WORK'],
  'hcm.management': [
    'ADMINISTRATION',
    'CONFIGURATION',
    'DESIGN',
    'INTEGRATION',
    'OPERATIONS',
    'REPORTING',
  ],
  'hcm.operations': ['OPERATIONS'],
  'hcm.personal': ['WORK'],
  'hcm.team': ['REVIEW', 'WORK'],
  'services.management': ['ADMINISTRATION', 'OPERATIONS'],
  'services.work': ['WORK'],
} as const;

describe('governed mutation telemetry task classification', () => {
  it('classifies every generated PRODUCT ACTION inside the closed backend dimensions', () => {
    const actions = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.routeKind === 'ACTION' && route.subjectType === 'PRODUCT'
    );

    expect(actions.length).toBeGreaterThan(0);
    for (const route of actions) {
      const taskKind = resolveProductSurfaceTaskKind({
        productKey: route.productId,
        surfaceKey: route.surfaceId,
        routeContractKey: route.routeContractKey,
      });
      expect(
        BACKEND_TASK_ALLOWLIST[route.surfaceId as keyof typeof BACKEND_TASK_ALLOWLIST],
        route.routeContractKey
      ).toContain(taskKind);
    }
  });

  it('keeps semantically distinct management tasks explicit', () => {
    const task = (routeContractKey: string) =>
      resolveProductSurfaceTaskKind({
        productKey: 'hcm',
        surfaceKey: 'hcm.management',
        routeContractKey,
      });

    expect(task('route.hcm.management.org-publish.action')).toBe('DESIGN');
    expect(task('route.hcm.management.integration-execute.action')).toBe('INTEGRATION');
    expect(task('route.hcm.management.controlled-export-create.action')).toBe('REPORTING');
    expect(task('route.hcm.management.reference-update.action')).toBe('CONFIGURATION');
  });

  it('fails closed for a new, mismatched, or unclassified ACTION', () => {
    expect(() =>
      resolveProductSurfaceTaskKind({
        productKey: 'hcm',
        surfaceKey: 'hcm.management',
        routeContractKey: 'route.hcm.management.unknown.action',
      })
    ).toThrow(/Unclassified/);
    expect(() =>
      resolveProductSurfaceTaskKind({
        productKey: 'hcm',
        surfaceKey: 'hcm.personal',
        routeContractKey: 'route.services.work.request-create.action',
      })
    ).toThrow(/Invalid/);
  });
});
