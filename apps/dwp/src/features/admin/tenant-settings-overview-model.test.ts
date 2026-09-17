import { describe, expect, it } from 'vitest';

import {
  resolveTenantAuthenticationPosture,
  resolveTenantPrioritySummaryState,
  resolveTenantSettingsTasks,
} from './tenant-settings-overview-model';

describe('tenant settings overview model', () => {
  it('does not present zero tasks as clear when an owner read failed', () => {
    expect(
      resolveTenantPrioritySummaryState({ loading: false, partialFailure: true, taskCount: 0 })
    ).toBe('UNAVAILABLE');
    expect(
      resolveTenantPrioritySummaryState({ loading: false, partialFailure: false, taskCount: 0 })
    ).toBe('CLEAR');
  });

  it('uses owner responses instead of inventing an SSO or SCIM readiness state', () => {
    expect(resolveTenantAuthenticationPosture({})).toEqual({
      sso: 'UNAVAILABLE',
      providerKeys: [],
      mfaRequired: null,
      scim: 'UNAVAILABLE',
      activeScimConnectors: null,
    });

    expect(
      resolveTenantAuthenticationPosture({
        authPolicy: {
          tenantId: 7,
          defaultLoginType: 'SSO',
          allowedLoginTypes: ['LOCAL', 'SSO'],
          localLoginEnabled: true,
          ssoLoginEnabled: true,
          ssoProviderKey: 'entra',
          requireMfa: true,
        },
        identityProviders: [{ enabled: true, providerType: 'OIDC', providerKey: 'entra' }],
        scimConnectors: [],
      })
    ).toEqual({
      sso: 'ENABLED',
      providerKeys: ['entra'],
      mfaRequired: true,
      scim: 'NOT_CONFIGURED',
      activeScimConnectors: 0,
    });
  });

  it('does not turn an unavailable identity-provider owner into an incomplete SSO task', () => {
    const authentication = resolveTenantAuthenticationPosture({
      authPolicy: {
        tenantId: 7,
        defaultLoginType: 'SSO',
        allowedLoginTypes: ['LOCAL', 'SSO'],
        localLoginEnabled: true,
        ssoLoginEnabled: true,
        ssoProviderKey: 'entra',
        requireMfa: true,
      },
    });

    expect(authentication.sso).toBe('UNAVAILABLE');
    expect(resolveTenantSettingsTasks({ authentication })).toEqual([]);
  });

  it('does not report SSO ready when the enabled provider differs from the configured provider', () => {
    const authentication = resolveTenantAuthenticationPosture({
      authPolicy: {
        tenantId: 7,
        defaultLoginType: 'SSO',
        allowedLoginTypes: ['LOCAL', 'SSO'],
        localLoginEnabled: true,
        ssoLoginEnabled: true,
        ssoProviderKey: 'entra',
        requireMfa: true,
      },
      identityProviders: [{ enabled: true, providerType: 'SAML', providerKey: 'okta' }],
      scimConnectors: [],
    });

    expect(authentication.sso).toBe('INCOMPLETE');
    expect(authentication.providerKeys).toEqual(['okta']);
    expect(resolveTenantSettingsTasks({ authentication }).map(({ kind }) => kind)).toContain(
      'SSO_CONFIGURATION'
    );
  });

  it('creates only actionable tasks backed by canonical owner state', () => {
    const tasks = resolveTenantSettingsTasks({
      authentication: {
        sso: 'INCOMPLETE',
        providerKeys: [],
        mfaRequired: true,
        scim: 'ATTENTION',
        activeScimConnectors: 0,
      },
      appGovernance: {
        metrics: {
          activeAssignments: 2,
          pendingApprovals: 3,
          reviewsDueSoon: 0,
          resourcesWithoutOwner: 0,
        },
        responsibilities: [],
        principals: [],
        resourceSets: [],
        assignments: [],
      },
      policyRevisions: [
        {
          revisionId: 'revision-4',
          revisionNumber: 4,
          lifecycleState: 'IN_REVIEW',
          standardRetentionDays: 365,
          extendedRetentionDays: 730,
          exportLimitRows: 1000,
          requireExportReason: true,
          integrityEnabled: true,
          highRiskThreshold: 80,
          changeReason: 'Extend retention',
          diff: {},
          contentSha256: 'abc',
          createdBy: 'admin',
          createdAt: '2026-09-17T00:00:00Z',
          version: 1,
        },
      ],
    });

    expect(tasks.map(({ kind, count }) => [kind, count])).toEqual([
      ['SSO_CONFIGURATION', 1],
      ['SCIM_ATTENTION', 1],
      ['APP_APPROVAL', 3],
      ['POLICY_REVIEW', 1],
    ]);
  });
});
