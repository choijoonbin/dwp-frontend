import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listAuditPolicyRevisions } from './audit-control-api';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('audit policy revision API', () => {
  it('reads revisions through the generated bounded page contract', async () => {
    const page = {
      items: [{ revisionId: 'revision-1', lifecycleState: 'PUBLISHED' }],
      limit: 100,
      hasMore: true,
    };
    http.get.mockResolvedValueOnce({ data: { data: page } });

    await expect(listAuditPolicyRevisions()).resolves.toEqual(page);
    expect(http.get).toHaveBeenCalledWith(
      '/api/platform/v1/admin/audit-control/policy/revisions?limit=100'
    );
  });
});
