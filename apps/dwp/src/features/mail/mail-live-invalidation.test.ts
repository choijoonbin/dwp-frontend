import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBoundedMailInvalidator,
  mailEventInvalidatesQueries,
  mailEventStreamUrl,
  mailLiveEvidenceIsStale,
  mailLiveReconnectDelay,
  parseMailLiveEvent,
  readMailEventCursor,
  shouldRunMailLiveConnection,
  storeMailEventCursor,
} from './mail-live-invalidation';

const event = {
  sequence: 42,
  type: 'THREAD_UPDATED',
  threadId: '40000000-0000-4000-8000-000000000042',
  occurredAt: '2026-10-28T10:00:00.000Z',
};

afterEach(() => vi.useRealTimers());

describe('mail live invalidation model', () => {
  it('accepts only the official sequenced Mail event shape', () => {
    expect(parseMailLiveEvent(event)).toEqual(event);
    expect(parseMailLiveEvent({ ...event, sequence: -1 })).toBeNull();
    expect(parseMailLiveEvent({ ...event, sequence: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
    expect(parseMailLiveEvent({ ...event, threadId: 'not-a-uuid' })).toBeNull();
    expect(parseMailLiveEvent({ cursor: '42', kind: 'mail.changed' })).toBeNull();
    expect(mailEventInvalidatesQueries({ event: 'mail', data: event })).toBe(true);
    expect(mailEventInvalidatesQueries({ event: 'message', data: event })).toBe(false);
  });

  it('reconnects with a URL-encoded persisted sequence cursor', () => {
    expect(mailEventStreamUrl(null)).toBe('/api/platform/v1/mail/events');
    expect(mailEventStreamUrl('42')).toBe('/api/platform/v1/mail/events?after=42');
    expect(mailLiveReconnectDelay(0, 0.5)).toBe(1_000);
    expect(mailLiveReconnectDelay(1, 0.5)).toBe(2_000);
    expect(mailLiveReconnectDelay(10, 1)).toBe(30_000);
  });

  it('runs only while online and visible', () => {
    expect(shouldRunMailLiveConnection(true, 'visible')).toBe(true);
    expect(shouldRunMailLiveConnection(false, 'visible')).toBe(false);
    expect(shouldRunMailLiveConnection(true, 'hidden')).toBe(false);
  });

  it('shows connection state only when visible cached Mail evidence is stale', () => {
    const evidence = {
      live: false,
      visibilityState: 'visible' as const,
      latestEvidenceAt: 1_000,
      now: 92_000,
      staleAfterMs: 90_000,
    };
    expect(mailLiveEvidenceIsStale(evidence)).toBe(true);
    expect(mailLiveEvidenceIsStale({ ...evidence, live: true })).toBe(false);
    expect(mailLiveEvidenceIsStale({ ...evidence, visibilityState: 'hidden' })).toBe(false);
    expect(mailLiveEvidenceIsStale({ ...evidence, latestEvidenceAt: 0 })).toBe(false);
  });

  it('coalesces event bursts into one bounded cache invalidation', async () => {
    vi.useFakeTimers();
    const invalidate = vi.fn();
    const scheduler = createBoundedMailInvalidator(invalidate, 250);
    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
    expect(invalidate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(invalidate).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it('persists only nonnegative decimal cursors and tolerates blocked storage', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    storeMailEventCursor(storage, 'cursor', '42');
    expect(readMailEventCursor(storage, 'cursor')).toBe('42');
    values.set('cursor', '-1');
    expect(readMailEventCursor(storage, 'cursor')).toBeNull();
    values.set('cursor', String(Number.MAX_SAFE_INTEGER + 1));
    expect(readMailEventCursor(storage, 'cursor')).toBeNull();
    expect(
      readMailEventCursor(
        {
          getItem: () => {
            throw new Error('blocked');
          },
        },
        'cursor'
      )
    ).toBeNull();
  });
});
