import {
  Building2,
  CalendarCheck2,
  LayoutDashboard,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';

import type {
  ProductAreaNavigationGroup,
  ProductAreaNavigationItem,
} from '../../layouts/product-area-layout';

export type RoomsView =
  'find' | 'my-bookings' | 'admin-operations' | 'admin-resources' | 'admin-policies';

type RoomsNavigationItem = ProductAreaNavigationItem & { view: RoomsView };
type RoomsNavigationGroup = {
  id: string;
  items: readonly RoomsNavigationItem[];
};

export const ROOMS_NAVIGATION: readonly RoomsNavigationGroup[] = [
  {
    id: 'booking',
    items: [
      { view: 'find', path: '/rooms/find', icon: Building2 },
      { view: 'my-bookings', path: '/rooms/my-bookings', icon: CalendarCheck2 },
    ],
  },
  {
    id: 'operations',
    items: [
      {
        view: 'admin-operations',
        path: '/rooms/admin/operations',
        icon: LayoutDashboard,
        requiredResourceKey: 'ADMIN.ROOMS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-resources',
        path: '/rooms/admin/resources',
        icon: SlidersHorizontal,
        requiredResourceKey: 'ADMIN.ROOMS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-policies',
        path: '/rooms/admin/policies',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.ROOMS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];

export const ROOMS_DEFAULT_PATH = '/rooms/find';

export function findRoomsNavigationItem(pathname: string): RoomsNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  for (const group of ROOMS_NAVIGATION) {
    const match = group.items.find((item) => item.path === normalized);
    if (match) return match;
  }
  return undefined;
}
