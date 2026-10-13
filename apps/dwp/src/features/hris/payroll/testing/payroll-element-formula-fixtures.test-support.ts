import { PAY_FORMULA_REGISTRY_ID } from '../model/payroll-element-formula-model';

import type { PayrollFormulaReceipt } from '../model/payroll-element-formula-model';

export const PAY006_IDS = Object.freeze({
  element: '10000000-0000-4000-8000-000000000001',
  formula: '10000000-0000-4000-8000-000000000002',
  legalEntity: '10000000-0000-4000-8000-000000000003',
  payrollGroup: '10000000-0000-4000-8000-000000000004',
  rounding: '10000000-0000-4000-8000-000000000005',
  command: '20000000-0000-4000-8000-000000000001',
  receipt: '20000000-0000-4000-8000-000000000002',
  correlation: '30000000-0000-4000-8000-000000000001',
  subject: '30000000-0000-4000-8000-000000000002',
});

export function formulaAstWire() {
  return {
    registryId: PAY_FORMULA_REGISTRY_ID,
    registryVersion: 1,
    declaredReturnType: 'MONEY',
    rootNodeId: 'rounded_total',
    nodes: [
      {
        nodeId: 'base_pay',
        operator: 'INPUT',
        arguments: [],
        returnType: 'MONEY',
        value: null,
        currency: 'XTS',
        inputKey: 'basePay',
        roundingRef: null,
        lookupRef: null,
        collectionInputKey: null,
      },
      {
        nodeId: 'rounded_total',
        operator: 'ROUND',
        arguments: ['base_pay'],
        returnType: 'MONEY',
        value: null,
        currency: 'XTS',
        inputKey: null,
        roundingRef: {
          owner: 'PAY',
          schemaId: 'pay.rounding-policy.v1',
          publicId: PAY006_IDS.rounding,
          revision: 1,
          contentHash: 'a'.repeat(64),
          validFrom: null,
          validToExclusive: null,
        },
        lookupRef: null,
        collectionInputKey: null,
      },
    ],
  };
}

const ACTIONS: Readonly<
  Record<PayrollFormulaReceipt['commandType'], PayrollFormulaReceipt['originatingAction']>
> = {
  CREATE_ELEMENT_VERSION: 'PAY_ELEMENT_CONFIGURE',
  CREATE_FORMULA_VERSION: 'PAY_FORMULA_CONFIGURE',
  VALIDATE_FORMULA: 'PAY_FORMULA_VALIDATE',
  SIMULATE_FORMULA: 'PAY_FORMULA_SIMULATE',
  PUBLISH_FORMULA: 'PAY_FORMULA_PUBLISH',
};

export function commandReceiptWire(
  commandType: PayrollFormulaReceipt['commandType'] = 'VALIDATE_FORMULA',
  overrides: Record<string, unknown> = {}
) {
  return {
    receiptId: PAY006_IDS.receipt,
    commandType,
    originatingAction: ACTIONS[commandType],
    subjectPrincipalPublicId: PAY006_IDS.subject,
    populationScopeDigest: '1'.repeat(64),
    fieldPolicyRevision: 'field-policy-7',
    purposeCode: 'PAYROLL_CONFIGURATION',
    authorizationRevision: 'authorization-v37',
    status: 'SUCCEEDED',
    correlationId: PAY006_IDS.correlation,
    requestDigest: '2'.repeat(64),
    createdAt: '2026-10-13T01:00:00Z',
    ...overrides,
  };
}

export function workbenchWire(overrides: Record<string, unknown> = {}) {
  return {
    projectionVersion: '1',
    variantKey: 'PAYROLL',
    asOf: '2026-10-13T01:00:00Z',
    queryState: {
      state: 'COMPLETE',
      scopeDecisionRevision: 'decision-11',
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 },
      partialFailures: [],
      correlationId: PAY006_IDS.correlation,
      cachePolicy: {
        authorizationDecisionRevision: 'decision-11',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: [
      {
        itemPublicId: `formula:${PAY006_IDS.formula}`,
        title: 'Base pay formula',
        statusCode: 'VALIDATED',
        fieldGroups: {
          POLICY_VERSION: {
            decision: 'VIEW',
            value: {
              policyKey: 'pay.formula.base-pay',
              revision: 1,
              effectiveFrom: '2026-10-01',
              effectiveTo: null,
              status: 'VALIDATED',
            },
          },
          PAYROLL_POLICY: {
            decision: 'VIEW',
            value: {
              policyKey: 'pay.policy.standard',
              revision: 2,
              effectiveFrom: '2026-10-01',
              effectiveTo: null,
              status: 'PUBLISHED',
            },
          },
          EFFECTIVE_STATUS: {
            decision: 'VIEW',
            value: { code: 'VALIDATED', revision: 1 },
          },
        },
        deepLink: {
          route: '/hr/settings/payroll',
          resourcePublicId: `formula:${PAY006_IDS.formula}`,
        },
        availableActions: [
          {
            actionKey: 'hris.action.pay.formula.publish',
            method: 'POST',
            hrefTemplate: '/api/payroll/v1/formulas/{formulaId}/publish',
            idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
            stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
          },
        ],
      },
    ],
    ...overrides,
  };
}
