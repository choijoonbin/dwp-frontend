import { BriefcaseBusiness, House } from 'lucide-react';

import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export const WORK_NAVIGATION = [
  {
    id: 'start',
    items: [{ view: 'home', path: '/work/home', icon: House }],
  },
  {
    id: 'work',
    items: [{ view: 'queue', path: '/work/queue', icon: BriefcaseBusiness }],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];
