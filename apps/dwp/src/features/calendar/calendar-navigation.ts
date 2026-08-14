import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  Gauge,
  House,
  Settings2,
  UsersRound,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type CalendarSection = 'start' | 'plan' | 'spaces' | 'insights' | 'admin';
export type CalendarView =
  | 'home'
  | 'schedule'
  | 'availability'
  | 'resources'
  | 'insights'
  | 'admin-overview'
  | 'admin-resources'
  | 'admin-policies';

export type CalendarNavigationItem = {
  section: CalendarSection;
  view: CalendarView;
  path: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
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
        view: 'availability',
        path: '/calendar/availability',
        icon: UsersRound,
      },
    ],
  },
  {
    id: 'spaces',
    items: [
      {
        section: 'spaces',
        view: 'resources',
        path: '/calendar/resources',
        icon: Building2,
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
        view: 'admin-resources',
        path: '/calendar/admin/resources',
        icon: CalendarClock,
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
