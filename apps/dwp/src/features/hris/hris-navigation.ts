import {
  BookKey,
  BriefcaseBusiness,
  ClipboardList,
  ContactRound,
  DatabaseZap,
  FileLock2,
  Gauge,
  GitBranch,
  House,
  Network,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type HrisAudience = 'all' | 'manager' | 'operator';
export type HrisSection =
  'start' | 'personal' | 'organization' | 'team' | 'operate' | 'design' | 'foundation';
export type HrisView =
  | 'home'
  | 'me'
  | 'directory'
  | 'organization'
  | 'team'
  | 'operations'
  | 'people'
  | 'assignments'
  | 'organization-design'
  | 'reference-data'
  | 'data-operations'
  | 'exports';

export type HrisNavigationItem = {
  section: HrisSection;
  view: HrisView;
  path: string;
  icon: LucideIcon;
  audience: HrisAudience;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
};

export type HrisNavigationGroup = {
  id: HrisSection;
  items: readonly HrisNavigationItem[];
};

export const HRIS_NAVIGATION: readonly HrisNavigationGroup[] = [
  {
    id: 'start',
    items: [{ section: 'start', view: 'home', path: '/hr/home', icon: House, audience: 'all' }],
  },
  {
    id: 'personal',
    items: [
      { section: 'personal', view: 'me', path: '/hr/me', icon: ContactRound, audience: 'all' },
    ],
  },
  {
    id: 'organization',
    items: [
      {
        section: 'organization',
        view: 'directory',
        path: '/hr/directory',
        icon: UsersRound,
        audience: 'all',
      },
      {
        section: 'organization',
        view: 'organization',
        path: '/hr/organization',
        icon: Network,
        audience: 'all',
      },
    ],
  },
  {
    id: 'team',
    items: [
      {
        section: 'team',
        view: 'team',
        path: '/hr/team',
        icon: UserRoundCheck,
        audience: 'manager',
      },
    ],
  },
  {
    id: 'operate',
    items: [
      {
        section: 'operate',
        view: 'operations',
        path: '/hr/operations',
        icon: Gauge,
        audience: 'operator',
      },
      {
        section: 'operate',
        view: 'people',
        path: '/hr/operations/people',
        icon: BriefcaseBusiness,
        audience: 'operator',
      },
      {
        section: 'operate',
        view: 'assignments',
        path: '/hr/operations/assignments',
        icon: ClipboardList,
        audience: 'operator',
      },
    ],
  },
  {
    id: 'design',
    items: [
      {
        section: 'design',
        view: 'organization-design',
        path: '/hr/design/organization',
        icon: GitBranch,
        audience: 'operator',
      },
    ],
  },
  {
    id: 'foundation',
    items: [
      {
        section: 'foundation',
        view: 'reference-data',
        path: '/hr/data/reference',
        icon: BookKey,
        audience: 'operator',
        requiredResourceKey: 'ACTION.WORKFORCE_REFERENCE',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
      {
        section: 'foundation',
        view: 'data-operations',
        path: '/hr/data/integrations',
        icon: DatabaseZap,
        audience: 'operator',
        requiredResourceKey: 'ACTION.WORKFORCE_DATA_OPERATIONS',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
      {
        section: 'foundation',
        view: 'exports',
        path: '/hr/data/exports',
        icon: FileLock2,
        audience: 'operator',
        requiredResourceKey: 'DATA.WORKFORCE',
        requiredAnyPermissionCodes: ['MANAGE'],
      },
    ],
  },
];

export const HRIS_DEFAULT_PATH = '/hr/home';

export function visibleHrisNavigation(access: {
  isManager: boolean;
  canOperate: boolean;
}): HrisNavigationGroup[] {
  return HRIS_NAVIGATION.flatMap((group) => {
    const items = group.items.filter(
      (item) =>
        item.audience === 'all' ||
        (item.audience === 'manager' && access.isManager) ||
        (item.audience === 'operator' && access.canOperate)
    );
    return items.length ? [{ ...group, items }] : [];
  });
}

export function findHrisNavigationItem(pathname: string): HrisNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return HRIS_NAVIGATION.flatMap((group) => group.items).find((item) => item.path === normalized);
}

export function mapLegacyHrisPath(pathname: string): string {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  const explicitRoutes: Record<string, string> = {
    '/people': HRIS_DEFAULT_PATH,
    '/people/directory': '/hr/directory',
    '/people/organization': '/hr/organization',
    '/workforce': '/hr/operations',
    '/workforce/overview': '/hr/operations',
    '/workforce/people': '/hr/operations/people',
    '/workforce/assignments': '/hr/operations/assignments',
    '/workforce/organization': '/hr/design/organization',
    '/workforce/reference-data': '/hr/data/reference',
    '/workforce/data-operations': '/hr/data/integrations',
    '/workforce/exports': '/hr/data/exports',
  };
  return explicitRoutes[normalized] ?? normalized;
}
