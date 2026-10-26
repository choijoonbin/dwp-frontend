export const HRIS_INTEGRATION_CONTROL_PLANE_FEATURE = 'HRIS_INTEGRATION_CONTROL_PLANE' as const;
export const HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE = '/hr/settings/integrations' as const;
export const HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE =
  '/admin/integrations/productivity?product=HCM' as const;
export const HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE_CONTRACT =
  'route.hcm.configuration.settings-integrations.page' as const;
export const HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE_CONTRACT =
  'route.hcm.configuration.dwp-integrations.data' as const;

export const HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS = Object.freeze({
  PRIMARY_HRIS_SETTINGS: Object.freeze({
    entryQuery: 'IAQ-057',
    iaNodeId: 'BASE:settings-integrations',
    role: 'PRIMARY_HRIS_SETTINGS',
    method: 'GET',
    browserApi: '/api/platform/v1/hris/workbench/settings-integrations',
    serviceApi: '/v1/hris/workbench/settings-integrations',
    canonicalRoute: HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE,
    routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE_CONTRACT,
    routeKind: 'PAGE',
    fieldGroups: Object.freeze(['CONNECTOR_METADATA', 'POLICY_VERSION', 'EFFECTIVE_STATUS']),
    filters: Object.freeze([
      'connectorMetadata',
      'policyVersion',
      'effectiveStatus',
      'effectiveOn',
    ]),
    ownsPage: true,
  }),
  PRIMARY_DWP_CONTROL: Object.freeze({
    entryQuery: 'IAQ-062',
    iaNodeId: 'BASE:dwp-integrations',
    role: 'PRIMARY_DWP_CONTROL',
    method: 'GET',
    browserApi: '/api/platform/v1/hris/workbench/dwp-integrations',
    serviceApi: '/v1/hris/workbench/dwp-integrations',
    canonicalRoute: HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE,
    routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE_CONTRACT,
    routeKind: 'DATA',
    fieldGroups: Object.freeze(['CONNECTOR_METADATA', 'EXECUTION_POLICY', 'EFFECTIVE_STATUS']),
    filters: Object.freeze([
      'connectorMetadata',
      'executionPolicy',
      'effectiveStatus',
      'effectiveOn',
    ]),
    ownsPage: false,
  }),
} as const);

export type HrisIntegrationControlPlaneProjection =
  keyof typeof HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS;

export const HRIS_INTEGRATION_CONTROL_PLANE_OWNER_QUERY_CONTRACT = Object.freeze({
  owner: 'SYS008_SINGLE_OWNER_QUERY',
  relationship:
    'ONE_OWNER_TRUTH_TWO_POLICY_PROJECTIONS_NO_DUPLICATE_PERSISTENCE_CONTROLLER_DOMAIN_OR_COMPLETION_CREDIT',
  requiredCapability: 'hcm.configuration.workbench.view',
  sortCountPerProjection: 8,
  defaultSort: 'itemPublicId:ASC',
  minimumLimit: 1,
  maximumLimit: 100,
  queryStates: Object.freeze(['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'] as const),
  fieldDecisions: Object.freeze(['VIEW', 'MASK', 'OMIT'] as const),
  cursorBindings: Object.freeze([
    'tenant',
    'actor',
    'queryVariant',
    'filters',
    'sort',
    'asOf',
    'locale',
    'timeZone',
    'scopeRevision',
    'fieldPolicyRevision',
    'authorizationRevision',
  ] as const),
  stableIdentity:
    'SAME_ITEM_PUBLIC_ID_AND_EFFECTIVE_STATUS_REVISION_FROM_ONE_OWNER_TRUTH_ON_BOTH_SURFACES',
  ownerReceipt: 'SERVER_SIDE_NON_SERIALIZED_LINEAGE_ONLY',
  availableActions: 'SERVER_SIDE_ITEM_LEVEL_PEP_INTERSECTION_ONLY',
  stalePartialUnavailableOrDeniedActionCount: 0,
  scopeChange: 'CLEAR_SELECTION_CURSOR_AND_CACHED_ROWS',
});

export const HRIS_INTEGRATION_CONTROL_PLANE_OPERATION_CONTRACTS = Object.freeze([
  {
    api: 'IAQ-057',
    pep: 'IAQ.OP.057',
    method: 'GET',
    browserPath: '/api/platform/v1/hris/workbench/settings-integrations',
    servicePath: '/v1/hris/workbench/settings-integrations',
    routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE_CONTRACT,
    routeKind: 'PAGE',
    capability: 'hcm.configuration.workbench.view',
  },
  {
    api: 'IAQ-062',
    pep: 'IAQ.OP.062',
    method: 'GET',
    browserPath: '/api/platform/v1/hris/workbench/dwp-integrations',
    servicePath: '/v1/hris/workbench/dwp-integrations',
    routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE_CONTRACT,
    routeKind: 'DATA',
    capability: 'hcm.configuration.workbench.view',
  },
  {
    api: 'SYS-API-021.GET',
    pep: 'PEP-SYS-022',
    method: 'GET',
    browserPath: '/api/platform/v1/admin/hris/connectors',
    servicePath: '/v1/admin/hris/connectors',
    routeContractKey: 'route.hcm.configuration.connector-catalog.data',
    routeKind: 'DATA',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-021.POST',
    pep: 'PEP-SYS-023',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors',
    servicePath: '/v1/admin/hris/connectors',
    routeContractKey: 'route.hcm.configuration.connector-definition-create.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-022',
    pep: 'PEP-SYS-024',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/test',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/test',
    routeContractKey: 'route.hcm.configuration.connector-test.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-023',
    pep: 'PEP-SYS-025',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/dry-runs',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/mappings/{version}/dry-runs',
    routeContractKey: 'route.hcm.configuration.connector-mapping-dry-run.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-024',
    pep: 'PEP-SYS-026',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/executions',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/executions',
    routeContractKey: 'route.hcm.configuration.connector-execution-create.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-025',
    pep: 'PEP-SYS-027',
    method: 'GET',
    browserPath: '/api/platform/v1/admin/hris/connector-executions/{executionId}',
    servicePath: '/v1/admin/hris/connector-executions/{executionId}',
    routeContractKey: 'route.hcm.configuration.connector-execution-detail.data',
    routeKind: 'DATA',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-057',
    pep: 'PEP-SYS-059',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/validate',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/validate',
    routeContractKey: 'route.hcm.configuration.connector-definition-validate.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-058',
    pep: 'PEP-SYS-060',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/submit',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/submit',
    routeContractKey: 'route.hcm.configuration.connector-definition-submit.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-059',
    pep: 'PEP-SYS-061',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/approve',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/approve',
    routeContractKey: 'route.hcm.configuration.connector-definition-approve.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-060',
    pep: 'PEP-SYS-062',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/activate',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/activate',
    routeContractKey: 'route.hcm.configuration.connector-definition-activate.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-061',
    pep: 'PEP-SYS-063',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/mappings',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-create.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-062',
    pep: 'PEP-SYS-064',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/validate',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/mappings/{version}/validate',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-validate.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-063',
    pep: 'PEP-SYS-065',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/submit',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/mappings/{version}/submit',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-submit.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.definition.update',
  },
  {
    api: 'SYS-API-064',
    pep: 'PEP-SYS-066',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/approve',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/mappings/{version}/approve',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-approve.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-065',
    pep: 'PEP-SYS-067',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connectors/{connectorId}/mappings/{version}/activate',
    servicePath: '/v1/admin/hris/connectors/{connectorId}/mappings/{version}/activate',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-activate.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-066',
    pep: 'PEP-SYS-068',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connector-executions/{executionId}/reconcile',
    servicePath: '/v1/admin/hris/connector-executions/{executionId}/reconcile',
    routeContractKey: 'route.hcm.configuration.connector-execution-reconcile.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-067',
    pep: 'PEP-SYS-069',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connector-executions/{executionId}/retry',
    servicePath: '/v1/admin/hris/connector-executions/{executionId}/retry',
    routeContractKey: 'route.hcm.configuration.connector-execution-retry.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
  {
    api: 'SYS-API-068',
    pep: 'PEP-SYS-070',
    method: 'POST',
    browserPath: '/api/platform/v1/admin/hris/connector-executions/{executionId}/cancel',
    servicePath: '/v1/admin/hris/connector-executions/{executionId}/cancel',
    routeContractKey: 'route.hcm.configuration.connector-execution-cancel.action',
    routeKind: 'ACTION',
    capability: 'hcm.integration.control-plane.execute',
  },
] as const);

export const HRIS_INTEGRATION_CONTROL_PLANE_STATES = [
  'loading',
  'empty',
  'complete',
  'partial',
  'unavailable',
  'forbidden',
  'retry',
  'step-up',
  'result-unknown',
] as const;
export type HrisIntegrationControlPlaneState =
  (typeof HRIS_INTEGRATION_CONTROL_PLANE_STATES)[number];

export const HRIS_INTEGRATION_CONTROL_PLANE_SURFACE_POLICY = Object.freeze({
  owner: 'SYS-008',
  ownerQuery: HRIS_INTEGRATION_CONTROL_PLANE_OWNER_QUERY_CONTRACT.owner,
  requiredFeature: HRIS_INTEGRATION_CONTROL_PLANE_FEATURE,
  oneOwnerTruth: true,
  projectionCount: 2,
  newPageRouteCount: 1,
  newSidebarNode: false,
  duplicatePageOwner: false,
  dwpProductivityPageOwnerChanged: false,
  mounted: false,
  defaultEnabled: false,
  tenantEnrollmentCount: 0,
});

export const HRIS_INTEGRATION_CONTROL_PLANE_RESPONSIVE_CONTRACT = Object.freeze({
  viewportWidths: Object.freeze([1440, 1280, 390, 320] as const),
  zoomPercent: 200,
  inlineSize: '100%',
  minimumChildInlineSize: 0,
  contentColumns: Object.freeze({
    narrow: 'minmax(0, 1fr)',
    wide: 'minmax(0, 1fr) auto',
  }),
  textOverflow: 'anywhere',
  nestedMainLandmark: false,
});

export type HrisIntegrationControlPlaneAdmission = Readonly<{
  kind: 'TRUSTED_SYS008_PROJECTION_ADMISSION';
  feature: typeof HRIS_INTEGRATION_CONTROL_PLANE_FEATURE;
  projection: HrisIntegrationControlPlaneProjection;
  routeContractKey: string;
  routeAllowed: boolean;
  featureEnabled: boolean;
  tenantEnrolled: boolean;
}>;

export const HRIS_INTEGRATION_CONTROL_PLANE_DEFAULT_ADMISSIONS = Object.freeze({
  PRIMARY_HRIS_SETTINGS: Object.freeze({
    kind: 'TRUSTED_SYS008_PROJECTION_ADMISSION',
    feature: HRIS_INTEGRATION_CONTROL_PLANE_FEATURE,
    projection: 'PRIMARY_HRIS_SETTINGS',
    routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_PRIMARY_ROUTE_CONTRACT,
    routeAllowed: false,
    featureEnabled: false,
    tenantEnrolled: false,
  }),
  PRIMARY_DWP_CONTROL: Object.freeze({
    kind: 'TRUSTED_SYS008_PROJECTION_ADMISSION',
    feature: HRIS_INTEGRATION_CONTROL_PLANE_FEATURE,
    projection: 'PRIMARY_DWP_CONTROL',
    routeContractKey: HRIS_INTEGRATION_CONTROL_PLANE_DWP_ROUTE_CONTRACT,
    routeAllowed: false,
    featureEnabled: false,
    tenantEnrolled: false,
  }),
} satisfies Readonly<
  Record<HrisIntegrationControlPlaneProjection, HrisIntegrationControlPlaneAdmission>
>);

/**
 * The central mount switch is deliberately sealed off. Browser-provided authorization booleans
 * cannot expose either projection until a later admission explicitly changes the sealed policy.
 */
export function isHrisIntegrationControlPlaneProjectionMounted(
  admission: HrisIntegrationControlPlaneAdmission
): boolean {
  const projection = HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS[admission.projection];
  return (
    HRIS_INTEGRATION_CONTROL_PLANE_SURFACE_POLICY.mounted &&
    admission.kind === 'TRUSTED_SYS008_PROJECTION_ADMISSION' &&
    admission.feature === HRIS_INTEGRATION_CONTROL_PLANE_FEATURE &&
    admission.routeContractKey === projection.routeContractKey &&
    admission.routeAllowed &&
    admission.featureEnabled &&
    admission.tenantEnrolled
  );
}
