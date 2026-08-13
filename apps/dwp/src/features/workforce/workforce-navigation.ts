import {
  Activity,
  BookKey,
  DatabaseZap,
  FileLock2,
  LayoutDashboard,
  Network,
  UserRoundSearch,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type WorkforceSection = 'operate' | 'design' | 'foundation';
export type WorkforceView =
  | 'overview'
  | 'people'
  | 'assignments'
  | 'organization'
  | 'reference-data'
  | 'data-operations'
  | 'exports';

export type WorkforceNavigationItem = {
  section: WorkforceSection;
  view: WorkforceView;
  path: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
};

export type WorkforceNavigationGroup = {
  id: WorkforceSection;
  items: readonly WorkforceNavigationItem[];
};

export const WORKFORCE_NAVIGATION: readonly WorkforceNavigationGroup[] = [
  {
    id: 'operate',
    items: [
      {
        section: 'operate',
        view: 'overview',
        path: '/workforce/overview',
        icon: LayoutDashboard,
      },
      {
        section: 'operate',
        view: 'people',
        path: '/workforce/people',
        icon: UserRoundSearch,
      },
      {
        section: 'operate',
        view: 'assignments',
        path: '/workforce/assignments',
        icon: Activity,
      },
    ],
  },
  {
    id: 'design',
    items: [
      {
        section: 'design',
        view: 'organization',
        path: '/workforce/organization',
        icon: Network,
      },
    ],
  },
  {
    id: 'foundation',
    items: [
      {
        section: 'foundation',
        view: 'reference-data',
        path: '/workforce/reference-data',
        icon: BookKey,
      },
      {
        section: 'foundation',
        view: 'data-operations',
        path: '/workforce/data-operations',
        icon: DatabaseZap,
      },
      {
        section: 'foundation',
        view: 'exports',
        path: '/workforce/exports',
        icon: FileLock2,
        requiredResourceKey: 'DATA.WORKFORCE',
        requiredPermissionCode: 'MANAGE',
      },
    ],
  },
];

export const WORKFORCE_DEFAULT_PATH = WORKFORCE_NAVIGATION[0].items[0].path;

export function findWorkforceNavigationItem(view?: string): WorkforceNavigationItem | undefined {
  return WORKFORCE_NAVIGATION.flatMap((group) => group.items).find((item) => item.view === view);
}
