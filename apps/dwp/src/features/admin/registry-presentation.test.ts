import { describe, expect, it } from 'vitest';

import {
  registryRiskColor,
  registryRiskLabelKey,
  registryTypeColor,
  registryTypeLabelKey,
} from './registry-presentation';

describe('registry presentation', () => {
  it('fails closed for unknown owner enum values', () => {
    expect(registryTypeLabelKey('FUTURE_TYPE')).toBe('registry.types.UNKNOWN');
    expect(registryTypeColor('FUTURE_TYPE')).toBe('default');
    expect(registryRiskLabelKey('FUTURE_RISK')).toBe('registry.risk.UNKNOWN');
    expect(registryRiskColor('FUTURE_RISK')).toBe('default');
  });
});
