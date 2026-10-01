import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelProviderTenantLifecycleRequest,
  listProviderArtifactManifests,
  listProviderArtifactRolloutPlans,
  listProviderResourceCommitmentChanges,
  listProviderResourceCommitments,
  listProviderTenantLifecycleRequests,
} from './provider-control-resource-governance-client';

import type { ProviderTenantLifecycleRequest } from './provider-control-resource-governance-client';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('provider resource and artifact governance list contracts', () => {
  it('preserves every bounded page envelope instead of treating data as an array', async () => {
    const pages = [
      { items: [{ resourceKey: 'API_CALLS' }], limit: 100, hasMore: true },
      { items: [{ changeRequestId: 'change-1' }], limit: 50, hasMore: false },
      { items: [{ lifecycleRequestId: 'lifecycle-1' }], limit: 25, hasMore: true },
      { items: [{ artifactId: 'artifact-1' }], limit: 100, hasMore: false },
      { items: [{ rolloutPlanId: 'plan-1' }], limit: 100, hasMore: true },
    ];
    for (const page of pages) http.get.mockResolvedValueOnce({ data: { data: page } });

    await expect(listProviderResourceCommitments('tenant/a')).resolves.toEqual(pages[0]);
    await expect(listProviderResourceCommitmentChanges('tenant/a')).resolves.toEqual(pages[1]);
    await expect(listProviderTenantLifecycleRequests('tenant/a')).resolves.toEqual(pages[2]);
    await expect(listProviderArtifactManifests()).resolves.toEqual(pages[3]);
    await expect(listProviderArtifactRolloutPlans()).resolves.toEqual(pages[4]);

    expect(http.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/provider/v1/admin/resource-governance/commitments?tenantId=tenant%2Fa',
      '/api/provider/v1/admin/resource-governance/commitment-changes?tenantId=tenant%2Fa',
      '/api/provider/v1/admin/resource-governance/lifecycle-requests?tenantId=tenant%2Fa',
      '/api/provider/v1/admin/artifact-governance/manifests',
      '/api/provider/v1/admin/artifact-governance/rollout-plans',
    ]);
  });

  it('cancels the current lifecycle request with its optimistic version and reason', async () => {
    const request = {
      lifecycleRequestId: 'lifecycle-1',
      version: 7,
    } as ProviderTenantLifecycleRequest;
    const cancelled = { ...request, lifecycleState: 'CANCELLED', version: 8 };
    http.post.mockResolvedValue({ data: { data: cancelled } });

    await expect(
      cancelProviderTenantLifecycleRequest(request, 'No longer required')
    ).resolves.toEqual(cancelled);
    expect(http.post).toHaveBeenCalledWith(
      '/api/provider/v1/admin/resource-governance/lifecycle-requests/lifecycle-1/cancel',
      { version: 7, reason: 'No longer required' }
    );
  });
});
