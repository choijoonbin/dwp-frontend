import type { ProductSurfaceTaskKind } from '@dwp-frontend/shared-utils/api/observability-api';

export type ProductSurfaceTaskBinding = Readonly<{
  productKey: string;
  surfaceKey: string;
  routeContractKey: string;
}>;

const WORKPLACE_OPERATIONS_ACTIONS = new Set([
  'route.workplace.management.connector-replay-preview.action',
  'route.workplace.management.connector-replay-start.action',
  'route.workplace.management.service-catalog-create.action',
  'route.workplace.management.service-catalog-state.action',
  'route.workplace.management.service-catalog-update.action',
  'route.workplace.management.service-fulfillment-attachment-upload.action',
  'route.workplace.management.service-fulfillment-message.action',
  'route.workplace.management.service-fulfillment-task-update.action',
]);

/**
 * Closed telemetry classification for governed mutations. Authority registries stay the source of
 * truth for access; this projection only selects a privacy-safe KPI dimension and fails closed when
 * a new ACTION has not been deliberately classified.
 */
export function resolveProductSurfaceTaskKind(
  binding: ProductSurfaceTaskBinding
): ProductSurfaceTaskKind {
  const { productKey, surfaceKey, routeContractKey } = binding;
  if (
    !routeContractKey.startsWith(`route.${productKey}.`) ||
    !routeContractKey.endsWith('.action')
  ) {
    throw new Error(`Invalid governed mutation telemetry binding: ${routeContractKey}`);
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

  if (
    productKey === 'workplace' &&
    surfaceKey === 'workplace.management' &&
    WORKPLACE_OPERATIONS_ACTIONS.has(routeContractKey)
  ) {
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
