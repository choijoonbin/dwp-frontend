import { describe, expect, it } from 'vitest';

import {
  employeeChangeItemVersion,
  hasEmployeeChangeAction,
  employeeChangeReceiptDeepLink,
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

    const actionStateDrift = employeeChangeProjection();
    actionStateDrift.items[0]!.statusCode = 'SUBMITTED';
    expect(() => parseEmployeeChangeProjection(actionStateDrift)).toThrow(
      'Employee-change projection is invalid.'
    );
  });

  it('accepts only runtime-consistent COMPLETE, EMPTY, PARTIAL and UNAVAILABLE states', () => {
    const empty = employeeChangeProjection();
    empty.items = [];
    empty.queryState.state = 'EMPTY';
    empty.queryState.fieldDecisionSummary = { viewCount: 0, maskedCount: 0, omittedCount: 0 };
    expect(parseEmployeeChangeProjection(empty).queryState.state).toBe('EMPTY');

    const partial = employeeChangeProjection();
    partial.queryState.state = 'PARTIAL';
    partial.queryState.freshness = 'STALE';
    partial.queryState.partialFailures = [
      {
        componentKey: 'employee-change.request',
        errorCode: 'INVALID_REQUEST_REVISION',
        correlationId: CORRELATION_ID,
        retryable: false,
      },
    ];
    expect(parseEmployeeChangeProjection(partial).queryState.state).toBe('PARTIAL');

    const unavailable = employeeChangeProjection();
    unavailable.items = [];
    unavailable.queryState.state = 'UNAVAILABLE';
    unavailable.queryState.freshness = 'UNAVAILABLE';
    unavailable.queryState.fieldDecisionSummary = {
      viewCount: 0,
      maskedCount: 0,
      omittedCount: 0,
    };
    unavailable.queryState.partialFailures = [
      {
        componentKey: 'employee-change.repository',
        errorCode: 'EMPLOYEE_CHANGE_QUERY_UNAVAILABLE',
        correlationId: CORRELATION_ID,
        retryable: true,
      },
    ];
    expect(parseEmployeeChangeProjection(unavailable).queryState.state).toBe('UNAVAILABLE');

    const falseComplete = employeeChangeProjection();
    falseComplete.items = [];
    falseComplete.queryState.fieldDecisionSummary = {
      viewCount: 0,
      maskedCount: 0,
      omittedCount: 0,
    };
    expect(() => parseEmployeeChangeProjection(falseComplete)).toThrow(
      'Employee-change projection is invalid.'
    );

    const falseEmpty = employeeChangeProjection();
    falseEmpty.queryState.state = 'EMPTY';
    expect(() => parseEmployeeChangeProjection(falseEmpty)).toThrow(
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
    ).toThrow('HRIS command receipt is invalid.');
  });

  it('derives only the fixed owner route for a successful recognized receipt', () => {
    const succeeded = parseEmployeeChangeCommandReceipt(employeeChangeReceipt());
    expect(employeeChangeReceiptDeepLink(succeeded)).toBe(
      '/hr/operations/people/employee-change-requests'
    );
    expect(employeeChangeReceiptDeepLink({ ...succeeded, status: 'RUNNING' })).toBeNull();
    expect(
      employeeChangeReceiptDeepLink({
        ...succeeded,
        originatingAction: 'UNRECOGNIZED_EMPLOYEE_CHANGE_ACTION',
      })
    ).toBeNull();
  });
});
