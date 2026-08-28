import { describe, expect, it, vi } from 'vitest';

import { createMeetingEndSynchronizer } from './meeting-end-sync';

describe('meeting end synchronization', () => {
  it('waits for the current connection confirmation before ending the meeting', async () => {
    let releaseConnection: (() => void) | undefined;
    const settleConnection = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseConnection = resolve;
        })
    );
    const endMeeting = vi.fn().mockResolvedValue({ state: 'ENDED' });
    const synchronizer = createMeetingEndSynchronizer(settleConnection, endMeeting);

    const result = synchronizer.synchronize({ sessionId: 'session-1', expectedVersion: 7 });
    await vi.waitFor(() => expect(settleConnection).toHaveBeenCalledWith('session-1'));
    expect(endMeeting).not.toHaveBeenCalled();
    releaseConnection?.();

    await expect(result).resolves.toEqual({ state: 'ENDED' });
    expect(endMeeting).toHaveBeenCalledOnce();
    expect(endMeeting).toHaveBeenCalledWith(7);
  });

  it('coalesces duplicate end commands and allows retry only after a failed end', async () => {
    const settleConnection = vi.fn().mockResolvedValue(undefined);
    const endMeeting = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary end failure'))
      .mockResolvedValueOnce({ state: 'ENDED' });
    const synchronizer = createMeetingEndSynchronizer(settleConnection, endMeeting);
    const input = { sessionId: 'session-1', expectedVersion: 7 };

    const first = synchronizer.synchronize(input);
    const duplicate = synchronizer.synchronize(input);
    expect(first).toBe(duplicate);
    await expect(first).rejects.toThrow('temporary end failure');
    await expect(synchronizer.synchronize(input)).resolves.toEqual({ state: 'ENDED' });

    expect(settleConnection).toHaveBeenCalledTimes(2);
    expect(endMeeting).toHaveBeenCalledTimes(2);
  });

  it('still permits terminal end after connection confirmation exhausts its retries', async () => {
    const settleConnection = vi.fn().mockRejectedValue(new Error('attendance sync failed'));
    const endMeeting = vi.fn().mockResolvedValue({ state: 'ENDED' });
    const synchronizer = createMeetingEndSynchronizer(settleConnection, endMeeting);

    await expect(
      synchronizer.synchronize({ sessionId: 'session-1', expectedVersion: 7 })
    ).resolves.toEqual({ state: 'ENDED' });
    expect(endMeeting).toHaveBeenCalledWith(7);
  });
});
