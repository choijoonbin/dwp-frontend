import { CalendarClock, Gauge, History, House, LogIn, Settings2, Video } from 'lucide-react';

import type { ProductNavigationItem } from '../../components/product-manifest';

export type MeetingsSection = 'start' | 'meetings' | 'admin';
export type MeetingsView =
  'home' | 'mine' | 'history' | 'join' | 'admin-operations' | 'admin-policies';

export type MeetingsNavigationItem = ProductNavigationItem & {
  section: MeetingsSection;
  view: MeetingsView;
};

export type MeetingsNavigationGroup = {
  id: MeetingsSection;
  items: readonly MeetingsNavigationItem[];
};

export const MEETINGS_NAVIGATION: readonly MeetingsNavigationGroup[] = [
  {
    id: 'start',
    items: [
      { section: 'start', view: 'home', path: '/meetings/home', icon: House },
      { section: 'start', view: 'join', path: '/meetings/join', icon: LogIn },
    ],
  },
  {
    id: 'meetings',
    items: [
      { section: 'meetings', view: 'mine', path: '/meetings/mine', icon: CalendarClock },
      { section: 'meetings', view: 'history', path: '/meetings/history', icon: History },
    ],
  },
  {
    id: 'admin',
    items: [
      {
        section: 'admin',
        view: 'admin-operations',
        path: '/meetings/admin/operations',
        icon: Gauge,
        requiredResourceKey: 'ADMIN.MEETINGS',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-policies',
        path: '/meetings/admin/policies',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.MEETINGS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
];

export const MEETINGS_DEFAULT_PATH = '/meetings/home';
export const MEETINGS_ROOM_PATH_PREFIX = '/meetings/room/';
export const MEETINGS_PRODUCT_ICON = Video;

export function findMeetingsNavigationItem(pathname: string): MeetingsNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return MEETINGS_NAVIGATION.flatMap((group) => group.items).find(
    (item) => item.path === normalized
  );
}

export function meetingIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(MEETINGS_ROOM_PATH_PREFIX)) return null;
  const value = pathname.slice(MEETINGS_ROOM_PATH_PREFIX.length).split('/')[0];
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
