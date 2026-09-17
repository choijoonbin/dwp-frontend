import {
  Bot,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  ConciergeBell,
  House,
  LayoutDashboard,
  Network,
  MapPinned,
  MonitorSmartphone,
  PlugZap,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Siren,
  UserRoundCheck,
  Waypoints,
} from 'lucide-react';

import type {
  ProductAreaNavigationGroup,
  ProductAreaNavigationItem,
} from '../../layouts/product-area-layout';

export type RoomsView =
  | 'home'
  | 'find'
  | 'wayfinding'
  | 'planner'
  | 'assistant'
  | 'reservations'
  | 'service-orders'
  | 'safety'
  | 'admin-overview'
  | 'admin-safety'
  | 'admin-operations'
  | 'admin-devices'
  | 'admin-space-planning'
  | 'admin-exceptions'
  | 'admin-assistant-governance'
  | 'admin-governance'
  | 'admin-locations'
  | 'admin-policy'
  | 'admin-service-catalog'
  | 'admin-service-fulfillment'
  | 'admin-service-providers'
  | 'admin-visits'
  | 'admin-visit-policies'
  | 'admin-access-zones'
  | 'admin-visit-providers'
  | 'admin-kiosk-devices'
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
        view: 'find',
        path: '/workplace/find',
        icon: MapPinned,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'wayfinding',
        path: '/workplace/navigation',
        icon: MapPinned,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'planner',
        path: '/workplace/planner',
        icon: CalendarDays,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'assistant',
        path: '/workplace/assistant',
        icon: Bot,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'reservations',
        path: '/workplace/reservations',
        icon: CalendarRange,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'service-orders',
        path: '/workplace/service-orders',
        icon: ConciergeBell,
        requiredResourceKey: 'APP.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'safety',
        path: '/workplace/safety',
        icon: Siren,
        requiredResourceKey: 'APP.WORKPLACE',
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
        view: 'admin-safety',
        path: '/workplace/admin/safety',
        icon: Siren,
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
        view: 'admin-exceptions',
        path: '/workplace/admin/exceptions',
        icon: ShieldAlert,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-devices',
        path: '/workplace/admin/devices',
        icon: MonitorSmartphone,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-space-planning',
        path: '/workplace/admin/space-planning',
        icon: Building2,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-assistant-governance',
        path: '/workplace/admin/assistant-governance',
        icon: Bot,
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
      {
        view: 'admin-service-fulfillment',
        path: '/workplace/admin/service-fulfillment',
        icon: ConciergeBell,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-service-catalog',
        path: '/workplace/admin/service-catalog',
        icon: ClipboardList,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-service-providers',
        path: '/workplace/admin/service-providers',
        icon: ConciergeBell,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-visits',
        path: '/workplace/admin/visits',
        icon: UserRoundCheck,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-visit-policies',
        path: '/workplace/admin/visit-policies',
        icon: ShieldCheck,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-access-zones',
        path: '/workplace/admin/access-zones',
        icon: Waypoints,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-visit-providers',
        path: '/workplace/admin/visit-providers',
        icon: PlugZap,
        requiredResourceKey: 'ADMIN.WORKPLACE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-kiosk-devices',
        path: '/workplace/admin/kiosk-devices',
        icon: MonitorSmartphone,
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
