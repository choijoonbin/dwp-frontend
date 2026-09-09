import { describe, expect, it } from 'vitest';

import { resolveNotificationDeliveryStatus } from './notification-delivery-status-model';

import type {
  NotificationCapabilities,
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
} from '@dwp-frontend/shared-utils/api/notification-api';

const profile = {
  channels: {
    IN_APP: true,
    EMAIL: false,
    WEB_PUSH: false,
    MOBILE_PUSH: false,
    TEAMS: false,
    SLACK: false,
  },
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Seoul',
    days: [1, 2, 3, 4, 5],
    allowUrgentBypass: true,
  },
  digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
  presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
  version: '1',
  updatedAt: '2026-09-08T10:00:00Z',
} satisfies NotificationDeliveryProfile;

const capabilities = {
  enabledChannels: ['IN_APP'],
  unavailableChannels: ['EMAIL', 'WEB_PUSH', 'MOBILE_PUSH', 'TEAMS', 'SLACK'],
  canonicalStore: 'POSTGRESQL',
  realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
  externalDeliveryState: 'DISABLED',
  generatedAt: '2026-09-08T10:00:00Z',
} satisfies NotificationCapabilities;

const effectiveSettings = {
  partial: false,
  unavailableSources: [],
  globalChannels: {
    IN_APP: { effectiveValue: true, source: 'USER', managed: false, exceptionAllowed: true },
  },
  apps: [],
  generatedAt: '2026-09-08T10:00:00Z',
} satisfies NotificationEffectiveSettings;

describe('notification delivery status', () => {
  it('reports an honest in-app-only ready state', () => {
    expect(
      resolveNotificationDeliveryStatus({ capabilities, profile, effectiveSettings })
    ).toMatchObject({
      state: 'READY',
      inAppEnabled: true,
      externalDeliveryEnabled: false,
      externalChannels: [],
      enabledChannels: ['IN_APP'],
      unavailableChannels: ['EMAIL', 'WEB_PUSH', 'MOBILE_PUSH', 'TEAMS', 'SLACK'],
      canonicalStore: 'POSTGRESQL',
      realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
      quietHoursEnabled: true,
      policyState: 'CURRENT',
    });
  });

  it('does not report readiness before capabilities are known', () => {
    expect(resolveNotificationDeliveryStatus({ profile })).toMatchObject({
      state: 'CHECKING',
      inAppEnabled: null,
      externalDeliveryEnabled: null,
    });
  });

  it('surfaces partial or unavailable policy composition without disabling the inbox claim', () => {
    expect(
      resolveNotificationDeliveryStatus({ capabilities, profile, effectiveSettingsFailed: true })
    ).toMatchObject({ state: 'PARTIAL', inAppEnabled: true, policyState: 'UNAVAILABLE' });
    expect(
      resolveNotificationDeliveryStatus({
        capabilities,
        profile,
        effectiveSettings: { ...effectiveSettings, partial: true },
      })
    ).toMatchObject({ state: 'PARTIAL', policyState: 'PARTIAL' });
  });
});
