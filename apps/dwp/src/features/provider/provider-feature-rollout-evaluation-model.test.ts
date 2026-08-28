import { describe, expect, it } from 'vitest';

import {
  providerFeatureEvaluationResultMatches,
  providerFeatureEvaluationSelectionMatches,
  resolveProviderFeatureEvaluationOption,
} from './provider-feature-rollout-evaluation-model';

describe('provider feature rollout evaluation model', () => {
  it('adopts the first async option and replaces a removed selection', () => {
    expect(resolveProviderFeatureEvaluationOption('', [])).toBe('');
    expect(resolveProviderFeatureEvaluationOption('', ['flag-a', 'flag-b'])).toBe('flag-a');
    expect(resolveProviderFeatureEvaluationOption('flag-b', ['flag-a', 'flag-b'])).toBe('flag-b');
    expect(resolveProviderFeatureEvaluationOption('retired', ['flag-a', 'flag-b'])).toBe('flag-a');
  });

  it('binds pending work and results to the exact current feature and tenant', () => {
    const selection = { featureKey: 'flag-a', tenantId: 'tenant-42' };
    const result = { featureKey: 'flag-a', providerTenantId: 'tenant-42' };

    expect(providerFeatureEvaluationSelectionMatches(selection, 'flag-a', 'tenant-42')).toBe(true);
    expect(providerFeatureEvaluationSelectionMatches(selection, 'flag-b', 'tenant-42')).toBe(false);
    expect(providerFeatureEvaluationResultMatches(result, 'flag-a', 'tenant-42')).toBe(true);
    expect(providerFeatureEvaluationResultMatches(result, 'flag-a', 'tenant-7')).toBe(false);
  });
});
