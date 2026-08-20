import {
  Building2,
  CalendarCheck2,
  House,
  LayoutDashboard,
  Network,
  MapPinned,
  MonitorCheck,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import type {
  ProductAreaNavigationGroup,
  ProductAreaNavigationItem,
} from '../../layouts/product-area-layout';

export type RoomsView =
  | 'home'
  | 'explore'
  | 'find-rooms'
  | 'my-bookings'
  | 'my-meetings'
  | 'admin-overview'
  | 'admin-operations'
  | 'admin-governance'
  | 'admin-locations'
  | 'admin-policy'
  | 'admin-room-operations'
  | 'admin-room-policy';

type RoomsNavigationItem = ProductAreaNavigationItem & { view: RoomsView };
type RoomsNavigationGroup = {
  id: string;
  items: readonly RoomsNavigationItem[];
};

export const ROOMS_NAVIGATION: readonly RoomsNavigationGroup[] = [
  {
    id: 'booking',
    items: [
      {
        view: 'home',
        path: '/workplace/home',
        icon: House,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'explore',
        path: '/workplace/explore',
        icon: MapPinned,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'find-rooms',
        path: '/workplace/rooms',
        icon: UsersRound,
        requiredResourceKey: 'APP.ROOMS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'my-bookings',
        path: '/workplace/my-bookings',
        icon: MonitorCheck,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'my-meetings',
        path: '/workplace/my-meetings',
        icon: CalendarCheck2,
        requiredResourceKey: 'APP.ROOMS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
  {
    id: 'workplaceAdministration',
    items: [
      {
        view: 'admin-overview',
        path: '/workplace/admin/overview',
        icon: LayoutDashboard,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-operations',
        path: '/workplace/admin/operations',
        icon: ShieldCheck,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-governance',
        path: '/workplace/admin/governance',
        icon: Network,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-locations',
        path: '/workplace/admin/locations',
        icon: Building2,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-policy',
        path: '/workplace/admin/policies',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
  {
    id: 'meetingAdministration',
    items: [
      {
        view: 'admin-room-operations',
        path: '/workplace/admin/meeting-operations',
        icon: CalendarCheck2,
        requiredResourceKey: 'ADMIN.ROOMS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-room-policy',
        path: '/workplace/admin/meeting-policy',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.ROOMS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];

export const ROOMS_DEFAULT_PATH = '/workplace/home';

export function findFirstAccessibleRoomsPath(
  hasPermission: (resourceKey: string, permissionCode: string) => boolean
) {
  for (const group of ROOMS_NAVIGATION) {
    const item = group.items.find(
      (candidate) =>
        !candidate.requiredResourceKey ||
        Boolean(
          candidate.requiredPermissionCode &&
          hasPermission(candidate.requiredResourceKey, candidate.requiredPermissionCode)
        )
    );
    if (item) return item.path;
  }
  return '/';
}

export function findRoomsNavigationItem(pathname: string): RoomsNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  for (const group of ROOMS_NAVIGATION) {
    const match = group.items.find((item) => item.path === normalized);
    if (match) return match;
  }
  return undefined;
}
