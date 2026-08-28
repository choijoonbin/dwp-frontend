import { describe, expect, it, vi } from 'vitest';

import { createMeetingDepartureSynchronizer } from './meeting-departure-sync';

describe('meeting departure synchronization', () => {
  it('coalesces explicit, SDK, and lifecycle departure signals for one session', async () => {
    let release: (() => void) | undefined;
    const transport = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const synchronizer = createMeetingDepartureSynchronizer(transport);

    const explicit = synchronizer.synchronize('session-1', { keepalive: false });
    const sdkDisconnect = synchronizer.synchronize('session-1', { keepalive: false });
    const pageHide = synchronizer.synchronize('session-1', { keepalive: true });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());

    release?.();
    await Promise.all([explicit, sdkDisconnect, pageHide]);
    expect(transport).toHaveBeenCalledWith(false);

    await synchronizer.synchronize('session-1', { keepalive: true });
    expect(transport).toHaveBeenCalledOnce();
  });

  it('preserves keepalive when page lifecycle is the first departure signal', async () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingDepartureSynchronizer(transport);

    await Promise.all([
      synchronizer.synchronize('session-2', { keepalive: true }),
      synchronizer.synchronize('session-2', { keepalive: false }),
    ]);

    expect(transport).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledWith(true);
  });

  it('retries foreground synchronization and releases failed sessions for later recovery', async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary-1'))
      .mockRejectedValueOnce(new Error('temporary-2'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('pagehide-failed'))
      .mockResolvedValueOnce(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingDepartureSynchronizer(transport, { wait });

    await expect(
      synchronizer.synchronize('session-3', { keepalive: false })
    ).resolves.toBeUndefined();
    expect(transport).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 750);
    expect(wait).toHaveBeenNthCalledWith(2, 1_500);

    await expect(synchronizer.synchronize('session-4', { keepalive: true })).rejects.toThrow(
      'pagehide-failed'
    );
    await expect(
      synchronizer.synchronize('session-4', { keepalive: false })
    ).resolves.toBeUndefined();
    expect(transport).toHaveBeenCalledTimes(5);
  });

  it('starts a new departure lifecycle when a reused session reconnects', async () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingDepartureSynchronizer(transport);

    await synchronizer.synchronize('session-reused', { keepalive: false });
    synchronizer.reset('session-reused');
    await synchronizer.synchronize('session-reused', { keepalive: false });

    expect(transport).toHaveBeenCalledTimes(2);
  });
});
