import {
  Archive,
  BadgeCheck,
  BarChart3,
  Cable,
  CheckCircle2,
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
  Network,
  Rocket,
  ScrollText,
  Send,
  ShieldCheck,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import type {
  ProductNavigationGroup,
  ProductSurfaceNavigationGroup,
} from '../../components/product-manifest';

export type ApprovalView =
  | 'home'
  | 'inbox'
  | 'completed'
  | 'new'
  | 'drafts'
  | 'submitted'
  | 'needs-info'
  | 'archive'
  | 'delegations'
  | 'admin-overview'
  | 'workflows'
  | 'forms'
  | 'routing'
  | 'policies'
  | 'integrations'
  | 'audit'
  | 'operations'
  | 'signatures'
  | 'analytics'
  | 'deployments';

export type ApprovalAdminView = Extract<
  ApprovalView,
  | 'admin-overview'
  | 'forms'
  | 'workflows'
  | 'routing'
  | 'policies'
  | 'integrations'
  | 'audit'
  | 'operations'
  | 'signatures'
  | 'analytics'
  | 'deployments'
>;

const APPROVAL_ADMIN_V2_VIEWS: ReadonlySet<ApprovalAdminView> = new Set([
  'forms',
  'routing',
  'policies',
  'integrations',
  'audit',
  'operations',
  'analytics',
  'deployments',
]);

export function isApprovalAdminV2View(view: ApprovalView): view is ApprovalAdminView {
  return APPROVAL_ADMIN_V2_VIEWS.has(view as ApprovalAdminView);
}

export type ApprovalNavigationItem = {
  view: ApprovalView;
  path: string;
  icon: LucideIcon;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
  requiredAllPermissionCodes?: readonly string[];
};

export const APPROVAL_WORK_NAVIGATION = [
  {
    id: 'overview',
    items: [
      {
        view: 'home',
        path: '/approvals/home',
        icon: House,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'approvals.work-access.v1' },
      },
    ],
  },
  {
    id: 'decisions',
    items: [
      {
        view: 'inbox',
        path: '/approvals/inbox',
        icon: ClipboardCheck,
        taskKind: 'work',
        access: {
          type: 'capability',
          capabilityContractKey: 'approvals.work.task.read',
        },
      },
      {
        view: 'completed',
        path: '/approvals/completed',
        icon: CheckCircle2,
        taskKind: 'work',
        access: {
          type: 'capability',
          capabilityContractKey: 'approvals.work.task.read',
        },
      },
      {
        view: 'new',
        path: '/approvals/requests/new',
        icon: FileInput,
        taskKind: 'work',
        access: {
          type: 'capability-expression',
          mode: 'ALL',
          capabilityContractKeys: [
            'approvals.work.request.create',
            'approvals.work.request.update',
          ],
        },
      },
      {
        view: 'drafts',
        path: '/approvals/requests/drafts',
        icon: FilePenLine,
        taskKind: 'work',
        access: {
          type: 'capability',
          capabilityContractKey: 'approvals.work.request.read',
        },
      },
      {
        view: 'submitted',
        path: '/approvals/requests/submitted',
        icon: Send,
        taskKind: 'work',
        access: {
          type: 'capability',
          capabilityContractKey: 'approvals.work.request.read',
        },
      },
      {
        view: 'needs-info',
        path: '/approvals/requests/needs-info',
        icon: MessagesSquare,
        taskKind: 'work',
        access: {
          type: 'capability',
          capabilityContractKey: 'approvals.work.request.read',
        },
      },
      {
        view: 'archive',
        path: '/approvals/requests/archive',
        icon: Archive,
        taskKind: 'work',
        access: {
          type: 'capability',
          capabilityContractKey: 'approvals.work.request.read',
        },
      },
      {
        view: 'delegations',
        path: '/approvals/delegations',
        icon: BadgeCheck,
        taskKind: 'work',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.work.delegation.read',
            'approvals.work.delegation.manage',
          ],
        },
      },
    ],
  },
] as const satisfies readonly ProductSurfaceNavigationGroup[];

export const APPROVAL_MANAGEMENT_NAVIGATION = [
  {
    id: 'administration',
    items: [
      {
        view: 'admin-overview',
        path: '/approvals/admin/overview',
        icon: Gauge,
        taskKind: 'operations',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.operations.read',
            'approvals.oversight.overview.read',
          ],
        },
      },
      {
        view: 'forms',
        path: '/approvals/admin/forms',
        icon: FileStack,
        taskKind: 'administration',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: ['approvals.design.read', 'approvals.oversight.design.read'],
        },
      },
      {
        view: 'workflows',
        path: '/approvals/admin/workflows',
        icon: GitBranch,
        taskKind: 'administration',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: ['approvals.design.read', 'approvals.oversight.design.read'],
        },
      },
      {
        view: 'routing',
        path: '/approvals/admin/routing',
        icon: Network,
        taskKind: 'administration',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: ['approvals.design.read', 'approvals.oversight.design.read'],
        },
      },
      {
        view: 'policies',
        path: '/approvals/admin/policies',
        icon: ShieldCheck,
        taskKind: 'administration',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: ['approvals.policy.read', 'approvals.oversight.policy.read'],
        },
      },
      {
        view: 'integrations',
        path: '/approvals/admin/integrations',
        icon: Cable,
        taskKind: 'administration',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.operations.read',
            'approvals.oversight.operations.read',
          ],
        },
      },
      {
        view: 'audit',
        path: '/approvals/admin/audit',
        icon: ScrollText,
        taskKind: 'operations',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.audit.operations.read',
            'approvals.oversight.operations.read',
          ],
        },
      },
      {
        view: 'operations',
        path: '/approvals/admin/operations',
        icon: ListChecks,
        taskKind: 'operations',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.operations.read',
            'approvals.audit.operations.read',
            'approvals.oversight.operations.read',
          ],
        },
      },
      {
        view: 'signatures',
        path: '/approvals/admin/signatures',
        icon: KeyRound,
        taskKind: 'administration',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.signature.read',
            'approvals.oversight.signature.read',
          ],
        },
      },
      {
        view: 'analytics',
        path: '/approvals/admin/analytics',
        icon: BarChart3,
        taskKind: 'operations',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.operations.read',
            'approvals.audit.operations.read',
            'approvals.oversight.operations.read',
          ],
        },
      },
      {
        view: 'deployments',
        path: '/approvals/admin/deployments',
        icon: Rocket,
        taskKind: 'administration',
        access: {
          type: 'capability-expression',
          mode: 'ANY',
          capabilityContractKeys: [
            'approvals.design.read',
            'approvals.operations.read',
            'approvals.oversight.design.read',
            'approvals.oversight.operations.read',
          ],
        },
      },
    ],
  },
] as const satisfies readonly ProductSurfaceNavigationGroup[];

/** Flag-off compatibility projection. New surface routes never authorize from these fields. */
export const APPROVAL_NAVIGATION = [
  ...APPROVAL_WORK_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.view === 'home') return item;
      if (item.view === 'inbox' || item.view === 'completed') {
        return {
          ...item,
          requiredResourceKey: 'ACTION.APPROVAL_TASK',
          requiredPermissionCode: 'VIEW',
        };
      }
      if (item.view === 'new') {
        return {
          ...item,
          requiredResourceKey: 'ACTION.APPROVAL_REQUEST',
          requiredAllPermissionCodes: ['CREATE', 'UPDATE'],
        };
      }
      if (item.view === 'delegations') {
        return {
          ...item,
          requiredResourceKey: 'ACTION.APPROVAL_DELEGATION',
          requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
        };
      }
      return {
        ...item,
        requiredResourceKey: 'ACTION.APPROVAL_REQUEST',
        requiredPermissionCode: 'VIEW',
      };
    }),
  })),
  ...APPROVAL_MANAGEMENT_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      requiredResourceKey:
        item.view === 'workflows' || item.view === 'forms' || item.view === 'routing'
          ? 'ADMIN.APPROVAL_DESIGN'
          : item.view === 'policies'
            ? 'ADMIN.APPROVAL_POLICY'
            : item.view === 'signatures'
              ? 'ADMIN.APPROVAL_SIGNATURE'
              : 'ADMIN.APPROVAL_OPERATIONS',
      requiredPermissionCode: 'VIEW',
    })),
  })),
] as const satisfies readonly ProductNavigationGroup[];

export const APPROVAL_DEFAULT_PATH = '/approvals/home';

export function findApprovalNavigationItem(pathname: string): ApprovalNavigationItem | undefined {
  for (const group of APPROVAL_NAVIGATION) {
    const items = group.items as readonly ApprovalNavigationItem[];
    const item = items.find((candidate) => candidate.path === pathname);
    if (item) return item;
  }
  return undefined;
}

export function isApprovalAdminView(view: ApprovalView): view is ApprovalAdminView {
  return [
    'admin-overview',
    'forms',
    'workflows',
    'routing',
    'policies',
    'integrations',
    'audit',
    'operations',
    'signatures',
    'analytics',
    'deployments',
  ].includes(view);
}
