import { describe, expect, it } from 'vitest';

import {
  notificationLiveChannelName,
  parseNotificationLiveChannelMessage,
} from './notification-live-bridge';

describe('notification live bridge boundary', () => {
  it('isolates browser coordination by tenant', () => {
    expect(notificationLiveChannelName('1')).toBe('dwp:notification-live:v1:1');
    expect(notificationLiveChannelName('2')).not.toBe(notificationLiveChannelName('1'));
    expect(() => notificationLiveChannelName('  ')).toThrow('tenant ID');
  });

  it('relays only content-free version hints', () => {
    const notificationId = '93af7315-2271-462e-a819-3d238a28830f';
    expect(
      parseNotificationLiveChannelMessage({
        kind: 'notification.changed',
        signal: { changeVersion: '42', counterVersion: '9', changedIds: [notificationId] },
      })
    ).toEqual({ changeVersion: '42', counterVersion: '9', changedIds: [notificationId] });
    expect(
      parseNotificationLiveChannelMessage({
        kind: 'notification.changed',
        signal: { changeVersion: '42', changedIds: [], title: 'must never cross tabs' },
      })
    ).toBeNull();
    expect(parseNotificationLiveChannelMessage({ kind: 'other', signal: {} })).toBeNull();
  });
});
