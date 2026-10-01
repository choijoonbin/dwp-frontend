import { describe, expect, it } from 'vitest';

import {
  providerGovernanceBehaviorLabel,
  providerGovernanceGuidanceLabel,
  providerGovernanceTargetLabel,
  providerIncidentScopeLabel,
  providerMaintenanceImpactLabel,
  providerServiceCriticalityLabel,
} from './provider-health-presentation';

const translate = (key: string) => `translated:${key}`;

describe('provider health presentation', () => {
  it('maps known incident scopes and maintenance impact values', () => {
    expect(providerIncidentScopeLabel(translate, 'CELL')).toBe('translated:health.scopes.CELL');
    expect(providerServiceCriticalityLabel(translate, 'CRITICAL')).toBe(
      'translated:health.services.criticality.CRITICAL'
    );
    expect(providerMaintenanceImpactLabel(translate, 'FAILOVER')).toBe(
      'translated:reliability.maintenance.impact.FAILOVER'
    );
    expect(providerGovernanceTargetLabel(translate, 'SERVICE_INSTANCE')).toBe(
      'translated:reliability.drift.targetType.SERVICE_INSTANCE'
    );
    expect(providerGovernanceBehaviorLabel(translate, 'DETECTIVE')).toBe(
      'translated:reliability.drift.behavior.DETECTIVE'
    );
    expect(providerGovernanceGuidanceLabel(translate, 'MANDATORY')).toBe(
      'translated:reliability.drift.guidance.MANDATORY'
    );
  });

  it('fails closed for unknown server values', () => {
    expect(providerIncidentScopeLabel(translate, 'INTERNAL_SCOPE')).toBe(
      'translated:health.scopes.UNKNOWN'
    );
    expect(providerServiceCriticalityLabel(translate, 'INTERNAL_CRITICALITY')).toBe(
      'translated:health.services.criticality.UNKNOWN'
    );
    expect(providerMaintenanceImpactLabel(translate, 'INTERNAL_IMPACT')).toBe(
      'translated:reliability.maintenance.impact.UNKNOWN'
    );
    expect(providerGovernanceTargetLabel(translate, 'INTERNAL_TARGET')).toBe(
      'translated:reliability.drift.valueUnavailable'
    );
    expect(providerGovernanceBehaviorLabel(translate, 'INTERNAL_BEHAVIOR')).toBe(
      'translated:reliability.drift.valueUnavailable'
    );
    expect(providerGovernanceGuidanceLabel(translate, 'INTERNAL_GUIDANCE')).toBe(
      'translated:reliability.drift.valueUnavailable'
    );
  });
});
