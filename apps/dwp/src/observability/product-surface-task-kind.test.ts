import { describe, expect, it } from 'vitest';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../routes/product-surface-authorization.generated';
import { resolveProductSurfaceTaskKind } from './product-surface-task-kind';

const BACKEND_TASK_ALLOWLIST = {
  'approvals.admin': ['ADMINISTRATION', 'OPERATIONS'],
  'approvals.work': ['WORK'],
  'calendar.work': ['WORK'],
  'communications.management': ['OPERATIONS'],
  'communications.work': ['WORK'],
  'dwaion.management': ['ADMINISTRATION'],
  'dwaion.work': ['WORK'],
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
  'mail.management': ['ADMINISTRATION', 'OPERATIONS'],
  'mail.work': ['WORK'],
  'meetings.work': ['WORK'],
  'messaging.work': ['WORK'],
  'notifications.work': ['WORK'],
  'services.management': ['ADMINISTRATION', 'OPERATIONS'],
  'services.work': ['WORK'],
  'spaces.work': ['WORK'],
  'workplace.work': ['WORK'],
  'workplace.management': ['OPERATIONS'],
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

    expect(
      resolveProductSurfaceTaskKind({
        productKey: 'dwaion',
        surfaceKey: 'dwaion.management',
        routeContractKey: 'route.dwaion.management.action-policy-update.action',
      })
    ).toBe('ADMINISTRATION');

    expect(
      resolveProductSurfaceTaskKind({
        productKey: 'mail',
        surfaceKey: 'mail.management',
        routeContractKey: 'route.admin.mail.connection-diagnostics.action',
      })
    ).toBe('OPERATIONS');
    expect(
      resolveProductSurfaceTaskKind({
        productKey: 'mail',
        surfaceKey: 'mail.management',
        routeContractKey: 'route.admin.mail.connection-update.action',
      })
    ).toBe('ADMINISTRATION');

    expect(
      resolveProductSurfaceTaskKind({
        productKey: 'workplace',
        surfaceKey: 'workplace.management',
        routeContractKey: 'route.workplace.management.connector-replay-preview.action',
      })
    ).toBe('OPERATIONS');

    for (const routeContractKey of [
      'route.workplace.management.service-catalog-create.action',
      'route.workplace.management.service-catalog-state.action',
      'route.workplace.management.service-catalog-update.action',
      'route.workplace.management.service-fulfillment-attachment-upload.action',
      'route.workplace.management.service-fulfillment-message.action',
      'route.workplace.management.service-fulfillment-task-update.action',
    ]) {
      expect(
        resolveProductSurfaceTaskKind({
          productKey: 'workplace',
          surfaceKey: 'workplace.management',
          routeContractKey,
        }),
        routeContractKey
      ).toBe('OPERATIONS');
    }
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
    expect(() =>
      resolveProductSurfaceTaskKind({
        productKey: 'mail',
        surfaceKey: 'mail.management',
        routeContractKey: 'route.admin.mail.unknown.action',
      })
    ).toThrow(/Unclassified/);
  });
});
