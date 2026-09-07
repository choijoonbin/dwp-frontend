import type {
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
  NotificationItem,
  NotificationLiveSignal,
  NotificationQuietHours,
  NotificationTypeSetting,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { resolveZonedClock } from '@dwp-frontend/shared-i18n';

export type NotificationArrivalContent = {
  title: string;
  preview: string | null;
};

export type NotificationArrival = {
  item: NotificationItem;
  href: string | null;
};

export const MAXIMUM_PERSISTENT_NOTIFICATION_ARRIVALS = 3;

export function upsertPersistentNotificationArrival(
  current: NotificationArrival[],
  arrival: NotificationArrival,
  maximumSize = MAXIMUM_PERSISTENT_NOTIFICATION_ARRIVALS
): NotificationArrival[] {
  const boundedSize = Math.max(1, maximumSize);
  const existingIndex = current.findIndex(
    ({ item }) => item.notificationId === arrival.item.notificationId
  );
  if (existingIndex >= 0) {
    return current.map((queued, index) => (index === existingIndex ? arrival : queued));
  }
  const queued = [...current, arrival];
  if (queued.length <= boundedSize) return queued;
  if (boundedSize === 1) return [queued[0]!];
  return [queued[0]!, ...queued.slice(-(boundedSize - 1))];
}

export function notificationArrivalSignalKey(
  changeVersion: string,
  notificationId: string
): string {
  return `${changeVersion}:${notificationId}`;
}

export function notificationArrivalCandidateIds(signal: NotificationLiveSignal): string[] {
  return signal.arrivalIds;
}

function typeSetting(
  item: NotificationItem,
  effectiveSettings?: NotificationEffectiveSettings
): NotificationTypeSetting | undefined {
  return effectiveSettings?.apps
    .find((app) => app.appKey === item.source.appKey)
    ?.types.find((type) => type.typeKey === item.typeKey);
}

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isQuietHoursActive(quietHours: NotificationQuietHours, now = new Date()): boolean {
  if (!quietHours.enabled || quietHours.days.length === 0) return false;
  const clock = resolveZonedClock(now, quietHours.timeZone);
  const start = minutes(quietHours.start);
  const end = minutes(quietHours.end);
  if (!clock || start == null || end == null) return false;
  const currentMinute = clock.hour * 60 + clock.minute;

  const selected = new Set(quietHours.days);
  if (start === end) return selected.has(clock.day);
  if (start < end) {
    return selected.has(clock.day) && currentMinute >= start && currentMinute < end;
  }

  const previousDay = clock.day === 1 ? 7 : clock.day - 1;
  return (
    (selected.has(clock.day) && currentMinute >= start) ||
    (selected.has(previousDay) && currentMinute < end)
  );
}

export function shouldSurfaceNotificationArrival(
  item: NotificationItem | null | undefined,
  profile?: NotificationDeliveryProfile,
  effectiveSettings?: NotificationEffectiveSettings,
  now = new Date()
): boolean {
  // Arrival banners are a passive surface. Do not expose content until both the
  // user's privacy choices and the tenant's effective policy are authoritative.
  if (!item || !profile || !effectiveSettings || effectiveSettings.partial) return false;
  if (item.readAt || item.completedAt || item.snoozedUntil) return false;
  if (!profile.channels.IN_APP) return false;

  const setting = typeSetting(item, effectiveSettings);
  if (setting && setting.mode.effectiveValue !== 'IMMEDIATE') return false;

  if (profile.presentation.bannerMode === 'OFF') return false;
  if (
    profile.presentation.bannerMode === 'HIGH_PRIORITY_ONLY' &&
    item.priority !== 'URGENT' &&
    item.priority !== 'HIGH' &&
    !item.actionable
  ) {
    return false;
  }

  if (isQuietHoursActive(profile.quietHours, now)) {
    const policyBypass = setting?.quietHoursBypass ?? false;
    const urgentBypass = item.priority === 'URGENT' && profile.quietHours.allowUrgentBypass;
    if (!policyBypass && !urgentBypass) return false;
  }

  if (profile.presentation.bannerMode === 'HIGH_PRIORITY_ONLY') return true;
  if (item.reason.kind === 'DIRECT' || item.reason.kind === 'MENTION') return true;
  return item.actionable || item.priority === 'URGENT' || item.priority === 'HIGH';
}

export function notificationArrivalContent(
  item: NotificationItem,
  profile: NotificationDeliveryProfile | undefined,
  protectedTitle: string
): NotificationArrivalContent {
  const previewMode = profile?.presentation.previewMode ?? 'HIDDEN';
  if (item.sensitive || previewMode === 'HIDDEN') {
    return { title: protectedTitle, preview: null };
  }
  return {
    title: item.title,
    preview: previewMode === 'FULL' ? (item.preview ?? null) : null,
  };
}

export function isPersistentNotificationArrival(item: NotificationItem): boolean {
  return item.priority === 'URGENT';
}

export function isAssertiveNotificationArrival(item: NotificationItem): boolean {
  return item.priority === 'URGENT' && item.interruptionLevel === 'CRITICAL';
}
