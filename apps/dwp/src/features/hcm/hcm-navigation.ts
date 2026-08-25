import {
  BookKey,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  Clock3,
  ContactRound,
  DatabaseZap,
  FileLock2,
  Gauge,
  GitBranch,
  HeartHandshake,
  House,
  LifeBuoy,
  Network,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';

export type HcmAudience =
  | 'all'
  | 'manager'
  | 'operator'
  | 'time-admin'
  | 'absence-admin'
  | 'benefits-admin'
  | 'pay-admin'
  | 'talent-admin';
export type HcmSection =
  | 'start'
  | 'personal'
  | 'organization'
  | 'team'
  | 'operate'
  | 'design'
  | 'foundation';
export type HcmView =
  | 'home'
  | 'me'
  | 'time'
  | 'absence'
  | 'benefits'
  | 'pay'
  | 'talent'
  | 'services'
  | 'directory'
  | 'organization'
  | 'team'
  | 'team-time'
  | 'team-absence'
  | 'operations'
  | 'people'
  | 'assignments'
  | 'time-operations'
  | 'absence-operations'
  | 'benefits-operations'
  | 'pay-operations'
  | 'talent-operations'
  | 'organization-design'
  | 'reference-data'
  | 'data-operations'
  | 'exports';

export type HcmNavigationItem = {
  section: HcmSection;
  view: HcmView;
  path: string;
  icon: LucideIcon;
  audience: HcmAudience;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  requiredAnyPermissionCodes?: readonly string[];
  requiredAnySupportScopes?: readonly string[];
};

export type HcmNavigationGroup = {
  id: HcmSection;
  items: readonly HcmNavigationItem[];
};

export const HCM_NAVIGATION: readonly HcmNavigationGroup[] = [
  {
    id: 'start',
    items: [
      {
        section: 'start',
        view: 'home',
        path: '/hr/home',
        icon: House,
        audience: 'all',
        requiredAnySupportScopes: ['WORKFORCE_READ'],
      },
    ],
  },
  {
    id: 'personal',
    items: [
      { section: 'personal', view: 'me', path: '/hr/me', icon: ContactRound, audience: 'all' },
      { section: 'personal', view: 'time', path: '/hr/time', icon: Clock3, audience: 'all' },
      {
        section: 'personal',
        view: 'absence',
        path: '/hr/absence',
        icon: CalendarDays,
        audience: 'all',
      },
      {
        section: 'personal',
        view: 'benefits',
        path: '/hr/benefits',
        icon: HeartHandshake,
        audience: 'all',
      },
      { section: 'personal', view: 'pay', path: '/hr/pay', icon: ReceiptText, audience: 'all' },
      {
        section: 'personal',
        view: 'talent',
        path: '/hr/talent',
        icon: Sparkles,
        audience: 'all',
      },
      {
        section: 'personal',
        view: 'services',
        path: '/hr/services',
        icon: LifeBuoy,
        audience: 'all',
        requiredResourceKey: 'APP.EMPLOYEE_SERVICES',
        requiredPermissionCode: 'VIEW',
      },
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
        requiredAnySupportScopes: ['WORKFORCE_READ'],
      },
      {
        section: 'organization',
        view: 'organization',
        path: '/hr/organization',
        icon: Network,
        audience: 'all',
        requiredAnySupportScopes: ['WORKFORCE_READ'],
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
      {
        section: 'team',
        view: 'team-time',
        path: '/hr/team/time',
        icon: CalendarCheck2,
        audience: 'manager',
      },
      {
        section: 'team',
        view: 'team-absence',
        path: '/hr/team/absence',
        icon: CalendarDays,
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
        requiredAnySupportScopes: ['WORKFORCE_READ'],
      },
      {
        section: 'operate',
        view: 'time-operations',
        path: '/hr/operations/time',
        icon: Clock3,
        audience: 'time-admin',
        requiredResourceKey: 'DATA.HR_TIME',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'absence-operations',
        path: '/hr/operations/absence',
        icon: CalendarCheck2,
        audience: 'absence-admin',
        requiredResourceKey: 'DATA.HR_ABSENCE',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'benefits-operations',
        path: '/hr/operations/benefits',
        icon: HeartHandshake,
        audience: 'benefits-admin',
        requiredResourceKey: 'DATA.HR_BENEFITS',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'pay-operations',
        path: '/hr/operations/pay',
        icon: ReceiptText,
        audience: 'pay-admin',
        requiredResourceKey: 'DATA.HR_PAY',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'talent-operations',
        path: '/hr/operations/talent',
        icon: ShieldCheck,
        audience: 'talent-admin',
        requiredResourceKey: 'DATA.HR_TALENT',
        requiredAnyPermissionCodes: ['VIEW', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'people',
        path: '/hr/operations/people',
        icon: BriefcaseBusiness,
        audience: 'operator',
        requiredAnySupportScopes: ['WORKFORCE_READ'],
      },
      {
        section: 'operate',
        view: 'assignments',
        path: '/hr/operations/assignments',
        icon: ClipboardList,
        audience: 'operator',
        requiredAnySupportScopes: ['WORKFORCE_READ'],
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
        requiredAnySupportScopes: ['WORKFORCE_READ'],
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

const policy = (accessPolicyKey: string) => ({ type: 'policy' as const, accessPolicyKey });
const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

export const HCM_PERSONAL_NAVIGATION = projectProductSurfaceNavigation(HCM_NAVIGATION, {
  home: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  me: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  time: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  absence: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  benefits: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  pay: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  talent: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  services: { taskKind: 'work', access: policy('hcm.personal-services-access.v1') },
  directory: { taskKind: 'work', access: policy('hcm.directory-access.v1') },
  organization: { taskKind: 'work', access: policy('hcm.directory-access.v1') },
});

export const HCM_TEAM_NAVIGATION = projectProductSurfaceNavigation(HCM_NAVIGATION, {
  team: { taskKind: 'team', access: policy('hcm.team-access.v1') },
  'team-time': { taskKind: 'team', access: capability('hcm.team.time.read') },
  'team-absence': { taskKind: 'team', access: capability('hcm.team.absence.read') },
});

export const HCM_OPERATIONS_NAVIGATION = projectProductSurfaceNavigation(HCM_NAVIGATION, {
  operations: {
    taskKind: 'operations',
    access: {
      type: 'capability-expression',
      mode: 'ANY',
      capabilityContractKeys: [
        'hcm.operations.workforce.read',
        'hcm.operations.time.read',
        'hcm.operations.absence.read',
        'hcm.operations.benefits.read',
        'hcm.operations.pay.read',
        'hcm.operations.talent.read',
      ],
    },
  },
  'time-operations': { taskKind: 'operations', access: capability('hcm.operations.time.read') },
  'absence-operations': {
    taskKind: 'operations',
    access: capability('hcm.operations.absence.read'),
  },
  'benefits-operations': {
    taskKind: 'operations',
    access: capability('hcm.operations.benefits.read'),
  },
  'pay-operations': { taskKind: 'operations', access: capability('hcm.operations.pay.read') },
  'talent-operations': {
    taskKind: 'operations',
    access: capability('hcm.operations.talent.read'),
  },
  people: { taskKind: 'operations', access: capability('hcm.operations.workforce.read') },
  assignments: { taskKind: 'operations', access: capability('hcm.operations.workforce.read') },
});

export const HCM_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(HCM_NAVIGATION, {
  'organization-design': {
    taskKind: 'administration',
    access: capability('hcm.org-design.read'),
  },
  'reference-data': { taskKind: 'administration', access: capability('hcm.reference.read') },
  'data-operations': { taskKind: 'operations', access: capability('hcm.integration.read') },
  exports: { taskKind: 'operations', access: capability('hcm.controlled-export.read') },
});

export { HCM_DEFAULT_PATH, mapLegacyHrPath } from './hcm-legacy-paths';

export function visibleHcmNavigation(access: {
  isManager: boolean;
  canOperate: boolean;
  canManageTime?: boolean;
  canManageAbsence?: boolean;
  canManageBenefits?: boolean;
  canManagePay?: boolean;
  canManageTalent?: boolean;
}): HcmNavigationGroup[] {
  return HCM_NAVIGATION.flatMap((group) => {
    const items = group.items.filter(
      (item) =>
        item.audience === 'all' ||
        (item.audience === 'manager' && access.isManager) ||
        (item.audience === 'operator' && access.canOperate) ||
        (item.audience === 'time-admin' && access.canManageTime) ||
        (item.audience === 'absence-admin' && access.canManageAbsence) ||
        (item.audience === 'benefits-admin' && access.canManageBenefits) ||
        (item.audience === 'pay-admin' && access.canManagePay) ||
        (item.audience === 'talent-admin' && access.canManageTalent)
    );
    return items.length ? [{ ...group, items }] : [];
  });
}

export function findHcmNavigationItem(pathname: string): HcmNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return HCM_NAVIGATION.flatMap((group) => group.items).find((item) => item.path === normalized);
}
