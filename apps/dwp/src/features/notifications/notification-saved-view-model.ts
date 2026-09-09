import {
  EMPTY_NOTIFICATION_FILTERS,
  notificationFiltersForView,
  type CenterFilters,
  type NotificationCenterScope,
} from './notification-filter-model';

import type { SavedViewConfiguration } from '@dwp-frontend/shared-utils';
import type {
  NotificationPriority,
  NotificationReasonKind,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export const NOTIFICATION_SAVED_VIEW_SURFACE = 'notifications.work';

const CONTRACT = 'dwp.notifications.center.saved-view';
const VERSION = 1;
const VIEWS = new Set<NotificationView>([
  'PRIORITY',
  'ALL',
  'MENTIONS',
  'SAVED',
  'SNOOZED',
  'DONE',
]);
const READ_STATES = new Set<CenterFilters['readState']>(['ALL', 'UNREAD', 'READ']);
const PRIORITIES = new Set<NotificationPriority | 'ALL'>([
  'ALL',
  'URGENT',
  'HIGH',
  'NORMAL',
  'LOW',
]);
const REASONS = new Set<NotificationReasonKind | 'ALL'>([
  'ALL',
  'MENTION',
  'DIRECT',
  'ROLE',
  'ORGANIZATION',
  'SUBSCRIPTION',
  'MANDATORY_POLICY',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : null;
}

export function notificationSavedViewConfiguration(
  scope: NotificationCenterScope
): SavedViewConfiguration {
  const filters = notificationFiltersForView(scope, scope.view);
  return {
    contract: CONTRACT,
    version: VERSION,
    scope: {
      view: scope.view,
      query: filters.query.trim(),
      appKey: filters.appKey.trim(),
      priority: filters.priority,
      readState: filters.readState,
      reason: filters.reason,
    },
  };
}

export function parseNotificationSavedViewConfiguration(
  configuration: SavedViewConfiguration
): NotificationCenterScope | null {
  if (configuration.contract !== CONTRACT || configuration.version !== VERSION) return null;
  const candidate = configuration.scope;
  if (!isRecord(candidate)) return null;

  const view = candidate.view;
  const readState = candidate.readState;
  const priority = candidate.priority;
  const reason = candidate.reason;
  const query = boundedString(candidate.query, 200);
  const appKey = boundedString(candidate.appKey, 120);
  if (
    !VIEWS.has(view as NotificationView) ||
    !READ_STATES.has(readState as CenterFilters['readState']) ||
    !PRIORITIES.has(priority as NotificationPriority | 'ALL') ||
    !REASONS.has(reason as NotificationReasonKind | 'ALL') ||
    query == null ||
    appKey == null
  ) {
    return null;
  }

  const filters = notificationFiltersForView(
    {
      ...EMPTY_NOTIFICATION_FILTERS,
      query,
      appKey,
      priority: priority as NotificationPriority | 'ALL',
      readState: readState as CenterFilters['readState'],
      reason: reason as NotificationReasonKind | 'ALL',
    },
    view as NotificationView
  );
  return { ...filters, view: view as NotificationView };
}

export function selectedNotificationBuiltInViewId(scope: NotificationCenterScope): string | null {
  const canonical = notificationFiltersForView(scope, scope.view);
  const filtersAreEmpty =
    !canonical.query.trim() &&
    !canonical.appKey &&
    canonical.priority === 'ALL' &&
    canonical.readState === 'ALL' &&
    canonical.reason === 'ALL';
  if (filtersAreEmpty && ['PRIORITY', 'MENTIONS'].includes(scope.view)) {
    return `notification-${scope.view.toLocaleLowerCase('en-US')}`;
  }
  if (
    scope.view === 'ALL' &&
    !canonical.query.trim() &&
    !canonical.appKey &&
    canonical.priority === 'ALL' &&
    canonical.readState === 'UNREAD' &&
    canonical.reason === 'ALL'
  ) {
    return 'notification-unread';
  }
  return null;
}
