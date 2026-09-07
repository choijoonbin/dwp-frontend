import type {
  NotificationPriority,
  NotificationReasonKind,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export type CenterFilters = {
  query: string;
  appKey: string;
  priority: NotificationPriority | 'ALL';
  readState: 'ALL' | 'UNREAD' | 'READ';
  reason: NotificationReasonKind | 'ALL';
};

export type NotificationCenterScope = CenterFilters & { view: NotificationView };

export const EMPTY_NOTIFICATION_FILTERS: CenterFilters = {
  query: '',
  appKey: '',
  priority: 'ALL',
  readState: 'ALL',
  reason: 'ALL',
};

export const NOTIFICATION_REASONS: readonly NotificationReasonKind[] = [
  'MENTION',
  'DIRECT',
  'ROLE',
  'ORGANIZATION',
  'SUBSCRIPTION',
  'MANDATORY_POLICY',
];

export function hasNotificationFilters(filters: CenterFilters): boolean {
  return Boolean(
    filters.query.trim() ||
    filters.appKey ||
    filters.priority !== 'ALL' ||
    filters.readState !== 'ALL' ||
    filters.reason !== 'ALL'
  );
}

export function notificationFiltersForView(
  filters: CenterFilters,
  view: NotificationView
): CenterFilters {
  // Mentions is a recipient-reason view; discard a contradictory reason, not unread/app scope.
  return view === 'MENTIONS' ? { ...filters, reason: 'ALL' } : filters;
}
