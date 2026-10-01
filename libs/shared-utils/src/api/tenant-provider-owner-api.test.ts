import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getTenantProviderDataGovernance,
  getTenantProviderDomains,
  getTenantProviderPlanEligibility,
  type TenantProviderDataGovernanceProjection,
  type TenantProviderDomainProjection,
  type TenantProviderPlanEligibilityProjection,
} from './tenant-provider-owner-api';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('tenant provider owner projections', () => {
  it('uses tenant-plane provider endpoints and preserves coverage exclusions', async () => {
    const domains: TenantProviderDomainProjection = {
      ownerService: 'provider-control-plane',
      observationState: 'LIVE_OWNER_READ',
      observedAt: '2026-09-29T02:00:00Z',
      sourceLastChangedAt: null,
      coverageState: 'CURRENT_TENANT_NON_REVOKED_DOMAINS',
      exclusions: ['DNS_CHALLENGE_SECRET'],
      domains: [],
    };
    const governance: TenantProviderDataGovernanceProjection = {
      ownerService: 'provider-control-plane',
      observationState: 'LIVE_OWNER_READ',
      observedAt: '2026-09-29T02:00:00Z',
      sourceLastChangedAt: null,
      coverageState: 'GLOBAL_POLICIES_AND_CURRENT_TENANT_LIFECYCLE_EVALUATIONS',
      exclusions: ['EXTERNAL_SHARING_OWNER_NOT_CONNECTED'],
      policies: [],
      tenantLifecycleHoldObservations: [],
    };
    const plan: TenantProviderPlanEligibilityProjection = {
      ownerService: 'provider-control-plane',
      observationState: 'LIVE_OWNER_READ',
      observedAt: '2026-09-29T02:00:00Z',
      sourceLastChangedAt: '2026-09-29T01:59:00Z',
      coverageState: 'CURRENT_SUBSCRIPTION_AND_TENANT_ENTITLEMENTS',
      exclusions: ['PRODUCTS_WITHOUT_PROVIDER_ENTITLEMENT_BINDINGS'],
      plan: {
        subscriptionState: 'ACTIVE',
        planKey: 'DWP_ENTERPRISE',
        planVersion: 1,
        displayName: 'DWP Enterprise',
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: null,
        sourceVersion: 3,
      },
      products: [],
    };
    http.get.mockResolvedValueOnce({ data: { data: domains } });
    http.get.mockResolvedValueOnce({ data: { data: governance } });
    http.get.mockResolvedValueOnce({ data: { data: plan } });

    await expect(getTenantProviderDomains()).resolves.toEqual(domains);
    await expect(getTenantProviderDataGovernance()).resolves.toEqual(governance);
    await expect(getTenantProviderPlanEligibility()).resolves.toEqual(plan);

    expect(http.get).toHaveBeenNthCalledWith(
      1,
      '/api/provider/v1/tenant/settings/provider-domains',
      undefined
    );
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/api/provider/v1/tenant/settings/data-governance-observation',
      undefined
    );
    expect(http.get).toHaveBeenNthCalledWith(
      3,
      '/api/provider/v1/tenant/settings/plan-eligibility',
      undefined
    );
  });

  it('forwards cancellation without adding tenant identifiers', async () => {
    const controller = new AbortController();
    http.get.mockResolvedValue({ data: { data: { domains: [] } } });

    await getTenantProviderDomains(controller.signal);

    expect(http.get).toHaveBeenCalledWith('/api/provider/v1/tenant/settings/provider-domains', {
      signal: controller.signal,
    });
  });
});
