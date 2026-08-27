import { describe, expect, it } from 'vitest';

import { resolveProviderLandingPath } from './provider-navigation';

describe('resolveProviderLandingPath', () => {
  it('keeps estate operators on the command center', () => {
    expect(resolveProviderLandingPath(['ESTATE_READ'])).toBe('/provider/overview');
  });

  it('lands a least-privilege release approver on feature rollouts', () => {
    expect(resolveProviderLandingPath(['FEATURE_ROLLOUT_READ', 'FEATURE_ROLLOUT_APPROVE'])).toBe(
      '/provider/feature-rollouts'
    );
  });

  it('lands a least-privilege data approver on data governance', () => {
    expect(resolveProviderLandingPath(['DATA_GOVERNANCE_READ', 'DATA_GOVERNANCE_APPROVE'])).toBe(
      '/provider/data-governance'
    );
  });

  it('lands a support-only operator on the support workspace', () => {
    expect(resolveProviderLandingPath(['SUPPORT_ACCESS_READ'])).toBe('/provider/support');
  });

  it('fails closed when no readable Provider destination is granted', () => {
    expect(resolveProviderLandingPath(['FEATURE_ROLLOUT_APPROVE'])).toBeNull();
  });
});
