import {
  Boxes,
  Building2,
  Database,
  Image,
  Megaphone,
  Network,
  ScrollText,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type AdminSection = 'experience' | 'people' | 'platform' | 'governance';

export type AdminView =
  | 'branding'
  | 'home-experience'
  | 'announcements'
  | 'access'
  | 'directory'
  | 'reference-data'
  | 'registry'
  | 'audit';

export type AdminNavigationItem = {
  section: AdminSection;
  view: AdminView;
  path: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type AdminNavigationGroup = {
  id: AdminSection;
  label: string;
  icon: LucideIcon;
  items: AdminNavigationItem[];
};

export const ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  {
    id: 'experience',
    label: 'Experience',
    icon: Building2,
    items: [
      {
        section: 'experience',
        view: 'branding',
        path: '/admin/experience/branding',
        label: 'Branding',
        title: 'Tenant branding',
        description: 'Manage the organization identity shown across the employee experience.',
        icon: Building2,
      },
      {
        section: 'experience',
        view: 'home-experience',
        path: '/admin/experience/home-experience',
        label: 'Home experience',
        title: 'Home experience',
        description: 'Configure the tenant home artwork and personalized launchpad experience.',
        icon: Image,
      },
      {
        section: 'experience',
        view: 'announcements',
        path: '/admin/experience/announcements',
        label: 'Announcements',
        title: 'Announcements',
        description: 'Publish time-bound notices to the appropriate tenant audience.',
        icon: Megaphone,
      },
    ],
  },
  {
    id: 'people',
    label: 'People & access',
    icon: UsersRound,
    items: [
      {
        section: 'people',
        view: 'access',
        path: '/admin/people/access',
        label: 'Access control',
        title: 'Identity access',
        description: 'Assign tenant roles and review effective access for workforce accounts.',
        icon: ShieldCheck,
      },
      {
        section: 'people',
        view: 'directory',
        path: '/admin/people/directory',
        label: 'Directory',
        title: 'Organization directory',
        description: 'Manage organizations and groups used for scoped access and experiences.',
        icon: Network,
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform setup',
    icon: Settings2,
    items: [
      {
        section: 'platform',
        view: 'reference-data',
        path: '/admin/platform/reference-data',
        label: 'Reference data',
        title: 'Reference data',
        description: 'Govern tenant code sets, localized labels, hierarchy, and effective dates.',
        icon: Database,
      },
      {
        section: 'platform',
        view: 'registry',
        path: '/admin/platform/registry',
        label: 'App registry',
        title: 'Application registry',
        description: 'Control registered applications, tenant availability, and launch metadata.',
        icon: Boxes,
      },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    icon: ShieldCheck,
    items: [
      {
        section: 'governance',
        view: 'audit',
        path: '/admin/governance/audit',
        label: 'Audit log',
        title: 'Audit log',
        description: 'Trace privileged changes, actor identity, outcome, and correlation context.',
        icon: ScrollText,
      },
    ],
  },
];

export const ADMIN_DEFAULT_PATH = '/admin/people/access';

const ADMIN_ITEMS = ADMIN_NAVIGATION.flatMap((group) => group.items);

export function findAdminNavigationItem(
  section: string | undefined,
  view: string | undefined
): AdminNavigationItem | undefined {
  return ADMIN_ITEMS.find((item) => item.section === section && item.view === view);
}

export function getLegacyAdminPath(view: string | null): string {
  return ADMIN_ITEMS.find((item) => item.view === view)?.path ?? ADMIN_DEFAULT_PATH;
}
