import { Compass, FileClock, House, ListChecks, Settings2, ShieldCheck } from 'lucide-react';

import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export type ServicesView =
  'home' | 'discover' | 'my' | 'drafts' | 'admin-catalog' | 'admin-operations';

export const SERVICES_NAVIGATION = [
  {
    id: 'overview',
    items: [{ view: 'home', path: '/services/home', icon: House }],
  },
  {
    id: 'discover',
    items: [
      { view: 'discover', path: '/services/discover', icon: Compass },
      { view: 'my', path: '/services/my', icon: ListChecks },
      { view: 'drafts', path: '/services/drafts', icon: FileClock },
    ],
  },
  {
    id: 'administration',
    items: [
      {
        view: 'admin-catalog',
        path: '/services/admin/catalog',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.SERVICE_CATALOG',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'admin-operations',
        path: '/services/admin/operations',
        icon: ShieldCheck,
        requiredResourceKey: 'ADMIN.SERVICE_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];

export const SERVICES_DEFAULT_PATH = '/services/home';
