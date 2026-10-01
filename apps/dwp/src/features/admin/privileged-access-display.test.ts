import { describe, expect, it, vi } from 'vitest';

import {
  activationModeLabel,
  assuranceLabel,
  delegatedActionLabel,
  emergencyModeLabel,
  privilegedScopeLabel,
  privilegedStateLabelKey,
  privilegedVerificationLabelKey,
} from './privileged-access-display';

describe('privileged access display', () => {
  const t = vi.fn((key: string) => key) as never;

  it('fails closed for unknown policy and lifecycle values', () => {
    expect(privilegedScopeLabel('FUTURE', t)).toBe('roleGovernance.scopes.UNKNOWN');
    expect(activationModeLabel('FUTURE', t)).toBe('privilegedAccess.activationModes.UNKNOWN');
    expect(assuranceLabel('FUTURE', t)).toBe('privilegedAccess.assurance.UNKNOWN');
    expect(emergencyModeLabel('FUTURE', t)).toBe('privilegedAccess.emergencyModes.UNKNOWN');
    expect(delegatedActionLabel('FUTURE', t)).toBe('privilegedAccess.actionsCatalog.UNKNOWN');
    expect(privilegedStateLabelKey('FUTURE')).toBe('privilegedAccess.states.UNKNOWN');
    expect(privilegedVerificationLabelKey('FUTURE')).toBe(
      'privilegedAccess.verification.states.UNKNOWN'
    );
  });
});
