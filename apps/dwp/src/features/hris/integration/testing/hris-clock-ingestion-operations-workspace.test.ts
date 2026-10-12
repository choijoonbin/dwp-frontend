import { describe, expect, it } from 'vitest';

import { timeClockVoidCommand } from '../hris-clock-ingestion-operations-workspace';

describe('HRIS TIM Control production adapter', () => {
  it('builds the exact immutable HIGH descriptor for corrective void', () => {
    expect(
      timeClockVoidCommand({
        eventId: '50000000-0000-4000-8000-000000000001',
        expectedObjectVersion: 7,
        idempotencyKey: '50000000-0000-4000-8000-000000000002',
        request: { reasonCode: 'DEVICE_DUPLICATE' },
      })
    ).toEqual({
      operation: 'HCM_TIME_CLOCK_EVENT_VOID',
      commandMethod: 'POST',
      commandPath: '/api/time/v1/clock-events/50000000-0000-4000-8000-000000000001/voids',
      targetType: 'CLOCK_EVENT',
      targetId: '50000000-0000-4000-8000-000000000001',
      expectedObjectVersion: 7,
      payload: { reasonCode: 'DEVICE_DUPLICATE' },
      idempotencyKey: '50000000-0000-4000-8000-000000000002',
    });
  });
});
