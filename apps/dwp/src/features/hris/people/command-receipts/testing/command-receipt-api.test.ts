import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get },
}));

import {
  HRIS_COMMAND_RECEIPT_API_CONTRACT,
  readHrisCommandReceipt,
} from '../api/command-receipt-api';
import {
  assertSameHrisCommandReceipt,
  hrisCommandReceiptIsTerminal,
  parseHrisCommandReceipt,
} from '../model/command-receipt';

import type { HrisCommandReceipt } from '../model/command-receipt';

const RECEIPT_ID = '10000000-0000-4000-8000-000000000001';

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
    runtime.get.mockResolvedValue({ data: receipt() });

    await expect(
      readHrisCommandReceipt(RECEIPT_ID, 'opaque/current-scope', signal)
    ).resolves.toEqual(receipt());

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
    });
    await expect(readHrisCommandReceipt(RECEIPT_ID)).rejects.toThrow(
      'HRIS command receipt does not match the request.'
    );

    expect(() =>
      assertSameHrisCommandReceipt(
        parseHrisCommandReceipt(receipt()),
        parseHrisCommandReceipt({
          ...receipt(),
          correlationId: '10000000-0000-4000-8000-000000000098',
        })
      )
    ).toThrow('HRIS command receipt identity changed during recovery.');
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
