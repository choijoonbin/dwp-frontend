// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refreshMessagingPresence: vi.fn(),
  defaultTiming: { leaseTtlSeconds: 75, refreshAfterSeconds: 20 },
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  refreshMessagingPresence: mocks.refreshMessagingPresence,
  MESSAGING_PRESENCE_DEFAULT_LEASE_TIMING: mocks.defaultTiming,
  MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS: 5_000,
  MESSAGING_PRESENCE_RENEWAL_SAFETY_MARGIN_MS: 5_000,
}));

import {
  MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS,
  messagingPresenceHeartbeatDelayMs,
  useMessagingPresenceHeartbeat,
} from './use-messaging-presence-heartbeat';

function Harness({ enabled = true }: { enabled?: boolean }) {
  useMessagingPresenceHeartbeat(enabled);
  return null;
}

describe('messaging presence heartbeat', () => {
  let host: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  let visible: boolean;
  let online: boolean;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    visible = true;
    online = true;
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() =>
      visible ? 'visible' : 'hidden'
    );
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    mocks.refreshMessagingPresence.mockReset().mockResolvedValue(mocks.defaultTiming);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mounted = true;
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function render() {
    await act(async () => root.render(<Harness />));
  }

  async function dispatch(
    target: Document | Window,
    event: 'visibilitychange' | 'online' | 'offline'
  ) {
    await act(async () => {
      target.dispatchEvent(new Event(event));
    });
  }

  it('publishes immediately and every 20 seconds while visible and online', async () => {
    await render();
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);

    await act(async () =>
      vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS - 1)
    );
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
  });

  it('stops while hidden or offline and publishes immediately when eligibility returns', async () => {
    await render();

    visible = false;
    await dispatch(document, 'visibilitychange');
    await act(async () =>
      vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS * 2)
    );
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);

    visible = true;
    await dispatch(document, 'visibilitychange');
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);

    online = false;
    await dispatch(window, 'offline');
    await act(async () =>
      vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS * 2)
    );
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);

    online = true;
    await dispatch(window, 'online');
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(3);
  });

  it('allows only one in-flight heartbeat and sends nothing during unmount', async () => {
    let resolveHeartbeat: ((timing: typeof mocks.defaultTiming) => void) | undefined;
    mocks.refreshMessagingPresence.mockImplementationOnce(
      () => new Promise((resolve) => (resolveHeartbeat = resolve))
    );

    await render();
    await act(async () =>
      vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS * 3)
    );
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);

    await act(async () => resolveHeartbeat?.(mocks.defaultTiming));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
    mounted = false;
    await act(async () =>
      vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS * 2)
    );
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
  });

  it('resumes scheduling when the effect restarts during an in-flight heartbeat', async () => {
    let resolveHeartbeat: ((timing: typeof mocks.defaultTiming) => void) | undefined;
    mocks.refreshMessagingPresence.mockImplementationOnce(
      () => new Promise((resolve) => (resolveHeartbeat = resolve))
    );

    await act(async () => root.render(<Harness enabled />));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);
    await act(async () => root.render(<Harness enabled={false} />));
    await act(async () => root.render(<Harness enabled />));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);

    await act(async () => resolveHeartbeat?.(mocks.defaultTiming));
    await act(async () => vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS));

    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
  });

  it('does not double-count a pending failure across visibility changes', async () => {
    let rejectHeartbeat: ((reason: Error) => void) | undefined;
    mocks.refreshMessagingPresence.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (rejectHeartbeat = reject))
    );

    await render();
    visible = false;
    await dispatch(document, 'visibilitychange');
    visible = true;
    await dispatch(document, 'visibilitychange');
    await act(async () => rejectHeartbeat?.(new Error('temporarily unavailable')));

    await act(async () => vi.advanceTimersByTimeAsync(39_999));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
  });

  it('does not publish without an explicit Messaging VIEW entitlement', async () => {
    await act(async () => root.render(<Harness enabled={false} />));
    await act(async () =>
      vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS * 3)
    );

    expect(mocks.refreshMessagingPresence).not.toHaveBeenCalled();
  });

  it('backs off after a failure and returns to the normal interval after recovery', async () => {
    mocks.refreshMessagingPresence
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValue(mocks.defaultTiming);

    await render();
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(39_999));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);

    await act(async () => vi.advanceTimersByTimeAsync(MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(3);
  });

  it('uses the server-provided successful refresh cadence', async () => {
    mocks.refreshMessagingPresence.mockResolvedValue({
      leaseTtlSeconds: 60,
      refreshAfterSeconds: 15,
    });

    await render();
    await act(async () => vi.advanceTimersByTimeAsync(14_999));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
  });

  it('renews at the minimum compatibility cadence returned for old servers', async () => {
    mocks.refreshMessagingPresence.mockResolvedValue({
      leaseTtlSeconds: 30,
      refreshAfterSeconds: 5,
    });

    await render();
    await act(async () => vi.advanceTimersByTimeAsync(4_999));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
  });

  it('keeps the minimum compatibility lease safe across a slow success and one timeout', async () => {
    let resolveSlowSuccess: ((timing: typeof mocks.defaultTiming) => void) | undefined;
    let rejectTimedOutHeartbeat: ((reason: Error) => void) | undefined;
    mocks.refreshMessagingPresence
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSlowSuccess = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectTimedOutHeartbeat = reject;
          })
      )
      .mockResolvedValue(mocks.defaultTiming);

    await render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      resolveSlowSuccess?.({ leaseTtlSeconds: 30, refreshAfterSeconds: 5 });
    });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      rejectTimedOutHeartbeat?.(new Error('request timeout'));
    });
    await act(async () => vi.advanceTimersByTimeAsync(9_999));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(3);
  });

  it('reserves a full retry timeout before the default 75 second lease can expire', async () => {
    let rejectTimedOutHeartbeat: ((reason: Error) => void) | undefined;
    mocks.refreshMessagingPresence
      .mockResolvedValueOnce(mocks.defaultTiming)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectTimedOutHeartbeat = reject;
          })
      )
      .mockResolvedValue(mocks.defaultTiming);

    await render();
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      rejectTimedOutHeartbeat?.(new Error('request timeout'));
    });
    await act(async () => vi.advanceTimersByTimeAsync(39_999));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshMessagingPresence).toHaveBeenCalledTimes(3);
  });

  it('adds bounded jitter to heartbeat and retry delays', () => {
    expect(messagingPresenceHeartbeatDelayMs(0, () => 0)).toBe(18_000);
    expect(messagingPresenceHeartbeatDelayMs(1, () => 0.5)).toBe(40_000);
    expect(messagingPresenceHeartbeatDelayMs(10, () => 1)).toBe(60_000);
    expect(messagingPresenceHeartbeatDelayMs(0, () => 0.5, 15_000)).toBe(15_000);
  });
});
