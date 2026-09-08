import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getWorkspaceActivityAuditEvidence,
  getWorkspaceActivityEventEvidence,
  getWorkspaceActivitySourceStatuses,
} from './workspace-activity-evidence-api';

const evidence = {
  eventId: 'aaaaaaaa-0000-5000-8000-000000000101',
  auditRecordId: 'aaaaaaaa-0000-5000-8000-000000000102',
  linkStatus: 'LINKED',
  auditAccess: 'AVAILABLE',
  recordHash: 'a'.repeat(64),
  hashAlgorithm: 'SHA-256',
  integrityStatus: 'VERIFIED',
  integrityScope: 'DAILY_CHECKPOINT_REPORTED',
  verifiedAt: '2026-09-07T09:00:00Z',
  observedAt: '2026-09-07T09:01:00Z',
};

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, data }),
    headers: new Headers(),
  } as Response;
}

describe('Workspace activity evidence API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads event evidence and audit evidence from separate authorized routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(evidence))
      .mockResolvedValueOnce(response(evidence));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getWorkspaceActivityEventEvidence(evidence.eventId)).resolves.toEqual(evidence);
    await expect(
      getWorkspaceActivityAuditEvidence(evidence.auditRecordId, evidence.eventId)
    ).resolves.toEqual(evidence);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/platform/v1/workspace/activity/events/${evidence.eventId}/evidence`
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/platform/v1/workspace/activity/audit/evidence/${evidence.auditRecordId}`
    );
  });

  it('rejects an audit receipt bound to a different owned Agent run', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(evidence)));

    await expect(
      getWorkspaceActivityAuditEvidence(
        evidence.auditRecordId,
        'aaaaaaaa-0000-5000-8000-000000000999'
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('accepts canonical PostgreSQL UUID text without assuming RFC version or variant bits', async () => {
    const postgresEvidence = {
      ...evidence,
      eventId: 'aaaaaaaa-0000-0000-0000-000000000101',
      auditRecordId: 'aaaaaaaa-0000-f000-0000-000000000102',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(postgresEvidence)));

    await expect(getWorkspaceActivityEventEvidence(postgresEvidence.eventId)).resolves.toEqual(
      postgresEvidence
    );
  });

  it('keeps restricted evidence honest and rejects invented or malformed verification', async () => {
    const restricted = {
      ...evidence,
      auditAccess: 'RESTRICTED',
      recordHash: null,
      hashAlgorithm: null,
      integrityStatus: 'UNAVAILABLE',
      verifiedAt: null,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(restricted)));
    await expect(getWorkspaceActivityEventEvidence(evidence.eventId)).resolves.toEqual(restricted);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(response({ ...evidence, recordHash: 'fabricated' }))
    );
    await expect(getWorkspaceActivityEventEvidence(evidence.eventId)).rejects.toMatchObject({
      status: 502,
    });
  });

  it.each([
    {
      label: 'restricted receipt promoted to verified',
      value: { ...evidence, auditAccess: 'RESTRICTED' },
    },
    {
      label: 'restricted receipt exposing verification time',
      value: {
        ...evidence,
        auditAccess: 'RESTRICTED',
        recordHash: null,
        hashAlgorithm: null,
        integrityStatus: 'UNAVAILABLE',
      },
    },
    {
      label: 'unlinked receipt retaining an audit identifier',
      value: { ...evidence, linkStatus: 'NOT_LINKED' },
    },
    {
      label: 'linked receipt without an audit identifier',
      value: { ...evidence, auditRecordId: null },
    },
    {
      label: 'hash without its algorithm',
      value: { ...evidence, hashAlgorithm: null },
    },
    {
      label: 'verified receipt without a checkpoint time',
      value: { ...evidence, verifiedAt: null },
    },
    {
      label: 'available linked receipt downgraded to unavailable',
      value: {
        ...evidence,
        recordHash: null,
        hashAlgorithm: null,
        integrityStatus: 'UNAVAILABLE',
        verifiedAt: null,
      },
    },
  ])('rejects a semantically inconsistent $label', async ({ value }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(value)));

    await expect(getWorkspaceActivityEventEvidence(evidence.eventId)).rejects.toMatchObject({
      status: 502,
    });
  });

  it('accepts a linked receipt whose checkpoint is still pending', async () => {
    const pending = {
      ...evidence,
      integrityStatus: 'PENDING',
      verifiedAt: null,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(pending)));

    await expect(getWorkspaceActivityEventEvidence(evidence.eventId)).resolves.toEqual(pending);
  });

  it('accepts a linked unavailable checkpoint without promoting it to verified', async () => {
    const unavailable = { ...evidence, integrityStatus: 'UNAVAILABLE' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(unavailable)));

    await expect(getWorkspaceActivityEventEvidence(evidence.eventId)).resolves.toEqual(unavailable);
  });

  it('loads actual personal sync states and treats an empty list as an explicit empty scope', async () => {
    const report = {
      observedAt: '2026-09-07T09:01:00Z',
      sources: [
        {
          sourceId: 'mail-primary',
          label: 'Mail',
          resourceKind: 'MAIL',
          status: 'STALE',
          lastAttemptAt: '2026-09-07T08:59:00Z',
          lastSuccessAt: '2026-09-07T08:30:00Z',
          observedAt: '2026-09-07T09:01:00Z',
          semantics: 'PERSONAL_SYNC_LEDGER',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(report)));
    await expect(getWorkspaceActivitySourceStatuses()).resolves.toEqual(report);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ ...report, sources: [] })));
    await expect(getWorkspaceActivitySourceStatuses()).resolves.toEqual({
      ...report,
      sources: [],
    });
  });
});
