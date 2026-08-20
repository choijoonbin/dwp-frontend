import {
  ChartNoAxesCombined,
  ClipboardCheck,
  Compass,
  FileCheck2,
  House,
  Layers3,
  LayoutTemplate,
  RadioTower,
  Route,
  Send,
} from 'lucide-react';

import type { ProductAreaNavigationItem } from '../../layouts/product-area-layout';

export type SpaceView =
  | 'home'
  | 'my-spaces'
  | 'discover'
  | 'requests'
  | 'admin-overview'
  | 'admin-directory'
  | 'admin-requests'
  | 'admin-templates'
  | 'admin-content-reviews'
  | 'admin-lifecycle'
  | 'admin-operations';

type SpaceNavigationItem = ProductAreaNavigationItem & { view: SpaceView };
type SpaceNavigationGroup = {
  id: string;
  items: readonly SpaceNavigationItem[];
};

export const SPACE_NAVIGATION: readonly SpaceNavigationGroup[] = [
  {
    id: 'overview',
    items: [{ view: 'home', path: '/spaces/home', icon: House }],
  },
  {
    id: 'portfolio',
    items: [
      { view: 'my-spaces', path: '/spaces/my', icon: Layers3 },
      { view: 'discover', path: '/spaces/discover', icon: Compass },
      { view: 'requests', path: '/spaces/requests', icon: Send },
    ],
  },
  {
    id: 'administration',
    items: [
      {
        view: 'admin-overview',
        path: '/spaces/admin/overview',
        icon: ChartNoAxesCombined,
        requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-directory',
        path: '/spaces/admin/directory',
        icon: Layers3,
        requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-requests',
        path: '/spaces/admin/requests',
        icon: Route,
        requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-templates',
        path: '/spaces/admin/templates',
        icon: LayoutTemplate,
        requiredResourceKey: 'ADMIN.SPACE_TEMPLATES',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-content-reviews',
        path: '/spaces/admin/content-reviews',
        icon: FileCheck2,
        requiredResourceKey: 'ADMIN.SPACE_COMPLIANCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-lifecycle',
        path: '/spaces/admin/lifecycle',
        icon: ClipboardCheck,
        requiredResourceKey: 'ADMIN.SPACE_ACCESS_REVIEW',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-operations',
        path: '/spaces/admin/operations',
        icon: RadioTower,
        requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
] as const;

export const SPACE_DEFAULT_PATH = '/spaces/home';

export function findSpaceView(pathname: string): SpaceView | undefined {
  for (const group of SPACE_NAVIGATION) {
    const item = group.items.find((candidate) => candidate.path === pathname);
    if (item) return item.view;
  }
  return undefined;
}

export function findSpaceNavigationItem(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return SPACE_NAVIGATION.flatMap((group) => group.items).find((item) => item.path === normalized);
}
