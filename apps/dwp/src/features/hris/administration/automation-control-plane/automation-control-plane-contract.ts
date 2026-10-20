export const HRIS_AUTOMATION_CONTROL_PLANE_FEATURE = 'HRIS_AUTOMATION_CONTROL_PLANE' as const;
export const HRIS_AUTOMATION_CONTROL_PLANE_SHARED_ROUTE = '/hr/settings/operations' as const;
export const HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT =
  'route.hcm.configuration.settings-operations.page' as const;

export const HRIS_AUTOMATION_CONTROL_PLANE_OPERATION_CONTRACTS = Object.freeze([
  {
    api: 'SYS-API-017.GET',
    pep: 'PEP-SYS-017',
    method: 'GET',
    path: '/api/platform/v1/admin/hris/automations',
    routeContractKey: 'route.hcm.configuration.automation-catalog.data',
    routeKind: 'DATA',
  },
  {
    api: 'SYS-API-017.POST',
    pep: 'PEP-SYS-018',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations',
    routeContractKey: 'route.hcm.configuration.automation-definition-create.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-018',
    pep: 'PEP-SYS-019',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations/{automationId}/runs',
    routeContractKey: 'route.hcm.configuration.automation-run-queue.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-019',
    pep: 'PEP-SYS-020',
    method: 'GET',
    path: '/api/platform/v1/admin/hris/automation-runs/{runId}',
    routeContractKey: 'route.hcm.configuration.automation-run-detail.data',
    routeKind: 'DATA',
  },
  {
    api: 'SYS-API-020',
    pep: 'PEP-SYS-021',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automation-runs/{runId}/retry',
    routeContractKey: 'route.hcm.configuration.automation-run-retry.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-046',
    pep: 'PEP-SYS-048',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations/{automationId}/versions',
    routeContractKey: 'route.hcm.configuration.automation-version-create.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-047',
    pep: 'PEP-SYS-049',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/validate',
    routeContractKey: 'route.hcm.configuration.automation-version-validate.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-048',
    pep: 'PEP-SYS-050',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/submit',
    routeContractKey: 'route.hcm.configuration.automation-version-submit.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-049',
    pep: 'PEP-SYS-051',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/approve',
    routeContractKey: 'route.hcm.configuration.automation-version-approve.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-050',
    pep: 'PEP-SYS-052',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations/{automationId}/versions/{version}/activate',
    routeContractKey: 'route.hcm.configuration.automation-version-activate.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-051',
    pep: 'PEP-SYS-053',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automations/{automationId}/schedules',
    routeContractKey: 'route.hcm.configuration.automation-schedule-create.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-052',
    pep: 'PEP-SYS-054',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/submit',
    routeContractKey: 'route.hcm.configuration.automation-schedule-submit.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-053',
    pep: 'PEP-SYS-055',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/approve',
    routeContractKey: 'route.hcm.configuration.automation-schedule-approve.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-054',
    pep: 'PEP-SYS-056',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/activate',
    routeContractKey: 'route.hcm.configuration.automation-schedule-activate.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-055',
    pep: 'PEP-SYS-057',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automation-schedules/{scheduleId}/suspend',
    routeContractKey: 'route.hcm.configuration.automation-schedule-suspend.action',
    routeKind: 'ACTION',
  },
  {
    api: 'SYS-API-056',
    pep: 'PEP-SYS-058',
    method: 'POST',
    path: '/api/platform/v1/admin/hris/automation-runs/{runId}/cancel',
    routeContractKey: 'route.hcm.configuration.automation-run-cancel.action',
    routeKind: 'ACTION',
  },
] as const);

export const HRIS_AUTOMATION_CONTROL_PLANE_STATES = [
  'loading',
  'empty',
  'complete',
  'partial',
  'unavailable',
  'forbidden',
  'retry',
  'step-up',
] as const;
export type HrisAutomationControlPlaneState = (typeof HRIS_AUTOMATION_CONTROL_PLANE_STATES)[number];

export const HRIS_AUTOMATION_CONTROL_PLANE_SURFACE_POLICY = Object.freeze({
  parentOwner: 'SYS-002',
  sharedRoute: HRIS_AUTOMATION_CONTROL_PLANE_SHARED_ROUTE,
  requiredFeature: HRIS_AUTOMATION_CONTROL_PLANE_FEATURE,
  requiredBasePageDecision: HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT,
  secondSidebarNode: false,
  secondPageOwner: false,
  mounted: false,
  defaultEnabled: false,
  tenantEnrollmentCount: 0,
});

export const HRIS_AUTOMATION_CONTROL_PLANE_RESPONSIVE_CONTRACT = Object.freeze({
  viewportWidths: Object.freeze([1440, 1280, 390, 320] as const),
  zoomPercent: 200,
  inlineSize: '100%',
  minimumChildInlineSize: 0,
  contentColumns: Object.freeze({
    narrow: 'minmax(0, 1fr)',
    wide: 'minmax(0, 1fr) auto',
  }),
  textOverflow: 'anywhere',
});

export type HrisAutomationControlPlaneAdmission = Readonly<{
  kind: 'TRUSTED_SYS006_CHILD_ADMISSION';
  feature: typeof HRIS_AUTOMATION_CONTROL_PLANE_FEATURE;
  basePageRouteContractKey: typeof HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT;
  basePageAllowed: boolean;
  featureEnabled: boolean;
  tenantEnrolled: boolean;
}>;

export const HRIS_AUTOMATION_CONTROL_PLANE_DEFAULT_ADMISSION = Object.freeze({
  kind: 'TRUSTED_SYS006_CHILD_ADMISSION',
  feature: HRIS_AUTOMATION_CONTROL_PLANE_FEATURE,
  basePageRouteContractKey: HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT,
  basePageAllowed: false,
  featureEnabled: false,
  tenantEnrolled: false,
} satisfies HrisAutomationControlPlaneAdmission);

/**
 * This predicate intentionally includes the sealed central mount switch. Passing a fabricated
 * browser-side gate cannot expose SYS-006 before a later central admission changes that switch.
 */
export function isHrisAutomationControlPlaneChildMounted(
  admission: HrisAutomationControlPlaneAdmission
): boolean {
  return (
    HRIS_AUTOMATION_CONTROL_PLANE_SURFACE_POLICY.mounted &&
    admission.kind === 'TRUSTED_SYS006_CHILD_ADMISSION' &&
    admission.feature === HRIS_AUTOMATION_CONTROL_PLANE_FEATURE &&
    admission.basePageRouteContractKey === HRIS_AUTOMATION_CONTROL_PLANE_BASE_PAGE_ROUTE_CONTRACT &&
    admission.basePageAllowed &&
    admission.featureEnabled &&
    admission.tenantEnrolled
  );
}
