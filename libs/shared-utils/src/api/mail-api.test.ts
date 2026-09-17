import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  approveMailPurge,
  createMailDeliveryAuditExport,
  executeMailPurge,
  getMailAdminOperations,
  getMailDeliveryAudit,
  previewMailPurge,
  removeMailSharedInboxMember,
  runMailConnectionDiagnostic,
} from './mail-admin-completion-api';
import {
  applyMailLifecycle,
  cancelMailProposalHandoff,
  createMailDraft,
  createMailFolder,
  createMailRule,
  getMailHome,
  getMailProposalHandoff,
  getMailProposals,
  getMailRuleBackfillPreview,
  getMailThreads,
  previewMailLifecycle,
  reorderMailRules,
  replyToMailThread,
  runMailRuleBackfill,
  saveMailDraft,
  updateMailConnection,
  updateMailPolicy,
  updateMailProposal,
  updateMailSharedInbox,
} from './mail-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('mail organization API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('queries a custom folder by opaque folder id without putting message data in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailThreads({
      folderId: 'folder/customer-success',
      state: 'OPEN',
      query: 'launch review',
      page: 2,
      pageSize: 30,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/mail/threads?state=OPEN&folderId=folder%2Fcustomer-success&query=launch+review&page=2&pageSize=30',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('creates a personal folder with its account and hierarchy contract intact', async () => {
    const input = {
      accountId: 'account-1',
      parentFolderId: 'folder-1',
      displayName: 'Customer launch',
      color: 'TEAL' as const,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ folderId: 'folder-2', ...input }));
    vi.stubGlobal('fetch', fetchMock);

    await createMailFolder(input);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/mail/organization/folders');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual(input);
  });

  it('preserves typed sender rules and optimistic lifecycle requests', async () => {
    const rule = {
      accountId: 'account-1',
      displayName: 'Partner mail',
      priority: 100,
      matchMode: 'ALL' as const,
      conditions: [
        { field: 'SENDER' as const, operator: 'ENDS_WITH' as const, value: '@partner.example' },
      ],
      actions: [{ type: 'MOVE_TO_FOLDER' as const, folderId: 'folder-2' }],
      stopProcessing: true,
      enabled: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ ruleId: 'rule-1', ...rule }))
      .mockResolvedValueOnce(jsonResponse({ thread: null, deleted: false }));
    vi.stubGlobal('fetch', fetchMock);

    await createMailRule(rule);
    await applyMailLifecycle('thread/1', 'MOVE', 7, 'folder-2');

    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(rule);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/platform/v1/mail/threads/thread%2F1/lifecycle');
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
      action: 'MOVE',
      version: 7,
      targetFolderId: 'folder-2',
    });
  });

  it('previews and applies account rule backfill with an opaque idempotent command', async () => {
    const accountId = 'account/personal-1';
    const input = {
      requestId: '4fbe6fef-343c-43eb-a739-17d8ed78b8f4',
      previewFingerprint: 'a'.repeat(64),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          accountId,
          previewFingerprint: input.previewFingerprint,
          enabledRuleCount: 2,
          scannedCount: 6,
          matchedThreadCount: 3,
          plannedApplicationCount: 3,
          truncated: false,
          generatedAt: '2026-08-28T00:00:00Z',
        })
      )
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        jsonResponse({
          executionId: '5eb905b4-7f6a-4ac8-91b0-7728ccdbd768',
          accountId,
          ...input,
          status: 'SUCCEEDED',
          replayed: false,
          scannedCount: 6,
          matchedThreadCount: 3,
          applicationCount: 3,
          changedCount: 3,
          startedAt: '2026-08-28T00:00:00Z',
          completedAt: '2026-08-28T00:00:01Z',
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getMailRuleBackfillPreview(accountId);
    await runMailRuleBackfill(accountId, input);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/mail/organization/accounts/account%2Fpersonal-1/rules/backfill-preview'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/mail/organization/accounts/account%2Fpersonal-1/rules/backfill'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual(input);
  });

  it('uses the additive partial-draft endpoints without weakening the send contract', async () => {
    const createInput = {
      subject: 'Subject-only draft',
      idempotencyKey: '4fbe6fef-343c-43eb-a739-17d8ed78b8f4',
    };
    const saveInput = {
      body: 'Body added later',
      idempotencyKey: '5eb905b4-7f6a-4ac8-91b0-7728ccdbd768',
      version: 3,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ thread: { threadId: 'draft-1', version: 3 } }))
      .mockResolvedValueOnce(jsonResponse({ thread: { threadId: 'draft-1', version: 4 } }));
    vi.stubGlobal('fetch', fetchMock);

    await createMailDraft(createInput);
    await saveMailDraft('draft/1', saveInput);

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/mail/drafts');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(
      createInput
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/platform/v1/mail/drafts/draft%2F1');
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('PUT');
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual(
      saveInput
    );
  });
});

describe('mail collaboration API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps account, shared inbox, and assignment scopes in read URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ accounts: [], focusQueue: [], proposals: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 0, pageSize: 30 }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailHome({ accountId: 'account/1' });
    await getMailThreads({
      accountId: 'account/1',
      sharedInboxId: 'shared/1',
      assignment: 'UNASSIGNED',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/platform/v1/mail/home?accountId=account%2F1');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/mail/threads?accountId=account%2F1&sharedInboxId=shared%2F1&assignment=UNASSIGNED&page=0&pageSize=30'
    );
  });

  it('sends reply-all, lifecycle preview, and versioned rule order contracts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ thread: { threadId: 'thread-1' } }))
      .mockResolvedValueOnce(jsonResponse({ threadId: 'thread-1', allowed: true, blockers: [] }))
      .mockResolvedValueOnce(jsonResponse({ rules: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await replyToMailThread('thread/1', 'Reply', 'request-1', {
      mode: 'REPLY_ALL',
      recipients: [{ type: 'CC', name: 'Partner', email: 'partner@example.com' }],
    });
    await previewMailLifecycle('thread/1', {
      action: 'MOVE',
      targetFolderId: 'folder/1',
      version: 4,
    });
    await reorderMailRules({ rules: [{ ruleId: 'rule/1', version: 7 }] });

    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      body: 'Reply',
      idempotencyKey: 'request-1',
      mode: 'REPLY_ALL',
      recipients: [{ type: 'CC', name: 'Partner', email: 'partner@example.com' }],
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/mail/threads/thread%2F1/lifecycle/preview'
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/platform/v1/mail/organization/rules/order');
  });

  it('filters and updates governed proposals without putting payload data in the URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ proposalId: 'proposal-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailProposals({ status: 'PROPOSED', type: 'CREATE_TASK' });
    await updateMailProposal('proposal/1', {
      proposedPayload: { title: 'Review launch', requiresConfirmation: true },
      version: 3,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/mail/proposals?status=PROPOSED&type=CREATE_TASK'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/platform/v1/mail/proposals/proposal%2F1');
  });

  it('reads an owner handoff and sends only an actor-bound versioned cancellation', async () => {
    const accepted = {
      proposalId: 'proposal/1',
      commandId: 'command-1',
      ownerRoute: '/work?action=create',
      returnTo: null,
      focus: 'task-editor',
      status: 'ACCEPTED',
      resultRef: null,
      updatedAt: '2026-09-17T09:00:00Z',
      version: 4,
    };
    const cancellation = {
      commandId: 'command-1',
      version: 4,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(accepted))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        jsonResponse({
          ...accepted,
          status: 'CANCELLED',
          resultRef: 'cancelled-by-actor',
          version: 5,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getMailProposalHandoff('proposal/1');
    await cancelMailProposalHandoff('proposal/1', cancellation);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/mail/proposals/proposal%2F1/handoff'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/mail/proposals/proposal%2F1/handoff/cancel'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual(
      cancellation
    );
  });
});

describe('mail administration API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps operations and delivery audit filters on dedicated administrative reads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sources: [], exceptions: [], commands: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 0, pageSize: 50 }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailAdminOperations();
    await getMailDeliveryAudit({ page: 0, pageSize: 50, correlationId: 'corr/42' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/platform/v1/admin/mail/operations');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/mail/delivery-audit?page=0&pageSize=50&correlationId=corr%2F42'
    );
  });

  it('sends a UUID Idempotency-Key on policy, connection, and shared-inbox updates', async () => {
    const keys = [
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValue(jsonResponse({ version: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    await updateMailPolicy(
      {
        externalSenderBanner: true,
        blockRemoteImages: true,
        allowSharedInboxes: true,
        aiAssistanceEnabled: false,
        aiCrossAppActionsEnabled: false,
        retentionDays: 365,
        maximumAttachmentMb: 25,
        version: 1,
      },
      { idempotencyKey: keys[0]! }
    );
    await updateMailConnection(
      'connection/1',
      {
        displayName: 'Primary mail',
        mailDomain: 'example.com',
        credentialRef: null,
        state: 'SUSPENDED',
        version: 1,
      },
      { idempotencyKey: keys[1]! }
    );
    await updateMailSharedInbox(
      'shared/1',
      {
        displayName: 'Support',
        purpose: 'Customer support',
        serviceTargetMinutes: 240,
        lifecycleState: 'ACTIVE',
        version: 1,
      },
      { idempotencyKey: keys[2]! }
    );

    expect(
      fetchMock.mock.calls
        .slice(1)
        .map(([, init]) => new Headers(init?.headers).get('Idempotency-Key'))
    ).toEqual(keys);
  });

  it('sends connection diagnostics as an idempotent versioned command', async () => {
    const input = {
      capability: 'SYNC' as const,
      idempotencyKey: '4fbe6fef-343c-43eb-a739-17d8ed78b8f4',
      version: 8,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ operationId: 'operation-1', state: 'ACCEPTED' }));
    vi.stubGlobal('fetch', fetchMock);

    await runMailConnectionDiagnostic('connection/1', input);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/mail/connections/connection%2F1/diagnostics'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(input);
  });

  it('revokes shared access with an explicit impact acknowledgement in the request body', async () => {
    const input = {
      impactAcknowledged: true,
      idempotencyKey: '5eb905b4-7f6a-4ac8-91b0-7728ccdbd768',
      version: 3,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ sharedInboxId: 'inbox-1', members: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await removeMailSharedInboxMember('inbox/1', 'member/2', input);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/mail/shared-inboxes/inbox%2F1/members/member%2F2/revoke'
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(input);
  });

  it('preserves the candidate fingerprint and policy version through purge approval and execution', async () => {
    const previewInput = {
      scope: { tenant: true },
      resourceTypes: ['MESSAGE'],
      before: '2026-09-16T06:00:00.000Z',
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      policyVersion: 9,
    };
    const approvalInput = {
      decision: 'APPROVE' as const,
      idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      policyVersion: 9,
    };
    const executionInput = {
      idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      policyVersion: 9,
      fingerprint: 'd'.repeat(64),
    };
    const exportInput = {
      filters: { state: 'UNKNOWN' },
      purpose: 'Incident review',
      idempotencyKey: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ candidateSnapshotId: 'candidate-1' }))
      .mockResolvedValueOnce(jsonResponse({ distinctApproverCount: 2 }))
      .mockResolvedValueOnce(jsonResponse({ jobId: 'job-1', state: 'ACCEPTED' }))
      .mockResolvedValueOnce(jsonResponse({ exportId: 'export-1', state: 'ACCEPTED' }));
    vi.stubGlobal('fetch', fetchMock);

    await previewMailPurge(previewInput);
    await approveMailPurge('candidate/1', approvalInput);
    await executeMailPurge('candidate/1', executionInput);
    await createMailDeliveryAuditExport(exportInput);

    expect(fetchMock.mock.calls.slice(1).map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/mail/retention/purge-previews',
      '/api/platform/v1/admin/mail/retention/purges/candidate%2F1/approvals',
      '/api/platform/v1/admin/mail/retention/purges/candidate%2F1/execute',
      '/api/platform/v1/admin/mail/delivery-audit/exports',
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body))).toEqual(
      executionInput
    );
  });
});
