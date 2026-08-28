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

import {
  SPACE_ADMIN_NAVIGATION_CONTRACTS,
  type SpaceAdminView,
} from '../../components/spaces/space-admin-navigation-contract';
import type { ProductAreaNavigationItem } from '../../layouts/product-area-layout';

export type SpaceView = 'home' | 'my-spaces' | 'discover' | 'requests' | SpaceAdminView;

type SpaceNavigationItem = ProductAreaNavigationItem & { view: SpaceView };
type SpaceNavigationGroup = {
  id: string;
  items: readonly SpaceNavigationItem[];
};

const SPACE_ADMIN_ICONS = {
  'admin-overview': ChartNoAxesCombined,
  'admin-directory': Layers3,
  'admin-requests': Route,
  'admin-templates': LayoutTemplate,
  'admin-content-reviews': FileCheck2,
  'admin-lifecycle': ClipboardCheck,
  'admin-operations': RadioTower,
} as const;

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
    items: SPACE_ADMIN_NAVIGATION_CONTRACTS.map((item) => ({
      ...item,
      icon: SPACE_ADMIN_ICONS[item.view],
    })),
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
