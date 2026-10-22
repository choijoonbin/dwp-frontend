import {
  PAY004_DATA_ROUTE_CONTRACT_KEY,
  PAY004_FEATURE,
  PAY004_PAGE_ROUTE_CONTRACT_KEY,
} from '../retirement-contract';

import type { Pay004TrustedAdmission, Pay004TrustedScope } from '../retirement-contract';

export const PAY004_TEST_IDS: Readonly<{
  item: string;
  itemTwo: string;
  correlation: string;
}> = Object.freeze({
  item: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  itemTwo: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  correlation: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
});
export const PAY004_TEST_DECISION_REVISION = 'authorization-revision-58';
export const PAY004_TEST_SCOPE_DECISION_REVISION = 'scope-projection-revision-12';
export const PAY004_TEST_AS_OF = '2026-10-22T05:00:00Z';
export const PAY004_TEST_CURSOR = 'eyJwYWdlIjoyfWFhYQ';

export const PAY004_TEST_ADMISSION: Pay004TrustedAdmission = Object.freeze({
  kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
  feature: PAY004_FEATURE,
  pageRouteContractKey: PAY004_PAGE_ROUTE_CONTRACT_KEY,
  dataRouteContractKey: PAY004_DATA_ROUTE_CONTRACT_KEY,
  tenantId: 'tenant-a',
  contextScopeKey: 'tenant:tenant-a/legal-entity:seoul/pay-group:monthly',
  decisionRevision: PAY004_TEST_DECISION_REVISION,
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: PAY004_TEST_IDS.correlation,
});

export const PAY004_TEST_SCOPE: Pay004TrustedScope = Object.freeze({
  contextScopeKey: PAY004_TEST_ADMISSION.contextScopeKey,
  decisionRevision: PAY004_TEST_ADMISSION.decisionRevision,
  locale: PAY004_TEST_ADMISSION.locale,
  timeZone: PAY004_TEST_ADMISSION.timeZone,
  correlationId: PAY004_TEST_ADMISSION.correlationId,
});

type State = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';
type Freshness = 'CURRENT' | 'STALE' | 'UNAVAILABLE';

export function pay004ProjectionWire(
  state: State = 'COMPLETE',
  freshness: Freshness = state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CURRENT',
  nextCursor: string | null = null
) {
  const hasItems = state === 'COMPLETE' || state === 'PARTIAL';
  return {
    projectionVersion: '1',
    variantKey: 'RETIREMENT',
    asOf: PAY004_TEST_AS_OF,
    queryState: {
      state,
      scopeDecisionRevision: PAY004_TEST_SCOPE_DECISION_REVISION,
      freshness,
      nextCursor,
      fieldDecisionSummary: {
        viewCount: hasItems ? 2 : 0,
        maskedCount: hasItems ? 1 : 0,
        omittedCount: 0,
      },
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'retirement.policy-evidence',
                errorCode: 'OWNER_COMPONENT_UNAVAILABLE',
                correlationId: PAY004_TEST_IDS.correlation,
                retryable: true,
              },
            ]
          : state === 'UNAVAILABLE'
            ? [
                {
                  componentKey: 'retirement.projection',
                  errorCode: 'OWNER_COMPONENT_UNAVAILABLE',
                  correlationId: PAY004_TEST_IDS.correlation,
                  retryable: true,
                },
              ]
            : [],
      correlationId: PAY004_TEST_IDS.correlation,
      cachePolicy: {
        authorizationDecisionRevision: PAY004_TEST_DECISION_REVISION,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: hasItems
      ? [
          {
            itemPublicId: PAY004_TEST_IDS.item,
            title: 'Retirement case · October separation',
            statusCode: 'CALCULATED',
            fieldGroups: {
              RETIREMENT_RESULT: {
                decision: 'VIEW',
                value: { amount: '12850000.0000', currency: 'KRW' },
              },
              POLICY_VERSION: {
                decision: 'MASK',
                value: null,
                maskReason: 'FIELD_POLICY',
                maskedDisplayKey: 'hris.retirement.policy.restricted',
              },
              CASE_STATUS: {
                decision: 'VIEW',
                value: { code: 'CALCULATED', revision: 7 },
              },
            },
            deepLink: {
              route: '/hr/operations/payroll/retirement',
              resourcePublicId: PAY004_TEST_IDS.item,
            },
            availableActions: [],
          },
        ]
      : [],
  };
}

export function pay004OmittedProjectionWire() {
  const wire = pay004ProjectionWire();
  wire.items[0]!.fieldGroups = {
    CASE_STATUS: { decision: 'VIEW', value: { code: 'CALCULATED', revision: 7 } },
  } as never;
  wire.queryState.fieldDecisionSummary = { viewCount: 1, maskedCount: 0, omittedCount: 2 };
  return wire;
}

export function pay004TwoItemProjectionWire(
  secondTitle = 'Retirement case · November correction'
) {
  const wire = pay004ProjectionWire();
  const first = wire.items[0]!;
  wire.items.push({
    ...first,
    itemPublicId: PAY004_TEST_IDS.itemTwo,
    title: secondTitle,
    deepLink: {
      ...first.deepLink,
      resourcePublicId: PAY004_TEST_IDS.itemTwo,
    },
    availableActions: [],
  });
  wire.queryState.fieldDecisionSummary = { viewCount: 4, maskedCount: 2, omittedCount: 0 };
  return wire;
}
