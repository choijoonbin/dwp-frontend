import {
  Boxes,
  AppWindow,
  Building2,
  ChartNoAxesCombined,
  ClipboardCheck,
  Database,
  FolderTree,
  Fingerprint,
  Image,
  KeyRound,
  Megaphone,
  PlugZap,
  ScrollText,
  SearchCheck,
  Settings2,
  ShieldCheck,
  UsersRound,
  ShieldAlert,
  Network,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type AdminSection = 'experience' | 'identity' | 'platform' | 'integrations' | 'governance';

export type AdminView =
  | 'branding'
  | 'home-experience'
  | 'announcements'
  | 'access'
  | 'app-access-requests'
  | 'access-reviews'
  | 'roles'
  | 'provisioning'
  | 'catalog'
  | 'navigation'
  | 'reference-data'
  | 'registry'
  | 'productivity'
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
  reviewerAccessible?: boolean;
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
    id: 'identity',
    icon: UsersRound,
    items: [
      {
        section: 'identity',
        view: 'access',
        path: '/admin/identity/access',
        icon: ShieldCheck,
      },
      {
        section: 'identity',
        view: 'app-access-requests',
        path: '/admin/identity/app-access-requests',
        icon: AppWindow,
      },
      {
        section: 'identity',
        view: 'access-reviews',
        path: '/admin/identity/access-reviews',
        icon: ClipboardCheck,
        reviewerAccessible: true,
      },
      {
        section: 'identity',
        view: 'roles',
        path: '/admin/identity/roles',
        icon: KeyRound,
      },
      {
        section: 'identity',
        view: 'provisioning',
        path: '/admin/identity/provisioning',
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
        view: 'catalog',
        path: '/admin/platform/catalog',
        icon: Network,
      },
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
    id: 'integrations',
    icon: PlugZap,
    items: [
      {
        section: 'integrations',
        view: 'productivity',
        path: '/admin/integrations/productivity',
        icon: PlugZap,
        requiredResourceKey: 'ADMIN.PRODUCTIVITY_CONNECTOR',
        requiredPermissionCode: 'MANAGE',
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

export const ADMIN_DEFAULT_PATH = '/admin/identity/access';

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
