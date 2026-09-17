import { describe, expect, it, vi } from 'vitest';

import {
  completeCalendarResponseIntent,
  prepareCalendarResponseCommand,
} from './calendar-response-intent';

describe('calendar response intent', () => {
  it('reuses the idempotency key for a retry of the same event version and response', () => {
    const keyFactory = vi.fn(() => 'attempt-1');
    const first = prepareCalendarResponseCommand(
      null,
      { eventId: 'event-1', version: 7 },
      'ACCEPTED',
      keyFactory
    );
    const retry = prepareCalendarResponseCommand(
      first.intent,
      { eventId: 'event-1', version: 7 },
      'ACCEPTED',
      keyFactory
    );

    expect(retry.command).toEqual({
      eventId: 'event-1',
      response: 'ACCEPTED',
      expectedVersion: 7,
      idempotencyKey: 'attempt-1',
    });
    expect(keyFactory).toHaveBeenCalledTimes(1);
  });

  it('creates a new key when the event version or requested response changes', () => {
    const keyFactory = vi.fn().mockReturnValueOnce('attempt-1').mockReturnValueOnce('attempt-2');
    const first = prepareCalendarResponseCommand(
      null,
      { eventId: 'event-1', version: 7 },
      'ACCEPTED',
      keyFactory
    );
    const next = prepareCalendarResponseCommand(
      first.intent,
      { eventId: 'event-1', version: 8 },
      'TENTATIVE',
      keyFactory
    );

    expect(next.command.idempotencyKey).toBe('attempt-2');
  });

  it('clears only the intent completed by the server', () => {
    const prepared = prepareCalendarResponseCommand(
      null,
      { eventId: 'event-1', version: 7 },
      'DECLINED',
      () => 'attempt-1'
    );

    expect(completeCalendarResponseIntent(prepared.intent, 'another-attempt')).toBe(
      prepared.intent
    );
    expect(completeCalendarResponseIntent(prepared.intent, 'attempt-1')).toBeNull();
  });
});
