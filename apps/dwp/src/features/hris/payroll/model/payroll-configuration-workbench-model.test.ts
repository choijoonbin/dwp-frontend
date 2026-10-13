import { describe, expect, it } from 'vitest';

import {
  payrollWorkbenchCanPublish,
  selectPayrollConfigurationWorkbench,
} from './payroll-configuration-workbench-model';

function workbench() {
  return {
    projectionVersion: '1',
    variantKey: 'PAYROLL',
    asOf: '2026-10-13T01:00:00Z',
    queryState: {
      state: 'COMPLETE',
      scopeDecisionRevision: 'decision-11',
      freshness: 'CURRENT',
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 2, maskedCount: 1, omittedCount: 0 },
      partialFailures: [],
      correlationId: '20000000-0000-4000-8000-000000000001',
      cachePolicy: {
        authorizationDecisionRevision: 'decision-11',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
        maxAgeSeconds: 30,
      },
    },
    items: [
      {
        itemPublicId: 'formula:BASE_PAY',
        title: 'Base pay formula',
        statusCode: 'VALIDATED',
        fieldGroups: {
          POLICY_VERSION: {
            decision: 'VIEW',
            value: {
              policyKey: 'pay.formula.base-pay',
              revision: 3,
              effectiveFrom: '2026-10-01',
              effectiveTo: null,
              status: 'VALIDATED',
            },
          },
          PAYROLL_POLICY: {
            decision: 'MASK',
            value: null,
            maskReason: 'FIELD_POLICY_MASKED',
            maskedDisplayKey: 'common.restricted',
          },
          EFFECTIVE_STATUS: {
            decision: 'VIEW',
            value: { code: 'VALIDATED', revision: 3 },
          },
        },
        deepLink: { route: '/hr/settings/payroll', resourcePublicId: 'formula:BASE_PAY' },
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
  };
}

describe('IAQ-055 payroll configuration workbench projection', () => {
  it('accepts exact PAYROLL projection and gates publish from availableActions', () => {
    const selected = selectPayrollConfigurationWorkbench(workbench());

    expect(selected.variantKey).toBe('PAYROLL');
    expect(selected.queryState.freshness).toBe('CURRENT');
    expect(selected.items[0]?.fieldGroups.PAYROLL_POLICY).toMatchObject({ decision: 'MASK' });
    expect(payrollWorkbenchCanPublish(selected.items[0])).toBe(true);
    expect(Object.isFrozen(selected.items[0]?.availableActions)).toBe(true);
  });

  it('rejects substituted action paths and unknown tenant fields', () => {
    const substituted = workbench();
    substituted.items[0]!.availableActions[0]!.hrefTemplate = '/api/payroll/admin/publish-all';
    expect(() => selectPayrollConfigurationWorkbench(substituted)).toThrow(
      /Invalid payroll configuration workbench source/
    );

    const tenantLeak = workbench();
    Reflect.set(tenantLeak.items[0]!, 'tenantId', 42);
    expect(() => selectPayrollConfigurationWorkbench(tenantLeak)).toThrow(
      /Invalid payroll configuration workbench source/
    );
  });

  it('rejects decision-summary drift instead of inferring hidden fields', () => {
    const drift = workbench();
    drift.queryState.fieldDecisionSummary = { viewCount: 3, maskedCount: 0, omittedCount: 0 };

    expect(() => selectPayrollConfigurationWorkbench(drift)).toThrow(/fieldDecisionSummary/);
  });

  it('enforces EMPTY, PARTIAL and UNAVAILABLE state invariants', () => {
    const empty = workbench();
    empty.items = [];
    empty.queryState.state = 'EMPTY';
    empty.queryState.fieldDecisionSummary = { viewCount: 0, maskedCount: 0, omittedCount: 0 };
    expect(selectPayrollConfigurationWorkbench(empty).items).toEqual([]);

    const partial = workbench();
    partial.queryState.state = 'PARTIAL';
    expect(() => selectPayrollConfigurationWorkbench(partial)).toThrow(/queryState/);

    const unavailable = workbench();
    unavailable.queryState.state = 'UNAVAILABLE';
    unavailable.queryState.freshness = 'UNAVAILABLE';
    expect(() => selectPayrollConfigurationWorkbench(unavailable)).toThrow(/queryState/);
  });
});
