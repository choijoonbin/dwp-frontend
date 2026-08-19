import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { NotificationCenter } from '../features/notifications/notification-center';

import type { NotificationView } from '@dwp-frontend/shared-utils/api/notification-api';

const VIEW_BY_QUERY: Readonly<Record<string, NotificationView>> = {
  priority: 'PRIORITY',
  all: 'ALL',
  mentions: 'MENTIONS',
  saved: 'SAVED',
  later: 'SNOOZED',
  done: 'DONE',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notificationId } = useParams();
  const [searchParams] = useSearchParams();
  const initialView = VIEW_BY_QUERY[searchParams.get('view') ?? ''] ?? 'PRIORITY';

  return (
    <NotificationCenter
      key={`${initialView}:${notificationId ?? ''}`}
      initialView={initialView}
      initialNotificationId={notificationId ? decodeURIComponent(notificationId) : null}
      onOpenSettings={() => navigate('/account/settings/notifications')}
      onOpenTarget={(href) => navigate(href)}
    />
  );
}
