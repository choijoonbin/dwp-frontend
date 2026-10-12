export const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
export const CORRELATION_ID = '10000000-0000-4000-8000-000000000002';

export function employeeChangeProjection() {
  return {
    projectionVersion: '1',
    asOf: '2026-10-12T08:00:00Z',
    variantKey: 'EMPLOYEE_CHANGE_REQUESTS',
    queryState: {
      state: 'COMPLETE',
      scopeDecisionRevision: 'decision:employee-change:31',
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: CORRELATION_ID,
      cachePolicy: {
        maxAgeSeconds: 0,
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        authorizationDecisionRevision: 'decision:employee-change:31',
      },
    },
    items: [
      {
        itemPublicId: REQUEST_ID,
        title: 'Kim Minsoo · PROFILE_UPDATE',
        statusCode: 'DRAFT',
        fieldGroups: {
          CHANGE_REQUEST_SUMMARY: {
            decision: 'VIEW',
            value: { itemCount: 2, revision: 3, asOf: '2026-10-12T08:00:00Z' },
          },
          APPROVAL_STATUS: {
            decision: 'VIEW',
            value: { code: 'DRAFT', revision: 3 },
          },
          EMPLOYMENT: {
            decision: 'VIEW',
            value: { effectiveFrom: '2026-10-12', effectiveTo: null, revision: 3 },
          },
        },
        deepLink: {
          route: '/hr/operations/people/employee-change-requests',
          resourcePublicId: REQUEST_ID,
        },
        availableActions: [
          {
            actionKey: 'hris.action.hrm.create-employee-change-request',
            method: 'POST',
            hrefTemplate: '/api/people/v1/hris/employee-change-requests',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
          {
            actionKey: 'hris.action.hrm.submit-employee-change-request',
            method: 'POST',
            hrefTemplate: '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
        ],
      },
    ],
  };
}

export function employeeChangeReceipt() {
  return {
    receiptId: '10000000-0000-4000-8000-000000000003',
    commandType: 'EMPLOYEE_CHANGE_SUBMIT',
    originatingAction: 'SUBMIT_EMPLOYEE_CHANGE_REQUEST',
    subjectPrincipalPublicId: '10000000-0000-4000-8000-000000000004',
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 11,
    purposeCode: 'HR_OPERATIONS',
    authorizationRevision: 13,
    status: 'SUCCEEDED',
    correlationId: CORRELATION_ID,
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-12T08:00:00Z',
  };
}
