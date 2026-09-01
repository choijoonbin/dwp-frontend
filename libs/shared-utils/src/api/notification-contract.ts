export type NotificationDecimalVersion = string;
export type NotificationChangeVersion = NotificationDecimalVersion;
export type NotificationCounterVersion = NotificationDecimalVersion;
export type NotificationEntityVersion = NotificationDecimalVersion;

export type NotificationPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export type NotificationChannel =
  'IN_APP' | 'EMAIL' | 'WEB_PUSH' | 'MOBILE_PUSH' | 'TEAMS' | 'SLACK';

export type NotificationDeliveryMode = 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST' | 'MUTED';

export type NotificationPartialState = {
  partial: boolean;
  unavailableSources: string[];
  message?: string | null;
};
