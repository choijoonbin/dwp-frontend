import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get },
}));

import {
  HRIS_COMMAND_RECEIPT_API_CONTRACT,
  parseAuthorizedEmployeeChangeResultLocation,
  readHrisCommandReceipt,
} from '../api/command-receipt-api';
import {
  assertSameHrisCommandReceipt,
  hrisCommandReceiptIsTerminal,
  parseHrisCommandReceipt,
} from '../model/command-receipt';

import type { HrisCommandReceipt } from '../model/command-receipt';

const RECEIPT_ID = '10000000-0000-4000-8000-000000000001';
const RESULT_LOCATION =
  '/hr/operations/people/employee-change-requests?requestPublicId=123e4567-e89b-42d3-a456-426614174000';

function receipt(status: HrisCommandReceipt['status'] = 'ACCEPTED'): HrisCommandReceipt {
  return {
    receiptId: RECEIPT_ID,
    commandType: 'EMPLOYEE_CHANGE_APPLY',
    originatingAction: 'APPLY_EMPLOYEE_CHANGE_REQUEST',
    subjectPrincipalPublicId: '10000000-0000-4000-8000-000000000002',
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 11,
    purposeCode: 'HR_LIFECYCLE',
    authorizationRevision: 43,
    status,
    correlationId: '10000000-0000-4000-8000-000000000003',
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-15T01:00:00Z',
  };
}

describe('PEP-HRM-014 command receipt client', () => {
  beforeEach(() => runtime.get.mockReset());

  it('pins the sole GET route and forwards opaque scope plus cancellation', async () => {
    const signal = new AbortController().signal;
    runtime.get.mockResolvedValue({ data: receipt(), headers: new Headers() });

    await expect(
      readHrisCommandReceipt(RECEIPT_ID, 'opaque/current-scope', signal)
    ).resolves.toEqual({ receipt: receipt(), resultLocation: null });

    expect(HRIS_COMMAND_RECEIPT_API_CONTRACT).toEqual({
      bindingId: 'PEP-HRM-014',
      method: 'GET',
      path: '/api/people/v1/hris/command-receipts/{receiptId}',
    });
    expect(runtime.get).toHaveBeenCalledWith(`/api/people/v1/hris/command-receipts/${RECEIPT_ID}`, {
      contextScopeKey: 'opaque/current-scope',
      signal,
    });
  });

  it('rejects malformed, additive, mismatched, and identity-drifting projections', async () => {
    expect(() => parseHrisCommandReceipt({ ...receipt(), rawResult: { secret: true } })).toThrow(
      'HRIS command receipt is invalid.'
    );
    expect(() => parseHrisCommandReceipt({ ...receipt(), requestDigest: 'raw' })).toThrow(
      'HRIS command receipt is invalid.'
    );

    runtime.get.mockResolvedValue({
      data: { ...receipt(), receiptId: '10000000-0000-4000-8000-000000000099' },
      headers: new Headers(),
    });
    await expect(readHrisCommandReceipt(RECEIPT_ID)).rejects.toThrow(
      'HRIS command receipt does not match the request.'
    );
  });

  it.each([
    ['receiptId', { receiptId: '10000000-0000-4000-8000-000000000091' }],
    ['commandType', { commandType: 'EMPLOYEE_CHANGE_SUBMIT' }],
    ['originatingAction', { originatingAction: 'SUBMIT_EMPLOYEE_CHANGE_REQUEST' }],
    [
      'subjectPrincipalPublicId',
      { subjectPrincipalPublicId: '10000000-0000-4000-8000-000000000092' },
    ],
    ['populationScopeDigest', { populationScopeDigest: 'c'.repeat(64) }],
    ['fieldPolicyRevision', { fieldPolicyRevision: 12 }],
    ['purposeCode', { purposeCode: 'HR_OPERATIONS' }],
    ['authorizationRevision', { authorizationRevision: 44 }],
    ['correlationId', { correlationId: '10000000-0000-4000-8000-000000000093' }],
    ['requestDigest', { requestDigest: 'd'.repeat(64) }],
    ['createdAt', { createdAt: '2026-10-15T01:00:01Z' }],
  ] as const)('rejects immutable %s drift while recovering', (_field, patch) => {
    expect(() =>
      assertSameHrisCommandReceipt(receipt('ACCEPTED'), {
        ...receipt('RUNNING'),
        ...patch,
      })
    ).toThrow('HRIS command receipt identity changed during recovery.');
  });

  it('allows status as the only mutable receipt field', () => {
    expect(() =>
      assertSameHrisCommandReceipt(receipt('ACCEPTED'), receipt('RUNNING'))
    ).not.toThrow();
  });

  it('carries only a backend-authorized canonical employee-change Location', async () => {
    runtime.get.mockResolvedValue({
      data: receipt('SUCCEEDED'),
      headers: new Headers({ location: RESULT_LOCATION }),
    });

    await expect(readHrisCommandReceipt(RECEIPT_ID)).resolves.toEqual({
      receipt: receipt('SUCCEEDED'),
      resultLocation: RESULT_LOCATION,
    });
  });

  it.each([
    ['absolute URL', `https://dwp.example${RESULT_LOCATION}`],
    ['foreign origin', `https://evil.example${RESULT_LOCATION}`],
    ['uppercase UUID', RESULT_LOCATION.replace('123e4567', '123E4567')],
    ['extra query', `${RESULT_LOCATION}&tab=overview`],
    ['fragment', `${RESULT_LOCATION}#details`],
    ['wrong key', RESULT_LOCATION.replace('requestPublicId=', 'focus=')],
    ['wrong route', RESULT_LOCATION.replace('employee-change-requests', 'assignments')],
  ])('rejects a non-canonical %s result Location', (_case, location) => {
    expect(() =>
      parseAuthorizedEmployeeChangeResultLocation(location, receipt('SUCCEEDED'))
    ).toThrow('HRIS command receipt result Location is invalid.');
  });

  it('rejects a Location on non-success or an unrecognized command tuple', () => {
    expect(() =>
      parseAuthorizedEmployeeChangeResultLocation(RESULT_LOCATION, receipt('RUNNING'))
    ).toThrow('HRIS command receipt result Location is invalid.');
    expect(() =>
      parseAuthorizedEmployeeChangeResultLocation(RESULT_LOCATION, {
        ...receipt('SUCCEEDED'),
        originatingAction: 'UNRECOGNIZED_EMPLOYEE_CHANGE_ACTION',
      })
    ).toThrow('HRIS command receipt result Location is invalid.');
    expect(parseAuthorizedEmployeeChangeResultLocation(null, receipt('SUCCEEDED'))).toBeNull();
  });

  it.each(['SUCCEEDED', 'REJECTED', 'FAILED'] as const)(
    'recognizes %s as terminal without treating pending states as terminal',
    (status) => {
      expect(hrisCommandReceiptIsTerminal(parseHrisCommandReceipt(receipt(status)))).toBe(true);
      expect(hrisCommandReceiptIsTerminal(parseHrisCommandReceipt(receipt('ACCEPTED')))).toBe(
        false
      );
    }
  );
});
