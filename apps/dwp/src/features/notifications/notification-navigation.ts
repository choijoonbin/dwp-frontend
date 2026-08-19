import { Activity, BellRing, Braces, Settings2 } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { NotificationView } from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationNavigationSection = 'center' | 'settings' | 'administration';

export type NotificationNavigationView =
  'center' | 'settings' | 'admin-overview' | 'admin-contracts' | 'admin-operations';

/**
 * Structurally compatible with ProductAreaNavigationGroup. The host layout can
 * consume this model without introducing a layout dependency into the feature.
 */
export type NotificationNavigationItem = {
  section: NotificationNavigationSection;
  view: NotificationNavigationView;
  path: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
};

export type NotificationNavigationGroup = {
  id: NotificationNavigationSection;
  items: readonly NotificationNavigationItem[];
};

export type NotificationCenterViewLink = {
  view: NotificationView;
  path: string;
};

export const NOTIFICATION_CENTER_PATH = '/notifications';
export const NOTIFICATION_SETTINGS_PATH = '/account/settings/notifications';
export const NOTIFICATION_ADMIN_BASE_PATH = '/admin/notifications';

export const NOTIFICATION_CENTER_VIEW_LINKS: readonly NotificationCenterViewLink[] = [
  { view: 'PRIORITY', path: `${NOTIFICATION_CENTER_PATH}?view=priority` },
  { view: 'ALL', path: `${NOTIFICATION_CENTER_PATH}?view=all` },
  { view: 'MENTIONS', path: `${NOTIFICATION_CENTER_PATH}?view=mentions` },
  { view: 'SAVED', path: `${NOTIFICATION_CENTER_PATH}?view=saved` },
  { view: 'SNOOZED', path: `${NOTIFICATION_CENTER_PATH}?view=later` },
  { view: 'DONE', path: `${NOTIFICATION_CENTER_PATH}?view=done` },
] as const;

export const NOTIFICATION_NAVIGATION: readonly NotificationNavigationGroup[] = [
  {
    id: 'center',
    items: [
      {
        section: 'center',
        view: 'center',
        path: NOTIFICATION_CENTER_PATH,
        icon: BellRing,
        requiredResourceKey: 'APP.NOTIFICATIONS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
  {
    id: 'settings',
    items: [
      {
        section: 'settings',
        view: 'settings',
        path: NOTIFICATION_SETTINGS_PATH,
        icon: Settings2,
        requiredResourceKey: 'APP.NOTIFICATIONS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
  {
    id: 'administration',
    items: [
      {
        section: 'administration',
        view: 'admin-overview',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/overview`,
        icon: Activity,
        requiredResourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'administration',
        view: 'admin-contracts',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/contracts`,
        icon: Braces,
        requiredResourceKey: 'ADMIN.NOTIFICATION_CONTRACT',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'administration',
        view: 'admin-operations',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/operations`,
        icon: Activity,
        requiredResourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
] as const;

export const NOTIFICATION_DEFAULT_PATH = NOTIFICATION_CENTER_PATH;

export function findNotificationNavigationItem(
  pathname: string
): NotificationNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return NOTIFICATION_NAVIGATION.flatMap((group) => group.items).find(
    (item) => item.path === normalized
  );
}
