import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  NotificationChangeVersion,
  NotificationCounterVersion,
  NotificationPartialState,
} from './notification-contract';

const NOTIFICATION_API_BASE = '/api/notifications/v1';

export type NotificationView = 'PRIORITY' | 'ALL' | 'MENTIONS' | 'SAVED' | 'SNOOZED' | 'DONE';

export type NotificationViewCounts = Record<NotificationView, number>;

export type NotificationSummary = NotificationPartialState & {
  actionableUnread: number;
  totalUnread: number;
  viewCounts: NotificationViewCounts;
  changeVersion: NotificationChangeVersion;
  counterVersion: NotificationCounterVersion;
  generatedAt: string;
};

export function getNotificationSummary(signal?: AbortSignal): Promise<NotificationSummary> {
  return axiosInstance
    .get<ApiResponse<NotificationSummary>>(`${NOTIFICATION_API_BASE}/summary`, { signal })
    .then((response) => response.data.data);
}
