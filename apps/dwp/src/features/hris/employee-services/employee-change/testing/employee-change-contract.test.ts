import { describe, expect, it } from 'vitest';

import {
  employeeChangeItemVersion,
  hasEmployeeChangeAction,
  parseEmployeeChangeCommandReceipt,
  parseEmployeeChangeProjection,
} from '../model/employee-change-contract';
import {
  CORRELATION_ID,
  employeeChangeProjection,
  employeeChangeReceipt,
} from './employee-change-fixtures.test-support';

describe('employee-change generated contract adapter', () => {
  it('accepts the exact IAQ-009 projection and derives lifecycle authority', () => {
    const projection = parseEmployeeChangeProjection(employeeChangeProjection());
    const item = projection.items[0]!;

    expect(employeeChangeItemVersion(item)).toBe(3);
    expect(hasEmployeeChangeAction(item, 'hris.action.hrm.submit-employee-change-request')).toBe(
      true
    );
    expect(hasEmployeeChangeAction(item, 'hris.action.hrm.apply-employee-change-request')).toBe(
      false
    );
  });

  it('rejects summary drift, unknown fields and action substitution', () => {
    const summaryDrift = employeeChangeProjection();
    summaryDrift.queryState.fieldDecisionSummary.viewCount = 2;
    expect(() => parseEmployeeChangeProjection(summaryDrift)).toThrow(
      'Employee-change projection is invalid.'
    );

    const unknownField = employeeChangeProjection() as Record<string, unknown>;
    unknownField.tenantId = 77;
    expect(() => parseEmployeeChangeProjection(unknownField)).toThrow(
      'Employee-change projection is invalid.'
    );

    const substituted = employeeChangeProjection();
    substituted.items[0]!.availableActions[1]!.hrefTemplate = '/api/people/v1/unsafe';
    expect(() => parseEmployeeChangeProjection(substituted)).toThrow(
      'Employee-change projection is invalid.'
    );
  });

  it('accepts only the exact immutable command receipt', () => {
    expect(parseEmployeeChangeCommandReceipt(employeeChangeReceipt())).toMatchObject({
      status: 'SUCCEEDED',
      correlationId: CORRELATION_ID,
    });
    expect(() =>
      parseEmployeeChangeCommandReceipt({ ...employeeChangeReceipt(), requestDigest: 'raw' })
    ).toThrow('Employee-change receipt is invalid.');
  });
});
