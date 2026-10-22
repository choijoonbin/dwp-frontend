import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import { PAY004_API_CONTRACTS, pay004QueryString, queryPay004Entry } from '../retirement-api';
import { createPay004QueryRequest } from '../retirement-contract';
import {
  PAY004_TEST_ADMISSION,
  PAY004_TEST_SCOPE,
  pay004ProjectionWire,
} from './retirement-fixtures.test-support';

describe('PAY-004 IAQ-049 API', () => {
  beforeEach(() => transport.get.mockReset());

  it('pins one GET browser-owner binding', () => {
    expect(PAY004_API_CONTRACTS).toEqual([
      {
        bindingId: 'IAQ-049',
        operationId: 'IAQ.OP.049',
        method: 'GET',
        browserPath: '/api/payroll/v1/workbench/pay-retirement',
        ownerPath: '/v1/workbench/pay-retirement',
      },
    ]);
  });

  it('serializes only the typed query and uses governed read scope', async () => {
    transport.get.mockResolvedValue({ data: pay004ProjectionWire() });
    const request = createPay004QueryRequest(PAY004_TEST_SCOPE, {
      limit: 20,
      filter: { caseStatus: { codes: ['CALCULATED'] } },
      sort: ['caseStatus:ASC'],
    });
    const signal = new AbortController().signal;

    await expect(
      queryPay004Entry(request, PAY004_TEST_ADMISSION.contextScopeKey, signal)
    ).resolves.toEqual(expect.objectContaining({ variantKey: 'RETIREMENT' }));

    const [url, config] = transport.get.mock.calls[0]!;
    const parsed = new URL(url, 'https://dwp.invalid');
    expect(parsed.pathname).toBe('/api/payroll/v1/workbench/pay-retirement');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(parsed.searchParams.getAll('sort')).toEqual(['caseStatus:ASC', 'itemPublicId:ASC']);
    expect(parsed.searchParams.getAll('filter[caseStatus][codes]')).toEqual(['CALCULATED']);
    expect(parsed.searchParams.has('tenantId')).toBe(false);
    expect(config.signal).toBe(signal);
    expect(config.contextScopeKey).toBe(PAY004_TEST_ADMISSION.contextScopeKey);
    expect(config.headers).toEqual(
      expect.objectContaining({
        'X-DWP-Route-Contract-Key': 'route.hcm.operations.pay-retirement.data',
      })
    );
  });

  it('emits an explicit empty filter and refuses a missing trusted scope', async () => {
    const request = createPay004QueryRequest(PAY004_TEST_SCOPE);
    expect(new URLSearchParams(pay004QueryString(request)).get('filter')).toBe('{}');
    await expect(queryPay004Entry(request, ' ', new AbortController().signal)).rejects.toThrow(
      'trusted request scope'
    );
    expect(transport.get).not.toHaveBeenCalled();
  });
});
