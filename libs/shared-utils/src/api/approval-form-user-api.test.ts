import { afterEach, describe, expect, it, vi } from 'vitest';

import { searchApprovalFormUserCandidates } from './approval-form-user-api';

const binding = {
  formId: '00000000-0000-0000-0000-000000000001',
  formVersionId: '00000000-0000-0000-0000-000000000002',
  schemaSha256: 'a'.repeat(64),
  fieldKey: 'reviewer',
  surface: 'WORK',
} as const;
const candidate = { personPublicId: '00000000-0000-0000-0000-000000000003', displayName: '김서연' };
function result(overrides: Record<string, unknown> = {}) {
  return {
    formVersionId: binding.formVersionId,
    schemaSha256: binding.schemaSha256,
    fieldPath: 'reviewer',
    decisionRevision: 'decision-current',
    validUntil: new Date(Date.now() + 30000).toISOString(),
    people: [candidate],
    mayBeTruncated: false,
    requestId: null,
    requestVersion: null,
    ...overrides,
  };
}
function response(data: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify({ data }) } as Response;
}

describe('approval form user source API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['WORK', 'ADMIN'] as const)(
    'uses the fixed %s source and exact field binding',
    async (surface) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(response(result({ fieldPath: 'members.reviewer' })));
      vi.stubGlobal('fetch', fetchMock);
      const data = await searchApprovalFormUserCandidates(
        { ...binding, surface, groupKey: 'members' },
        '김 & 서연',
        10,
        'opaque-scope'
      );
      const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
      expect(url.pathname).toBe(
        `/api/approvals/v1/${surface === 'WORK' ? 'catalog' : 'admin'}/forms/${binding.formId}/versions/${binding.formVersionId}/field-candidates`
      );
      expect(url.searchParams.get('query')).toBe('김 & 서연');
      expect(url.searchParams.get('contextScopeKey')).toBe('opaque-scope');
      expect(data.people).toEqual([candidate]);
      expect(Object.isFrozen(data.people)).toBe(true);
    }
  );

  it.each([
    { formId: '../people' },
    { formVersionId: '2' },
    { schemaSha256: 'bad' },
    { fieldKey: 'reviewer/../scope' },
    { groupKey: 'members[0]' },
    { requestId: 'bad' },
    { surface: 'ADMIN' as const, requestId: '00000000-0000-0000-0000-000000000010' },
  ])('rejects malformed source identity before HTTP: %j', async (change) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      searchApprovalFormUserCandidates({ ...binding, ...change }, '김서연')
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { formVersionId: '00000000-0000-0000-0000-000000000099' },
    { schemaSha256: 'b'.repeat(64) },
    { fieldPath: 'different' },
    { validUntil: 'invalid' },
    { validUntil: '2000-01-01T00:00:00Z' },
    { people: [candidate, candidate] },
    { people: [{ ...candidate, email: 'private@example.com' }] },
    { people: [{ ...candidate, personPublicId: '123' }] },
    { mayBeTruncated: true },
    { requestId: '00000000-0000-0000-0000-000000000010', requestVersion: 0 },
    { requestVersion: 0 },
  ])('rejects stale or overbroad successful projections: %j', async (change) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(result(change))));
    await expect(searchApprovalFormUserCandidates(binding, '김서연')).rejects.toThrow();
  });

  it('binds an existing request to its server-verified immutable form and version zero', async () => {
    const requestId = '00000000-0000-0000-0000-000000000010';
    const fetchMock = vi.fn().mockResolvedValue(response(result({ requestId, requestVersion: 0 })));
    vi.stubGlobal('fetch', fetchMock);
    const data = await searchApprovalFormUserCandidates({ ...binding, requestId }, '김서연');
    expect(
      new URL(fetchMock.mock.calls[0][0], 'http://localhost').searchParams.get('requestId')
    ).toBe(requestId);
    expect(data.requestVersion).toBe(0);
    fetchMock.mockResolvedValue(response(result({ requestId, requestVersion: -1 })));
    await expect(
      searchApprovalFormUserCandidates({ ...binding, requestId }, '김서연')
    ).rejects.toThrow();
  });
});
