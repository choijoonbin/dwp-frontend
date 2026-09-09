import type {
  NotificationCapabilities,
  NotificationChannel,
  NotificationDeliveryProfile,
  NotificationEffectiveSettings,
} from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationDeliveryStatusState = 'CHECKING' | 'READY' | 'BLOCKED' | 'PARTIAL';

export type NotificationDeliveryStatus = {
  state: NotificationDeliveryStatusState;
  inAppEnabled: boolean | null;
  externalChannels: NotificationChannel[];
  externalDeliveryEnabled: boolean | null;
  quietHoursEnabled: boolean;
  digestMode: NotificationDeliveryProfile['digest']['mode'];
  policyState: 'CHECKING' | 'CURRENT' | 'PARTIAL' | 'UNAVAILABLE';
  enabledChannels: NotificationChannel[];
  unavailableChannels: NotificationChannel[];
  canonicalStore?: NotificationCapabilities['canonicalStore'];
  realtimeTransport?: NotificationCapabilities['realtimeTransport'];
  generatedAt?: string;
};

export function resolveNotificationDeliveryStatus({
  capabilities,
  profile,
  effectiveSettings,
  effectiveSettingsFailed = false,
}: {
  capabilities?: NotificationCapabilities;
  profile: NotificationDeliveryProfile;
  effectiveSettings?: NotificationEffectiveSettings;
  effectiveSettingsFailed?: boolean;
}): NotificationDeliveryStatus {
  const inAppEnabled = capabilities
    ? capabilities.enabledChannels.includes('IN_APP') &&
      (effectiveSettings?.globalChannels.IN_APP?.effectiveValue ?? profile.channels.IN_APP)
    : null;
  const externalChannels = capabilities
    ? capabilities.enabledChannels.filter((channel) => channel !== 'IN_APP')
    : [];
  const policyState = effectiveSettingsFailed
    ? 'UNAVAILABLE'
    : !effectiveSettings
      ? 'CHECKING'
      : effectiveSettings.partial
        ? 'PARTIAL'
        : 'CURRENT';
  const state =
    inAppEnabled == null || policyState === 'CHECKING'
      ? 'CHECKING'
      : !inAppEnabled
        ? 'BLOCKED'
        : policyState === 'PARTIAL' || policyState === 'UNAVAILABLE'
          ? 'PARTIAL'
          : 'READY';

  return {
    state,
    inAppEnabled,
    externalChannels,
    externalDeliveryEnabled: capabilities ? capabilities.externalDeliveryState === 'ENABLED' : null,
    quietHoursEnabled: profile.quietHours.enabled,
    digestMode: profile.digest.mode,
    policyState,
    enabledChannels: capabilities?.enabledChannels ?? [],
    unavailableChannels: capabilities?.unavailableChannels ?? [],
    canonicalStore: capabilities?.canonicalStore,
    realtimeTransport: capabilities?.realtimeTransport,
    generatedAt: effectiveSettings?.generatedAt ?? capabilities?.generatedAt,
  };
}
