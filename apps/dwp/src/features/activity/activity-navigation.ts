import { Activity, House } from 'lucide-react';

import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export const ACTIVITY_NAVIGATION = [
  {
    id: 'start',
    items: [{ view: 'home', path: '/activity/home', icon: House }],
  },
  {
    id: 'monitor',
    items: [{ view: 'timeline', path: '/activity/timeline', icon: Activity }],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];
