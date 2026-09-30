import { describe, expect, it } from 'vitest';

import {
  authPolicyCoverageLabelKey,
  authPolicyImpactConfidenceLabelKey,
  authPolicyStateLabelKey,
  resolveTenantAuthPolicyDraft,
} from './tenant-auth-policy-workflow-model';

describe('tenant authentication-policy draft model', () => {
  it('preserves every server-owned field from the current policy', () => {
    expect(
      resolveTenantAuthPolicyDraft({
        defaultLoginType: 'SSO',
        allowedLoginTypes: ['LOCAL', 'SSO'],
        localLoginEnabled: true,
        ssoLoginEnabled: true,
        ssoProviderKey: 'entra',
        requireMfa: true,
        tokenTtlSec: 3600,
      })
    ).toEqual({
      defaultLoginType: 'SSO',
      allowedLoginTypes: ['LOCAL', 'SSO'],
      localLoginEnabled: true,
      ssoLoginEnabled: true,
      ssoProviderKey: 'entra',
      requireMfa: true,
      tokenTtlSec: 3600,
    });
  });

  it('uses a safe local-login default before the current policy is available', () => {
    expect(resolveTenantAuthPolicyDraft(null)).toMatchObject({
      defaultLoginType: 'LOCAL',
      allowedLoginTypes: ['LOCAL'],
      localLoginEnabled: true,
      ssoLoginEnabled: false,
      requireMfa: false,
    });
  });

  it('never exposes unknown owner enums through translation keys', () => {
    for (const key of [
      authPolicyStateLabelKey('FUTURE_STATE'),
      authPolicyImpactConfidenceLabelKey('FUTURE_CONFIDENCE'),
      authPolicyCoverageLabelKey('FUTURE_COVERAGE'),
    ]) {
      expect(key).toMatch(/\.UNKNOWN$/);
      expect(key).not.toContain('FUTURE_');
    }
  });
});
