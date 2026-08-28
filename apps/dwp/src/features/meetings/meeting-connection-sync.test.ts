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
});
