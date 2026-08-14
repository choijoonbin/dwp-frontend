import {
  Archive,
  BadgeCheck,
  ClipboardCheck,
  FileInput,
  FilePenLine,
  FileStack,
  Gauge,
  GitBranch,
  House,
  KeyRound,
  ListChecks,
  MessagesSquare,
  Send,
  ShieldCheck,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type { ProductAreaNavigationGroup } from '../../layouts/product-area-layout';

export type ApprovalView =
  | 'home'
  | 'inbox'
  | 'new'
  | 'drafts'
  | 'submitted'
  | 'needs-info'
  | 'archive'
  | 'delegations'
  | 'admin-overview'
  | 'workflows'
  | 'forms'
  | 'policies'
  | 'operations'
  | 'signatures';

export type ApprovalNavigationItem = {
  view: ApprovalView;
  path: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
};

export const APPROVAL_NAVIGATION = [
  {
    id: 'overview',
    items: [{ view: 'home', path: '/approvals/home', icon: House }],
  },
  {
    id: 'decisions',
    items: [
      {
        view: 'inbox',
        path: '/approvals/inbox',
        icon: ClipboardCheck,
        requiredResourceKey: 'ACTION.APPROVAL_TASK',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'new',
        path: '/approvals/requests/new',
        icon: FileInput,
        requiredResourceKey: 'ACTION.APPROVAL_REQUEST',
        requiredPermissionCode: 'CREATE',
      },
      {
        view: 'drafts',
        path: '/approvals/requests/drafts',
        icon: FilePenLine,
        requiredResourceKey: 'ACTION.APPROVAL_REQUEST',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'submitted',
        path: '/approvals/requests/submitted',
        icon: Send,
        requiredResourceKey: 'ACTION.APPROVAL_REQUEST',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'needs-info',
        path: '/approvals/requests/needs-info',
        icon: MessagesSquare,
        requiredResourceKey: 'ACTION.APPROVAL_REQUEST',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'archive',
        path: '/approvals/requests/archive',
        icon: Archive,
        requiredResourceKey: 'ACTION.APPROVAL_REQUEST',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'delegations',
        path: '/approvals/delegations',
        icon: BadgeCheck,
        requiredResourceKey: 'ACTION.APPROVAL_DELEGATION',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
    ],
  },
  {
    id: 'administration',
    items: [
      {
        view: 'admin-overview',
        path: '/approvals/admin/overview',
        icon: Gauge,
        requiredResourceKey: 'ADMIN.APPROVAL_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'workflows',
        path: '/approvals/admin/workflows',
        icon: GitBranch,
        requiredResourceKey: 'ADMIN.APPROVAL_DESIGN',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'forms',
        path: '/approvals/admin/forms',
        icon: FileStack,
        requiredResourceKey: 'ADMIN.APPROVAL_DESIGN',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'policies',
        path: '/approvals/admin/policies',
        icon: ShieldCheck,
        requiredResourceKey: 'ADMIN.APPROVAL_POLICY',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'operations',
        path: '/approvals/admin/operations',
        icon: ListChecks,
        requiredResourceKey: 'ADMIN.APPROVAL_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
        view: 'signatures',
        path: '/approvals/admin/signatures',
        icon: KeyRound,
        requiredResourceKey: 'ADMIN.APPROVAL_SIGNATURE',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
] as const satisfies readonly ProductAreaNavigationGroup[];

export const APPROVAL_DEFAULT_PATH = '/approvals/home';

export function findApprovalNavigationItem(pathname: string): ApprovalNavigationItem | undefined {
  for (const group of APPROVAL_NAVIGATION) {
    const items: readonly ApprovalNavigationItem[] = group.items;
    const item = items.find((candidate) => candidate.path === pathname);
    if (item) return item;
  }
  return undefined;
}

export function isApprovalAdminView(view: ApprovalView): boolean {
  return (
    view === 'admin-overview' ||
    ['workflows', 'forms', 'policies', 'operations', 'signatures'].includes(view)
  );
}
