import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listAuditIntegrity } from './audit-control-api';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('audit integrity coverage', () => {
  it('preserves the owner truncation signal at the ninety-checkpoint boundary', async () => {
    http.get.mockResolvedValue({
      data: {
        data: {
          items: Array.from({ length: 90 }, (_, index) => ({ checkpointId: String(index) })),
          limit: 90,
          hasMore: true,
          coverageState: 'TRUNCATED_AT_LIMIT',
        },
      },
    });

    await expect(listAuditIntegrity()).resolves.toMatchObject({
      items: { length: 90 },
      limit: 90,
      hasMore: true,
      coverageState: 'TRUNCATED_AT_LIMIT',
    });
  });
});
