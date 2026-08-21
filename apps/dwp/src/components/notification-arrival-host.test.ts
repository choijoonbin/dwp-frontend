import { describe, expect, it } from 'vitest';
import type {
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
  NotificationItem,
} from '@dwp-frontend/shared-utils/api/notification-api';

import {
  isNotificationTargetActive,
  registerNotificationActiveContexts,
} from './notification-active-context';
import {
  isAssertiveNotificationArrival,
  isPersistentNotificationArrival,
  isQuietHoursActive,
  notificationArrivalContent,
  shouldSurfaceNotificationArrival,
} from './notification-arrival-policy';

const messagingItem = {
  notificationId: 'notification-1',
  threadKey: 'messaging-conversation:conversation-42',
  threadCount: 1,
  source: { appKey: 'messaging', appName: 'Messaging' },
  typeKey: 'MESSAGING.DIRECT_MESSAGE',
  title: 'New message',
  preview: 'Review the plan',
  priority: 'NORMAL',
  reason: { kind: 'DIRECT', label: 'Direct' },
  receivedAt: '2026-08-20T01:00:00Z',
  lastActivityAt: '2026-08-20T01:00:00Z',
  readAt: null,
  savedAt: null,
  completedAt: null,
  snoozedUntil: null,
  actionable: false,
  sensitive: false,
  actions: [
    {
      actionKey: 'OPEN',
      label: 'Open',
      href: '/messages/direct?conversation=conversation-42&message=message-7',
      enabled: true,
      primary: true,
    },
  ],
  version: '1',
} satisfies NotificationItem;

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
    enabled: false,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Seoul',
    days: [1, 2, 3, 4, 5, 6, 7],
    allowUrgentBypass: true,
  },
  digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
  presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
  version: '1',
  updatedAt: '2026-08-20T00:00:00Z',
} satisfies NotificationDeliveryProfile;

const effectiveSettings = {
  partial: false,
  unavailableSources: [],
  globalChannels: {},
  apps: [
    {
      appKey: 'messaging',
      appName: 'Messaging',
      types: [
        {
          typeKey: 'MESSAGING.DIRECT_MESSAGE',
          typeName: 'Direct message',
          mode: {
            effectiveValue: 'IMMEDIATE',
            source: 'SYSTEM_DEFAULT',
            managed: false,
            exceptionAllowed: true,
          },
          channels: {},
          mandatory: false,
          quietHoursBypass: false,
        },
      ],
    },
  ],
  generatedAt: '2026-08-20T00:00:00Z',
} satisfies NotificationEffectiveSettings;

describe('notification arrival target suppression', () => {
  it('suppresses an arrival only while an app registers the same active context', () => {
    const unregister = registerNotificationActiveContexts([
      'messaging-conversation:conversation-42',
    ]);
    expect(isNotificationTargetActive(messagingItem, true)).toBe(true);
    expect(
      isNotificationTargetActive(
        { ...messagingItem, threadKey: 'messaging-conversation:conversation-99' },
        true
      )
    ).toBe(false);
    expect(isNotificationTargetActive(messagingItem, false)).toBe(false);
    unregister();
    expect(isNotificationTargetActive(messagingItem, true)).toBe(false);
  });
});

describe('notification arrival policy', () => {
  it('fails closed until both personal and effective policy are authoritative', () => {
    expect(shouldSurfaceNotificationArrival(messagingItem, undefined, effectiveSettings)).toBe(
      false
    );
    expect(shouldSurfaceNotificationArrival(messagingItem, profile, undefined)).toBe(false);
    expect(
      shouldSurfaceNotificationArrival(messagingItem, profile, {
        ...effectiveSettings,
        partial: true,
      })
    ).toBe(false);
    expect(notificationArrivalContent(messagingItem, undefined, 'Protected notification')).toEqual({
      title: 'Protected notification',
      preview: null,
    });
  });

  it('handles overnight focus hours in the configured time zone', () => {
    const quietHours = { ...profile.quietHours, enabled: true, days: [3] };

    expect(isQuietHoursActive(quietHours, new Date('2026-08-19T14:30:00Z'))).toBe(true);
    expect(isQuietHoursActive(quietHours, new Date('2026-08-19T21:30:00Z'))).toBe(true);
    expect(isQuietHoursActive(quietHours, new Date('2026-08-20T08:00:00Z'))).toBe(false);
  });

  it('keeps the inbox item but suppresses live interruption during focus hours', () => {
    const focused = {
      ...profile,
      quietHours: { ...profile.quietHours, enabled: true },
    } satisfies NotificationDeliveryProfile;

    expect(
      shouldSurfaceNotificationArrival(
        messagingItem,
        focused,
        effectiveSettings,
        new Date('2026-08-19T14:30:00Z')
      )
    ).toBe(false);
  });

  it('allows an urgent bypass and suppresses digest-mode arrivals', () => {
    const urgent = { ...messagingItem, priority: 'URGENT' as const };
    const focused = {
      ...profile,
      quietHours: { ...profile.quietHours, enabled: true },
    } satisfies NotificationDeliveryProfile;
    expect(
      shouldSurfaceNotificationArrival(
        urgent,
        focused,
        effectiveSettings,
        new Date('2026-08-19T14:30:00Z')
      )
    ).toBe(true);

    const digestSettings: NotificationEffectiveSettings = structuredClone(effectiveSettings);
    digestSettings.apps[0].types[0].mode.effectiveValue = 'DAILY_DIGEST';
    expect(shouldSurfaceNotificationArrival(messagingItem, profile, digestSettings)).toBe(false);
  });

  it('honors high-priority-only banners and protects sensitive content', () => {
    const priorityOnly = {
      ...profile,
      presentation: { ...profile.presentation, bannerMode: 'HIGH_PRIORITY_ONLY' as const },
    };
    const passive = {
      ...messagingItem,
      reason: { kind: 'SUBSCRIPTION' as const, label: 'Subscribed' },
      priority: 'NORMAL' as const,
      actionable: false,
    };
    expect(shouldSurfaceNotificationArrival(passive, priorityOnly, effectiveSettings)).toBe(false);

    expect(
      notificationArrivalContent(
        { ...messagingItem, sensitive: true },
        profile,
        'Protected notification'
      )
    ).toEqual({ title: 'Protected notification', preview: null });
  });

  it('keeps urgent arrivals persistent but reserves assertive announcements for critical types', () => {
    const urgentMessage = { ...messagingItem, priority: 'URGENT' as const };
    const urgentSecurity = {
      ...urgentMessage,
      source: { appKey: 'security', appName: 'Security' },
      typeKey: 'SECURITY.ACCOUNT_COMPROMISE',
    };

    expect(isPersistentNotificationArrival(urgentMessage)).toBe(true);
    expect(isAssertiveNotificationArrival(urgentMessage)).toBe(false);
    expect(isAssertiveNotificationArrival(urgentSecurity)).toBe(true);
  });
});
