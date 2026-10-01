import { describe, expect, it } from 'vitest';

import {
  providerGateLabel,
  providerImpactLabel,
  providerIsolationLabel,
  providerOperationGateEvidenceState,
  providerOperationLabel,
  providerServiceLabel,
  providerServiceTierLabel,
  providerStepLabel,
} from './provider-operation-presentation';

const translate = (key: string) => `translated:${key}`;

describe('provider operation presentation', () => {
  it('maps known governance codes to localized keys', () => {
    expect(providerOperationLabel(translate, 'TENANT_ONBOARD')).toBe(
      'translated:operationTypes.TENANT_ONBOARD'
    );
    expect(providerGateLabel(translate, 'RISK_REVIEW')).toBe(
      'translated:operations.gates.labels.RISK_REVIEW'
    );
    expect(providerServiceLabel(translate, 'dwp-auth-server')).toBe(
      'translated:operations.services.auth'
    );
    expect(providerStepLabel(translate, 'AUTH_TENANT')).toBe('translated:steps.AUTH_TENANT');
    expect(providerServiceTierLabel(translate, 'ENTERPRISE')).toBe(
      'translated:operations.planValues.serviceTier.ENTERPRISE'
    );
    expect(providerIsolationLabel(translate, 'SILO')).toBe(
      'translated:operations.planValues.isolation.SILO'
    );
    expect(providerImpactLabel(translate, 'BRIEF_INTERRUPTION')).toBe(
      'translated:operations.planValues.impact.BRIEF_INTERRUPTION'
    );
  });

  it('fails closed instead of presenting unknown internal codes', () => {
    expect(providerOperationLabel(translate, 'NEW_INTERNAL_OPERATION')).toBe(
      'translated:operations.unknownOperation'
    );
    expect(providerGateLabel(translate, 'NEW_INTERNAL_GATE')).toBe(
      'translated:operations.gates.unknown'
    );
    expect(providerServiceLabel(translate, 'new-internal-service')).toBe(
      'translated:operations.services.unknown'
    );
    expect(providerStepLabel(translate, 'NEW_INTERNAL_STEP')).toBe(
      'translated:operations.unknownStep'
    );
    expect(providerServiceTierLabel(translate, 'INTERNAL_TIER')).toBe(
      'translated:operations.planValues.unknown'
    );
    expect(providerIsolationLabel(translate, { raw: true })).toBe(
      'translated:operations.planValues.unknown'
    );
    expect(providerImpactLabel(translate, 'INTERNAL_IMPACT')).toBe(
      'translated:operations.planValues.unknown'
    );
  });

  it('does not claim approval is unnecessary when required evidence is unavailable', () => {
    expect(providerOperationGateEvidenceState(0, true)).toBe('REQUIRED_EVIDENCE_UNAVAILABLE');
    expect(providerOperationGateEvidenceState(0, false)).toBe('NOT_REQUIRED');
    expect(providerOperationGateEvidenceState(1, true)).toBe('PRESENT');
  });
});
