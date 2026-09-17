import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  getWorkplaceResourceFavorites,
  setWorkplaceResourceFavorite,
} from './workplace-resource-favorite-api';

const resourceId = '10000000-0000-0000-0000-000000000014';
const now = '2026-09-17T06:00:00Z';

afterEach(() => vi.restoreAllMocks());

describe('Workplace resource favorite API', () => {
  it('reads an explicit resource scope without shared caching assumptions', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({
      data: { success: true, data: [{ resourceId, favorite: false, version: 0, updatedAt: null }] },
    });
    await expect(getWorkplaceResourceFavorites([resourceId])).resolves.toEqual([
      { resourceId, favorite: false, version: 0, updatedAt: null },
    ]);
    expect(get).toHaveBeenCalledWith(
      `/api/platform/v1/workplace/resource-favorites?resourceIds=${resourceId}`
    );
  });

  it('sends a versioned idempotent favorite command and validates its receipt', async () => {
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({
      data: {
        success: true,
        data: {
          commandId: '20000000-0000-0000-0000-000000000014',
          favorite: { resourceId, favorite: true, version: 1, updatedAt: now },
          auditEventId: '30000000-0000-0000-0000-000000000014',
          correlationId: 'corr-14',
          completedAt: now,
        },
      },
    });
    await expect(
      setWorkplaceResourceFavorite(
        resourceId,
        { favorite: true, expectedVersion: 0 },
        { idempotencyKey: 'workplace:resource-favorite:test', correlationId: 'corr-14' }
      )
    ).resolves.toMatchObject({ favorite: { favorite: true, version: 1 } });
    expect(put).toHaveBeenCalledWith(
      `/api/platform/v1/workplace/resources/${resourceId}/favorite`,
      { favorite: true, expectedVersion: 0 },
      {
        headers: {
          'Idempotency-Key': 'workplace:resource-favorite:test',
          'X-Correlation-ID': 'corr-14',
        },
      }
    );
  });
});
