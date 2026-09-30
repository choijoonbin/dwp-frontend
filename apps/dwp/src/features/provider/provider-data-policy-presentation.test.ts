import { describe, expect, it } from 'vitest';

import {
  providerPolicyImpactCode,
  providerPolicyRuleFacts,
  providerPolicyScopePresentation,
  providerPolicyTypePresentation,
} from './provider-data-policy-presentation';

describe('provider data policy presentation', () => {
  it('projects typed rule fields without serializing JSON', () => {
    expect(providerPolicyRuleFacts('DELETION', { deletionSlaDays: 30, mode: 'ANONYMIZE' })).toEqual(
      [
        { field: 'deletionSlaDays', text: '30' },
        {
          field: 'deletionMode',
          translationKey: 'dataGovernance.policy.deletionModes.ANONYMIZE',
        },
      ]
    );
    expect(providerPolicyRuleFacts('DELETION', { internal: true })).toBeNull();
  });

  it('fails closed for unknown impact codes while retaining known safe detail', () => {
    expect(providerPolicyImpactCode('TENANT_COLUMN_MISSING:tenant_id')).toEqual({
      code: 'TENANT_COLUMN_MISSING',
      detail: 'tenant_id',
    });
    expect(providerPolicyImpactCode('INTERNAL_NEW_CODE:secret')).toBeNull();
    expect(providerPolicyTypePresentation('INTERNAL_POLICY')).toBe('UNKNOWN');
    expect(providerPolicyScopePresentation('INTERNAL_SCOPE')).toBe('UNKNOWN');
  });
});
