export type HrisR7GovernedPageCatalogItem = Readonly<{
  feature:
    | 'HRIS_ORGANIZATION_POSITIONS'
    | 'HRIS_HRM_APPOINTMENT_WORKBENCH'
    | 'HRIS_HRM_CERTIFICATE_WORKBENCH'
    | 'HRIS_APPROVAL_WORKFLOW_AND_DELEGATION_ADAPTERS'
    | 'HRIS_PAYROLL_RUN_PREPARE'
    | 'HRIS_OPERATIONS_EXCEPTION_CENTER'
    | 'HRIS_TIME_CLOSE_HANDOFF';
  module: 'HRM' | 'PAY' | 'SYS' | 'TIM';
  path: string;
  routeContractKey: string;
  state: 'ADMISSION_MOUNTED' | 'CATALOG_ONLY';
}>;

export const HRIS_R7_GOVERNED_PAGE_CATALOG: readonly HrisR7GovernedPageCatalogItem[] =
  Object.freeze([
    Object.freeze({
      feature: 'HRIS_HRM_CERTIFICATE_WORKBENCH',
      module: 'HRM',
      path: '/hr/me/requests',
      routeContractKey: 'route.hcm.personal.requests.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_HRM_CERTIFICATE_WORKBENCH',
      module: 'HRM',
      path: '/hr/operations/people/certificates-documents',
      routeContractKey: 'route.hcm.operations.certificates-documents.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_HRM_APPOINTMENT_WORKBENCH',
      module: 'HRM',
      path: '/hr/team/people-changes',
      routeContractKey: 'route.hcm.team.people-changes.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_HRM_APPOINTMENT_WORKBENCH',
      module: 'HRM',
      path: '/hr/operations/people/appointments',
      routeContractKey: 'route.hcm.operations.people-appointments.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_HRM_APPOINTMENT_WORKBENCH',
      module: 'HRM',
      path: '/hr/settings/people-employment',
      routeContractKey: 'route.hcm.configuration.people-employment.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_ORGANIZATION_POSITIONS',
      module: 'HRM',
      path: '/hr/operations/people/organization-positions',
      routeContractKey: 'route.hcm.operations.organization-positions.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_PAYROLL_RUN_PREPARE',
      module: 'PAY',
      path: '/hr/operations/payroll/population',
      routeContractKey: 'route.hcm.operations.payroll-population.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_OPERATIONS_EXCEPTION_CENTER',
      module: 'SYS',
      path: '/hr/settings/operations',
      routeContractKey: 'route.hcm.configuration.settings-operations.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_APPROVAL_WORKFLOW_AND_DELEGATION_ADAPTERS',
      module: 'SYS',
      path: '/hr/settings/workflow',
      routeContractKey: 'route.hcm.configuration.workflow.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_APPROVAL_WORKFLOW_AND_DELEGATION_ADAPTERS',
      module: 'SYS',
      path: '/hr/team/delegation',
      routeContractKey: 'route.hcm.team.delegation.page',
      state: 'ADMISSION_MOUNTED',
    }),
    Object.freeze({
      feature: 'HRIS_TIME_CLOSE_HANDOFF',
      module: 'TIM',
      path: '/hr/operations/time/command-center',
      routeContractKey: 'route.hcm.operations.time-command-center.page',
      state: 'CATALOG_ONLY',
    }),
    Object.freeze({
      feature: 'HRIS_TIME_CLOSE_HANDOFF',
      module: 'TIM',
      path: '/hr/operations/time/daily-close',
      routeContractKey: 'route.hcm.operations.time-daily-close.page',
      state: 'CATALOG_ONLY',
    }),
    Object.freeze({
      feature: 'HRIS_TIME_CLOSE_HANDOFF',
      module: 'TIM',
      path: '/hr/operations/time/monthly-close',
      routeContractKey: 'route.hcm.operations.time-monthly-close.page',
      state: 'CATALOG_ONLY',
    }),
  ]);
