import { describe, expect, it } from 'vitest';

import {
  providerCommitmentLifecycleLabel,
  providerResourceChangeKindLabel,
  providerResourceControlModeLabel,
  providerResourceFreshnessLabel,
  providerResourceLedgerEntryTypeLabel,
  providerResourceUnitLabel,
  providerTenantHoldStateLabel,
  providerTenantLifecycleActionLabel,
} from './provider-resource-presentation';

const t = (key: string) => key;

describe('provider resource presentation', () => {
  it('maps known resource governance codes', () => {
    expect(providerResourceUnitLabel(t, 'SEAT')).toBe('resourceGovernance.units.SEAT');
    expect(providerResourceControlModeLabel(t, 'HARD_BLOCK')).toBe(
      'resourceGovernance.controlModes.HARD_BLOCK'
    );
    expect(providerCommitmentLifecycleLabel(t, 'ACTIVE')).toBe(
      'resourceGovernance.commitmentLifecycle.ACTIVE'
    );
  });

  it('fails closed for unknown values', () => {
    expect(providerResourceUnitLabel(t, 'INTERNAL_UNIT')).toBe('resourceGovernance.unknownValue');
    expect(providerResourceControlModeLabel(t, 'INTERNAL_MODE')).toBe(
      'resourceGovernance.unknownValue'
    );
    expect(providerResourceFreshnessLabel(t, 'INTERNAL_FRESHNESS')).toBe(
      'resourceGovernance.unknownValue'
    );
    expect(providerResourceLedgerEntryTypeLabel(t, 'INTERNAL_ENTRY')).toBe(
      'resourceGovernance.unknownValue'
    );
    expect(providerResourceChangeKindLabel(t, 'INTERNAL_CHANGE')).toBe(
      'resourceGovernance.unknownValue'
    );
    expect(providerTenantLifecycleActionLabel(t, 'INTERNAL_ACTION')).toBe(
      'resourceGovernance.unknownValue'
    );
    expect(providerTenantHoldStateLabel(t, 'INTERNAL_HOLD')).toBe(
      'resourceGovernance.unknownValue'
    );
  });
});
