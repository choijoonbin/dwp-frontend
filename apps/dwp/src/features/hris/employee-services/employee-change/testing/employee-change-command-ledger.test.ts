import { describe, expect, it, vi } from 'vitest';

import { EmployeeChangePendingCommandLedger } from '../hooks/use-employee-change-workspace';

import type { EmployeeChangeLifecycleCommand } from '../api/employee-change-api';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';

describe('employee-change ambiguous command ledger', () => {
  it('reuses idempotency and correlation across response-loss retries until receipt recovery', () => {
    const ledger = new EmployeeChangePendingCommandLedger();
    const idFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce('10000000-0000-4000-8000-000000000011')
      .mockReturnValueOnce('10000000-0000-4000-8000-000000000012')
      .mockReturnValueOnce('10000000-0000-4000-8000-000000000013')
      .mockReturnValueOnce('10000000-0000-4000-8000-000000000014');
    const signature = JSON.stringify({ requestPublicId: REQUEST_ID, expectedRequestVersion: 1 });
    const command = (): EmployeeChangeLifecycleCommand => ({
      requestPublicId: REQUEST_ID,
      expectedRequestVersion: 1,
      idempotencyKey: idFactory(),
      correlationId: idFactory(),
    });

    const sentBeforeResponseLoss = ledger.getOrCreate('submit', signature, command);
    const reconciledRetry = ledger.getOrCreate('submit', signature, command);

    expect(reconciledRetry).toBe(sentBeforeResponseLoss);
    expect(reconciledRetry).toMatchObject({
      idempotencyKey: '10000000-0000-4000-8000-000000000011',
      correlationId: '10000000-0000-4000-8000-000000000012',
    });
    expect(idFactory).toHaveBeenCalledTimes(2);

    ledger.recordReceipt('submit', signature, 'RESULT_UNKNOWN');
    expect(ledger.getOrCreate('submit', signature, command)).toBe(sentBeforeResponseLoss);

    ledger.recordReceipt('submit', signature, 'SUCCEEDED');
    const commandAfterReceipt = ledger.getOrCreate('submit', signature, command);
    expect(commandAfterReceipt).not.toBe(sentBeforeResponseLoss);
    expect(commandAfterReceipt).toMatchObject({
      idempotencyKey: '10000000-0000-4000-8000-000000000013',
      correlationId: '10000000-0000-4000-8000-000000000014',
    });
  });

  it('does not reuse an identity for a different governed command binding', () => {
    const ledger = new EmployeeChangePendingCommandLedger();
    const first = ledger.getOrCreate('apply', 'request:v1', () => command('idem-000000000001'));
    const changed = ledger.getOrCreate('apply', 'request:v2', () => command('idem-000000000002'));

    expect(changed).not.toBe(first);
    expect(changed.expectedRequestVersion).toBe(2);
  });
});

function command(idempotencyKey: string): EmployeeChangeLifecycleCommand {
  return {
    requestPublicId: REQUEST_ID,
    expectedRequestVersion: idempotencyKey.endsWith('2') ? 2 : 1,
    idempotencyKey,
    correlationId: '10000000-0000-4000-8000-000000000021',
    purposeCode: 'HR_LIFECYCLE',
  };
}
