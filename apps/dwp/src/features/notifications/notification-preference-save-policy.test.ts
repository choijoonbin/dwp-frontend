import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import {
  buildNotificationSubscriptionRuleInput,
  findNotificationTypeSetting,
  isNotificationPreferenceConflict,
  rebaseNotificationDeliveryProfile,
} from './notification-preference-save-policy';

import type {
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
  NotificationTypeSetting,
} from '@dwp-frontend/shared-utils/api/notification-api';

function profile(
  overrides: Partial<NotificationDeliveryProfile> = {}
): NotificationDeliveryProfile {
  return {
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
      days: [1, 2, 3, 4, 5],
      allowUrgentBypass: true,
    },
    digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
    presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
    version: '1',
    updatedAt: '2026-08-24T00:00:00Z',
    ...overrides,
  };
}

describe('notification preference conflict recovery', () => {
  it('recognizes governed stale-version conflicts without masking other errors', () => {
    expect(
      isNotificationPreferenceConflict(
        new HttpError('stale', 409, { errorCode: 'NOTIFICATION_STALE_VERSION' })
      )
    ).toBe(true);
    expect(isNotificationPreferenceConflict(new HttpError('forbidden', 403))).toBe(false);
  });

  it('replays only the local change over the latest server profile', () => {
    const base = profile();
    const attempted = profile({
      presentation: { ...base.presentation, bannerMode: 'OFF' },
    });
    const latest = profile({
      channels: { ...base.channels, EMAIL: true },
      quietHours: { ...base.quietHours, enabled: true },
      version: '4',
      updatedAt: '2026-08-24T00:05:00Z',
    });

    const rebased = rebaseNotificationDeliveryProfile(base, attempted, latest);

    expect(rebased.presentation.bannerMode).toBe('OFF');
    expect(rebased.channels.EMAIL).toBe(true);
    expect(rebased.quietHours.enabled).toBe(true);
    expect(rebased.version).toBe('4');
  });

  it('rebuilds a conflicted rule from the latest user-owned leaves only', () => {
    const setting: NotificationTypeSetting = {
      typeKey: 'MESSAGING.DIRECT_MESSAGE',
      typeName: 'Direct message',
      mode: {
        effectiveValue: 'IMMEDIATE',
        source: 'TENANT_POLICY',
        managed: false,
        exceptionAllowed: true,
      },
      channels: {
        IN_APP: {
          effectiveValue: true,
          source: 'USER',
          managed: false,
          exceptionAllowed: true,
        },
        EMAIL: {
          effectiveValue: true,
          source: 'TENANT_POLICY',
          managed: true,
          exceptionAllowed: false,
        },
      },
      mandatory: false,
      quietHoursBypass: false,
      ruleId: 'rule-2',
      ruleVersion: '7',
    };
    const effective = {
      apps: [{ appKey: 'messaging', appName: 'Messaging', types: [setting] }],
    } as NotificationEffectiveSettings;

    expect(findNotificationTypeSetting(effective, 'messaging', setting.typeKey)).toBe(setting);
    expect(
      buildNotificationSubscriptionRuleInput('messaging', setting, {
        channel: 'IN_APP',
        enabled: false,
      })
    ).toEqual({
      appKey: 'messaging',
      typeKey: setting.typeKey,
      mode: 'IMMEDIATE',
      channels: { IN_APP: false },
      expectedVersion: '7',
    });
  });
});
