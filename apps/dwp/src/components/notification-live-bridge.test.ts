import { describe, expect, it } from 'vitest';

import {
  notificationLiveChannelName,
  notificationStreamUrl,
  notificationStreamCoordinationMode,
  resolveNotificationStreamClientId,
  createNotificationReconnectPolicy,
  notificationRetryAfterDelay,
  newestNotificationCursor,
  isNotificationConnectionRequest,
  parseNotificationConnectionChannelMessage,
  parseNotificationCursorChannelMessage,
  parseNotificationLiveChannelMessage,
  parseNotificationSyncResetChannelMessage,
  runNotificationStreamCoordination,
  shouldAttemptNotificationStream,
  waitForNotificationOnline,
  type NotificationExclusiveLockRequest,
} from './notification-live-bridge';

describe('notification live bridge boundary', () => {
  it('isolates browser coordination by tenant and authenticated user', () => {
    expect(notificationLiveChannelName('1', 900018)).toBe('dwp:notification-live:v2:1:900018');
    expect(notificationLiveChannelName('2', 900018)).not.toBe(
      notificationLiveChannelName('1', 900018)
    );
    expect(notificationLiveChannelName('1', 900019)).not.toBe(
      notificationLiveChannelName('1', 900018)
    );
    expect(() => notificationLiveChannelName('  ', 900018)).toThrow('Tenant and user IDs');
    expect(() => notificationLiveChannelName('1', '')).toThrow('Tenant and user IDs');
  });

  it('relays only content-free version hints', () => {
    const notificationId = '93af7315-2271-462e-a819-3d238a28830f';
    expect(
      parseNotificationLiveChannelMessage({
        kind: 'notification.changed',
        signal: {
          changeVersion: '42',
          counterVersion: '9',
          changedIds: [notificationId],
          arrivalIds: [notificationId],
        },
      })
    ).toEqual({
      changeVersion: '42',
      counterVersion: '9',
      changedIds: [notificationId],
      arrivalIds: [notificationId],
    });
    expect(
      parseNotificationLiveChannelMessage({
        kind: 'notification.changed',
        signal: { changeVersion: '42', changedIds: [], title: 'must never cross tabs' },
      })
    ).toBeNull();
    expect(parseNotificationLiveChannelMessage({ kind: 'other', signal: {} })).toBeNull();
  });

  it('relays and validates the connected cursor without notification content', () => {
    expect(
      parseNotificationCursorChannelMessage({
        kind: 'notification.cursor',
        changeVersion: '42',
      })
    ).toBe('42');
    expect(
      parseNotificationCursorChannelMessage({
        kind: 'notification.cursor',
        changeVersion: '-1',
      })
    ).toBeNull();
    expect(
      parseNotificationCursorChannelMessage({
        kind: 'notification.cursor',
        changeVersion: 42,
      })
    ).toBeNull();
    expect(
      parseNotificationCursorChannelMessage({
        kind: 'notification.cursor',
        changeVersion: '42',
        title: 'must never cross tabs',
      })
    ).toBeNull();
  });

  it('relays a governed cursor reset without notification content', () => {
    expect(
      parseNotificationSyncResetChannelMessage({
        kind: 'notification.sync-reset',
        signal: { errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED' },
      })
    ).toEqual({ errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED' });
    expect(
      parseNotificationSyncResetChannelMessage({
        kind: 'notification.sync-reset',
        signal: {
          errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED',
          title: 'must never cross tabs',
        },
      })
    ).toBeNull();
  });

  it('coordinates connection state without notification content', () => {
    expect(
      parseNotificationConnectionChannelMessage({
        kind: 'notification.connection',
        signal: { state: 'live' },
      })
    ).toEqual({ state: 'live' });
    expect(
      parseNotificationConnectionChannelMessage({
        kind: 'notification.connection',
        signal: { state: 'live', title: 'must never cross tabs' },
      })
    ).toBeNull();
    expect(isNotificationConnectionRequest({ kind: 'notification.connection-request' })).toBe(true);
    expect(
      isNotificationConnectionRequest({ kind: 'notification.connection-request', cursor: '1' })
    ).toBe(false);
  });

  it('reconnects with the greatest decimal cursor without JavaScript precision loss', () => {
    expect(newestNotificationCursor(null, '9007199254740993')).toBe('9007199254740993');
    expect(newestNotificationCursor('9007199254740993', '9007199254740992')).toBe(
      '9007199254740993'
    );
    expect(newestNotificationCursor('9007199254740993', '9007199254740994')).toBe(
      '9007199254740994'
    );
    expect(notificationStreamUrl(null)).toBe('/api/notifications/v1/stream');
    expect(notificationStreamUrl('9007199254740994', '42000000-0000-4000-8000-000000000001')).toBe(
      '/api/notifications/v1/stream?clientId=42000000-0000-4000-8000-000000000001&after=9007199254740994'
    );
  });

  it('keeps one stable stream identity across reconnects and runtime remounts', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const first = '42000000-0000-4000-8000-000000000002';
    const second = '42000000-0000-4000-8000-000000000003';

    expect(
      resolveNotificationStreamClientId('notification-client-test', storage, () => first)
    ).toBe(first);
    expect(
      resolveNotificationStreamClientId('notification-client-test', storage, () => second)
    ).toBe(first);
    expect(values.get('notification-client-test')).toBe(first);
  });

  it('rejects malformed generated stream identities', () => {
    expect(() =>
      resolveNotificationStreamClientId('invalid-client-test', null, () => 'bad')
    ).toThrow('must be a UUID');
  });

  it('elects one profile leader only when locks and cross-tab messaging are both available', () => {
    expect(notificationStreamCoordinationMode(true, true)).toBe('profile-leader');
    expect(notificationStreamCoordinationMode(true, false)).toBe('per-tab');
    expect(notificationStreamCoordinationMode(false, true)).toBe('per-tab');
    expect(notificationStreamCoordinationMode(false, false)).toBe('per-tab');
  });

  it('keeps a hidden elected leader connected but gates attempts while offline', () => {
    expect(shouldAttemptNotificationStream(true, 'visible')).toBe(true);
    expect(shouldAttemptNotificationStream(true, 'hidden')).toBe(true);
    expect(shouldAttemptNotificationStream(false, 'visible')).toBe(false);
    expect(shouldAttemptNotificationStream(false, 'hidden')).toBe(false);
  });

  it('applies deterministic bounded reconnect backoff and resets only after a stable connection', () => {
    const policy = createNotificationReconnectPolicy(() => 0.5);

    expect(policy.nextDelay()).toBe(1_000);
    expect(policy.nextDelay()).toBe(2_000);
    expect(policy.nextDelay()).toBe(4_000);
    expect(policy.currentBaseDelay()).toBe(8_000);

    policy.markConnectionOpened(1_000);
    policy.markConnectionClosed(1_100);
    expect(policy.nextDelay()).toBe(8_000);

    policy.markConnectionOpened(20_000);
    policy.markConnectionClosed(30_000);
    expect(policy.currentBaseDelay()).toBe(1_000);

    for (let index = 0; index < 10; index += 1) policy.nextDelay();
    expect(policy.currentBaseDelay()).toBe(30_000);
    expect(policy.nextDelay()).toBe(30_000);

    policy.markCursorReset();
    expect(policy.nextDelay()).toBe(1_000);

    const maximumJitter = createNotificationReconnectPolicy(() => 1);
    for (let index = 0; index < 10; index += 1) maximumJitter.nextDelay();
    expect(maximumJitter.nextDelay()).toBe(30_000);
  });

  it('prioritizes bounded Retry-After seconds and HTTP dates for 429 reconnects', () => {
    const now = Date.parse('2026-10-28T10:00:00Z');
    const retryError = (value: string, status = 429) => ({
      status,
      headers: new Headers({ 'Retry-After': value }),
    });

    expect(notificationRetryAfterDelay(retryError('17'), now)).toBe(17_000);
    expect(notificationRetryAfterDelay(retryError('Wed, 28 Oct 2026 10:00:12 GMT'), now)).toBe(
      12_000
    );
    expect(notificationRetryAfterDelay(retryError('120'), now)).toBe(120_000);
    expect(notificationRetryAfterDelay(retryError('600'), now)).toBe(300_000);
    expect(notificationRetryAfterDelay(retryError('Wed, 28 Oct 2026 09:59:59 GMT'), now)).toBe(
      1_000
    );
    expect(notificationRetryAfterDelay(retryError('invalid'), now)).toBeNull();
    expect(notificationRetryAfterDelay(retryError('17', 503), now)).toBeNull();

    const policy = createNotificationReconnectPolicy(() => 0.5);
    expect(policy.nextDelay(notificationRetryAfterDelay(retryError('17'), now))).toBe(17_000);
    expect(policy.currentBaseDelay()).toBe(2_000);
  });

  it('hands the exclusive profile stream to the next tab after leader abort and release', async () => {
    let previousOwner = Promise.resolve();
    const requestExclusiveLock: NotificationExclusiveLockRequest = async (
      _name,
      _signal,
      runOwner
    ) => {
      const acquire = previousOwner;
      let release: () => void = () => undefined;
      previousOwner = new Promise<void>((resolve) => {
        release = resolve;
      });
      await acquire;
      try {
        await runOwner();
      } finally {
        release();
      }
    };
    const order: string[] = [];
    let peerCursor: string | null = null;
    const runOwner = (tab: string, signal: AbortSignal) => async () => {
      order.push(`${tab}:acquired`);
      if (tab === 'first') {
        const relayed = parseNotificationCursorChannelMessage({
          kind: 'notification.cursor',
          changeVersion: '42',
        });
        if (relayed) peerCursor = newestNotificationCursor(peerCursor, relayed);
      } else {
        order.push(`${tab}:cursor:${peerCursor}`);
      }
      await new Promise<void>((resolve) => {
        const release = () => {
          order.push(`${tab}:released`);
          resolve();
        };
        if (signal.aborted) release();
        else signal.addEventListener('abort', release, { once: true });
      });
    };
    const first = new AbortController();
    const second = new AbortController();

    const firstRun = runNotificationStreamCoordination(
      requestExclusiveLock,
      true,
      'notification-profile',
      first.signal,
      runOwner('first', first.signal)
    );
    const secondRun = runNotificationStreamCoordination(
      requestExclusiveLock,
      true,
      'notification-profile',
      second.signal,
      runOwner('second', second.signal)
    );
    await Promise.resolve();
    expect(order).toEqual(['first:acquired']);

    first.abort();
    await firstRun;
    await Promise.resolve();
    expect(order).toEqual([
      'first:acquired',
      'first:released',
      'second:acquired',
      'second:cursor:42',
    ]);

    second.abort();
    await secondRun;
    expect(order).toEqual([
      'first:acquired',
      'first:released',
      'second:acquired',
      'second:cursor:42',
      'second:released',
    ]);
  });

  it('waits without reconnect churn until online and releases promptly on abort', async () => {
    const events = new EventTarget();
    let online = false;
    const controller = new AbortController();
    let resolved = false;
    const waiting = waitForNotificationOnline(controller.signal, () => online, events).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    events.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(resolved).toBe(false);

    online = true;
    events.dispatchEvent(new Event('online'));
    await waiting;
    expect(resolved).toBe(true);

    const aborted = new AbortController();
    const abortWaiting = waitForNotificationOnline(aborted.signal, () => false, events);
    aborted.abort();
    await expect(abortWaiting).resolves.toBeUndefined();
  });
});
