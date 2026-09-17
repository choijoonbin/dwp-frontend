import { describe, expect, it, vi } from 'vitest';

import { createMeetingConnectionSynchronizer } from './meeting-connection-sync';

describe('meeting connection synchronization', () => {
  it('coalesces duplicate SDK connected events inside one connection cycle', async () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingConnectionSynchronizer(transport);

    synchronizer.start('session-1');
    await Promise.all([
      synchronizer.synchronize('session-1'),
      synchronizer.synchronize('session-1'),
    ]);
    await synchronizer.synchronize('session-1');

    expect(transport).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledWith('session-1');
  });

  it('confirms attendance again after leave and re-entry reuse the same session id', async () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingConnectionSynchronizer(transport);

    synchronizer.start('session-reused');
    await synchronizer.synchronize('session-reused');
    synchronizer.end('session-reused');
    synchronizer.start('session-reused');
    await synchronizer.synchronize('session-reused');

    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls).toEqual([['session-reused'], ['session-reused']]);
  });

  it('fences a stale confirmation and retries a failed active connection', async () => {
    let releaseFirst: (() => void) | undefined;
    const transport = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          })
      )
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingConnectionSynchronizer(transport, { wait });

    synchronizer.start('session-1');
    const stale = synchronizer.synchronize('session-1');
    synchronizer.end('session-1');
    synchronizer.start('session-1');
    const active = synchronizer.synchronize('session-1');
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf('function'));
    releaseFirst?.();

    await Promise.all([stale, active]);
    expect(transport).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  it('recovers a connected session after the foreground webhook window is exhausted', async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error('webhook-pending-1'))
      .mockRejectedValueOnce(new Error('webhook-pending-2'))
      .mockRejectedValueOnce(new Error('webhook-pending-3'))
      .mockRejectedValueOnce(new Error('webhook-pending-4'))
      .mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingConnectionSynchronizer(transport, {
      recoveryAttempts: 3,
      wait,
    });

    synchronizer.start('session-delayed');
    await expect(synchronizer.synchronize('session-delayed')).rejects.toThrow('webhook-pending-3');
    await expect(synchronizer.recover('session-delayed')).resolves.toBeUndefined();
    await synchronizer.synchronize('session-delayed');

    expect(transport).toHaveBeenCalledTimes(5);
    expect(wait.mock.calls).toEqual([[1_000], [2_000], [2_000], [4_000]]);
  });

  it('stops immediately when the failure is not safe to retry', async () => {
    const denied = new Error('access-revoked');
    const transport = vi.fn().mockRejectedValue(denied);
    const wait = vi.fn().mockResolvedValue(undefined);
    const synchronizer = createMeetingConnectionSynchronizer(transport, {
      shouldRetry: (error) => error !== denied,
      wait,
    });

    synchronizer.start('session-revoked');
    await expect(synchronizer.synchronize('session-revoked')).rejects.toBe(denied);

    expect(transport).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it('fences a delayed recovery after the active connection cycle ends', async () => {
    let releaseWait: (() => void) | undefined;
    const transport = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseWait = resolve;
        })
    );
    const synchronizer = createMeetingConnectionSynchronizer(transport, { wait });

    synchronizer.start('session-reused');
    const staleRecovery = synchronizer.recover('session-reused');
    await vi.waitFor(() => expect(releaseWait).toBeTypeOf('function'));
    synchronizer.end('session-reused');
    synchronizer.start('session-reused');
    releaseWait?.();
    await staleRecovery;
    await synchronizer.synchronize('session-reused');

    expect(transport).toHaveBeenCalledOnce();
  });
});
