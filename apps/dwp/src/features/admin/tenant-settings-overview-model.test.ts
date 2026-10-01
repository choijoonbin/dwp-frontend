import { describe, expect, it } from 'vitest';

import type { TenantProviderDomainProjection } from '@dwp-frontend/shared-utils';

import {
  resolveTenantAuthenticationPosture,
  resolveTenantDomainOverview,
  resolveTenantPrioritySummaryState,
  resolveTenantSettingsTasks,
} from './tenant-settings-overview-model';

describe('tenant settings overview model', () => {
  it('summarizes Provider domain loading, failure, empty, and observed states without inventing evidence', () => {
    const projection: TenantProviderDomainProjection = {
      ownerService: 'provider-control-plane',
      observationState: 'LIVE_OWNER_READ',
      observedAt: '2026-10-01T00:00:00Z',
      coverageState: 'CURRENT_TENANT_NON_REVOKED_DOMAINS',
      exclusions: [],
      domains: [
        {
          domainId: 'verified-domain',
          domainName: 'verified.example',
          domainType: 'LOGIN',
          verificationMethod: 'DNS_TXT',
          verificationState: 'VERIFIED',
          primaryDomain: true,
          sourceChangedAt: '2026-10-01T00:00:00Z',
          evidenceFreshnessState: 'OWNER_ATTESTED',
          version: 1,
        },
        {
          domainId: 'pending-domain',
          domainName: 'pending.example',
          domainType: 'EMAIL',
          verificationMethod: 'HTTP',
          verificationState: 'PENDING',
          primaryDomain: false,
          sourceChangedAt: '2026-10-01T00:00:00Z',
          evidenceFreshnessState: 'RECORDED_AT',
          version: 1,
        },
      ],
    };

    expect(
      resolveTenantDomainOverview({
        permitted: false,
        loading: false,
        failed: false,
      })
    ).toEqual({ state: 'NO_ACCESS', total: null, verified: null });
    expect(resolveTenantDomainOverview({ permitted: true, loading: true, failed: false })).toEqual({
      state: 'LOADING',
      total: null,
      verified: null,
    });
    expect(resolveTenantDomainOverview({ permitted: true, loading: false, failed: true })).toEqual({
      state: 'ERROR',
      total: null,
      verified: null,
    });
    expect(
      resolveTenantDomainOverview({
        permitted: true,
        loading: false,
        failed: false,
        projection: { ...projection, domains: [] },
      })
    ).toEqual({ state: 'EMPTY', total: 0, verified: 0 });
    expect(
      resolveTenantDomainOverview({
        permitted: true,
        loading: false,
        failed: false,
        projection,
      })
    ).toEqual({ state: 'OBSERVED', total: 2, verified: 1 });
  });

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
      policyRevisions: {
        items: [
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
            impactSnapshot: {
              observedAt: '2026-09-17T00:00:00Z',
              coverageState: 'UNAVAILABLE_LEGACY_REVISION',
              includedOwners: [],
              exclusions: ['LEGACY_REVISION_NOT_SNAPSHOTTED'],
              auditEventCount: 0,
              affectedAuditEventCount: 0,
              affectedActorCount: 0,
              affectedTargetCount: 0,
              standardRetentionEventCount: 0,
              extendedRetentionEventCount: 0,
              legalHoldEventCount: 0,
              standardRetentionAffectedEventCount: 0,
              extendedRetentionAffectedEventCount: 0,
              highRiskClassificationAffectedEventCount: 0,
              exportableEventCountBefore: 0,
              exportableEventCountAfter: 0,
              integrityProtectedEventCountBefore: 0,
              integrityProtectedEventCountAfter: 0,
            },
            impactSha256: 'b'.repeat(64),
            createdBy: 'admin',
            createdAt: '2026-09-17T00:00:00Z',
            version: 1,
          },
        ],
        hasMore: true,
      },
    });

    expect(tasks.map(({ kind, count }) => [kind, count])).toEqual([
      ['SSO_CONFIGURATION', 1],
      ['SCIM_ATTENTION', 1],
      ['APP_APPROVAL', 3],
      ['POLICY_REVIEW', 1],
    ]);
    expect(tasks.find(({ kind }) => kind === 'POLICY_REVIEW')?.countIsLowerBound).toBe(true);
  });
});
