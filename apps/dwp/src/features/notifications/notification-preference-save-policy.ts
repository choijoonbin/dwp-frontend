import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import type {
  NotificationChannel,
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
  NotificationSubscriptionRuleInput,
  NotificationTypeSetting,
} from '@dwp-frontend/shared-utils/api/notification-api';

const CHANNELS: NotificationChannel[] = [
  'IN_APP',
  'EMAIL',
  'WEB_PUSH',
  'MOBILE_PUSH',
  'TEAMS',
  'SLACK',
];

export function isNotificationPreferenceConflict(error: unknown): boolean {
  if (!(error instanceof HttpError) || error.status !== 409) return false;
  if (!error.details || typeof error.details !== 'object') return true;
  const code = (error.details as { errorCode?: unknown }).errorCode;
  return (
    code === undefined ||
    code === 'NOTIFICATION_STALE_VERSION' ||
    code === 'NOTIFICATION_IDEMPOTENCY_CONFLICT'
  );
}

function changed<T>(base: T, attempted: T, latest: T): T {
  return Object.is(base, attempted) ? latest : attempted;
}

function changedList<T>(base: T[], attempted: T[], latest: T[]): T[] {
  return JSON.stringify(base) === JSON.stringify(attempted) ? latest : attempted;
}

/** Replays only the user's changed leaves over the latest server profile. */
export function rebaseNotificationDeliveryProfile(
  base: NotificationDeliveryProfile,
  attempted: NotificationDeliveryProfile,
  latest: NotificationDeliveryProfile
): NotificationDeliveryProfile {
  return {
    channels: Object.fromEntries(
      CHANNELS.map((channel) => [
        channel,
        changed(base.channels[channel], attempted.channels[channel], latest.channels[channel]),
      ])
    ) as NotificationDeliveryProfile['channels'],
    quietHours: {
      enabled: changed(
        base.quietHours.enabled,
        attempted.quietHours.enabled,
        latest.quietHours.enabled
      ),
      start: changed(base.quietHours.start, attempted.quietHours.start, latest.quietHours.start),
      end: changed(base.quietHours.end, attempted.quietHours.end, latest.quietHours.end),
      timeZone: changed(
        base.quietHours.timeZone,
        attempted.quietHours.timeZone,
        latest.quietHours.timeZone
      ),
      days: changedList(base.quietHours.days, attempted.quietHours.days, latest.quietHours.days),
      allowUrgentBypass: changed(
        base.quietHours.allowUrgentBypass,
        attempted.quietHours.allowUrgentBypass,
        latest.quietHours.allowUrgentBypass
      ),
    },
    digest: {
      mode: changed(base.digest.mode, attempted.digest.mode, latest.digest.mode),
      deliveryTime: changed(
        base.digest.deliveryTime,
        attempted.digest.deliveryTime,
        latest.digest.deliveryTime
      ),
      dayOfWeek: changed(
        base.digest.dayOfWeek,
        attempted.digest.dayOfWeek,
        latest.digest.dayOfWeek
      ),
    },
    presentation: {
      bannerMode: changed(
        base.presentation.bannerMode,
        attempted.presentation.bannerMode,
        latest.presentation.bannerMode
      ),
      previewMode: changed(
        base.presentation.previewMode,
        attempted.presentation.previewMode,
        latest.presentation.previewMode
      ),
    },
    version: latest.version,
    updatedAt: latest.updatedAt,
  };
}

export type NotificationRulePatch = {
  mode?: NotificationSubscriptionRuleInput['mode'];
  channel?: NotificationChannel;
  enabled?: boolean;
};

export function findNotificationTypeSetting(
  settings: NotificationEffectiveSettings,
  appKey: string,
  typeKey: string
): NotificationTypeSetting | null {
  return (
    settings.apps
      .find((app) => app.appKey === appKey)
      ?.types.find((type) => type.typeKey === typeKey) ?? null
  );
}

/** Builds a user override from the latest effective state without copying managed values. */
export function buildNotificationSubscriptionRuleInput(
  appKey: string,
  setting: NotificationTypeSetting,
  patch: NotificationRulePatch
): NotificationSubscriptionRuleInput {
  const channels: NotificationSubscriptionRuleInput['channels'] = {};
  for (const channel of CHANNELS) {
    const value = setting.channels[channel];
    if (setting.ruleId && value?.source === 'USER' && typeof value.effectiveValue === 'boolean') {
      channels[channel] = value.effectiveValue;
    }
  }
  if (patch.channel && patch.enabled !== undefined) channels[patch.channel] = patch.enabled;
  return {
    appKey,
    typeKey: setting.typeKey,
    mode: patch.mode ?? setting.mode.effectiveValue,
    channels,
    expectedVersion: setting.ruleVersion ?? undefined,
  };
}
