import { describe, expect, it, vi } from 'vitest';

import { createWorkScheduleCoordinator } from './work-hub-schedule-coordinator';
import type { WorkScheduleResult } from './work-hub-scheduling';

const owner = 'tenant-a:user-a:calendar-create';
const itemKey = 'PERSONAL_TASK:task-1:';
const command = {
  linkId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
  work: { sourceSystem: 'PERSONAL_TASK' as const, sourceReference: 'task-1' },
  reviewedItemSourceId: 'personal' as const,
  reviewedItemSourceStatus: 'OPEN',
  reviewedItemVersion: 1,
  reviewedItemLifecycle: 'OPEN' as const,
  eventInput: {
    idempotencyKey: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
    calendarId: 'calendar-1',
    title: 'Private reviewed title',
  },
} as WorkScheduleResult['command'];
const recovery = {
  state: 'CALENDAR_UNCONFIRMED',
  command,
  sourceChanged: false,
  reason: 'CANCELLED',
  retryable: true,
} as WorkScheduleResult;

describe('Work schedule coordinator ownership', () => {
  it('retains an exact same-owner retry after route cancellation without web storage', () => {
    const coordinator = createWorkScheduleCoordinator(owner);
    const operation = coordinator.begin(owner, itemKey, command)!;
    expect(coordinator.isActive(owner, itemKey)).toBe(true);
    operation.cancel();

    expect(operation.canContinue()).toBe(false);
    expect(operation.publish(recovery)).toBe(true);
    expect(coordinator.isActive(owner, itemKey)).toBe(false);
    expect(coordinator.recover(owner, itemKey)).toEqual(recovery);
    expect(coordinator.recover('tenant-b:user-b', itemKey)).toBeNull();
  });

  it('rejects late old-owner publication after scope disposal', () => {
    const coordinator = createWorkScheduleCoordinator(owner);
    const listener = vi.fn();
    coordinator.subscribe(listener);
    const operation = coordinator.begin(owner, itemKey, command)!;
    listener.mockClear();

    coordinator.dispose();

    expect(operation.signal.aborted).toBe(true);
    expect(operation.publish(recovery)).toBe(false);
    expect(coordinator.recover(owner, itemKey)).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects an older same-command result after the newer operation succeeds', () => {
    const coordinator = createWorkScheduleCoordinator(owner);
    const first = coordinator.begin(owner, itemKey, command)!;
    const second = coordinator.begin(owner, itemKey, command)!;
    const scheduled = {
      state: 'SCHEDULED',
      command,
      event: {},
      link: {},
      sourceChanged: false,
    } as WorkScheduleResult;

    expect(first.signal.aborted).toBe(true);
    expect(second.publish(scheduled)).toBe(true);
    expect(coordinator.recover(owner, itemKey)).toBeNull();
    expect(first.publish(recovery)).toBe(false);
    expect(coordinator.recover(owner, itemKey)).toBeNull();
  });

  it('retains an invalid receipt until explicit reconciliation clears it', () => {
    const coordinator = createWorkScheduleCoordinator(owner);
    const operation = coordinator.begin(owner, itemKey, command)!;
    const invalidReceipt = {
      state: 'CALENDAR_REJECTED',
      command,
      sourceChanged: false,
      reason: 'INVALID_RECEIPT',
      retryable: true,
    } as WorkScheduleResult;

    expect(operation.publish(invalidReceipt)).toBe(true);
    expect(coordinator.recover(owner, itemKey)).toEqual(invalidReceipt);
    coordinator.clear(owner, itemKey);
    expect(coordinator.recover(owner, itemKey)).toBeNull();
  });

  it('rejects commands whose exact work identity or reviewed lifecycle is not schedulable', () => {
    const coordinator = createWorkScheduleCoordinator(owner);

    expect(coordinator.begin(owner, 'PERSONAL_TASK:task-2:', command)).toBeNull();
    expect(
      coordinator.begin(owner, itemKey, {
        ...command,
        reviewedItemLifecycle: 'COMPLETED',
      })
    ).toBeNull();
    expect(
      coordinator.begin(owner, itemKey, command, {
        eventId: 'not-an-event-receipt',
      } as Parameters<typeof coordinator.begin>[3])
    ).toBeNull();
    expect(coordinator.recover(owner, itemKey)).toBeNull();
  });
});
