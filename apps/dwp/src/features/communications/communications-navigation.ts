import { Bookmark, CircleAlert, House, Megaphone, Newspaper, Sparkles } from 'lucide-react';

import type {
  ProductNavigationGroup,
  ProductSurfaceNavigationGroup,
} from '../../components/product-manifest';

export type CommunicationsView =
  | 'home'
  | 'for-you'
  | 'all'
  | 'required'
  | 'saved'
  | 'admin-content';

export const COMMUNICATIONS_WORK_NAVIGATION = [
  {
    id: 'overview',
    items: [
      {
        view: 'home',
        path: '/communications/home',
        icon: House,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'communications.work-access.v1' },
      },
    ],
  },
  {
    id: 'discover',
    items: [
      {
        view: 'for-you',
        path: '/communications/for-you',
        icon: Sparkles,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'communications.work-access.v1' },
      },
      {
        view: 'all',
        path: '/communications/all',
        icon: Newspaper,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'communications.work-access.v1' },
      },
    ],
  },
  {
    id: 'library',
    items: [
      {
        view: 'required',
        path: '/communications/required',
        icon: CircleAlert,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'communications.work-access.v1' },
      },
      {
        view: 'saved',
        path: '/communications/saved',
        icon: Bookmark,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'communications.work-access.v1' },
      },
    ],
  },
] as const satisfies readonly ProductSurfaceNavigationGroup[];

export const COMMUNICATIONS_MANAGEMENT_NAVIGATION = [
  {
    id: 'administration',
    items: [
      {
        view: 'admin-content',
        path: '/communications/admin/content',
        icon: Megaphone,
        taskKind: 'operations',
        access: {
          type: 'policy',
          accessPolicyKey: 'communications.content-route-access.v1',
        },
      },
    ],
  },
] as const satisfies readonly ProductSurfaceNavigationGroup[];

export const COMMUNICATIONS_NAVIGATION = [
  ...COMMUNICATIONS_WORK_NAVIGATION,
  ...COMMUNICATIONS_MANAGEMENT_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      requiredResourceKey: 'ADMIN.COMMUNICATIONS',
      requiredPermissionCode: 'VIEW',
      requiredAnySupportScopes: ['TENANT_CONFIGURATION_READ', 'TENANT_CONFIGURATION_WRITE'],
    })),
  })),
] as const satisfies readonly ProductNavigationGroup[];

export const COMMUNICATIONS_DEFAULT_PATH = '/communications/home';
