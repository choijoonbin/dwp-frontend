import { describe, expect, it, vi } from 'vitest';

import {
  invalidateNotificationCaches,
  resetNotificationCaches,
  scheduleNotificationCacheInvalidation,
} from '../features/notifications/notification-cache-policy';

describe('invalidateNotificationCaches', () => {
  it('refreshes aggregate, app and inbox projections after every live signal', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateNotificationCaches({ invalidateQueries } as never);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['notifications', 'summary'],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['notifications', 'app-summary'],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['notifications', 'inbox'],
    });
  });

  it('coalesces every live consumer in the same event turn', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as never;

    const first = scheduleNotificationCacheInvalidation(queryClient);
    const second = scheduleNotificationCacheInvalidation(queryClient);
    const third = scheduleNotificationCacheInvalidation(queryClient);

    expect(second).toBe(first);
    expect(third).toBe(first);
    await first;
    expect(invalidateQueries).toHaveBeenCalledTimes(3);

    await scheduleNotificationCacheInvalidation(queryClient);
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
  });

  it('resets every user-visible projection after a durable cursor reset', async () => {
    const resetQueries = vi.fn().mockResolvedValue(undefined);

    await resetNotificationCaches({ resetQueries } as never);

    expect(resetQueries).toHaveBeenCalledTimes(3);
    expect(resetQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['notifications', 'summary'],
    });
    expect(resetQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['notifications', 'app-summary'],
    });
    expect(resetQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['notifications', 'inbox'],
    });
  });
});
