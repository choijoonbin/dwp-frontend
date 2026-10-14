import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getHcmAuditEvidence,
  listHcmAuditEvidence,
  parseHcmAuditEvidence,
  parseHcmAuditEvidencePage,
} from './hcm-audit-evidence-api';

const EVENT_ID = '10000000-0000-4000-8000-000000000001';
const OCCURRED_AT = '2026-10-14T04:20:00Z';

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    occurredAt: OCCURRED_AT,
    category: 'ADMIN_CHANGE',
    action: 'WORKER.UPDATED',
    outcome: 'SUCCESS',
    severity: 'INFO',
    actorType: 'USER',
    sourceService: 'people',
    sourceModule: 'hris.people.worker',
    aggregateType: 'WORKER',
    aggregateRevision: 7,
    effectiveCapability: 'HCM.WORKER.UPDATE',
    purposeCode: 'HR_OPERATIONS',
    authorizationDecisionRef: 'decision:42',
    scopeRevision: 3,
    fieldPolicyRevision: 5,
    approvalReceiptId: null,
    reasonCode: null,
    beforeDigest: 'a'.repeat(64),
    afterDigest: 'b'.repeat(64),
    evidenceDigest: 'c'.repeat(64),
    classification: 'CONFIDENTIAL',
    retentionClass: 'EXTENDED',
    causationId: '20000000-0000-4000-8000-000000000002',
    correlationId: '30000000-0000-4000-8000-000000000003',
    recordHash: 'd'.repeat(64),
    ...overrides,
  };
}

function page(overrides: Record<string, unknown> = {}) {
  return {
    items: [evidence()],
    size: 1,
    snapshotAt: '2026-10-14T04:21:00Z',
    nextCursor: 'signed.cursor_value-1',
    ...overrides,
  };
}

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('HCM audit evidence client', () => {
  it('sends one fixed case-sensitive product selector and only allowlisted filters', async () => {
    const fetch = vi.fn().mockResolvedValue(response(page()));
    vi.stubGlobal('fetch', fetch);

    await expect(
      listHcmAuditEvidence({
        window: 'D7',
        category: 'ADMIN_CHANGE',
        severity: 'INFO',
        outcome: 'SUCCESS',
        sourceService: 'people',
        query: 'WORKER',
        size: 25,
      })
    ).resolves.toEqual(page());

    const url = new URL(String(fetch.mock.calls[0]?.[0]), 'https://dwp.invalid');
    expect(url.pathname).toBe('/api/platform/v1/admin/audit-control/events');
    expect(url.searchParams.getAll('product')).toEqual(['HCM']);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      product: 'HCM',
      window: 'D7',
      category: 'ADMIN_CHANGE',
      severity: 'INFO',
      outcome: 'SUCCESS',
      sourceService: 'people',
      query: 'WORKER',
      size: '25',
    });
  });

  it('accepts the canonical CRITICAL severity without opening unsupported severities', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(response(page({ items: [evidence({ severity: 'CRITICAL' })] })));
    vi.stubGlobal('fetch', fetch);

    await expect(listHcmAuditEvidence({ severity: 'CRITICAL' })).resolves.toMatchObject({
      items: [{ severity: 'CRITICAL' }],
    });

    const url = new URL(String(fetch.mock.calls[0]?.[0]), 'https://dwp.invalid');
    expect(url.searchParams.get('severity')).toBe('CRITICAL');
    expect(() => parseHcmAuditEvidence(evidence({ severity: 'LOW' }))).toThrow('severity');
    expect(() => parseHcmAuditEvidence(evidence({ severity: 'MEDIUM' }))).toThrow('severity');
    await expect(
      listHcmAuditEvidence({ severity: 'LOW' } as Parameters<typeof listHcmAuditEvidence>[0])
    ).rejects.toThrow('filters.severity');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('uses the same fixed HCM selector for UUID detail and accepts no query input', async () => {
    const fetch = vi.fn().mockResolvedValue(response(evidence()));
    vi.stubGlobal('fetch', fetch);

    await expect(getHcmAuditEvidence(EVENT_ID)).resolves.toEqual(evidence());

    const url = new URL(String(fetch.mock.calls[0]?.[0]), 'https://dwp.invalid');
    expect(url.pathname).toBe(`/api/platform/v1/admin/audit-control/events/${EVENT_ID}`);
    expect([...url.searchParams.entries()]).toEqual([['product', 'HCM']]);
  });

  it('rejects a mismatched detail identity instead of rendering unrelated evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(response(evidence({ eventId: '40000000-0000-4000-8000-000000000004' })))
    );

    await expect(getHcmAuditEvidence(EVENT_ID)).rejects.toThrow(
      'does not match the requested evidence'
    );
  });

  it('rejects unknown response fields instead of silently redacting them', () => {
    expect(() => parseHcmAuditEvidence(evidence({ actorId: 'must-not-cross-boundary' }))).toThrow(
      'unknown field actorId'
    );
    expect(() => parseHcmAuditEvidencePage(page({ totalElements: 1 }))).toThrow(
      'unknown field totalElements'
    );
  });

  it('rejects omitted fields, invalid evidence shape, and noncanonical HRIS modules', () => {
    const missing = evidence();
    delete (missing as Partial<typeof missing>).recordHash;
    expect(() => parseHcmAuditEvidence(missing)).toThrow('missing field recordHash');
    expect(() => parseHcmAuditEvidence(evidence({ sourceModule: 'platform.audit' }))).toThrow(
      'sourceModule'
    );
    expect(() =>
      parseHcmAuditEvidence(evidence({ outcome: 'DENIED', category: 'POLICY_DENIED' }))
    ).toThrow('required for denied or failed evidence');
  });

  it('rejects client-supplied authority, tenant, offset, and malformed detail before dispatch', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(
      listHcmAuditEvidence({ tenantId: 9 } as Parameters<typeof listHcmAuditEvidence>[0])
    ).rejects.toThrow('filters.tenantId');
    await expect(
      listHcmAuditEvidence({ page: 2 } as Parameters<typeof listHcmAuditEvidence>[0])
    ).rejects.toThrow('filters.page');
    await expect(getHcmAuditEvidence('not-a-uuid')).rejects.toThrow('eventId');
    expect(fetch).not.toHaveBeenCalled();
  });
});
