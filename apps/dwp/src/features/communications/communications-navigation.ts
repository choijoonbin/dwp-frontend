import { Bookmark, CircleAlert, House, Megaphone, Newspaper, Sparkles } from 'lucide-react';

import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export type CommunicationsView =
  'home' | 'for-you' | 'all' | 'required' | 'saved' | 'admin-content';

export const COMMUNICATIONS_NAVIGATION = [
  {
    id: 'overview',
    items: [{ view: 'home', path: '/communications/home', icon: House }],
  },
  {
    id: 'discover',
    items: [
      { view: 'for-you', path: '/communications/for-you', icon: Sparkles },
      { view: 'all', path: '/communications/all', icon: Newspaper },
    ],
  },
  {
    id: 'library',
    items: [
      { view: 'required', path: '/communications/required', icon: CircleAlert },
      { view: 'saved', path: '/communications/saved', icon: Bookmark },
    ],
  },
  {
    id: 'administration',
    items: [
      {
        view: 'admin-content',
        path: '/communications/admin/content',
        icon: Megaphone,
        requiredResourceKey: 'ADMIN.COMMUNICATIONS',
        requiredPermissionCode: 'VIEW',
        requiredAnySupportScopes: ['TENANT_CONFIGURATION_READ', 'TENANT_CONFIGURATION_WRITE'],
      },
    ],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];

export const COMMUNICATIONS_DEFAULT_PATH = '/communications/home';
