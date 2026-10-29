import {
  BookKey,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  Clock3,
  ContactRound,
  DatabaseZap,
  FileCheck2,
  FileLock2,
  Gauge,
  GitBranch,
  HeartHandshake,
  House,
  LifeBuoy,
  Network,
  ReceiptText,
  ShieldCheck,
  Settings2,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import type { ProductNavigationItem } from '../../components/product-manifest';
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
  'start' | 'personal' | 'organization' | 'team' | 'operate' | 'design' | 'foundation';
export type HcmView =
  | 'home'
  | 'me'
  | 'employment-documents'
  | 'requests'
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
  | 'team-leave'
  | 'team-people-changes'
  | 'team-delegation'
  | 'operations'
  | 'operations-home'
  | 'people'
  | 'employee-change-requests'
  | 'employment-assignments'
  | 'people-appointments'
  | 'certificates-documents'
  | 'organization-positions'
  | 'assignments'
  | 'time-operations'
  | 'time-work-plans'
  | 'time-clock-ingestion'
  | 'time-interpretation'
  | 'time-exceptions'
  | 'absence-operations'
  | 'time-leave-operations'
  | 'benefits-operations'
  | 'pay-operations'
  | 'payroll-population'
  | 'talent-operations'
  | 'performance-goal-cycles'
  | 'performance-review-operations'
  | 'compensation-planning'
  | 'organization-design'
  | 'reference-data'
  | 'data-operations'
  | 'system-access'
  | 'settings-reference'
  | 'settings-payroll'
  | 'settings-navigation-policy'
  | 'settings-operations'
  | 'settings-people-employment'
  | 'settings-workflow'
  | 'exports';

export type HcmNavigationItem = ProductNavigationItem & {
  section: HcmSection;
  view: HcmView;
  audience: HcmAudience;
  governedOnly?: boolean;
};

export type HcmNavigationGroup = {
  id: HcmSection;
  items: readonly HcmNavigationItem[];
};

export { HRIS_R7_GOVERNED_PAGE_CATALOG } from '../../components/hris-governed-page-catalog';
export type { HrisR7GovernedPageCatalogItem } from '../../components/hris-governed-page-catalog';

const HCM_FULL_NAVIGATION: readonly HcmNavigationGroup[] = [
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
      {
        section: 'personal',
        view: 'employment-documents',
        path: '/hr/me/employment-documents',
        icon: FileLock2,
        audience: 'all',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_WORKFORCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'personal',
        view: 'requests',
        path: '/hr/me/requests',
        icon: FileCheck2,
        audience: 'all',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_SELF_REQUEST',
        requiredPermissionCode: 'VIEW',
      },
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
        view: 'team-leave',
        path: '/hr/team/leave',
        icon: CalendarDays,
        audience: 'manager',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_ABSENCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'team',
        view: 'team-people-changes',
        path: '/hr/team/people-changes',
        icon: ClipboardList,
        audience: 'manager',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_WORKFORCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'team',
        view: 'team-delegation',
        path: '/hr/team/delegation',
        icon: GitBranch,
        audience: 'manager',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_WORKFORCE',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
  {
    id: 'operate',
    items: [
      {
        section: 'operate',
        view: 'operations-home',
        path: '/hr/operations/home',
        icon: Gauge,
        audience: 'operator',
        governedOnly: true,
        requiredAnySupportScopes: ['WORKFORCE_READ'],
      },
      {
        section: 'operate',
        view: 'time-operations',
        path: '/hr/operations/time',
        icon: Clock3,
        audience: 'time-admin',
        requiredResourceKey: 'DATA.HR_TIME',
        requiredAnyPermissionCodes: ['VIEW_TENANT', 'APPROVE', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'time-work-plans',
        path: '/hr/operations/time/work-plans',
        icon: CalendarCheck2,
        audience: 'time-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_TIME',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'time-clock-ingestion',
        path: '/hr/operations/time/clock-ingestion',
        icon: Clock3,
        audience: 'time-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_TIME',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'time-interpretation',
        path: '/hr/operations/time/interpretation',
        icon: Clock3,
        audience: 'time-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_TIME',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'time-exceptions',
        path: '/hr/operations/time/exceptions',
        icon: CalendarCheck2,
        audience: 'time-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_TIME',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'time-leave-operations',
        path: '/hr/operations/time/leave-operations',
        icon: CalendarCheck2,
        audience: 'absence-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_ABSENCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'benefits-operations',
        path: '/hr/operations/benefits',
        icon: HeartHandshake,
        audience: 'benefits-admin',
        requiredResourceKey: 'DATA.HR_BENEFITS',
        requiredAnyPermissionCodes: ['VIEW_TENANT', 'APPROVE', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'pay-operations',
        path: '/hr/operations/pay',
        icon: ReceiptText,
        audience: 'pay-admin',
        requiredResourceKey: 'DATA.HR_PAY',
        requiredAnyPermissionCodes: ['VIEW_TENANT', 'APPROVE', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'talent-operations',
        path: '/hr/operations/talent',
        icon: ShieldCheck,
        audience: 'talent-admin',
        requiredResourceKey: 'DATA.HR_TALENT',
        requiredAnyPermissionCodes: ['VIEW_TENANT', 'APPROVE', 'MANAGE'],
      },
      {
        section: 'operate',
        view: 'performance-goal-cycles',
        path: '/hr/operations/performance/goal-cycles',
        icon: ShieldCheck,
        audience: 'talent-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_TALENT',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'performance-review-operations',
        path: '/hr/operations/performance/review-operations',
        icon: ShieldCheck,
        audience: 'talent-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_TALENT',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'compensation-planning',
        path: '/hr/operations/performance/compensation-planning',
        icon: ReceiptText,
        audience: 'talent-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_COMPENSATION_PLAN',
        requiredPermissionCode: 'VIEW',
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
        view: 'employee-change-requests',
        path: '/hr/operations/people/employee-change-requests',
        icon: ClipboardList,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_WORKFORCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'employment-assignments',
        path: '/hr/operations/people/employment-assignments',
        icon: ClipboardList,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_WORKFORCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'people-appointments',
        path: '/hr/operations/people/appointments',
        icon: BriefcaseBusiness,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_WORKFORCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'certificates-documents',
        path: '/hr/operations/people/certificates-documents',
        icon: FileCheck2,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_WORKFORCE',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'organization-positions',
        path: '/hr/operations/people/organization-positions',
        icon: Network,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_ORGANIZATION',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'operate',
        view: 'payroll-population',
        path: '/hr/operations/payroll/population',
        icon: ReceiptText,
        audience: 'pay-admin',
        governedOnly: true,
        requiredResourceKey: 'DATA.HR_PAY',
        requiredPermissionCode: 'VIEW',
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
        requiredResourceKey: 'ACTION.WORKFORCE_ORG_DESIGN',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
  {
    id: 'foundation',
    items: [
      {
        section: 'foundation',
        view: 'system-access',
        path: '/hr/manage/system',
        icon: Settings2,
        // This read-only entry explains the current subject's effective HRIS access. The owner
        // APIs still filter configuration/governance actions by exact authority. It remains
        // dormant while product-surface governance is OFF because no safe legacy owner scope
        // exists for this page.
        audience: 'all',
        governedOnly: true,
      },
      {
        section: 'foundation',
        view: 'settings-reference',
        path: '/hr/settings/reference-data',
        icon: BookKey,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'CONFIG.HRIS_WORKBENCH',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'foundation',
        view: 'settings-payroll',
        path: '/hr/settings/payroll',
        icon: ReceiptText,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'CONFIG.HRIS_WORKBENCH',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'foundation',
        view: 'settings-navigation-policy',
        path: '/hr/settings/navigation-policy',
        icon: Settings2,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'CONFIG.HRIS_NAVIGATION_POLICY',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'foundation',
        view: 'settings-operations',
        path: '/hr/settings/operations',
        icon: Gauge,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'CONFIG.HRIS_WORKBENCH',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'foundation',
        view: 'settings-people-employment',
        path: '/hr/settings/people-employment',
        icon: Settings2,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'CONFIG.HRIS_WORKBENCH',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'foundation',
        view: 'settings-workflow',
        path: '/hr/settings/workflow',
        icon: GitBranch,
        audience: 'operator',
        governedOnly: true,
        requiredResourceKey: 'CONFIG.HRIS_WORKBENCH',
        requiredPermissionCode: 'VIEW',
      },
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
        requiredResourceKey: 'ACTION.WORKFORCE_CONTROLLED_EXPORT',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
];

export function isHrisHrm009FrontendEnabled() {
  return import.meta.env?.VITE_HRIS_HRM_009_ENABLED === 'true';
}

export function createHcmNavigation(
  hrm009Enabled = isHrisHrm009FrontendEnabled()
): readonly HcmNavigationGroup[] {
  if (hrm009Enabled) return HCM_FULL_NAVIGATION;

  return HCM_FULL_NAVIGATION.flatMap((group) => {
    const items = group.items.filter(
      (item) => item.view !== 'requests' && item.view !== 'certificates-documents'
    );
    return items.length ? [{ ...group, items }] : [];
  });
}

export const HCM_NAVIGATION = createHcmNavigation();

/**
 * Historical bookmarks remain resolvable, but are deliberately kept outside every navigation
 * projection. The canonical R6-C PAGE owns menu placement; these aliases can only be reached by
 * an existing deep link and never create a second menu entry.
 */
export const HCM_DEEP_LINK_COMPATIBILITY_ITEMS: readonly HcmNavigationItem[] = Object.freeze([
  Object.freeze({
    section: 'team',
    view: 'team-leave',
    path: '/hr/team/absence',
    icon: CalendarDays,
    audience: 'manager',
  }),
  Object.freeze({
    section: 'operate',
    view: 'operations-home',
    path: '/hr/operations',
    icon: Gauge,
    audience: 'operator',
    requiredAnySupportScopes: ['WORKFORCE_READ'],
  }),
  Object.freeze({
    section: 'operate',
    view: 'time-leave-operations',
    path: '/hr/operations/absence',
    icon: CalendarCheck2,
    audience: 'absence-admin',
    requiredResourceKey: 'DATA.HR_ABSENCE',
    requiredAnyPermissionCodes: ['VIEW_TENANT', 'APPROVE', 'MANAGE'],
  }),
]);

const policy = (accessPolicyKey: string) => ({ type: 'policy' as const, accessPolicyKey });
const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

const HCM_PERSONAL_NAVIGATION_WITH_HRM009 = projectProductSurfaceNavigation(HCM_FULL_NAVIGATION, {
  home: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  me: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  'employment-documents': {
    taskKind: 'work',
    access: capability('hcm.personal.profile.view'),
  },
  requests: { taskKind: 'work', access: capability('hcm.personal.requests.view') },
  time: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  absence: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  benefits: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  pay: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  talent: { taskKind: 'work', access: policy('hcm.personal-core-access.v1') },
  services: { taskKind: 'work', access: policy('hcm.personal-services-access.v1') },
  directory: { taskKind: 'work', access: policy('hcm.directory-access.v1') },
  organization: { taskKind: 'work', access: policy('hcm.directory-access.v1') },
});

function withoutHrm009Navigation(navigation: ReturnType<typeof projectProductSurfaceNavigation>) {
  return navigation.flatMap((group) => {
    const items = group.items.filter(
      (item) => item.view !== 'requests' && item.view !== 'certificates-documents'
    );
    return items.length ? [{ ...group, items }] : [];
  });
}

export function createHcmPersonalNavigation(hrm009Enabled = isHrisHrm009FrontendEnabled()) {
  return hrm009Enabled
    ? HCM_PERSONAL_NAVIGATION_WITH_HRM009
    : withoutHrm009Navigation(HCM_PERSONAL_NAVIGATION_WITH_HRM009);
}

export const HCM_PERSONAL_NAVIGATION = createHcmPersonalNavigation();

export const HCM_TEAM_NAVIGATION = projectProductSurfaceNavigation(HCM_NAVIGATION, {
  team: { taskKind: 'team', access: policy('hcm.team-access.v1') },
  'team-time': { taskKind: 'team', access: capability('hcm.team.time.read') },
  'team-leave': { taskKind: 'team', access: capability('hcm.team.absence.read') },
  'team-people-changes': {
    taskKind: 'team',
    access: capability('hcm.team.people-change.view'),
  },
  'team-delegation': {
    taskKind: 'team',
    access: capability('hcm.team.members.view'),
  },
});

const HCM_OPERATIONS_NAVIGATION_WITH_HRM009 = projectProductSurfaceNavigation(HCM_FULL_NAVIGATION, {
  'operations-home': {
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
  'time-work-plans': {
    taskKind: 'operations',
    access: capability('hcm.operations.time.read'),
  },
  'time-clock-ingestion': {
    taskKind: 'operations',
    access: capability('hcm.operations.time.view'),
  },
  'time-interpretation': {
    taskKind: 'operations',
    access: capability('hcm.operations.time.view'),
  },
  'time-exceptions': {
    taskKind: 'operations',
    access: capability('hcm.operations.time.view'),
  },
  'time-leave-operations': {
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
  'performance-goal-cycles': {
    taskKind: 'operations',
    access: capability('hcm.operations.talent.read'),
  },
  'performance-review-operations': {
    taskKind: 'operations',
    access: capability('hcm.operations.performance.view'),
  },
  'compensation-planning': {
    taskKind: 'operations',
    access: capability('hcm.compensation.plan.view'),
  },
  people: { taskKind: 'operations', access: capability('hcm.operations.workforce.read') },
  'employee-change-requests': {
    taskKind: 'operations',
    access: capability('hcm.operations.people.view'),
  },
  'employment-assignments': {
    taskKind: 'operations',
    access: capability('hcm.operations.people.view'),
  },
  'people-appointments': {
    taskKind: 'operations',
    access: capability('hcm.operations.people.view'),
  },
  'certificates-documents': {
    taskKind: 'operations',
    access: capability('hcm.operations.people.view'),
  },
  'organization-positions': {
    taskKind: 'operations',
    access: capability('hcm.operations.organization.view'),
  },
  'payroll-population': {
    taskKind: 'operations',
    access: capability('hcm.operations.payroll-support.view'),
  },
  assignments: { taskKind: 'operations', access: capability('hcm.operations.workforce.read') },
});

export function createHcmOperationsNavigation(hrm009Enabled = isHrisHrm009FrontendEnabled()) {
  return hrm009Enabled
    ? HCM_OPERATIONS_NAVIGATION_WITH_HRM009
    : withoutHrm009Navigation(HCM_OPERATIONS_NAVIGATION_WITH_HRM009);
}

export const HCM_OPERATIONS_NAVIGATION = createHcmOperationsNavigation();

export const HCM_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(HCM_NAVIGATION, {
  'system-access': {
    taskKind: 'administration',
    access: policy('hcm.management-system-access.v1'),
  },
  'settings-reference': {
    taskKind: 'administration',
    access: capability('hcm.configuration.workbench.view'),
  },
  'settings-payroll': {
    taskKind: 'administration',
    access: capability('hcm.configuration.workbench.view'),
  },
  'settings-navigation-policy': {
    taskKind: 'administration',
    access: capability('hcm.configuration.navigation-policy.view'),
  },
  'settings-operations': {
    taskKind: 'administration',
    access: capability('hcm.configuration.workbench.view'),
  },
  'settings-people-employment': {
    taskKind: 'administration',
    access: capability('hcm.configuration.workbench.view'),
  },
  'settings-workflow': {
    taskKind: 'administration',
    access: capability('hcm.configuration.workflow.view'),
  },
  'organization-design': {
    taskKind: 'administration',
    access: capability('hcm.org-design.read'),
  },
  'reference-data': { taskKind: 'administration', access: capability('hcm.reference.read') },
  'data-operations': { taskKind: 'operations', access: capability('hcm.integration.read') },
  exports: { taskKind: 'operations', access: capability('hcm.controlled-export.read') },
});

export { HCM_DEFAULT_PATH, mapLegacyHrPath } from './hcm-legacy-paths';

export type HcmAudienceAccess = {
  isManager: boolean;
  canOperate: boolean;
  canManageTime?: boolean;
  canManageAbsence?: boolean;
  canManageBenefits?: boolean;
  canManagePay?: boolean;
  canManageTalent?: boolean;
  canAccessOperationsOverview?: boolean;
  canAccessOrganizationDesign?: boolean;
  canAccessReferenceData?: boolean;
  canAccessDataOperations?: boolean;
  canAccessExports?: boolean;
};

export function canAccessHcmNavigationAudience(
  item: HcmNavigationItem,
  access: HcmAudienceAccess
): boolean {
  if (item.governedOnly) return false;
  if (item.audience === 'all') return true;
  if (item.audience === 'manager') return access.isManager;
  if (item.audience === 'time-admin') return access.canManageTime === true;
  if (item.audience === 'absence-admin') return access.canManageAbsence === true;
  if (item.audience === 'benefits-admin') return access.canManageBenefits === true;
  if (item.audience === 'pay-admin') return access.canManagePay === true;
  if (item.audience === 'talent-admin') return access.canManageTalent === true;
  if (item.view === 'operations-home') {
    return (
      access.canAccessOperationsOverview === true ||
      access.canOperate ||
      access.canManageTime === true ||
      access.canManageAbsence === true ||
      access.canManageBenefits === true ||
      access.canManagePay === true ||
      access.canManageTalent === true
    );
  }
  if (item.view === 'organization-design') return access.canAccessOrganizationDesign === true;
  if (item.view === 'reference-data') return access.canAccessReferenceData === true;
  if (item.view === 'data-operations') return access.canAccessDataOperations === true;
  if (item.view === 'exports') return access.canAccessExports === true;
  return access.canOperate;
}

export function visibleHcmNavigation(access: HcmAudienceAccess): HcmNavigationGroup[] {
  return HCM_NAVIGATION.flatMap((group) => {
    const items = group.items.filter((item) => canAccessHcmNavigationAudience(item, access));
    return items.length ? [{ ...group, items }] : [];
  });
}

export function findHcmNavigationItem(
  pathname: string,
  navigation: readonly HcmNavigationGroup[] = HCM_NAVIGATION
): HcmNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return [...navigation.flatMap((group) => group.items), ...HCM_DEEP_LINK_COMPATIBILITY_ITEMS].find(
    (item) => item.path === normalized
  );
}
