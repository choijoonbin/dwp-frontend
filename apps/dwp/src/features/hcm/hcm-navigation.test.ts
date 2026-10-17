import { describe, expect, it } from 'vitest';

import { isHrWorkItem, selectCurrentPerson } from './hcm-experience-model';
import {
  findHcmNavigationItem,
  HCM_DEEP_LINK_COMPATIBILITY_ITEMS,
  HCM_MANAGEMENT_NAVIGATION,
  HCM_OPERATIONS_NAVIGATION,
  HCM_PERSONAL_NAVIGATION,
  HCM_TEAM_NAVIGATION,
  mapLegacyHrPath,
  visibleHcmNavigation,
} from './hcm-navigation';

import type { PersonSummary } from '@dwp-frontend/shared-utils';

function person(overrides: Partial<PersonSummary> = {}): PersonSummary {
  return {
    personId: 'person-1',
    displayName: 'Minseo Kim',
    lifecycleState: 'ACTIVE',
    workEmail: 'minseo.kim@example.invalid',
    directReportCount: 0,
    dataAccess: { classification: 'DIRECTORY', workerNumberMasked: true, excludedFieldGroups: [] },
    ...overrides,
  };
}

describe('HR product navigation', () => {
  it('builds one menu from employee, manager, and operator audiences', () => {
    const employee = visibleHcmNavigation({ isManager: false, canOperate: false });
    const manager = visibleHcmNavigation({ isManager: true, canOperate: false });
    const operator = visibleHcmNavigation({ isManager: false, canOperate: true });

    expect(employee.flatMap((group) => group.items).map((item) => item.view)).toEqual([
      'home',
      'me',
      'time',
      'absence',
      'benefits',
      'pay',
      'talent',
      'services',
      'directory',
      'organization',
    ]);
    expect(manager.flatMap((group) => group.items).some((item) => item.view === 'team')).toBe(true);
    expect(operator.flatMap((group) => group.items).some((item) => item.view === 'people')).toBe(
      true
    );
  });

  it('keeps legacy bookmarks while resolving every destination to the HR shell', () => {
    expect(mapLegacyHrPath('/people/directory')).toBe('/hr/directory');
    expect(mapLegacyHrPath('/workforce/data-operations')).toBe('/hr/data/integrations');
    expect(mapLegacyHrPath('/workforce/exports')).toBe('/hr/data/exports');
    expect(mapLegacyHrPath('/WORKFORCE/DATA-OPERATIONS/?scope=S#tab')).toBeUndefined();
    expect(mapLegacyHrPath('/WORKFORCE/DATA-OPERATIONS/')).toBe('/hr/data/integrations');
    expect(mapLegacyHrPath('/people/unknown')).toBeUndefined();
    expect(mapLegacyHrPath('/workforce/unknown')).toBeUndefined();
    expect(findHcmNavigationItem('/hr/design/organization')?.view).toBe('organization-design');
  });

  it('mounts canonical R6-C pages and keeps historical aliases deep-link-only', () => {
    expect(
      [
        '/hr/operations/time/work-plans',
        '/hr/operations/performance/goal-cycles',
        '/hr/team/leave',
        '/hr/operations/time/leave-operations',
        '/hr/operations/home',
      ].map((path) => findHcmNavigationItem(path)?.path)
    ).toEqual([
      '/hr/operations/time/work-plans',
      '/hr/operations/performance/goal-cycles',
      '/hr/team/leave',
      '/hr/operations/time/leave-operations',
      '/hr/operations/home',
    ]);
    expect(HCM_DEEP_LINK_COMPATIBILITY_ITEMS.map((item) => item.path)).toEqual([
      '/hr/team/absence',
      '/hr/operations',
      '/hr/operations/absence',
    ]);
    const menuPaths = [...HCM_TEAM_NAVIGATION, ...HCM_OPERATIONS_NAVIGATION].flatMap((group) =>
      group.items.map((item) => item.path)
    );
    expect(menuPaths).not.toEqual(
      expect.arrayContaining(['/hr/team/absence', '/hr/operations', '/hr/operations/absence'])
    );
  });

  it('shows exact management work without requiring the broad workforce operator role', () => {
    const specialist = visibleHcmNavigation({
      isManager: false,
      canOperate: false,
      canAccessOrganizationDesign: true,
      canAccessReferenceData: true,
      canAccessDataOperations: true,
      canAccessExports: true,
    });
    expect(specialist.flatMap((group) => group.items).map((item) => item.view)).toEqual([
      'home',
      'me',
      'time',
      'absence',
      'benefits',
      'pay',
      'talent',
      'services',
      'directory',
      'organization',
      'organization-design',
      'reference-data',
      'data-operations',
      'exports',
    ]);
  });

  it('shows the operations overview to a single-domain administrator without broad workforce access', () => {
    const timeAdministrator = visibleHcmNavigation({
      isManager: false,
      canOperate: false,
      canManageTime: true,
      canAccessOperationsOverview: true,
    });
    const operationsViews = timeAdministrator
      .flatMap((group) => group.items)
      .filter((item) => item.section === 'operate')
      .map((item) => item.view);

    expect(operationsViews).toEqual(['time-operations']);
    expect(operationsViews).not.toContain('people');
    expect(operationsViews).not.toContain('assignments');
  });

  it('keeps legacy management item resources aligned with exact capability contracts', () => {
    expect(findHcmNavigationItem('/hr/design/organization')?.requiredResourceKey).toBe(
      'ACTION.WORKFORCE_ORG_DESIGN'
    );
    expect(findHcmNavigationItem('/hr/data/exports')?.requiredResourceKey).toBe(
      'ACTION.WORKFORCE_CONTROLLED_EXPORT'
    );
    expect(findHcmNavigationItem('/hr/manage/system')?.view).toBe('system-access');
    expect(findHcmNavigationItem('/hr/manage/system')?.governedOnly).toBe(true);
    expect(
      HCM_MANAGEMENT_NAVIGATION.flatMap((group) => group.items).find(
        (item) => item.view === 'system-access'
      )
    ).toMatchObject({
      path: '/hr/manage/system',
      taskKind: 'administration',
      access: {
        type: 'policy',
        accessPolicyKey: 'hcm.management-system-access.v1',
      },
    });
  });

  it('keeps successor module pages governed-only and bound to their exact PAGE capability', () => {
    expect(findHcmNavigationItem('/hr/me/employment-documents')).toMatchObject({
      view: 'employment-documents',
      governedOnly: true,
      requiredResourceKey: 'DATA.HRIS_WORKFORCE',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/time/clock-ingestion')).toMatchObject({
      view: 'time-clock-ingestion',
      governedOnly: true,
      requiredResourceKey: 'DATA.HR_TIME',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/time/exceptions')).toMatchObject({
      view: 'time-exceptions',
      governedOnly: true,
      requiredResourceKey: 'DATA.HR_TIME',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/time/interpretation')).toMatchObject({
      view: 'time-interpretation',
      governedOnly: true,
      requiredResourceKey: 'DATA.HR_TIME',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/time/work-plans')).toMatchObject({
      view: 'time-work-plans',
      governedOnly: true,
      requiredResourceKey: 'DATA.HR_TIME',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/performance/goal-cycles')).toMatchObject({
      view: 'performance-goal-cycles',
      governedOnly: true,
      requiredResourceKey: 'DATA.HR_TALENT',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/performance/review-operations')).toMatchObject({
      view: 'performance-review-operations',
      governedOnly: true,
      requiredResourceKey: 'DATA.HR_TALENT',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/performance/compensation-planning')).toMatchObject(
      {
        view: 'compensation-planning',
        governedOnly: true,
        requiredResourceKey: 'DATA.HRIS_COMPENSATION_PLAN',
        requiredPermissionCode: 'VIEW',
      }
    );
    expect(findHcmNavigationItem('/hr/operations/people/employee-change-requests')).toMatchObject({
      view: 'employee-change-requests',
      governedOnly: true,
      requiredResourceKey: 'DATA.HRIS_WORKFORCE',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/people/employment-assignments')).toMatchObject({
      view: 'employment-assignments',
      governedOnly: true,
      requiredResourceKey: 'DATA.HRIS_WORKFORCE',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/settings/reference-data')).toMatchObject({
      view: 'settings-reference',
      governedOnly: true,
      requiredResourceKey: 'CONFIG.HRIS_WORKBENCH',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/settings/payroll')).toMatchObject({
      view: 'settings-payroll',
      governedOnly: true,
      requiredResourceKey: 'CONFIG.HRIS_WORKBENCH',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/settings/navigation-policy')).toMatchObject({
      view: 'settings-navigation-policy',
      governedOnly: true,
      requiredResourceKey: 'CONFIG.HRIS_NAVIGATION_POLICY',
      requiredPermissionCode: 'VIEW',
    });
  });

  it('projects each canonical PAGE through its exact capability contract', () => {
    const item = (groups: typeof HCM_PERSONAL_NAVIGATION, view: string) =>
      groups.flatMap((group) => group.items).find((candidate) => candidate.view === view);

    expect(item(HCM_PERSONAL_NAVIGATION, 'employment-documents')).toMatchObject({
      path: '/hr/me/employment-documents',
      taskKind: 'work',
      access: { type: 'capability', capabilityContractKey: 'hcm.personal.profile.view' },
    });
    expect(item(HCM_OPERATIONS_NAVIGATION, 'employment-assignments')).toMatchObject({
      path: '/hr/operations/people/employment-assignments',
      taskKind: 'operations',
      access: { type: 'capability', capabilityContractKey: 'hcm.operations.people.view' },
    });
    expect(item(HCM_OPERATIONS_NAVIGATION, 'time-interpretation')).toMatchObject({
      path: '/hr/operations/time/interpretation',
      taskKind: 'operations',
      access: { type: 'capability', capabilityContractKey: 'hcm.operations.time.view' },
    });
    expect(item(HCM_OPERATIONS_NAVIGATION, 'time-work-plans')).toMatchObject({
      path: '/hr/operations/time/work-plans',
      taskKind: 'operations',
      access: { type: 'capability', capabilityContractKey: 'hcm.operations.time.read' },
    });
    expect(item(HCM_OPERATIONS_NAVIGATION, 'performance-goal-cycles')).toMatchObject({
      path: '/hr/operations/performance/goal-cycles',
      taskKind: 'operations',
      access: { type: 'capability', capabilityContractKey: 'hcm.operations.talent.read' },
    });
    expect(item(HCM_OPERATIONS_NAVIGATION, 'compensation-planning')).toMatchObject({
      path: '/hr/operations/performance/compensation-planning',
      taskKind: 'operations',
      access: { type: 'capability', capabilityContractKey: 'hcm.compensation.plan.view' },
    });
    expect(item(HCM_MANAGEMENT_NAVIGATION, 'settings-payroll')).toMatchObject({
      path: '/hr/settings/payroll',
      taskKind: 'administration',
      access: {
        type: 'capability',
        capabilityContractKey: 'hcm.configuration.workbench.view',
      },
    });
    expect(item(HCM_MANAGEMENT_NAVIGATION, 'settings-navigation-policy')).toMatchObject({
      path: '/hr/settings/navigation-policy',
      taskKind: 'administration',
      access: {
        type: 'capability',
        capabilityContractKey: 'hcm.configuration.navigation-policy.view',
      },
    });
    expect(findHcmNavigationItem('/hr/operations/assignments')).toMatchObject({
      view: 'assignments',
      path: '/hr/operations/assignments',
    });
  });
});

describe('HR experience evidence', () => {
  it('links the signed-in identity by exact normalized email before display name', () => {
    const people = [
      person({ personId: 'same-name', workEmail: 'other@example.invalid' }),
      person({
        personId: 'exact-email',
        displayName: 'Another Name',
        workEmail: 'exact-email@example.invalid',
      }),
    ];
    expect(
      selectCurrentPerson(people, {
        email: ' EXACT-EMAIL@example.invalid ',
        displayName: 'Minseo Kim',
      })?.personId
    ).toBe('exact-email');
  });

  it('only promotes actual HR-routed or HR-owned work onto HR home', () => {
    expect(isHrWorkItem({ sourceRoute: '/people', sourceSystem: 'People Service' })).toBe(true);
    expect(isHrWorkItem({ sourceRoute: '/admin/access', sourceSystem: 'IT Service' })).toBe(false);
  });
});
