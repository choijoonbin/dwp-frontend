import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get, post: runtime.post },
}));

import {
  HCM_WORKFORCE_INGESTION_MUTATION_API_CONTRACT,
  HRM012_API_CONTRACTS,
  hrm012QueryString,
  queryHrm012Entry,
  startWorkforceIngestion,
} from '../data-quality-api';
import { HRM012_QUERY_CONTRACT, createHrm012QueryRequest } from '../data-quality-contract';
import {
  HRM012_TEST_AS_OF,
  HRM012_TEST_CURSOR,
  HRM012_TEST_DIGEST,
  HRM012_TEST_SCOPE,
  hrm012ProjectionWire,
} from './data-quality-fixtures.test-support';

describe('HRM-012 IAQ-012 API adapter', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.post.mockReset();
  });

  it('keeps the query adapter contract separate from the governed command boundary', () => {
    expect(HRM012_API_CONTRACTS).toEqual([
      {
        bindingId: 'IAQ-012',
        operationId: 'IAQ.OP.012',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/operations/data/quality',
        ownerPath: '/v1/hris/workbench/operations/data/quality',
      },
    ]);
    expect(HCM_WORKFORCE_INGESTION_MUTATION_API_CONTRACT).toEqual({
      apiFunction: 'startWorkforceIngestion',
      routeContractKey: 'route.hcm.operations.workforce-ingestion.action',
      method: 'POST',
      path: '/api/people/v1/hris/integrations/workforce-ingestions',
    });
  });

  it('posts a sealed COMMAND_HEADER HIGH workforce-ingestion command', async () => {
    const correlationId = '10000000-0000-4000-8000-000000000001';
    const receiptId = '20000000-0000-4000-8000-000000000002';
    const subjectId = '30000000-0000-4000-8000-000000000003';
    const idempotencyKey = 'workforce-ingestion-command-0001';
    const command = {
      objectRef: 'obj_workforce_ingestion_0001',
      objectDigest: HRM012_TEST_DIGEST,
      schemaKey: 'dwp.hris.workforce.ingestion.v1',
      schemaVersion: 1,
      mode: 'APPLY' as const,
      effectiveDate: '2026-10-29',
    };
    const receipt = {
      receiptId,
      commandType: 'WORKFORCE_INGESTION',
      status: 'RECEIVED',
      requestHash: HRM012_TEST_DIGEST,
      correlationId,
      receivedAt: '2026-10-29T00:00:00Z',
      originatingAction: 'INITIATE_WORKFORCE_INGESTION',
      subjectPrincipalPublicId: subjectId,
      populationScopeDigest: HRM012_TEST_DIGEST,
      fieldPolicyRevision: 2,
      purposeCode: 'HRIS_INTEGRATION',
      authorizationRevision: 3,
      links: { self: `/api/people/v1/hris/command-receipts/${receiptId}` },
    } as const;
    const authority = {
      idempotencyKey,
      correlationId,
      expectedObjectVersion: 4,
      governance: {
        mode: 'SECURE' as const,
        rolloutState: '111' as const,
        expectedDecisionRevision: 'decision:workforce-ingestion:4',
        contextKey: 'context:workforce-ingestion:4',
        contextScopeKey: HRM012_TEST_SCOPE.contextScopeKey,
        idempotencyKey,
        objectVersion: 4,
        stepUp: {
          challenge: 'signed-workforce-ingestion-proof',
          challengeId: 'challenge:workforce-ingestion:4',
          decisionRevision: 'decision:workforce-ingestion:4',
          expiresAt: '2099-10-29T00:00:00Z',
        },
      },
    };
    runtime.post.mockResolvedValue({ data: receipt });

    await expect(startWorkforceIngestion(command, authority)).resolves.toEqual(receipt);

    expect(runtime.post).toHaveBeenCalledWith(
      HCM_WORKFORCE_INGESTION_MUTATION_API_CONTRACT.path,
      command,
      expect.objectContaining({
        contextScopeKey: HRM012_TEST_SCOPE.contextScopeKey,
        csrfReplay: 'NEVER',
        headers: expect.objectContaining({
          'Idempotency-Key': idempotencyKey,
          'If-Match': '"4"',
          'X-Correlation-ID': correlationId,
          'X-Purpose-Code': 'HRIS_INTEGRATION',
          'X-DWP-Expected-Decision-Revision': 'decision:workforce-ingestion:4',
          'X-DWP-Step-Up-Challenge': 'signed-workforce-ingestion-proof',
          'X-DWP-Expected-Object-Version': '4',
        }),
      })
    );

    await expect(
      startWorkforceIngestion(command, { ...authority, expectedObjectVersion: 5 })
    ).rejects.toThrow('HIGH-risk authority does not match');
    expect(runtime.post).toHaveBeenCalledOnce();
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
