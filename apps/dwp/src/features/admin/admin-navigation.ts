import {
  Boxes,
  Building2,
  Database,
  FolderTree,
  Image,
  KeyRound,
  Megaphone,
  Network,
  PlugZap,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type AdminSection = 'experience' | 'people' | 'platform' | 'governance';

export type AdminView =
  | 'branding'
  | 'home-experience'
  | 'announcements'
  | 'access'
  | 'roles'
  | 'people-directory'
  | 'provisioning'
  | 'directory'
  | 'navigation'
  | 'reference-data'
  | 'registry'
  | 'audit';

export type AdminNavigationItem = {
  section: AdminSection;
  view: AdminView;
  path: string;
  icon: LucideIcon;
};

export type AdminNavigationGroup = {
  id: AdminSection;
  icon: LucideIcon;
  items: AdminNavigationItem[];
};

export const ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  {
    id: 'experience',
    icon: Building2,
    items: [
      {
        section: 'experience',
        view: 'branding',
        path: '/admin/experience/branding',
        icon: Building2,
      },
      {
        section: 'experience',
        view: 'home-experience',
        path: '/admin/experience/home-experience',
        icon: Image,
      },
      {
        section: 'experience',
        view: 'announcements',
        path: '/admin/experience/announcements',
        icon: Megaphone,
      },
    ],
  },
  {
    id: 'people',
    icon: UsersRound,
    items: [
      {
        section: 'people',
        view: 'access',
        path: '/admin/people/access',
        icon: ShieldCheck,
      },
      {
        section: 'people',
        view: 'roles',
        path: '/admin/people/roles',
        icon: KeyRound,
      },
      {
        section: 'people',
        view: 'people-directory',
        path: '/admin/people/people-directory',
        icon: UserRoundSearch,
      },
      {
        section: 'people',
        view: 'directory',
        path: '/admin/people/directory',
        icon: Network,
      },
      {
        section: 'people',
        view: 'provisioning',
        path: '/admin/people/provisioning',
        icon: PlugZap,
      },
    ],
  },
  {
    id: 'platform',
    icon: Settings2,
    items: [
      {
        section: 'platform',
        view: 'reference-data',
        path: '/admin/platform/reference-data',
        icon: Database,
      },
      {
        section: 'platform',
        view: 'registry',
        path: '/admin/platform/registry',
        icon: Boxes,
      },
      {
        section: 'platform',
        view: 'navigation',
        path: '/admin/platform/navigation',
        icon: FolderTree,
      },
    ],
  },
  {
    id: 'governance',
    icon: ShieldCheck,
    items: [
      {
        section: 'governance',
        view: 'audit',
        path: '/admin/governance/audit',
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
