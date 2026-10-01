import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listProviderDataPolicies } from './provider-control-data-governance-client';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('provider data policy list contract', () => {
  it('preserves policy and nested revision partial-page evidence', async () => {
    const page = {
      items: [
        {
          policyId: 'policy-1',
          displayName: 'Retention policy',
          revisions: [{ revisionId: 'revision-1' }],
          revisionsLimit: 50,
          revisionsHasMore: true,
        },
      ],
      limit: 100,
      hasMore: true,
    };
    http.get.mockResolvedValue({ data: { data: page } });

    await expect(listProviderDataPolicies()).resolves.toEqual(page);
    expect(http.get).toHaveBeenCalledWith('/api/provider/v1/admin/data-governance/policies');
  });
});
