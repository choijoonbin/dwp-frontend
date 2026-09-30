import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listRegistryEntries } from './platform-registry-api';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('platform registry pagination', () => {
  it('requests the selected server page and preserves the full owner count', async () => {
    http.get.mockResolvedValue({
      data: {
        data: {
          content: [{ entryKey: 'item-101' }],
          page: 4,
          size: 25,
          totalElements: 101,
          totalPages: 5,
        },
      },
    });

    await expect(listRegistryEntries({ page: 4, size: 25 })).resolves.toMatchObject({
      page: 4,
      size: 25,
      totalElements: 101,
      totalPages: 5,
    });
    expect(http.get).toHaveBeenCalledWith('/api/platform/v1/admin/registry-entries?page=4&size=25');
  });
});
