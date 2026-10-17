/**
 * R7-C1 append-only runtime overlay. The generated 98-node IA remains historical evidence;
 * this successor adds the dedicated People-owned controlled-export node without rewriting it.
 */
export const HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_REVISION = 'HRIS-IA-98-WB7-G46-N97-R5' as const;
export const HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_SHA256 =
  '4d27b3b8958d591968ed42e7ccd6387664fff66a364adfc83a8a5b7f223a6d8a' as const;
export const HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_REVISION = 'HRIS-IA-99-WB7-G46-N98-R6' as const;
export const HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_SHA256 =
  '4ac4b5411d804888ff1a4bd0373c70419b698a0abe43d0de43bd646966cfe166' as const;

export const HRIS_CONTROLLED_EXPORT_NODE_ID = 'MODERN:hcm.management.controlled-export' as const;
export const HRIS_CONTROLLED_EXPORT_ROUTE = '/hr/data/exports' as const;
export const HRIS_CONTROLLED_EXPORT_WORKBENCH_ID = 'HRIS-WB-SETTINGS' as const;
export const HRIS_CONTROLLED_EXPORT_GROUP_ID = 'SET-08' as const;
export const HRIS_CONTROLLED_EXPORT_DISPLAY_ORDER = 5 as const;

export const HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_HASH_MATERIAL = Object.freeze([
  'schema=hris-navigation-topology-successor.v1',
  `revision=${HRIS_NAVIGATION_TOPOLOGY_SUCCESSOR_REVISION}`,
  `predecessorRevision=${HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_REVISION}`,
  `predecessorSha256=${HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_SHA256}`,
  'workbenchCount=7',
  'groupCount=46',
  'descendantNodeCount=98',
  `append.workbenchId=${HRIS_CONTROLLED_EXPORT_WORKBENCH_ID}`,
  `append.groupId=${HRIS_CONTROLLED_EXPORT_GROUP_ID}`,
  `append.displayOrder=${HRIS_CONTROLLED_EXPORT_DISPLAY_ORDER}`,
  `append.nodeId=${HRIS_CONTROLLED_EXPORT_NODE_ID}`,
  'append.ownerSession=HRIS-HRM',
  'append.module=HRM',
  'append.runtimeOwner=dwp-people-server',
  'append.inventoryGroup=DWP_CONTROL',
  'append.navigationSurface=SETTINGS',
  `append.canonicalRoute=${HRIS_CONTROLLED_EXPORT_ROUTE}`,
  'append.label.ko=통제형 반출',
  'append.label.en=Governed exports',
  'retiredAlias.nodeId=BASE:dwp-governance',
  `retiredAlias.path=${HRIS_CONTROLLED_EXPORT_ROUTE}`,
] as const).join('\n');

export const HRIS_CONTROLLED_EXPORT_PAGE_AUTHORITY = Object.freeze({
  routeContractKey: 'route.hcm.management.controlled-export.page',
  capabilityContractKey: 'hcm.controlled-export.read',
  permission: 'ACTION.WORKFORCE_CONTROLLED_EXPORT:VIEW',
  profileKey: 'full-management',
  activeAccessModes: Object.freeze(['NORMAL', 'ELEVATED'] as const),
  targetBindingKinds: Object.freeze(['TARGET_POPULATION', 'OBJECT'] as const),
  predicatePolicyKeys: Object.freeze(['predicate.hcm-export-population.v1'] as const),
  initialReads: Object.freeze([
    Object.freeze({
      method: 'GET',
      gatewayPath: '/api/people/v1/workforce/exports/datasets',
      serviceKey: 'people',
      servicePath: '/v1/workforce/exports/datasets',
    }),
    Object.freeze({
      method: 'GET',
      gatewayPath: '/api/people/v1/workforce/exports',
      serviceKey: 'people',
      servicePath: '/v1/workforce/exports',
    }),
  ] as const),
  conditionalRead: Object.freeze({
    method: 'GET',
    gatewayPath: '/api/people/v1/workforce/exports/{requestId}/attempts',
    serviceKey: 'people',
    servicePath: '/v1/workforce/exports/{requestId}/attempts',
  }),
});

export const HRIS_CONTROLLED_EXPORT_TOPOLOGY_NODE = Object.freeze({
  iaNodeId: HRIS_CONTROLLED_EXPORT_NODE_ID,
  sourceSet: 'R7C1',
  sourceNodeKey: 'hcm.management.controlled-export',
  inventoryGroup: 'DWP_CONTROL',
  navigationSurface: 'SETTINGS',
  ownerSession: 'HRIS-HRM',
  runtimeOwners: Object.freeze(['dwp-people-server'] as const),
  module: 'HRM',
  contractPersonas: Object.freeze([
    'BUSINESS_OPERATOR',
    'SETTINGS_ADMIN',
    'ENTERPRISE_AUDITOR',
  ] as const),
  contractSourceLifecycle: 'PILOT',
  canonicalRoute: HRIS_CONTROLLED_EXPORT_ROUTE,
  workbenchTab: 'datasets',
  entryQueryRefs: Object.freeze([
    'route.hcm.management.controlled-export.page.binding.01',
    'route.hcm.management.controlled-export.page.binding.02',
  ] as const),
  visibilityCapabilityRefs: Object.freeze(['hcm.controlled-export.read'] as const),
  deepLinkTemplate: '/hr/data/exports?dataset={datasetKey}',
  contractEntryState: 'EXISTING_QUERY_CONTRACT_BOUND',
  contractImplementationState: 'PILOT_CURRENT_RUNTIME_LIMITED_SCOPE',
  contractProductionState: 'NOT_AUTHORIZED_G6',
  compatibilityDecisionRef: 'R7-C1-DEDICATED-TOPOLOGY-SUCCESSOR',
  currentCatalog: Object.freeze({
    lifecycle: 'PILOT',
    availability: 'CURRENT_RUNTIME',
    authorization: 'RUNTIME_POLICY_REQUIRED',
    label: Object.freeze({ ko: '통제형 반출', en: 'Governed exports' }),
    capability: Object.freeze({
      ko: '승인된 인력 데이터셋 반출 요청과 실행 증적',
      en: 'Approved workforce dataset export requests and execution evidence',
    }),
    coverageNote: null,
    legacyPaths: Object.freeze([] as const),
    externalTarget: null,
    href: HRIS_CONTROLLED_EXPORT_ROUTE,
  }),
});
