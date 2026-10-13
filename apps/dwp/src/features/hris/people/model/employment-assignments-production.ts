import {
  EMPLOYMENT_EVENT_API_CONTRACTS,
  EMPLOYMENT_EVENT_BASE_PATH,
  EMPLOYMENT_EVENT_RECEIPT_PATH,
} from '../../employment/assignment-proposal-model';
import { EMPLOYMENT_ASSIGNMENTS_PATH } from '../api/employment-workbench-api';

export const EMPLOYMENT_ASSIGNMENTS_SURFACE = Object.freeze({
  productKey: 'hcm',
  surfaceKey: 'hcm.operations',
} as const);

export const EMPLOYMENT_ASSIGNMENTS_CAPABILITIES = Object.freeze({
  read: 'hcm.operations.people.view',
  manage: 'hcm.operations.assignment.manage',
  publish: 'hcm.operations.people-change.approve',
} as const);

/**
 * Closed owner-binding inventory for the canonical operations mount. Shared route registration
 * consumes these same route keys; this module never substitutes the legacy assignment endpoint.
 */
export const EMPLOYMENT_ASSIGNMENTS_PRODUCTION_CONTRACT = Object.freeze({
  page: Object.freeze({
    contractId: 'IAQ-006',
    routeContractKey: 'route.hcm.operations.employment-assignments.page',
    method: 'GET',
    path: EMPLOYMENT_ASSIGNMENTS_PATH,
  }),
  eventDetail: Object.freeze({
    routeContractKey: 'route.hcm.operations.assignment-event-detail.data',
    method: 'GET',
    path: `${EMPLOYMENT_EVENT_BASE_PATH}/{eventPublicId}`,
  }),
  eventReceipt: Object.freeze({
    routeContractKey: 'route.hcm.operations.assignment-command-receipt.data',
    method: 'GET',
    path: `${EMPLOYMENT_EVENT_RECEIPT_PATH}/{receiptId}`,
  }),
  eventActions: EMPLOYMENT_EVENT_API_CONTRACTS,
} as const);

export const EMPLOYMENT_ASSIGNMENTS_STALE_AFTER_MS = 15 * 60 * 1000;

export function employmentAssignmentsSnapshotIsStale(
  asOf: string,
  nowMs = Date.now(),
  staleAfterMs = EMPLOYMENT_ASSIGNMENTS_STALE_AFTER_MS
): boolean {
  const asOfMs = Date.parse(asOf);
  return (
    !Number.isFinite(asOfMs) ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(staleAfterMs) ||
    staleAfterMs < 0 ||
    nowMs - asOfMs > staleAfterMs ||
    asOfMs - nowMs > 60_000
  );
}
