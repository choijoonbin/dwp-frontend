import { describe, expect, it } from 'vitest';

import {
  notificationLiveChannelName,
  notificationStreamUrl,
  resolveNotificationStreamClientId,
  newestNotificationCursor,
  isNotificationConnectionRequest,
  parseNotificationConnectionChannelMessage,
  parseNotificationLiveChannelMessage,
  parseNotificationSyncResetChannelMessage,
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
});
