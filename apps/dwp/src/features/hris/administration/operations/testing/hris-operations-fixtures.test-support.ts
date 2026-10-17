import { hrisOperationOwnerDeepLink } from '../model/hris-operations-contract';

import type {
  HrisOperationalExceptionDetail,
  HrisOperationalExceptionPage,
  HrisOperationsEntry,
} from '../model/hris-operations-contract';

// Java UUID canonical text is accepted without RFC version or variant-bit restrictions.
export const EXCEPTION_ID = '10000000-0000-f000-0000-000000000001';
export const CORRELATION_ID = '20000000-0000-4000-8000-000000000001';
export const RECEIPT_ID = '30000000-0000-4000-8000-000000000001';
export const NOW = '2026-10-17T08:00:00Z';
export const OWNER_ROUTE_KEY = 'route.hcm.configuration.settings-reference.page' as const;
const OWNER_MODULES = ['HRM', 'PER', 'PAY', 'SYS', 'TIM'] as const;
const SOURCE_STATES = {
  COMPLETE: ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'AVAILABLE'],
  PARTIAL: ['UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE', 'AVAILABLE', 'UNAVAILABLE'],
  STALE: ['UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE', 'STALE', 'UNAVAILABLE'],
  UNAVAILABLE: ['UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE', 'UNAVAILABLE'],
} as const;

export function operationsEntry(
  projectionState: HrisOperationsEntry['projectionState'] = 'COMPLETE'
): HrisOperationsEntry {
  const counts =
    projectionState === 'UNAVAILABLE'
      ? { total: 0, open: 0, acknowledged: 0, resolved: 0, highImpact: 0 }
      : { total: 1, open: 1, acknowledged: 0, resolved: 0, highImpact: 1 };
  return {
    asOf: NOW,
    projectionState,
    lastSuccessfulRefreshAt: projectionState === 'UNAVAILABLE' ? null : '2026-10-17T07:59:30Z',
    sources: OWNER_MODULES.map((ownerModule, index) => {
      const state = SOURCE_STATES[projectionState][index]!;
      const reasonCode =
        state === 'STALE'
          ? 'OWNER_PROJECTION_STALE'
          : state === 'UNAVAILABLE'
            ? 'OWNER_PROJECTION_UNAVAILABLE'
            : undefined;
      return {
        ownerModule,
        state,
        ...(reasonCode === undefined ? {} : { reasonCode }),
      };
    }),
    counts,
  };
}

export function emptyOperationsEntry(): HrisOperationsEntry {
  return operationsEntry('UNAVAILABLE');
}

export function exceptionItem() {
  return {
    exceptionPublicId: EXCEPTION_ID,
    ownerModule: 'SYS' as const,
    severity: 'HIGH' as const,
    state: 'OPEN' as const,
    code: 'REFERENCE_CONFIGURATION_PUBLICATION_STALLED',
    summaryKey: 'hris.operations.exception.sys.reference-configuration-publication-stalled',
    ownerRouteKey: OWNER_ROUTE_KEY,
    ownerDeepLink: hrisOperationOwnerDeepLink(OWNER_ROUTE_KEY, EXCEPTION_ID),
    sourceRevision: 7,
    firstObservedAt: '2026-10-17T07:30:00Z',
    lastObservedAt: NOW,
    occurrenceCount: 3,
  };
}

export function exceptionPage(empty = false): HrisOperationalExceptionPage {
  return {
    asOf: NOW,
    items: empty ? [] : [exceptionItem()],
    nextCursor: null,
  };
}

export function exceptionDetail(
  overrides: Partial<HrisOperationalExceptionDetail> = {}
): HrisOperationalExceptionDetail {
  return {
    ...exceptionItem(),
    type: 'OWNER_PROJECTION_EXCEPTION',
    correlationId: CORRELATION_ID,
    evidenceRefs: [
      `urn:dwp:hris:evidence:command-receipt:${RECEIPT_ID}`,
      `urn:dwp:hris:evidence:domain-event:${EXCEPTION_ID}`,
    ],
    fieldDecisions: {
      OPERATION_EXCEPTION: 'VIEW',
      OWNER_DEEP_LINK: 'VIEW',
      RECOVERY_METADATA: 'VIEW',
      REDACTED_PAYLOAD: 'OMIT',
    },
    ...overrides,
  };
}
