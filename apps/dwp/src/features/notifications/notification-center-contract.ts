import type { NotificationView } from '@dwp-frontend/shared-utils/api/notification-api';

import type { CenterFilters, NotificationCenterScope } from './notification-filter-model';

export type NotificationCenterProps = {
  initialView?: NotificationView;
  initialNotificationId?: string | null;
  initialQuery?: string;
  initialReadState?: CenterFilters['readState'];
  initialAppKey?: string;
  initialPriority?: CenterFilters['priority'];
  initialReason?: CenterFilters['reason'];
  onOpenSettings: () => void;
  onOpenTarget?: (href: string) => void;
  onViewChange?: (view: NotificationView) => void;
  onScopeChange?: (scope: NotificationCenterScope) => void;
  onDetailChange?: (notificationId: string | null) => void;
};
