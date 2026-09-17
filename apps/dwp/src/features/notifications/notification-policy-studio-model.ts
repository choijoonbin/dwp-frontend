import type {
  NotificationChannel,
  NotificationPolicyChannelRule,
  TenantNotificationPolicy,
} from '@dwp-frontend/shared-utils/api/notification-api';

const POLICY_CHANNELS: readonly NotificationChannel[] = [
  'IN_APP',
  'EMAIL',
  'WEB_PUSH',
  'MOBILE_PUSH',
  'TEAMS',
  'SLACK',
];

export const DEFAULT_NOTIFICATION_POLICY_CHANNELS: NotificationPolicyChannelRule[] =
  POLICY_CHANNELS.map((channel) => ({
    channel,
    enabled: channel === 'IN_APP',
    defaultMode: 'IMMEDIATE',
    userOverridable: channel === 'IN_APP',
    maxPerWindow: channel === 'IN_APP' ? 100 : null,
  }));

export function editableNotificationPolicyChannels(
  policy: TenantNotificationPolicy
): NotificationPolicyChannelRule[] {
  const indexed = new Map(policy.channels.map((channel) => [channel.channel, channel]));
  return DEFAULT_NOTIFICATION_POLICY_CHANNELS.map((fallback) => ({
    ...fallback,
    ...indexed.get(fallback.channel),
  }));
}

export function notificationPolicySourceTone(
  source: TenantNotificationPolicy['source']
): 'default' | 'info' {
  return source === 'PROVIDER_POLICY' ? 'info' : 'default';
}
