import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  deleteDwaionConversation,
  getDwaionConversation,
  getDwaionConversations,
  previewWorkplaceAction,
  renameDwaionConversation,
} from './agent-conversation-api';
import type { AgentActionHandoffOrigin } from './agent-plan-api';

const origin: AgentActionHandoffOrigin = {
  appKey: 'APP.ASK',
  route: '/dwaion/conversations/00000000-0000-4000-8000-000000000001',
  surface: 'action-shelf',
  sourceRunId: '00000000-0000-4000-8000-000000000002',
  sourceRequestId: 'request-source-1',
  sourceCorrelationId: 'correlation-source-1',
  conversationId: '00000000-0000-4000-8000-000000000001',
};

const secureAuthority = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'psr-current',
  contextKey: 'psc-dwaion',
  contextScopeKey: 'scope-dwaion-self',
} as const;

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function preview() {
  return {
    action: {
      actionKey: 'MAIL.DRAFT.CREATE',
      title: 'Draft mail',
      description: 'Prepare a mail draft.',
      mode: 'REDIRECT',
      riskTier: 'L2',
      requiredPermission: 'APP.MAIL:CREATE',
      targetRoute: '/mail/inbox?compose=open',
      confirmationRequired: true,
      inputFields: ['subject'],
    },
    reviewedInputs: { subject: 'Weekly review' },
    plan: {
      runId: 'run-ref-1',
      auditId: 'AUD-REF-1',
      planHash: 'a'.repeat(64),
      correlationId: 'correlation-preview-1',
      state: 'REVIEW',
      riskTier: 'L2',
      approvalRequired: true,
      mutationAllowed: false,
      summary: 'Preview',
      steps: [
        {
          id: 'human-gate',
          title: 'Wait for approval',
          tool: 'workflow.human-approval',
          description: 'No mutation before approval.',
        },
      ],
      sourceReferences: ['src-01'],
      referenceMode: true,
      agentRegistry: {
        entryKey: 'REFERENCE_PLANNER',
        revision: 1,
        artifactVersion: 'reference-v1',
        riskTier: 'MEDIUM',
        resolution: 'ACTIVE',
      },
      handoffOrigin: origin,
    },
  };
}

describe('Agent workplace action API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('sends the conversation agent through the supported GET query contract', async () => {
    const data = conversation('DWP_APPROVAL_EXPERT');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      getDwaionConversation('saved-conversation', 'DWP_APPROVAL_EXPERT')
    ).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent/v1/conversations/saved-conversation?agentKey=DWP_APPROVAL_EXPERT',
      expect.anything()
    );
  });

  it('accepts persisted summary evidence and retention metadata', async () => {
    const data = [conversation('DWP_APPROVAL_EXPERT').summary];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    await expect(getDwaionConversations()).resolves.toEqual(data);
  });

  it('binds rename and delete to the evaluated DWAI scope and decision revision', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: conversation('DWP_ASSISTANT') }))
      .mockResolvedValueOnce(jsonResponse(204, undefined));
    vi.stubGlobal('fetch', fetchMock);

    await renameDwaionConversation('saved-conversation', 'Review', secureAuthority);
    await deleteDwaionConversation('saved-conversation', secureAuthority);

    for (const call of [fetchMock.mock.calls[1], fetchMock.mock.calls[2]]) {
      expect(call?.[0]).toContain('contextScopeKey=scope-dwaion-self');
      expect(call?.[1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-DWP-Expected-Decision-Revision': 'psr-current',
          }),
        })
      );
    }
  });

  it.each([
    ['agent key', { agentKey: undefined }],
    ['source systems', { sourceSystems: ['DWP Work', 17] }],
    ['evidence count', { evidenceCount: -1 }],
    ['summary excerpt', { summaryExcerpt: false }],
    ['last answer status', { lastAnswerStatus: 17 }],
    ['retention deadline', { retentionUntil: false }],
    ['legal hold', { legalHold: 'false' }],
  ])('rejects a conversation summary with invalid %s metadata', async (_label, patch) => {
    const data = [{ ...conversation('DWP_ASSISTANT').summary, ...patch }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    await expect(getDwaionConversations()).rejects.toMatchObject({ status: 502 });
  });

  it('rejects an otherwise valid response from a different conversation agent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { data: conversation('DWP_ASSISTANT') }))
    );
    await expect(
      getDwaionConversation('saved-conversation', 'DWP_APPROVAL_EXPERT')
    ).rejects.toMatchObject({ status: 409 });
  });

  it('accepts only one stable selected-work binding for the persisted conversation', async () => {
    const data = selectedConversation();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    await expect(
      getDwaionConversation('saved-conversation', 'DWP_APPROVAL_EXPERT')
    ).resolves.toEqual(data);
  });

  it.each([
    ['source system', { sourceSystem: 'APPROVAL_REQUEST' as const }],
    [
      'source reference',
      {
        sourceReference: '30000000-0000-4000-8000-000000000003',
      },
    ],
    ['source version', { expectedVersion: 4 }],
    ['obligation', { obligationKey: 'approve' }],
  ])(
    'rejects a persisted conversation that changes its selected-work %s',
    async (_label, patch) => {
      const data = selectedConversation(patch);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

      await expect(
        getDwaionConversation('saved-conversation', 'DWP_APPROVAL_EXPERT')
      ).rejects.toMatchObject({ status: 409 });
    }
  );

  it('rejects a selected-work conversation whose later assistant message drops its binding', async () => {
    const data = selectedConversation();
    (data.messages[1] as { selectedWork: unknown }).selectedWork = null;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    await expect(
      getDwaionConversation('saved-conversation', 'DWP_APPROVAL_EXPERT')
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a selected-work conversation bound to a different expert', async () => {
    const data = selectedConversation();
    data.messages = data.messages.map((message) => ({ ...message, agentKey: 'DWP_ASSISTANT' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    await expect(
      getDwaionConversation('saved-conversation', 'DWP_ASSISTANT')
    ).rejects.toMatchObject({ status: 409 });
  });

  it('binds the declared browser origin to the governed preview request and response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'SUCCESS', message: 'OK', data: preview() })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      previewWorkplaceAction(
        'MAIL.DRAFT.CREATE',
        {
          requestId: 'preview-request-1',
          inputs: { subject: 'Weekly review' },
          sourceReferences: ['src-01'],
          origin,
        },
        secureAuthority
      )
    ).resolves.toEqual(preview());
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/actions/MAIL.DRAFT.CREATE/preview?contextScopeKey=scope-dwaion-self',
      expect.objectContaining({
        body: JSON.stringify({
          requestId: 'preview-request-1',
          inputs: { subject: 'Weekly review' },
          sourceReferences: ['src-01'],
          origin,
        }),
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-current',
        }),
      })
    );
  });

  it('rejects a preview response that drops the origin evidence', async () => {
    const unsafe = preview();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: 'SUCCESS',
          message: 'OK',
          data: { ...unsafe, plan: { ...unsafe.plan, handoffOrigin: null } },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      previewWorkplaceAction('MAIL.DRAFT.CREATE', {
        requestId: 'preview-request-1',
        origin,
      })
    ).rejects.toMatchObject({ status: 502 });
  });
});

function conversation(agentKey: string) {
  return {
    summary: {
      conversationId: 'saved-conversation',
      title: 'Review',
      locale: 'en',
      messageCount: 1,
      agentKey,
      sourceSystems: ['DWP Work'],
      evidenceCount: 1,
      summaryExcerpt: 'Verified metadata only.',
      lastAnswerStatus: 'ANSWER_GROUNDED',
      retentionUntil: '2026-12-06T01:00:00Z',
      legalHold: false,
      createdAt: '2026-09-07T01:00:00Z',
      updatedAt: '2026-09-07T01:00:00Z',
      lastMessageAt: '2026-09-07T01:00:00Z',
    },
    messages: [
      {
        messageId: 'saved-answer',
        role: 'ASSISTANT',
        content: 'Verified metadata only.',
        citations: [],
        agentKey,
        createdAt: '2026-09-07T01:00:00Z',
      },
    ],
  };
}

function selectedConversation(secondBinding: Record<string, unknown> = {}) {
  const binding = {
    sourceSystem: 'APPROVAL_TASK' as const,
    sourceReference: '20000000-0000-4000-8000-000000000001',
    expectedVersion: 3,
    obligationKey: 'review',
  };
  return {
    summary: {
      ...conversation('DWP_APPROVAL_EXPERT').summary,
      messageCount: 2,
    },
    messages: [
      {
        ...conversation('DWP_APPROVAL_EXPERT').messages[0],
        messageId: 'selected-answer-1',
        selectedWork: binding,
      },
      {
        ...conversation('DWP_APPROVAL_EXPERT').messages[0],
        messageId: 'selected-answer-2',
        selectedWork: { ...binding, ...secondBinding },
      },
    ],
  };
}
