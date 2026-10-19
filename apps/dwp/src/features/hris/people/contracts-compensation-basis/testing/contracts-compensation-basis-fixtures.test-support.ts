import {
  HRM011_ISSUE_ACTION,
  HRM011_QUERY_CONTRACT,
} from '../contracts-compensation-basis-contract';

import type { HrisCommandReceipt } from '../../command-receipts/model/command-receipt';
import type { Hrm011TrustedScope } from '../contracts-compensation-basis-contract';

export const HRM011_TEST_CORRELATION_ID = '11111111-1111-4111-8111-111111111111';
export const HRM011_TEST_RELATIONSHIP_ID = '22222222-2222-4222-8222-222222222222';
export const HRM011_TEST_TEMPLATE_ID = '33333333-3333-4333-8333-333333333333';
export const HRM011_TEST_AS_OF = '2026-10-19T00:00:00Z';
export const HRM011_TEST_DIGEST = 'a'.repeat(64);

export const HRM011_TEST_SCOPE: Hrm011TrustedScope = Object.freeze({
  contextScopeKey: 'scope:tenant-one:hrm-011',
  decisionRevision: 'decision:hrm-011:59',
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: HRM011_TEST_CORRELATION_ID,
});

export type Hrm011WireProjection = {
  projectionVersion: string;
  asOf: string;
  variantKey: string;
  queryState: {
    state: string;
    scopeDecisionRevision: string;
    freshness: string;
    nextCursor: string | null;
    fieldDecisionSummary: { viewCount: number; maskedCount: number; omittedCount: number };
    partialFailures: {
      componentKey: string;
      errorCode: string;
      correlationId: string;
      retryable: boolean;
    }[];
    correlationId: string;
    cachePolicy: {
      authorizationDecisionRevision: string;
      invalidationEvent: string;
      maxAgeSeconds: number;
    };
  };
  items: {
    itemPublicId: string;
    resourceVersion: number;
    title: string;
    statusCode: string;
    fieldGroups: Record<string, unknown>;
    deepLink: { route: string; resourcePublicId: string };
    availableActions: Record<string, unknown>[];
  }[];
};

export function hrm011ProjectionWire(
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE',
  freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE' = state === 'UNAVAILABLE'
    ? 'UNAVAILABLE'
    : 'CURRENT'
): Hrm011WireProjection {
  const empty = state === 'EMPTY' || state === 'UNAVAILABLE';
  const actionable = state === 'COMPLETE' && freshness === 'CURRENT';
  return {
    projectionVersion: '2',
    asOf: HRM011_TEST_AS_OF,
    variantKey: HRM011_QUERY_CONTRACT.variantKey,
    queryState: {
      state,
      scopeDecisionRevision: HRM011_TEST_SCOPE.decisionRevision,
      freshness,
      nextCursor: empty ? null : 'abcdefghijklmnop',
      fieldDecisionSummary: empty
        ? { viewCount: 0, maskedCount: 0, omittedCount: 0 }
        : { viewCount: 2, maskedCount: 0, omittedCount: 0 },
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'contract.template',
                errorCode: 'AUTHORITATIVE_TEMPLATE_AMBIGUOUS',
                correlationId: '44444444-4444-4444-8444-444444444444',
                retryable: false,
              },
            ]
          : [],
      correlationId: HRM011_TEST_CORRELATION_ID,
      cachePolicy: {
        authorizationDecisionRevision: HRM011_TEST_SCOPE.decisionRevision,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: empty
      ? []
      : [
          {
            itemPublicId: HRM011_TEST_RELATIONSHIP_ID,
            resourceVersion: 7,
            title:
              'Global mobility employment relationship with a deliberately long governed contract label 고용계약 검토',
            statusCode: actionable ? 'READY_TO_ISSUE' : 'AUTHORITY_INCOMPLETE',
            fieldGroups: {
              CONTRACT_METADATA: {
                decision: 'VIEW',
                value: {
                  key: HRM011_TEST_TEMPLATE_ID,
                  version: '3',
                  digest: HRM011_TEST_DIGEST,
                },
              },
              COMPENSATION_BASIS: {
                decision: 'VIEW',
                value: { amount: '125000.00', currency: 'USD' },
              },
            },
            deepLink: {
              route: HRM011_QUERY_CONTRACT.route,
              resourcePublicId: HRM011_TEST_RELATIONSHIP_ID,
            },
            availableActions: actionable ? [{ ...HRM011_ISSUE_ACTION }] : [],
          },
        ],
  };
}

export function hrm011Receipt(): HrisCommandReceipt {
  return {
    receiptId: '55555555-5555-4555-8555-555555555555',
    commandType: 'EMPLOYMENT_CONTRACT_ISSUE',
    originatingAction: 'ISSUE_EMPLOYMENT_CONTRACT',
    subjectPrincipalPublicId: HRM011_TEST_RELATIONSHIP_ID,
    populationScopeDigest: 'b'.repeat(64),
    fieldPolicyRevision: 7,
    purposeCode: 'HR_LIFECYCLE',
    authorizationRevision: 59,
    status: 'ACCEPTED',
    correlationId: HRM011_TEST_CORRELATION_ID,
    requestDigest: 'c'.repeat(64),
    createdAt: HRM011_TEST_AS_OF,
  };
}
