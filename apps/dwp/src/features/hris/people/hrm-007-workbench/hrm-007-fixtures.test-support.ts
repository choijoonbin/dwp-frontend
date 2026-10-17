import { HRM007_QUERY_CONTRACTS } from './hrm-007-contract';

import type { Hrm007QueryId, Hrm007TrustedScope } from './hrm-007-contract';

export const HRM007_TEST_CORRELATION = '11111111-1111-4111-8111-111111111111';
export const HRM007_TEST_AS_OF = '2026-10-17T00:00:00Z';
export const HRM007_TEST_CURSOR = 'abcdefghijklmnop';

export const HRM007_TEST_SCOPE: Hrm007TrustedScope = Object.freeze({
  tenantId: 'tenant:one',
  actorId: 'actor:hrm-007',
  accessMode: 'NORMAL',
  contextScopeKey: 'scope:tenant-one:hrm-007',
  decisionRevision: 'decision:hrm-007:51',
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: HRM007_TEST_CORRELATION,
});

export type Hrm007WireItem = {
  itemPublicId: string;
  title: string;
  statusCode: string;
  fieldGroups: Record<string, unknown>;
  deepLink: { route: string; resourcePublicId: string };
  availableActions: Record<string, unknown>[];
};

export type Hrm007WireProjection = {
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
  items: Hrm007WireItem[];
};

function view(value: unknown) {
  return { decision: 'VIEW', value };
}

const aggregate = { itemCount: 3, revision: 2, asOf: HRM007_TEST_AS_OF };
const status = { code: 'APPROVED', revision: 3 };
const temporal = {
  startAt: '2026-10-20T00:00:00Z',
  endAt: null,
  durationMinutes: 0,
};
const reference = {
  publicId: 'assignment:1001',
  code: 'ASSIGNMENT',
  label: 'People Operations Lead',
  revision: 4,
};
const effectiveRange = { effectiveFrom: '2026-10-20', effectiveTo: null, revision: 2 };
const policy = {
  policyKey: 'employment.standard',
  revision: 7,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  status: 'ACTIVE',
};

function action(actionKey: string, hrefTemplate: string) {
  return {
    actionKey,
    method: 'POST',
    hrefTemplate,
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  };
}

function item(queryId: Hrm007QueryId): Hrm007WireItem {
  const contract = HRM007_QUERY_CONTRACTS[queryId];
  if (queryId === 'IAQ-005') {
    return {
      itemPublicId: 'people-change:1001',
      title: 'Employment details change',
      statusCode: 'APPROVED',
      fieldGroups: {
        CHANGE_REQUEST_SUMMARY: view(aggregate),
        LIMITED_EMPLOYMENT: view({ code: 'LIMITED', revision: 1 }),
        APPROVAL_STATUS: view(status),
      },
      deepLink: { route: contract.route, resourcePublicId: 'people-change:1001' },
      availableActions: [
        action(
          'hris.action.hrm.create-employee-change-request',
          '/api/people/v1/hris/employee-change-requests'
        ),
        action(
          'hris.action.hrm.submit-employee-change-request',
          '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit'
        ),
      ],
    };
  }
  if (queryId === 'IAQ-007') {
    return {
      itemPublicId: 'appointment:1001',
      title: 'People Operations appointment',
      statusCode: 'DRAFT',
      fieldGroups: {
        APPOINTMENT: view(temporal),
        ASSIGNMENT: view(reference),
        EMPLOYMENT: view(effectiveRange),
      },
      deepLink: { route: contract.route, resourcePublicId: 'appointment:1001' },
      availableActions: [
        action('hris.action.hrm.create-assignment-event', '/api/people/v1/hris/assignment-events'),
        action(
          'hris.action.hrm.validate-assignment-event',
          '/api/people/v1/hris/assignment-events/{eventPublicId}/validate'
        ),
        action(
          'hris.action.hrm.submit-assignment-event',
          '/api/people/v1/hris/assignment-events/{eventPublicId}/submit'
        ),
        action(
          'hris.action.hrm.publish-assignment-event',
          '/api/people/v1/hris/assignment-events/{eventPublicId}/publish'
        ),
      ],
    };
  }
  return {
    itemPublicId: 'employment-policy:1001',
    title: 'Standard employment policy',
    statusCode: 'ACTIVE',
    fieldGroups: {
      POLICY_METADATA: view(policy),
      EMPLOYMENT_RULE: view({ ...policy, policyKey: 'employment.standard.rule' }),
      IMPACT_SUMMARY: view(aggregate),
    },
    deepLink: { route: contract.route, resourcePublicId: 'employment-policy:1001' },
    availableActions: [],
  };
}

export function hrm007ProjectionWire(
  queryId: Hrm007QueryId,
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE'
): Hrm007WireProjection {
  const unavailable = state === 'UNAVAILABLE';
  const empty = state === 'EMPTY' || unavailable;
  return {
    projectionVersion: '1',
    asOf: HRM007_TEST_AS_OF,
    variantKey: HRM007_QUERY_CONTRACTS[queryId].variantKey,
    queryState: {
      state,
      scopeDecisionRevision: HRM007_TEST_SCOPE.decisionRevision,
      freshness: unavailable ? 'UNAVAILABLE' : 'CURRENT',
      nextCursor: empty ? null : HRM007_TEST_CURSOR,
      fieldDecisionSummary: empty
        ? { viewCount: 0, maskedCount: 0, omittedCount: 0 }
        : { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'employment.policy',
                errorCode: 'OWNER_TEMPORARILY_UNAVAILABLE',
                correlationId: '22222222-2222-4222-8222-222222222222',
                retryable: true,
              },
            ]
          : [],
      correlationId: HRM007_TEST_CORRELATION,
      cachePolicy: {
        authorizationDecisionRevision: HRM007_TEST_SCOPE.decisionRevision,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: empty ? [] : [item(queryId)],
  };
}
