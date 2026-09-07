import { BriefcaseBusiness } from 'lucide-react';

import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export const WORK_NAVIGATION = [
  {
    id: 'work',
    items: [{ view: 'queue', path: '/work/queue', icon: BriefcaseBusiness }],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];
