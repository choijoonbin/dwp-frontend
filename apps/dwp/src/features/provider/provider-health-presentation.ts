type Translate = (key: string) => string;

const INCIDENT_SCOPE_KEYS: Readonly<Record<string, string>> = {
  GLOBAL: 'health.scopes.GLOBAL',
  REGION: 'health.scopes.REGION',
  CELL: 'health.scopes.CELL',
  SERVICE: 'health.scopes.SERVICE',
  TENANT: 'health.scopes.TENANT',
};

const SERVICE_CRITICALITY_KEYS: Readonly<Record<string, string>> = {
  STANDARD: 'health.services.criticality.STANDARD',
  HIGH: 'health.services.criticality.HIGH',
  CRITICAL: 'health.services.criticality.CRITICAL',
};

const MAINTENANCE_IMPACT_KEYS: Readonly<Record<string, string>> = {
  NO_IMPACT: 'reliability.maintenance.impact.NO_IMPACT',
  BRIEF_INTERRUPTION: 'reliability.maintenance.impact.BRIEF_INTERRUPTION',
  DEGRADED_PERFORMANCE: 'reliability.maintenance.impact.DEGRADED_PERFORMANCE',
  SERVICE_UNAVAILABLE: 'reliability.maintenance.impact.SERVICE_UNAVAILABLE',
  FAILOVER: 'reliability.maintenance.impact.FAILOVER',
  OTHER: 'reliability.maintenance.impact.OTHER',
};

const GOVERNANCE_TARGET_KEYS: Readonly<Record<string, string>> = {
  ORGANIZATION: 'reliability.drift.targetType.ORGANIZATION',
  TENANT: 'reliability.drift.targetType.TENANT',
  SERVICE_INSTANCE: 'reliability.drift.targetType.SERVICE_INSTANCE',
  DOMAIN: 'reliability.drift.targetType.DOMAIN',
  CELL: 'reliability.drift.targetType.CELL',
};

const GOVERNANCE_BEHAVIOR_KEYS: Readonly<Record<string, string>> = {
  PREVENTIVE: 'reliability.drift.behavior.PREVENTIVE',
  DETECTIVE: 'reliability.drift.behavior.DETECTIVE',
  PROACTIVE: 'reliability.drift.behavior.PROACTIVE',
};

const GOVERNANCE_GUIDANCE_KEYS: Readonly<Record<string, string>> = {
  MANDATORY: 'reliability.drift.guidance.MANDATORY',
  STRONGLY_RECOMMENDED: 'reliability.drift.guidance.STRONGLY_RECOMMENDED',
  ELECTIVE: 'reliability.drift.guidance.ELECTIVE',
};

export function providerIncidentScopeLabel(translate: Translate, value: string): string {
  return translate(INCIDENT_SCOPE_KEYS[value] ?? 'health.scopes.UNKNOWN');
}

export function providerServiceCriticalityLabel(translate: Translate, value: string): string {
  return translate(SERVICE_CRITICALITY_KEYS[value] ?? 'health.services.criticality.UNKNOWN');
}

export function providerMaintenanceImpactLabel(translate: Translate, value: string): string {
  return translate(MAINTENANCE_IMPACT_KEYS[value] ?? 'reliability.maintenance.impact.UNKNOWN');
}

export function providerGovernanceTargetLabel(translate: Translate, value: string): string {
  return translate(GOVERNANCE_TARGET_KEYS[value] ?? 'reliability.drift.valueUnavailable');
}

export function providerGovernanceBehaviorLabel(translate: Translate, value: string): string {
  return translate(GOVERNANCE_BEHAVIOR_KEYS[value] ?? 'reliability.drift.valueUnavailable');
}

export function providerGovernanceGuidanceLabel(translate: Translate, value: string): string {
  return translate(GOVERNANCE_GUIDANCE_KEYS[value] ?? 'reliability.drift.valueUnavailable');
}
