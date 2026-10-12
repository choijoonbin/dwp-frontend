import type { ProductSurfaceTaskKind } from '@dwp-frontend/shared-utils/api/observability-api';

import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../routes/product-surface-authorization.generated';

export type ProductSurfaceTaskBinding = Readonly<{
  productKey: string;
  surfaceKey: string;
  routeContractKey: string;
}>;

const MAIL_OPERATION_ACTION_SUFFIXES = new Set([
  'connection-diagnostics',
  'connection-sync',
  'connection-test-send',
  'delivery-export-approve',
  'delivery-export-create',
  'delivery.cancel',
  'delivery.reconcile',
  'delivery.retry',
]);

function isRegisteredProductAction(binding: ProductSurfaceTaskBinding): boolean {
  return PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.some(
    (route) =>
      route.routeKind === 'ACTION' &&
      route.subjectType === 'PRODUCT' &&
      route.productId === binding.productKey &&
      route.surfaceId === binding.surfaceKey &&
      route.routeContractKey === binding.routeContractKey
  );
}

/**
 * Closed telemetry classification for governed mutations. Authority registries stay the source of
 * truth for access; this projection only selects a privacy-safe KPI dimension and fails closed when
 * a new ACTION has not been deliberately classified.
 */
export function resolveProductSurfaceTaskKind(
  binding: ProductSurfaceTaskBinding
): ProductSurfaceTaskKind {
  const { productKey, surfaceKey, routeContractKey } = binding;
  const productRoutePrefix = `route.${productKey}.`;
  const adminProductRoutePrefix = `route.admin.${productKey}.`;
  if (
    (!routeContractKey.startsWith(productRoutePrefix) &&
      !routeContractKey.startsWith(adminProductRoutePrefix)) ||
    !routeContractKey.endsWith('.action')
  ) {
    throw new Error(`Invalid governed mutation telemetry binding: ${routeContractKey}`);
  }
  if (!isRegisteredProductAction(binding)) {
    throw new Error(`Unclassified governed mutation telemetry binding: ${routeContractKey}`);
  }

  if (productKey === 'approvals') {
    if (surfaceKey === 'approvals.work') return 'WORK';
    if (surfaceKey === 'approvals.admin') {
      return routeContractKey.includes('.operations.') ? 'OPERATIONS' : 'ADMINISTRATION';
    }
  }

  if (productKey === 'dwaion') {
    if (surfaceKey === 'dwaion.work') return 'WORK';
    if (surfaceKey === 'dwaion.management') return 'ADMINISTRATION';
  }

  if (
    (productKey === 'calendar' && surfaceKey === 'calendar.work') ||
    (productKey === 'mail' && surfaceKey === 'mail.work') ||
    (productKey === 'meetings' && surfaceKey === 'meetings.work') ||
    (productKey === 'messaging' && surfaceKey === 'messaging.work') ||
    (productKey === 'notifications' && surfaceKey === 'notifications.work') ||
    (productKey === 'spaces' && surfaceKey === 'spaces.work') ||
    (productKey === 'workplace' && surfaceKey === 'workplace.work')
  ) {
    return 'WORK';
  }

  if (productKey === 'mail' && surfaceKey === 'mail.management') {
    const actionName = routeContractKey.slice('route.admin.mail.'.length, -'.action'.length);
    return MAIL_OPERATION_ACTION_SUFFIXES.has(actionName) ? 'OPERATIONS' : 'ADMINISTRATION';
  }

  if (productKey === 'workplace' && surfaceKey === 'workplace.management') {
    return 'OPERATIONS';
  }

  if (productKey === 'communications') {
    if (surfaceKey === 'communications.work') return 'WORK';
    if (surfaceKey === 'communications.management') return 'OPERATIONS';
  }

  if (productKey === 'services') {
    if (surfaceKey === 'services.work') return 'WORK';
    if (surfaceKey === 'services.management') {
      return routeContractKey.includes('.request-transition.') ? 'OPERATIONS' : 'ADMINISTRATION';
    }
  }

  if (productKey === 'hcm') {
    if (surfaceKey === 'hcm.personal') return 'WORK';
    if (surfaceKey === 'hcm.team') return 'REVIEW';
    if (surfaceKey === 'hcm.operations') return 'OPERATIONS';
    if (surfaceKey === 'hcm.management') {
      if (routeContractKey.includes('.controlled-export-')) return 'REPORTING';
      if (routeContractKey.includes('.integration-')) return 'INTEGRATION';
      if (routeContractKey.includes('.org-')) return 'DESIGN';
      if (routeContractKey.includes('.reference-')) return 'CONFIGURATION';
    }
  }

  throw new Error(`Unclassified governed mutation telemetry binding: ${routeContractKey}`);
}
