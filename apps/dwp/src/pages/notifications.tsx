import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  NotificationCenter,
  type NotificationCenterScope,
} from '../features/notifications/notification-center';
import { notificationCenterSearchParams } from '../features/notifications/notification-navigation';
import { NOTIFICATION_REASONS } from '../features/notifications/notification-filter-model';

import type {
  NotificationPriority,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

const VIEW_BY_QUERY: Readonly<Record<string, NotificationView>> = {
  priority: 'PRIORITY',
  all: 'ALL',
  mentions: 'MENTIONS',
  saved: 'SAVED',
  later: 'SNOOZED',
  done: 'DONE',
};

const READ_STATE_BY_QUERY = {
  unread: 'UNREAD',
  read: 'READ',
} as const;

const PRIORITY_BY_QUERY: Readonly<Record<string, NotificationPriority>> = {
  urgent: 'URGENT',
  high: 'HIGH',
  normal: 'NORMAL',
  low: 'LOW',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notificationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = VIEW_BY_QUERY[searchParams.get('view') ?? ''] ?? 'PRIORITY';
  const readState =
    READ_STATE_BY_QUERY[searchParams.get('read') as keyof typeof READ_STATE_BY_QUERY];
  const initialReadState = readState ?? 'ALL';
  const initialQuery = searchParams.get('q') ?? '';
  const initialAppKey = searchParams.get('app') ?? '';
  const initialPriority = PRIORITY_BY_QUERY[searchParams.get('priority') ?? ''] ?? 'ALL';
  const initialReason =
    initialView === 'MENTIONS'
      ? 'ALL'
      : (NOTIFICATION_REASONS.find(
          (reason) => reason.toLowerCase() === searchParams.get('reason')
        ) ?? 'ALL');
  const handleScopeChange = useCallback(
    (scope: NotificationCenterScope) => {
      const next = new URLSearchParams(searchParams);
      for (const key of ['view', 'read', 'q', 'app', 'priority', 'reason']) next.delete(key);
      notificationCenterSearchParams(scope).forEach((value, key) => next.set(key, value));
      if (next.toString() === searchParams.toString()) return;
      setSearchParams(next, { replace: scope.view === initialView });
    },
    [initialView, searchParams, setSearchParams]
  );

  return (
    <NotificationCenter
      initialView={initialView}
      initialNotificationId={notificationId ? decodeURIComponent(notificationId) : null}
      initialQuery={initialQuery}
      initialReadState={initialReadState}
      initialAppKey={initialAppKey}
      initialPriority={initialPriority}
      initialReason={initialReason}
      onOpenSettings={() => navigate('/notifications/settings')}
      onOpenTarget={(href) => navigate(href)}
      onScopeChange={handleScopeChange}
    />
  );
}
