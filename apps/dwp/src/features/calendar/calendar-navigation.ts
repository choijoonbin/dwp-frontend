import {
  BarChart3,
  CalendarDays,
  Focus,
  Gauge,
  House,
  Inbox,
  Settings2,
  Trash2,
  UsersRound,
} from 'lucide-react';

import type { ProductNavigationItem } from '../../components/product-manifest';

export type CalendarSection = 'start' | 'plan' | 'coordinate' | 'insights' | 'utility' | 'admin';
export type CalendarView =
  | 'home'
  | 'schedule'
  | 'focus'
  | 'invitations'
  | 'trash'
  | 'availability'
  | 'insights'
  | 'admin-overview'
  | 'admin-company-calendars'
  | 'admin-policies';

export type CalendarNavigationItem = ProductNavigationItem & {
  section: CalendarSection;
  view: CalendarView;
};

export type CalendarNavigationGroup = {
  id: CalendarSection;
  items: readonly CalendarNavigationItem[];
};

export const CALENDAR_NAVIGATION: readonly CalendarNavigationGroup[] = [
  {
    id: 'start',
    items: [{ section: 'start', view: 'home', path: '/calendar/home', icon: House }],
  },
  {
    id: 'plan',
    items: [
      {
        section: 'plan',
        view: 'schedule',
        path: '/calendar/schedule',
        icon: CalendarDays,
      },
      {
        section: 'plan',
        view: 'focus',
        path: '/calendar/focus',
        icon: Focus,
      },
    ],
  },
  {
    id: 'coordinate',
    items: [
      {
        section: 'coordinate',
        view: 'invitations',
        path: '/calendar/invitations',
        icon: Inbox,
      },
      {
        section: 'coordinate',
        view: 'availability',
        path: '/calendar/availability',
        icon: UsersRound,
      },
    ],
  },
  {
    id: 'insights',
    items: [
      {
        section: 'insights',
        view: 'insights',
        path: '/calendar/insights',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'utility',
    items: [
      {
        section: 'utility',
        view: 'trash',
        path: '/calendar/trash',
        icon: Trash2,
      },
    ],
  },
  {
    id: 'admin',
    items: [
      {
        section: 'admin',
        view: 'admin-overview',
        path: '/calendar/admin/overview',
        icon: Gauge,
        requiredResourceKey: 'ADMIN.CALENDAR',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-company-calendars',
        path: '/calendar/admin/company-calendars',
        icon: CalendarDays,
        requiredResourceKey: 'ADMIN.CALENDAR',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-policies',
        path: '/calendar/admin/policies',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.CALENDAR',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
];

export const CALENDAR_DEFAULT_PATH = '/calendar/home';

export function findCalendarNavigationItem(pathname: string): CalendarNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return CALENDAR_NAVIGATION.flatMap((group) => group.items).find(
    (item) => item.path === normalized
  );
}
