/**
 * Synapse API Contract Tests
 *
 * Verifies:
 * - X-Tenant-ID header is sent on all requests
 * - Valid tenant_id=1 returns 200 + data or empty list
 * - Invalid tenant returns 403 or 200 + empty (policy-dependent)
 * - Unauthenticated returns 401
 *
 * Run: yarn nx test shared-utils -- synapse-contract
 */

import { it, vi, expect, describe, beforeEach } from 'vitest';

import { getCases } from '../synapse-operations-api';
import { getFiDocHeaders } from '../synapse-data-api';
import { getAnalyticsKpis } from '../synapse-reporting-api';

// ----------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------

const mockFetch = vi.fn();

vi.mock('../../auth/token-storage', () => ({
  getAccessToken: () => 'mock-token',
}));

vi.mock('../../env', () => ({
  NX_API_URL: 'http://localhost:8080',
}));

// Tenant util - controllable per test (vi.hoisted for vi.mock factory)
const { mockGetTenantId } = vi.hoisted(() => ({
  mockGetTenantId: vi.fn(() => '1'),
}));
vi.mock('../../tenant-util', () => ({
  getTenantId: mockGetTenantId,
}));

// Use global fetch mock
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
});

// ----------------------------------------------------------------------
// Helper: assert request includes X-Tenant-ID
// ----------------------------------------------------------------------

function assertTenantHeader(calls: unknown[][], expectedTenantId: string) {
  const lastCall = calls[calls.length - 1];
  if (!lastCall || typeof lastCall[1] !== 'object') return;
  const opts = lastCall[1] as { headers?: Record<string, string> };
  const headers = opts?.headers ?? {};
  expect(headers['X-Tenant-ID']).toBe(expectedTenantId);
}

// ----------------------------------------------------------------------
// Contract: Valid tenant_id=1 returns data or empty
// ----------------------------------------------------------------------

describe('Synapse API Contract — Valid tenant_id=1', () => {
  beforeEach(() => {
    mockGetTenantId.mockReturnValue('1');
  });

  it('GET /api/synapse/cases with X-Tenant-ID: 1 returns 200 + data or empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'SUCCESS',
        data: { items: [], total: 0, page: 0, size: 20, totalPages: 0 },
      }),
    } as Response);

    const res = await getCases({ page: 0, size: 20 });
    expect(res.status).toBe('SUCCESS');
    expect(res.data).toBeDefined();
    expect(Array.isArray(res.data?.items)).toBe(true);

    assertTenantHeader(mockFetch.mock.calls, '1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/synapse/cases'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Tenant-ID': '1' }),
      })
    );
  });

  it('GET /api/synapse/cases with filters maps params 1:1 to query string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'SUCCESS',
        data: { content: [], totalElements: 0 },
      }),
    } as Response);

    await getCases({
      status: 'OPEN',
      severity: 'high',
      caseType: 'DUPLICATE',
      detectedFrom: '2025-01-01',
      detectedTo: '2025-01-31',
      bukrs: '1000',
      belnr: '1900000001',
      gjahr: '2025',
      partyId: 123,
      page: 0,
      size: 10,
      sort: 'detectedAt,desc',
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('status=OPEN');
    expect(url).toContain('severity=high');
    expect(url).toContain('caseType=DUPLICATE');
    expect(url).toContain('detectedFrom=2025-01-01');
    expect(url).toContain('detectedTo=2025-01-31');
    expect(url).toContain('bukrs=1000');
    expect(url).toContain('belnr=1900000001');
    expect(url).toContain('gjahr=2025');
    expect(url).toContain('partyId=123');
    expect(url).toContain('page=0');
    expect(url).toContain('size=10');
    expect(url).toContain('sort=detectedAt%2Cdesc');
  });

  it('GET /api/synapse/analytics/kpis with from, to, bukrs, currency maps 1:1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'SUCCESS',
        data: { savingsEstimate: 1000, automationRate: 0.85 },
      }),
    } as Response);

    await getAnalyticsKpis({
      from: '2025-01-01',
      to: '2025-01-31',
      bukrs: '1000',
      currency: 'USD',
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('from=2025-01-01');
    expect(url).toContain('to=2025-01-31');
    expect(url).toContain('bukrs=1000');
    expect(url).toContain('currency=USD');
  });

  it('GET /api/synapse/entities/fi-doc-headers with limit, page, size maps 1:1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'SUCCESS',
        data: [],
      }),
    } as Response);

    await getFiDocHeaders({
      limit: 20,
      page: 0,
      size: 20,
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/synapse/entities/fi-doc-headers');
    expect(url).toContain('limit=20');
    expect(url).toContain('page=0');
    expect(url).toContain('size=20');
  });

  it('GET /api/synapse/entities/fi-doc-headers passes filter params when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'SUCCESS', data: [] }),
    } as Response);

    await getFiDocHeaders({
      limit: 100,
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      bukrs: '1000',
      status: 'pass',
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('dateFrom=2025-01-01');
    expect(url).toContain('dateTo=2025-01-31');
    expect(url).toContain('bukrs=1000');
    expect(url).toContain('status=pass');
  });
});

// ----------------------------------------------------------------------
// Contract: Invalid tenant returns 403 or empty
// ----------------------------------------------------------------------

describe('Synapse API Contract — Invalid tenant', () => {
  beforeEach(() => {
    mockGetTenantId.mockReturnValue('invalid-tenant');
  });

  it('GET /api/synapse/cases with invalid X-Tenant-ID may return 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ status: 'ERROR', message: 'Access denied' }),
    } as Response);

    await expect(getCases()).rejects.toThrow();
    assertTenantHeader(mockFetch.mock.calls, 'invalid-tenant');
  });

  it('GET /api/synapse/cases with invalid tenant may return 200 + empty (policy)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'SUCCESS',
        data: { items: [], total: 0, page: 0, size: 20, totalPages: 0 },
      }),
    } as Response);

    const res = await getCases();
    expect(res.status).toBe('SUCCESS');
    expect(res.data?.items).toEqual([]);
    assertTenantHeader(mockFetch.mock.calls, 'invalid-tenant');
  });
});

// ----------------------------------------------------------------------
// Contract: Unauthenticated returns 401
// ----------------------------------------------------------------------

describe('Synapse API Contract — Unauthenticated', () => {
  it('401 response is thrown when no valid token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    } as Response);

    await expect(getCases()).rejects.toThrow();
  });
});
