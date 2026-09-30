import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listScimProvisioningEvents } from './provisioning-admin-api';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('SCIM provisioning event coverage', () => {
  it('preserves the owner truncation signal at the 100-event boundary', async () => {
    http.get.mockResolvedValue({
      data: {
        data: {
          items: Array.from({ length: 100 }, (_, index) => ({ eventId: String(index) })),
          limit: 100,
          hasMore: true,
          coverageState: 'TRUNCATED_AT_LIMIT',
        },
      },
    });

    await expect(listScimProvisioningEvents()).resolves.toMatchObject({
      items: { length: 100 },
      limit: 100,
      hasMore: true,
      coverageState: 'TRUNCATED_AT_LIMIT',
    });
    expect(http.get).toHaveBeenCalledWith(
      '/api/auth/admin/provisioning/scim/connectors/events?limit=100'
    );
  });
});
