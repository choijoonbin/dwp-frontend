import { HRM009_QUERY_CONTRACTS } from '../certificate-contract';

import type { HrisCommandReceipt } from '../../../people/command-receipts/model/command-receipt';
import type { Hrm009QueryId, Hrm009TrustedScope } from '../certificate-contract';

export const HRM009_TEST_CORRELATION_ID = '11111111-1111-4111-8111-111111111111';
export const HRM009_TEST_PERSON_ID = '22222222-2222-4222-8222-222222222222';
export const HRM009_TEST_AS_OF = '2026-10-18T00:00:00Z';

export const HRM009_TEST_SCOPE: Hrm009TrustedScope = Object.freeze({
  contextScopeKey: 'scope:tenant-one:hrm-009',
  decisionRevision: 'decision:hrm-009:52',
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: HRM009_TEST_CORRELATION_ID,
});

export type Hrm009WireProjection = {
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
    title: string;
    statusCode: string;
    fieldGroups: Record<string, unknown>;
    deepLink: { route: string; resourcePublicId: string };
    availableActions: Record<string, unknown>[];
  }[];
};

function view(value: unknown) {
  return { decision: 'VIEW', value };
}

function action(actionKey: string, hrefTemplate: string) {
  return {
    actionKey,
    method: 'POST',
    hrefTemplate,
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  };
}

function item(queryId: Hrm009QueryId): Hrm009WireProjection['items'][number] {
  const contract = HRM009_QUERY_CONTRACTS[queryId];
  if (queryId === 'IAQ-003') {
    return {
      itemPublicId: 'request:1001',
      title:
        'Employment and long-form certificate request for a globally mobile employee with an intentionally long Korean and English label 증명서 요청',
      statusCode: 'RUNNING',
      fieldGroups: {
        REQUEST_SUMMARY: view({ itemCount: 1, revision: 2, asOf: HRM009_TEST_AS_OF }),
        REQUEST_STATUS: view({ code: 'RUNNING', revision: 3 }),
        COMMAND_RECEIPT: view({
          receiptId: '33333333-3333-4333-8333-333333333333',
          state: 'ACCEPTED',
          occurredAt: HRM009_TEST_AS_OF,
          revision: 1,
        }),
      },
      deepLink: { route: contract.route, resourcePublicId: 'request:1001' },
      availableActions: [
        action(
          'hris.action.hrm.create-employee-change-request',
          '/api/people/v1/hris/employee-change-requests'
        ),
        action(
          'hris.action.hrm.submit-employee-change-request',
          '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit'
        ),
        action('hris.action.hrm.request-certificate', '/api/people/v1/hris/certificates'),
      ],
    };
  }
  return {
    itemPublicId: 'certificate:1001',
    title: 'Authorized certificate metadata requiring an issuance decision 인증서 메타데이터 검토',
    statusCode: 'ISSUED',
    fieldGroups: {
      CERTIFICATE_METADATA: view({
        key: 'certificate:employment',
        version: 'v1',
        digest: null,
      }),
      DOCUMENT_METADATA: view({
        key: 'document:employment',
        version: 'v2',
        digest: 'a'.repeat(64),
      }),
    },
    deepLink: { route: contract.route, resourcePublicId: 'certificate:1001' },
    availableActions: [
      action('hris.action.hrm.request-certificate', '/api/people/v1/hris/certificates'),
    ],
  };
}

export function hrm009ProjectionWire(
  queryId: Hrm009QueryId,
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE'
): Hrm009WireProjection {
  const empty = state === 'EMPTY' || state === 'UNAVAILABLE';
  const itemCount = queryId === 'IAQ-003' ? 3 : 2;
  return {
    projectionVersion: '1',
    asOf: HRM009_TEST_AS_OF,
    variantKey: HRM009_QUERY_CONTRACTS[queryId].variantKey,
    queryState: {
      state,
      scopeDecisionRevision: HRM009_TEST_SCOPE.decisionRevision,
      freshness: state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CURRENT',
      nextCursor: empty ? null : 'abcdefghijklmnop',
      fieldDecisionSummary: empty
        ? { viewCount: 0, maskedCount: 0, omittedCount: 0 }
        : { viewCount: itemCount, maskedCount: 0, omittedCount: 0 },
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'certificate.metadata',
                errorCode: 'OWNER_TEMPORARILY_UNAVAILABLE',
                correlationId: '44444444-4444-4444-8444-444444444444',
                retryable: true,
              },
            ]
          : [],
      correlationId: HRM009_TEST_CORRELATION_ID,
      cachePolicy: {
        authorizationDecisionRevision: HRM009_TEST_SCOPE.decisionRevision,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: empty ? [] : [item(queryId)],
  };
}

export function hrm009Receipt(): HrisCommandReceipt {
  return {
    receiptId: '55555555-5555-4555-8555-555555555555',
    commandType: 'CERTIFICATE_REQUEST',
    originatingAction: 'REQUEST_CERTIFICATE',
    subjectPrincipalPublicId: HRM009_TEST_PERSON_ID,
    populationScopeDigest: 'b'.repeat(64),
    fieldPolicyRevision: 3,
    purposeCode: 'EMPLOYEE_SELF_SERVICE',
    authorizationRevision: 52,
    status: 'ACCEPTED',
    correlationId: '66666666-6666-4666-8666-666666666666',
    requestDigest: 'c'.repeat(64),
    createdAt: HRM009_TEST_AS_OF,
  };
}
