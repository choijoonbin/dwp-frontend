import { Compass, House, Layers3, Send } from 'lucide-react';

import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export type SpaceView = 'home' | 'my-spaces' | 'discover' | 'requests';

export const SPACE_NAVIGATION = [
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
] as const satisfies readonly ProductAreaNavigationGroup[];

export const SPACE_DEFAULT_PATH = '/spaces/home';

export function findSpaceView(pathname: string): SpaceView | undefined {
  for (const group of SPACE_NAVIGATION) {
    const item = group.items.find((candidate) => candidate.path === pathname);
    if (item) return item.view;
  }
  return undefined;
}
