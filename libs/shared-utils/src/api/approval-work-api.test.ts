import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  decideApprovalTask,
  respondToApprovalInformationRequest,
  submitApprovalRequest,
} from './approval-api';
import { searchApprovalRequests, searchApprovalTasks } from './approval-search-api';
import {
  deleteApprovalDraft,
  getApprovalDraftReconciliation,
  getApprovalDraftRevision,
  getApprovalDraftRevisions,
  recoverApprovalDraft,
  restoreApprovalDraft,
} from './approval-draft-api';

function response(data: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify({ data }) } as Response;
}

describe('approval work API boundary', () => {
  it('rejects an invalid quorum command before CSRF or decision transport', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      decideApprovalTask(
        'request-1',
        {
          decision: 'APPROVE',
          expectedVersion: 3,
          quorum: {
            expectedRequestVersion: 8,
            generation: 0,
            expectedStageVersion: 1,
            payloadRevision: 1,
            payloadSha256: 'a'.repeat(64),
            pins: {
              workflowVersionId: '22222222-2222-4222-8222-222222222222',
              workflowVersion: 1,
              workflowDefinitionSha256: 'b'.repeat(64),
              formSchemaSha256: 'c'.repeat(64),
              policyVersion: 1,
              policySha256: 'd'.repeat(64),
            },
          },
        },
        { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }
      )
    ).rejects.toThrow('quorum');
    expect(fetch).not.toHaveBeenCalled();
  });
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it.each(['000', '100'] as const)(
    'preserves original submit and amendment command keys in rollout %s',
    async (rolloutState) => {
      const fetchMock = vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            response(
              url.includes('/csrf')
                ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' }
                : { requestId: 'request-1' }
            )
          )
        );
      vi.stubGlobal('fetch', fetchMock);
      const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState } as const;
      await submitApprovalRequest('request-1', 7, execution, { idempotencyKey: 'submit:original' });
      await respondToApprovalInformationRequest(
        'request-1',
        'Updated',
        { summary: 'Updated' },
        8,
        execution,
        { idempotencyKey: 'amend:original' }
      );
      const commands = fetchMock.mock.calls.filter(([, init]) => init.method === 'POST');
      expect(commands).toHaveLength(2);
      expect(commands.map(([, init]) => init.headers['Idempotency-Key'])).toEqual([
        'submit:original',
        'amend:original',
      ]);
      expect(commands.map(([, init]) => JSON.parse(init.body).expectedVersion)).toEqual([7, 8]);
    }
  );

  it('rejects malformed or borrowed request command keys before transport', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const execution = {
      mode: 'SECURE',
      rolloutState: '110',
      expectedDecisionRevision: 'rev-1',
      contextKey: 'ctx',
      contextScopeKey: 'scope',
      idempotencyKey: 'governed-key',
    } as const;
    await expect(
      submitApprovalRequest('request-1', 7, execution, { idempotencyKey: 'borrowed-key' })
    ).rejects.toThrow('command identity');
    await expect(
      respondToApprovalInformationRequest('request-1', 'Updated', {}, 8, execution, {
        idempotencyKey: 'bad key',
      })
    ).rejects.toThrow('command identity');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends whole-result filters and opaque scope without query injection', async () => {
    const page = {
      items: [],
      totalElements: 106,
      totalPages: 5,
      page: 4,
      size: 25,
      hasNext: false,
      evaluatedAt: '2026-09-14T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(response(page));
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    await expect(
      searchApprovalTasks(
        'INBOX',
        { query: 'A&B / 한글', page: 4, size: 25, sort: 'OLDEST', minRiskScore: 70, due: 'TODAY' },
        'scope-opaque',
        signal
      )
    ).resolves.toEqual(page);
    await searchApprovalRequests('DELETED', { status: 'DRAFT', page: 2 }, 'scope-opaque', signal);
    const first = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(first.pathname).toBe('/api/approvals/v1/tasks/search');
    expect(Object.fromEntries(first.searchParams)).toEqual({
      view: 'INBOX',
      query: 'A&B / 한글',
      page: '4',
      size: '25',
      sort: 'OLDEST',
      minRiskScore: '70',
      due: 'TODAY',
      contextScopeKey: 'scope-opaque',
    });
    const second = new URL(fetchMock.mock.calls[1][0], 'http://localhost');
    expect(second.searchParams.get('view')).toBe('DELETED');
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('binds receipt, history and revision reads to the current scope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ receipts: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await getApprovalDraftReconciliation('command:1', 'scope-current');
    await getApprovalDraftRevisions('request-1', { page: 2, size: 10 }, 'scope-current');
    await getApprovalDraftRevision('request-1', 7, 'scope-current');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/approvals/v1/draft-commands/command%3A1?contextScopeKey=scope-current',
      '/api/approvals/v1/requests/request-1/draft/revisions?page=2&size=10&contextScopeKey=scope-current',
      '/api/approvals/v1/requests/request-1/draft/revisions/7?contextScopeKey=scope-current',
    ]);
  });

  it.each(['000', '100'] as const)(
    'preserves identity and version for draft lifecycle in %s',
    async (rolloutState) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
        .mockResolvedValue(response({ requestId: 'request-1', version: 8 }));
      vi.stubGlobal('fetch', fetchMock);
      const input = {
        expectedVersion: 7,
        idempotencyKey: 'draft:command-1',
        reason: 'Requested by author',
      };
      const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState } as const;
      await deleteApprovalDraft('request-1', input, execution);
      await restoreApprovalDraft('request-1', input, execution);
      await recoverApprovalDraft('request-1', { ...input, revision: 3 }, execution);
      const commands = fetchMock.mock.calls.filter(([, init]) => init.method === 'POST');
      expect(commands.map(([url]) => url)).toEqual(
        ['delete', 'restore', 'recover'].map(
          (action) => `/api/approvals/v1/requests/request-1/draft/${action}`
        )
      );
      for (const [, init] of commands) {
        expect(init.headers['Idempotency-Key']).toBe(input.idempotencyKey);
        expect(JSON.parse(init.body)).toMatchObject(input);
      }
    }
  );

  it('rejects a malformed draft command before reading CSRF or issuing a mutation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      deleteApprovalDraft(
        'request-1',
        { expectedVersion: 1, idempotencyKey: 'invalid key', reason: 'Delete' },
        { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }
      )
    ).rejects.toThrow('Invalid approval draft command identity');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
