import { describe, expect, it } from 'vitest';

import {
  authPolicyCoverageLabelKey,
  authPolicyImpactConfidenceLabelKey,
  authPolicyStateLabelKey,
  resolveTenantAuthPolicyDraft,
  tenantAuthPolicyChangePageState,
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

describe('tenantAuthPolicyChangePageState', () => {
  it('preserves observed terminal rows and permits creation when only older terminal history remains', () => {
    const observed = {
      lifecycleState: 'PUBLISHED',
    } as Parameters<typeof tenantAuthPolicyChangePageState>[0]['items'][number];
    const terminalHistory = Array.from({ length: 100 }, () => observed);

    expect(tenantAuthPolicyChangePageState({ items: terminalHistory, hasMore: true })).toEqual({
      items: terminalHistory,
      partial: true,
      showEmpty: false,
      createBlocked: false,
    });
  });

  it('does not claim an empty history from an empty bounded page', () => {
    expect(tenantAuthPolicyChangePageState({ items: [], hasMore: true })).toMatchObject({
      partial: true,
      showEmpty: false,
      createBlocked: false,
    });
  });

  it('blocks creation when the actionability-first page contains an open change', () => {
    const open = {
      lifecycleState: 'IN_REVIEW',
    } as Parameters<typeof tenantAuthPolicyChangePageState>[0]['items'][number];
    expect(tenantAuthPolicyChangePageState({ items: [open], hasMore: true }).createBlocked).toBe(
      true
    );
  });
});
