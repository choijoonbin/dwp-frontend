import { describe, expect, it, vi } from 'vitest';

import { createLatestNotificationProfileSaveQueue } from './notification-preference-save-queue';

import type { NotificationDeliveryProfile } from '@dwp-frontend/shared-utils/api/notification-api';

function profile(
  overrides: Partial<NotificationDeliveryProfile> = {}
): NotificationDeliveryProfile {
  return {
    channels: {
      IN_APP: true,
      EMAIL: false,
      WEB_PUSH: false,
      MOBILE_PUSH: false,
      TEAMS: false,
      SLACK: false,
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '07:00',
      timeZone: 'Asia/Seoul',
      days: [1, 2, 3, 4, 5],
      allowUrgentBypass: true,
    },
    digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
    presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
    version: '1',
    updatedAt: '2026-10-28T00:00:00Z',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('latest notification profile save queue', () => {
  it('serializes a delayed response and coalesces rapid edits into the latest full intent', async () => {
    const first = deferred<{ saved: NotificationDeliveryProfile; recovered: boolean }>();
    const latest = deferred<{ saved: NotificationDeliveryProfile; recovered: boolean }>();
    const base = profile();
    const firstIntent = profile({ channels: { ...base.channels, EMAIL: true } });
    const secondIntent = profile({
      ...firstIntent,
      quietHours: { ...firstIntent.quietHours, enabled: true },
    });
    const latestIntent = profile({
      ...secondIntent,
      presentation: { ...secondIntent.presentation, previewMode: 'HIDDEN' },
    });
    const calls: NotificationDeliveryProfile[] = [];
    const successes: Array<{ sequence: number; latest: boolean }> = [];
    const busyChanges: boolean[] = [];
    let active = 0;
    let maximumActive = 0;
    const queue = createLatestNotificationProfileSaveQueue({
      persist: async (next) => {
        calls.push(next);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        try {
          return await (calls.length === 1 ? first.promise : latest.promise);
        } finally {
          active -= 1;
        }
      },
      onBusyChange: (busy) => busyChanges.push(busy),
      onSuccess: (_outcome, context) => {
        successes.push(context);
      },
      onError: vi.fn(),
    });

    queue.enqueue(firstIntent);
    queue.enqueue(secondIntent);
    queue.enqueue(latestIntent);

    expect(calls).toEqual([firstIntent]);
    first.resolve({ saved: profile({ ...firstIntent, version: '2' }), recovered: false });
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual(latestIntent);
    expect(calls).not.toContain(secondIntent);

    latest.resolve({ saved: profile({ ...latestIntent, version: '3' }), recovered: false });
    await vi.waitFor(() => expect(busyChanges).toEqual([true, false]));

    expect(maximumActive).toBe(1);
    expect(successes).toEqual([
      { sequence: 1, latest: false },
      { sequence: 3, latest: true },
    ]);
  });

  it('continues with the latest intent when the delayed older save fails', async () => {
    const first = deferred<{ saved: NotificationDeliveryProfile; recovered: boolean }>();
    const base = profile();
    const firstIntent = profile({ channels: { ...base.channels, EMAIL: true } });
    const latestIntent = profile({
      ...firstIntent,
      quietHours: { ...firstIntent.quietHours, enabled: true },
    });
    const calls: NotificationDeliveryProfile[] = [];
    const errors: Array<{ sequence: number; latest: boolean }> = [];
    const successes: Array<{ sequence: number; latest: boolean }> = [];
    const queue = createLatestNotificationProfileSaveQueue({
      persist: async (next) => {
        calls.push(next);
        if (calls.length === 1) return first.promise;
        return { saved: profile({ ...next, version: '2' }), recovered: false };
      },
      onBusyChange: vi.fn(),
      onSuccess: (_outcome, context) => {
        successes.push(context);
      },
      onError: (_error, context) => {
        errors.push(context);
      },
    });

    queue.enqueue(firstIntent);
    queue.enqueue(latestIntent);
    first.reject(new Error('temporary failure'));

    await vi.waitFor(() => expect(successes).toEqual([{ sequence: 2, latest: true }]));
    expect(calls).toEqual([firstIntent, latestIntent]);
    expect(errors).toEqual([{ sequence: 1, latest: false }]);
    expect(queue.isBusy()).toBe(false);
  });

  it('accepts an explicit retry of the preserved latest intent after its save fails', async () => {
    const latestIntent = profile({
      presentation: { bannerMode: 'OFF', previewMode: 'HIDDEN' },
    });
    const calls: NotificationDeliveryProfile[] = [];
    const errors: Array<{ sequence: number; latest: boolean }> = [];
    const successes: Array<{ sequence: number; latest: boolean }> = [];
    const queue = createLatestNotificationProfileSaveQueue({
      persist: async (next) => {
        calls.push(next);
        if (calls.length === 1) throw new Error('temporary failure');
        return { saved: profile({ ...next, version: '2' }), recovered: false };
      },
      onBusyChange: vi.fn(),
      onSuccess: (_outcome, context) => {
        successes.push(context);
      },
      onError: (_error, context) => {
        errors.push(context);
      },
    });

    queue.enqueue(latestIntent);
    await vi.waitFor(() => expect(errors).toEqual([{ sequence: 1, latest: true }]));
    expect(queue.isBusy()).toBe(false);

    queue.enqueue(latestIntent);
    await vi.waitFor(() => expect(successes).toEqual([{ sequence: 2, latest: true }]));

    expect(calls).toEqual([latestIntent, latestIntent]);
    expect(queue.isBusy()).toBe(false);
  });
});
