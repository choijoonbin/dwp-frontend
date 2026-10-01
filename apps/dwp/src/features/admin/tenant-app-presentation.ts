const KNOWN_PRODUCTS = new Set([
  'approvals',
  'calendar',
  'communications',
  'dwaion',
  'hcm',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'services',
  'spaces',
  'workplace',
]);

const KNOWN_ACTIONS = new Set([
  'VIEW',
  'CREATE',
  'UPDATE',
  'DELETE',
  'MANAGE',
  'APPROVE',
  'PUBLISH',
  'EXPORT',
  'EXECUTE',
]);

const PRESENTATION_KEYS = {
  installationStates: new Set([
    'DRAFT',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'ENABLED',
    'PENDING_APPROVAL',
    'ACTIVE',
    'DENIED',
    'REVOKED',
  ]),
  installationKinds: new Set(['INTERNAL_AUTH_CONTROLLED', 'EXTERNAL_SERVICE']),
  executorStates: new Set(['NOT_REQUIRED', 'UNAVAILABLE']),
  effectiveStates: new Set(['ENABLED', 'DISABLED']),
  overrideModes: new Set(['OWNER_LOCKED', 'ALLOW_DISABLE']),
  effectiveSources: new Set(['GLOBAL_AUTHORIZATION_BUNDLE', 'TENANT_OVERRIDE']),
  desiredStates: new Set(['DISABLED', 'INHERIT']),
  workflowStates: new Set([
    'DRAFT',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'ACTIVE',
    'REVOKED',
    'SUPERSEDED',
  ]),
  planStates: new Set([
    'ELIGIBLE',
    'NO_ACTIVE_SUBSCRIPTION',
    'SUBSCRIPTION_SUSPENDED',
    'NOT_INCLUDED_IN_PLAN',
    'NOT_ASSIGNED_TO_TENANT',
    'TENANT_ENTITLEMENT_SUSPENDED',
    'CATALOG_RETIRED',
  ]),
  internalCoverageStates: new Set(['COMPLETE_INTERNAL_OWNERS']),
  planCoverageStates: new Set(['CURRENT_SUBSCRIPTION_AND_TENANT_ENTITLEMENTS']),
} as const;

function closedSetKey(value: string, values: ReadonlySet<string>, prefix: string): string {
  return `${prefix}.${values.has(value) ? value : 'UNKNOWN'}`;
}

export function productPresentationKey(productKey: string): string {
  return KNOWN_PRODUCTS.has(productKey)
    ? `appGovernance.adoption.products.${productKey}`
    : 'appGovernance.adoption.products.unknown';
}

export function capabilitySurfacePresentationKey(surfaceKey: string): string {
  const segments = new Set(surfaceKey.toLowerCase().split(/[._-]/u));
  for (const candidate of [
    'policy',
    'catalog',
    'design',
    'configuration',
    'directory',
    'lifecycle',
    'operations',
    'personal',
    'team',
    'management',
    'admin',
    'work',
  ]) {
    if (segments.has(candidate)) {
      return `appGovernance.adoption.capabilities.surfaces.${candidate}`;
    }
  }
  return 'appGovernance.adoption.capabilities.surfaces.unknown';
}

export function capabilityActionPresentationKey(action: string): string {
  return KNOWN_ACTIONS.has(action)
    ? `appGovernance.adoption.capabilities.capabilityActions.${action}`
    : 'appGovernance.adoption.capabilities.capabilityActions.unknown';
}

export function tenantAppStatePresentationKey(state: string): string {
  return closedSetKey(state, PRESENTATION_KEYS.installationStates, 'appGovernance.adoption.states');
}

export function tenantAppKindPresentationKey(kind: string): string {
  return closedSetKey(kind, PRESENTATION_KEYS.installationKinds, 'appGovernance.adoption.kinds');
}

export function tenantAppExecutorStatePresentationKey(state: string): string {
  return closedSetKey(
    state,
    PRESENTATION_KEYS.executorStates,
    'appGovernance.adoption.executorStates'
  );
}

export function capabilityEffectiveStatePresentationKey(state: string): string {
  return closedSetKey(
    state,
    PRESENTATION_KEYS.effectiveStates,
    'appGovernance.adoption.capabilities.effectiveStates'
  );
}

export function capabilityOverrideModePresentationKey(mode: string): string {
  return closedSetKey(
    mode,
    PRESENTATION_KEYS.overrideModes,
    'appGovernance.adoption.capabilities.overrideModes'
  );
}

export function capabilitySourcePresentationKey(source: string): string {
  return closedSetKey(
    source,
    PRESENTATION_KEYS.effectiveSources,
    'appGovernance.adoption.capabilities.sources'
  );
}

export function capabilityDesiredStatePresentationKey(state: string): string {
  return closedSetKey(
    state,
    PRESENTATION_KEYS.desiredStates,
    'appGovernance.adoption.capabilities.desiredStates'
  );
}

export function capabilityWorkflowStatePresentationKey(state: string): string {
  return closedSetKey(
    state,
    PRESENTATION_KEYS.workflowStates,
    'appGovernance.adoption.capabilities.workflowStates'
  );
}

export function capabilityPlanStatePresentationKey(state: string): string {
  return closedSetKey(
    state,
    PRESENTATION_KEYS.planStates,
    'appGovernance.adoption.capabilities.plan.states'
  );
}

export function tenantAppCoveragePresentationKey(state: string): string {
  return closedSetKey(
    state,
    PRESENTATION_KEYS.internalCoverageStates,
    'appGovernance.adoption.coverage.states'
  );
}

export function tenantPlanCoveragePresentationKey(state: string): string {
  return closedSetKey(
    state,
    PRESENTATION_KEYS.planCoverageStates,
    'appGovernance.adoption.capabilities.plan.coverageStates'
  );
}

export function isTenantCapabilityCatalogEmpty(capabilityCount: number): boolean {
  return capabilityCount === 0;
}
