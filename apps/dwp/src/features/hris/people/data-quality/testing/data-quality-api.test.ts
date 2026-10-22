import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get },
}));

import { HRM012_API_CONTRACTS, hrm012QueryString, queryHrm012Entry } from '../data-quality-api';
import { HRM012_QUERY_CONTRACT, createHrm012QueryRequest } from '../data-quality-contract';
import {
  HRM012_TEST_AS_OF,
  HRM012_TEST_CURSOR,
  HRM012_TEST_DIGEST,
  HRM012_TEST_SCOPE,
  hrm012ProjectionWire,
} from './data-quality-fixtures.test-support';

describe('HRM-012 IAQ-012 API adapter', () => {
  beforeEach(() => runtime.get.mockReset());

  it('exposes exactly one GET owner contract and no command contract', () => {
    expect(HRM012_API_CONTRACTS).toEqual([
      {
        bindingId: 'IAQ-012',
        operationId: 'IAQ.OP.012',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/operations/data/quality',
        ownerPath: '/v1/hris/workbench/operations/data/quality',
      },
    ]);
  });

  it('serializes only the sealed nested query and carries trusted scope outside the URL', async () => {
    runtime.get.mockResolvedValue({ data: hrm012ProjectionWire() });
    const request = createHrm012QueryRequest(HRM012_TEST_SCOPE, {
      filter: {
        ingestionStatus: { codes: ['APPLIED'], minimumRevision: 2 },
        qualityFinding: { decisionCodes: ['VALID'], evidenceDigest: HRM012_TEST_DIGEST },
        commandReceipt: { receiptIds: ['receipt.public.1'], states: ['SUCCEEDED'] },
        effectiveOn: '2026-10-22',
      },
      sort: ['commandReceipt:DESC', 'itemPublicId:ASC'],
      asOf: HRM012_TEST_AS_OF,
      cursor: HRM012_TEST_CURSOR,
    });

    await expect(
      queryHrm012Entry(request, HRM012_TEST_SCOPE.contextScopeKey, new AbortController().signal)
    ).resolves.toEqual(expect.objectContaining({ variantKey: 'DATA_QUALITY' }));

    const [url, config] = runtime.get.mock.calls[0]!;
    const requestUrl = new URL(url, 'https://dwp.invalid');
    expect(requestUrl.pathname).toBe(HRM012_QUERY_CONTRACT.browserPath);
    expect(requestUrl.searchParams.getAll('sort')).toEqual([
      'commandReceipt:DESC',
      'itemPublicId:ASC',
    ]);
    expect(requestUrl.searchParams.get('filter[ingestionStatus][codes]')).toBe('APPLIED');
    expect(requestUrl.searchParams.get('filter[qualityFinding][evidenceDigest]')).toBe(
      HRM012_TEST_DIGEST
    );
    expect(requestUrl.searchParams.get('filter[commandReceipt][states]')).toBe('SUCCEEDED');
    for (const forbidden of ['tenantId', 'actorPublicId', 'contextScopeKey', 'decisionRevision']) {
      expect(requestUrl.searchParams.get(forbidden)).toBeNull();
    }
    expect(config).toEqual({
      contextScopeKey: HRM012_TEST_SCOPE.contextScopeKey,
      signal: expect.any(AbortSignal),
    });
  });

  it('emits the canonical empty-filter query and fails before I/O without trusted scope', async () => {
    const request = createHrm012QueryRequest(HRM012_TEST_SCOPE);
    expect(new URLSearchParams(hrm012QueryString(request)).get('filter')).toBe('{}');

    await expect(queryHrm012Entry(request, ' ', new AbortController().signal)).rejects.toThrow(
      'trusted request scope is unavailable'
    );
    expect(runtime.get).not.toHaveBeenCalled();
  });
});
