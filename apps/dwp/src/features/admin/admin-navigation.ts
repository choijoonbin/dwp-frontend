import {
  Braces,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  Database,
  FolderTree,
  Fingerprint,
  Image,
  KeyRound,
  Megaphone,
  Network,
  PlugZap,
  ScrollText,
  SearchCheck,
  Settings2,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
  ShieldAlert,
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
  | 'system-code-catalog'
  | 'registry'
  | 'api-monitoring'
  | 'audit'
  | 'audit-overview'
  | 'audit-events'
  | 'audit-investigations'
  | 'audit-governance';

export type AdminNavigationItem = {
  section: AdminSection;
  view: AdminView;
  path: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
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
        view: 'system-code-catalog',
        path: '/admin/platform/system-code-catalog',
        icon: Braces,
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
        view: 'api-monitoring',
        path: '/admin/governance/api-monitoring',
        icon: ChartNoAxesCombined,
        requiredResourceKey: 'ADMIN.API_MONITORING',
      },
      {
        section: 'governance',
        view: 'audit-overview',
        path: '/admin/governance/audit-overview',
        icon: ScrollText,
        requiredResourceKey: 'ADMIN.AUDIT_VIEW',
      },
      {
        section: 'governance',
        view: 'audit-investigations',
        path: '/admin/governance/audit-investigations',
        icon: ShieldAlert,
        requiredResourceKey: 'ADMIN.AUDIT_INVESTIGATE',
        requiredPermissionCode: 'UPDATE',
      },
      {
        section: 'governance',
        view: 'audit-events',
        path: '/admin/governance/audit-events',
        icon: SearchCheck,
        requiredResourceKey: 'ADMIN.AUDIT_VIEW',
      },
      {
        section: 'governance',
        view: 'audit-governance',
        path: '/admin/governance/audit-governance',
        icon: Fingerprint,
        requiredResourceKey: 'ADMIN.AUDIT_CONFIGURE',
        requiredPermissionCode: 'MANAGE',
      },
    ],
  },
];

export const ADMIN_DEFAULT_PATH = '/admin/people/access';

const ADMIN_ITEMS = ADMIN_NAVIGATION.flatMap((group) => group.items);

const LEGACY_ADMIN_ITEMS: AdminNavigationItem[] = [
  {
    section: 'governance',
    view: 'audit',
    path: '/admin/governance/audit',
    icon: ScrollText,
    requiredResourceKey: 'ADMIN.AUDIT_VIEW',
  },
];

export function findAdminNavigationItem(
  section: string | undefined,
  view: string | undefined
): AdminNavigationItem | undefined {
  return [...ADMIN_ITEMS, ...LEGACY_ADMIN_ITEMS].find(
    (item) => item.section === section && item.view === view
  );
}

export function getLegacyAdminPath(view: string | null): string {
  return ADMIN_ITEMS.find((item) => item.view === view)?.path ?? ADMIN_DEFAULT_PATH;
}
