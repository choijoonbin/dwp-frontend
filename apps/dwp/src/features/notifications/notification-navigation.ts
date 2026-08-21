import {
  BellRing,
  CircleStop,
  FileCode2,
  House,
  RadioTower,
  Settings2,
  Languages,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

import type {
  ProductAreaNavigationGroup,
  ProductAreaNavigationItem,
} from '../../layouts/product-area-layout';
import type { NotificationView } from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationNavigationView =
  | 'home'
  | 'center'
  | 'settings'
  | 'admin-overview'
  | 'admin-contracts'
  | 'admin-templates'
  | 'admin-policies'
  | 'admin-operations'
  | 'admin-suppressions';

export type NotificationNavigationSection = 'overview' | 'center' | 'administration';

export type NotificationNavigationItem = ProductAreaNavigationItem & {
  view: NotificationNavigationView;
};

export type NotificationNavigationGroup = ProductAreaNavigationGroup & {
  id: NotificationNavigationSection;
  items: readonly NotificationNavigationItem[];
};

export type NotificationCenterViewLink = {
  view: NotificationView;
  path: string;
};

export const NOTIFICATION_HOME_PATH = '/notifications/home';
export const NOTIFICATION_CENTER_PATH = '/notifications/center';
export const NOTIFICATION_SETTINGS_PATH = '/notifications/settings';
export const NOTIFICATION_ADMIN_BASE_PATH = '/notifications/admin';

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
    id: 'overview',
    items: [{ view: 'home', path: NOTIFICATION_HOME_PATH, icon: House }],
  },
  {
    id: 'center',
    items: [
      {
        view: 'center',
        path: NOTIFICATION_CENTER_PATH,
        icon: BellRing,
        requiredResourceKey: 'APP.NOTIFICATIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
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
        view: 'admin-overview',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/overview`,
        icon: ShieldCheck,
        requiredResourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-contracts',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/contracts`,
        icon: FileCode2,
        requiredResourceKey: 'ADMIN.NOTIFICATION_CONTRACT',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-policies',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/policies`,
        icon: SlidersHorizontal,
        requiredResourceKey: 'ADMIN.NOTIFICATION_POLICY',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-templates',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/templates`,
        icon: Languages,
        requiredResourceKey: 'ADMIN.NOTIFICATION_TEMPLATE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-operations',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/operations`,
        icon: RadioTower,
        requiredResourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-suppressions',
        path: `${NOTIFICATION_ADMIN_BASE_PATH}/suppressions`,
        icon: CircleStop,
        requiredResourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
] as const;

export const NOTIFICATION_DEFAULT_PATH = NOTIFICATION_HOME_PATH;

export function findNotificationNavigationItem(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return NOTIFICATION_NAVIGATION.flatMap((group) => group.items).find(
    (item) => item.path === normalized
  );
}
