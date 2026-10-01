import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listAppAccessRequests } from './workspace-api';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('workspace app access request coverage', () => {
  it('preserves the owner truncation signal at the five-hundred-request boundary', async () => {
    http.get.mockResolvedValue({
      data: {
        data: {
          items: Array.from({ length: 500 }, (_, index) => ({ requestId: String(index) })),
          limit: 500,
          hasMore: true,
          coverageState: 'TRUNCATED_AT_LIMIT',
        },
      },
    });

    await expect(listAppAccessRequests('ALL')).resolves.toMatchObject({
      items: { length: 500 },
      limit: 500,
      hasMore: true,
      coverageState: 'TRUNCATED_AT_LIMIT',
    });
    expect(http.get).toHaveBeenCalledWith('/api/platform/v1/admin/app-access-requests?state=ALL');
  });
});
