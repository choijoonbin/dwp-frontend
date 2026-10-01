import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import { listAllProviderTenants, listProviderOperations } from './provider-control-tenant-client';

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('provider complete-ledger reads', () => {
  it('loads every operation page before returning global metrics input', async () => {
    vi.mocked(axiosInstance.get)
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ operationId: 'operation-1' }],
            page: 0,
            size: 100,
            totalElements: 2,
            totalPages: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ operationId: 'operation-2' }],
            page: 1,
            size: 100,
            totalElements: 2,
            totalPages: 2,
          },
        },
      });

    const result = await listProviderOperations();

    expect(result.content.map((item) => item.operationId)).toEqual(['operation-1', 'operation-2']);
    expect(http.get).toHaveBeenNthCalledWith(
      1,
      '/api/provider/v1/admin/operations?page=0&size=100'
    );
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/api/provider/v1/admin/operations?page=1&size=100'
    );
  });

  it('fails closed when paged operation coverage changes during collection', async () => {
    http.get
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ operationId: 'operation-1' }],
            page: 0,
            size: 100,
            totalElements: 2,
            totalPages: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ operationId: 'operation-1' }],
            page: 1,
            size: 100,
            totalElements: 2,
            totalPages: 2,
          },
        },
      });

    await expect(listProviderOperations()).rejects.toThrow(
      'PROVIDER_COMPLETE_LEDGER_COVERAGE_INCONSISTENT'
    );
  });

  it('fails closed when a later operation page reports different ledger metadata', async () => {
    http.get
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ operationId: 'operation-1' }],
            page: 0,
            size: 100,
            totalElements: 2,
            totalPages: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ operationId: 'operation-2' }],
            page: 1,
            size: 100,
            totalElements: 3,
            totalPages: 2,
          },
        },
      });

    await expect(listProviderOperations()).rejects.toThrow(
      'PROVIDER_COMPLETE_LEDGER_COVERAGE_INCONSISTENT'
    );
  });

  it('loads every tenant page used by operation labels and coverage', async () => {
    http.get
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ tenantId: 'tenant-1' }],
            page: 0,
            size: 100,
            totalElements: 2,
            totalPages: 2,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{ tenantId: 'tenant-2' }],
            page: 1,
            size: 100,
            totalElements: 2,
            totalPages: 2,
          },
        },
      });

    const result = await listAllProviderTenants();

    expect(result.content.map((item) => item.tenantId)).toEqual(['tenant-1', 'tenant-2']);
    expect(http.get).toHaveBeenNthCalledWith(1, '/api/provider/v1/admin/tenants?page=0&size=100');
    expect(http.get).toHaveBeenNthCalledWith(2, '/api/provider/v1/admin/tenants?page=1&size=100');
  });
});
