type Translate = (key: string) => string;

const OPERATION_LABEL_KEYS: Readonly<Record<string, string>> = {
  TENANT_ONBOARD: 'operationTypes.TENANT_ONBOARD',
  TENANT_UPGRADE: 'operationTypes.TENANT_UPGRADE',
  TENANT_SUSPEND: 'operationTypes.TENANT_SUSPEND',
  TENANT_ACTIVATE: 'operationTypes.TENANT_ACTIVATE',
  ENTITLEMENT_CHANGE: 'operationTypes.ENTITLEMENT_CHANGE',
  MAINTENANCE_SCHEDULE: 'operationTypes.MAINTENANCE_SCHEDULE',
};

const GATE_LABEL_KEYS: Readonly<Record<string, string>> = {
  RISK_REVIEW: 'operations.gates.labels.RISK_REVIEW',
};

const SERVICE_LABEL_KEYS: Readonly<Record<string, string>> = {
  'dwp-provider-server': 'operations.services.provider',
  'dwp-auth-server': 'operations.services.auth',
  'dwp-platform-server': 'operations.services.platform',
  'dwp-people-server': 'operations.services.people',
  provider: 'operations.services.provider',
  auth: 'operations.services.auth',
  platform: 'operations.services.platform',
  people: 'operations.services.people',
  'asset-storage': 'operations.services.assetStorage',
};

const STEP_LABEL_KEYS: Readonly<Record<string, string>> = {
  'validate-contracts': 'steps.validate-contracts',
  CONTROL_RECORD: 'steps.CONTROL_RECORD',
  AUTH_TENANT: 'steps.AUTH_TENANT',
  PLATFORM_TENANT: 'steps.PLATFORM_TENANT',
  PEOPLE_TENANT: 'steps.PEOPLE_TENANT',
  ASSET_STORAGE: 'steps.ASSET_STORAGE',
  ACTIVATE_TENANT: 'steps.ACTIVATE_TENANT',
  SCHEDULE_MAINTENANCE: 'steps.SCHEDULE_MAINTENANCE',
};

const SERVICE_TIER_LABEL_KEYS: Readonly<Record<string, string>> = {
  STANDARD: 'operations.planValues.serviceTier.STANDARD',
  ENTERPRISE: 'operations.planValues.serviceTier.ENTERPRISE',
  REGULATED: 'operations.planValues.serviceTier.REGULATED',
};

const ISOLATION_LABEL_KEYS: Readonly<Record<string, string>> = {
  POOL: 'operations.planValues.isolation.POOL',
  BRIDGE: 'operations.planValues.isolation.BRIDGE',
  SILO: 'operations.planValues.isolation.SILO',
};

const IMPACT_LABEL_KEYS: Readonly<Record<string, string>> = {
  NO_IMPACT: 'operations.planValues.impact.NO_IMPACT',
  BRIEF_INTERRUPTION: 'operations.planValues.impact.BRIEF_INTERRUPTION',
  DEGRADED_PERFORMANCE: 'operations.planValues.impact.DEGRADED_PERFORMANCE',
  SERVICE_UNAVAILABLE: 'operations.planValues.impact.SERVICE_UNAVAILABLE',
  FAILOVER: 'operations.planValues.impact.FAILOVER',
  OTHER: 'operations.planValues.impact.OTHER',
};

const TENANT_LIFECYCLE_LABEL_KEYS: Readonly<Record<string, string>> = {
  ALL: 'states.ALL',
  PROVISIONING: 'states.PROVISIONING',
  ACTIVE: 'states.ACTIVE',
  SUSPENDED: 'states.SUSPENDED',
  RETIRED: 'states.RETIRED',
};

function resolveKnownLabel(
  translate: Translate,
  dictionary: Readonly<Record<string, string>>,
  code: string | null | undefined,
  fallbackKey: string
): string {
  const key = code ? dictionary[code] : undefined;
  return translate(key ?? fallbackKey);
}

export function providerOperationLabel(translate: Translate, code: string): string {
  return resolveKnownLabel(translate, OPERATION_LABEL_KEYS, code, 'operations.unknownOperation');
}

export function providerGateLabel(translate: Translate, code: string): string {
  return resolveKnownLabel(translate, GATE_LABEL_KEYS, code, 'operations.gates.unknown');
}

export function providerServiceLabel(translate: Translate, code: string): string {
  return resolveKnownLabel(translate, SERVICE_LABEL_KEYS, code, 'operations.services.unknown');
}

export function providerStepLabel(translate: Translate, code: string): string {
  return resolveKnownLabel(translate, STEP_LABEL_KEYS, code, 'operations.unknownStep');
}

export function providerServiceTierLabel(translate: Translate, code: unknown): string {
  return resolveKnownLabel(
    translate,
    SERVICE_TIER_LABEL_KEYS,
    typeof code === 'string' ? code : undefined,
    'operations.planValues.unknown'
  );
}

export function providerIsolationLabel(translate: Translate, code: unknown): string {
  return resolveKnownLabel(
    translate,
    ISOLATION_LABEL_KEYS,
    typeof code === 'string' ? code : undefined,
    'operations.planValues.unknown'
  );
}

export function providerImpactLabel(translate: Translate, code: unknown): string {
  return resolveKnownLabel(
    translate,
    IMPACT_LABEL_KEYS,
    typeof code === 'string' ? code : undefined,
    'operations.planValues.unknown'
  );
}

export function providerTenantLifecycleLabel(translate: Translate, code: unknown): string {
  return resolveKnownLabel(
    translate,
    TENANT_LIFECYCLE_LABEL_KEYS,
    typeof code === 'string' ? code : undefined,
    'operations.planValues.unknown'
  );
}

export function providerOperationGateEvidenceState(
  approvalCount: number,
  approvalPending: boolean
): 'PRESENT' | 'REQUIRED_EVIDENCE_UNAVAILABLE' | 'NOT_REQUIRED' {
  if (approvalCount > 0) return 'PRESENT';
  return approvalPending ? 'REQUIRED_EVIDENCE_UNAVAILABLE' : 'NOT_REQUIRED';
}
