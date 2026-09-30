import { describe, expect, it } from 'vitest';

import {
  RolloutFormError,
  buildFeatureSchema,
  buildFeatureValue,
  buildHealthEvidence,
  buildStages,
  buildTargeting,
  canDecideFeatureRollout,
  featureValueTypePresentation,
  featureRolloutStrategyPresentation,
  rolloutTargetingPresentation,
} from './provider-feature-rollout-form-model';

describe('provider feature rollout typed form model', () => {
  it('builds typed values and schemas without accepting raw JSON', () => {
    expect(
      buildFeatureValue('JSON', {
        primitive: '',
        entries: [
          { id: '1', key: 'enabled', kind: 'BOOLEAN', value: 'true' },
          { id: '2', key: 'limit', kind: 'NUMBER', value: '25' },
        ],
      })
    ).toEqual({ enabled: true, limit: 25 });
    expect(
      buildFeatureSchema('NUMBER', {
        description: 'Percentage',
        minimum: '0',
        maximum: '100',
        requiredKeys: [],
      })
    ).toEqual({ type: 'number', description: 'Percentage', minimum: 0, maximum: 100 });
  });

  it('builds allowlisted targeting arrays and strictly increasing stages', () => {
    expect(
      buildTargeting({
        tenantIds: [],
        tenantKeys: ['acme'],
        regions: ['ap-northeast-2'],
        serviceTiers: [],
        isolationModels: [],
      })
    ).toEqual({ tenantKeys: ['acme'], regions: ['ap-northeast-2'] });
    expect(
      buildStages(
        'RING',
        [
          {
            id: '1',
            exposurePercentage: '10',
            minimumObservationMinutes: '30',
            gate: { maxErrorRate: '1', maxP95LatencyMs: '800', minSuccessRate: '99' },
          },
          {
            id: '2',
            exposurePercentage: '100',
            minimumObservationMinutes: '60',
            gate: { maxErrorRate: '1', maxP95LatencyMs: '800', minSuccessRate: '99' },
          },
        ],
        (index, percentage) => `${index}:${percentage}`
      )
    ).toHaveLength(2);
  });

  it('fails closed for unsafe stage order and incomplete observed health', () => {
    expect(() =>
      buildStages(
        'RING',
        [
          {
            id: '1',
            exposurePercentage: '100',
            minimumObservationMinutes: '0',
            gate: { maxErrorRate: '', maxP95LatencyMs: '', minSuccessRate: '' },
          },
          {
            id: '2',
            exposurePercentage: '50',
            minimumObservationMinutes: '0',
            gate: { maxErrorRate: '', maxP95LatencyMs: '', minSuccessRate: '' },
          },
        ],
        () => 'stage'
      )
    ).toThrowError(RolloutFormError);
    expect(() =>
      buildHealthEvidence({ maxErrorRate: '0', maxP95LatencyMs: '', minSuccessRate: '100' }, true)
    ).toThrowError(RolloutFormError);
  });

  it('enforces independent approval and hides unknown enum values', () => {
    expect(canDecideFeatureRollout({ requestedBy: 10 }, 10, true)).toBe(false);
    expect(canDecideFeatureRollout({ requestedBy: 10 }, 11, true)).toBe(true);
    expect(canDecideFeatureRollout({ requestedBy: 10 }, 11, false)).toBe(false);
    expect(featureValueTypePresentation('FUTURE')).toBe('UNAVAILABLE');
    expect(featureRolloutStrategyPresentation('FUTURE')).toBe('UNAVAILABLE');
    expect(rolloutTargetingPresentation({ unsupported: ['raw'] })).toBeNull();
    expect(rolloutTargetingPresentation({ regions: ['ap-northeast-2'] })).toEqual([
      { key: 'regions', values: ['ap-northeast-2'] },
    ]);
  });
});
