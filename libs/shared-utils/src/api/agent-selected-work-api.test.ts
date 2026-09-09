import { describe, expect, it, vi } from 'vitest';

import {
  askSelectedWorkStream,
  selectedWorkConversationRoute,
  type SelectedWorkQuestion,
} from './agent-selected-work-api';
import type { AskDwpRequest, AskDwpResponse } from './agent-runtime-api';

const input: SelectedWorkQuestion = {
  selection: {
    sourceSystem: 'PERSONAL_TASK',
    sourceReference: '841ed13d-fbca-4484-a829-2a47a9a27924',
    expectedVersion: 3,
  },
  question: 'Review this selected work',
  locale: 'en',
  route: '/work/queue?work=opaque#detail',
};
const secureAuthority = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'psr-current',
  contextKey: 'psc-dwaion',
  contextScopeKey: 'scope-dwaion-self',
} as const;

function abstainedResponse(request: AskDwpRequest): AskDwpResponse {
  return {
    runId: 'run-selected-work',
    auditId: 'audit-selected-work',
    requestId: request.requestId,
    correlationId: 'correlation-selected-work',
    state: 'ABSTAINED',
    answer: null,
    confidence: null,
    citations: [],
    sourceCount: 0,
    policy: {
      outcome: 'DENY',
      riskTier: 'L1',
      code: 'SELECTED_WORK_UNAVAILABLE',
      explanation: 'The selected work is unavailable.',
      modelAllowed: false,
      mutationAllowed: false,
    },
    modelRoute: {
      state: 'NOT_INVOKED',
      provider: null,
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: 0,
    },
    agentRegistry: {
      entryKey: request.agentKey ?? 'DWP_ASSISTANT',
      revision: 1,
      artifactVersion: 'selected-work-v1',
      riskTier: 'MEDIUM',
      resolution: 'ACTIVE',
    },
    statusCode: 'SELECTED_WORK_UNAVAILABLE',
    completedAt: '2026-09-08T00:00:00Z',
    conversationId: null,
    userMessageId: null,
    assistantMessageId: null,
    selectedWork: request.pageContext?.selectedWork ?? null,
  };
}

describe('selected-work governed Ask boundary', () => {
  it('submits only the question and exact binding through the existing stream client', async () => {
    const client = vi.fn(async (request: AskDwpRequest) => abstainedResponse(request));
    const controller = new AbortController();
    const progress = vi.fn();
    await askSelectedWorkStream(
      input,
      { signal: controller.signal, onProgress: progress, authority: secureAuthority },
      client
    );
    expect(client).toHaveBeenCalledWith(
      {
        requestId: expect.any(String),
        query: input.question,
        locale: 'en',
        agentKey: 'DWP_ASSISTANT',
        sourceScopes: ['WORK_ITEM'],
        pageContext: {
          appKey: 'APP.WORK',
          route: '/work/queue',
          surface: 'selected-work-assist',
          entityType: 'PERSONAL_TASK',
          entityRef: input.selection.sourceReference,
          selectedWork: input.selection,
        },
      },
      { signal: controller.signal, onProgress: progress, authority: secureAuthority }
    );
    expect(JSON.stringify(client.mock.calls)).not.toContain('opaque');
  });

  it('binds the approval expert and exact task version and obligation', async () => {
    const client = vi.fn(async (request: AskDwpRequest) => abstainedResponse(request));
    await askSelectedWorkStream(
      {
        ...input,
        selection: { ...input.selection, sourceSystem: 'APPROVAL_TASK', obligationKey: 'review' },
      },
      {},
      client
    );
    expect(client.mock.calls[0]?.[0]).toMatchObject({
      agentKey: 'DWP_APPROVAL_EXPERT',
      sourceScopes: ['APPROVAL_TASK'],
      pageContext: { selectedWork: { expectedVersion: 3, obligationKey: 'review' } },
    });
  });

  it.each([
    { expectedVersion: -1 },
    { expectedVersion: 1.5 },
    { sourceReference: '../other' },
    { sourceSystem: 'APPROVAL_TASK' as const },
    { sourceSystem: 'WORKSPACE' as const },
  ])('rejects invalid version/resource/obligation before transmission: %j', async (patch) => {
    const client = vi.fn();
    await expect(
      askSelectedWorkStream({ ...input, selection: { ...input.selection, ...patch } }, {}, client)
    ).rejects.toThrow();
    expect(client).not.toHaveBeenCalled();
  });

  it('does not transmit an already-cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const client = vi.fn();
    await expect(
      askSelectedWorkStream(input, { signal: controller.signal }, client)
    ).rejects.toThrow();
    expect(client).not.toHaveBeenCalled();
  });

  it('rejects an invalid continuation id before transmission', async () => {
    const client = vi.fn();
    await expect(
      askSelectedWorkStream({ ...input, conversationId: '../other' }, {}, client)
    ).rejects.toThrow();
    expect(client).not.toHaveBeenCalled();
  });

  it('discards a result when cancellation occurs during the transport', async () => {
    const controller = new AbortController();
    const client = vi.fn().mockImplementation(async () => {
      controller.abort();
      return {};
    });
    await expect(
      askSelectedWorkStream(input, { signal: controller.signal }, client)
    ).rejects.toThrow();
  });

  it('rejects a response whose request id does not match the generated request id', async () => {
    const client = vi.fn(async (request: AskDwpRequest) => ({
      ...abstainedResponse(request),
      requestId: 'another-request',
    }));

    await expect(askSelectedWorkStream(input, {}, client)).rejects.toThrow(
      'Selected work response binding is invalid.'
    );
  });

  it('continues only the exact persisted conversation returned by the selected-work runtime', async () => {
    const conversationId = 'cefaef98-4cf6-46ee-a057-984c5e9c6cc8';
    const client = vi.fn(async (request: AskDwpRequest) => ({
      ...abstainedResponse(request),
      conversationId: request.conversationId ?? null,
    }));

    await expect(
      askSelectedWorkStream({ ...input, conversationId }, {}, client)
    ).resolves.toMatchObject({ conversationId });
    expect(client.mock.calls[0]?.[0]).toMatchObject({ conversationId });

    client.mockImplementationOnce(async (request: AskDwpRequest) => ({
      ...abstainedResponse(request),
      conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }));
    await expect(askSelectedWorkStream({ ...input, conversationId }, {}, client)).rejects.toThrow(
      'Selected work response binding is invalid.'
    );
  });

  it.each([
    ['source system', { sourceSystem: 'SERVICE_REQUEST' as const }],
    ['source reference', { sourceReference: 'c2222222-2222-4222-8222-222222222222' }],
    ['expected version', { expectedVersion: 4 }],
    ['obligation', { obligationKey: 'forged-obligation' }],
  ])('rejects a response with a mismatched selected-work %s', async (_label, patch) => {
    const client = vi.fn(async (request: AskDwpRequest) => ({
      ...abstainedResponse(request),
      selectedWork: {
        ...request.pageContext?.selectedWork,
        ...patch,
      } as SelectedWorkQuestion['selection'],
    }));

    await expect(askSelectedWorkStream(input, {}, client)).rejects.toThrow(
      'Selected work response binding is invalid.'
    );
  });

  it('rejects a selected-work response that omits the echoed binding', async () => {
    const client = vi.fn(async (request: AskDwpRequest) => ({
      ...abstainedResponse(request),
      selectedWork: null,
    }));

    await expect(askSelectedWorkStream(input, {}, client)).rejects.toThrow(
      'Selected work response binding is invalid.'
    );
  });

  it('rejects a response resolved by an agent other than the requested selected-work agent', async () => {
    const client = vi.fn(async (request: AskDwpRequest) => ({
      ...abstainedResponse(request),
      agentRegistry: {
        ...abstainedResponse(request).agentRegistry,
        entryKey: 'DWP_APPROVAL_EXPERT',
      },
    }));

    await expect(askSelectedWorkStream(input, {}, client)).rejects.toThrow(
      'Selected work response binding is invalid.'
    );
  });

  it('opens an approval conversation with its expert but no query text', () => {
    const response = {
      state: 'COMPLETED',
      conversationId: 'cefaef98-4cf6-46ee-a057-984c5e9c6cc8',
      agentRegistry: { entryKey: 'DWP_APPROVAL_EXPERT' },
    } as AskDwpResponse;
    expect(selectedWorkConversationRoute(response)).toBe(
      '/dwaion/conversations/cefaef98-4cf6-46ee-a057-984c5e9c6cc8?agent=DWP_APPROVAL_EXPERT'
    );
    expect(selectedWorkConversationRoute({ ...response, conversationId: null })).toBeNull();
  });

  it('uses the canonical conversation route when the persisted expert is the default assistant', () => {
    const response = {
      state: 'COMPLETED',
      conversationId: 'cefaef98-4cf6-46ee-a057-984c5e9c6cc8',
      agentRegistry: { entryKey: 'DWP_ASSISTANT' },
    } as AskDwpResponse;
    expect(selectedWorkConversationRoute(response)).toBe(
      '/dwaion/conversations/cefaef98-4cf6-46ee-a057-984c5e9c6cc8'
    );
  });

  it('does not open a non-completed or unexpected-agent conversation', () => {
    const response = {
      state: 'ABSTAINED',
      conversationId: 'cefaef98-4cf6-46ee-a057-984c5e9c6cc8',
      agentRegistry: { entryKey: 'DWP_ASSISTANT' },
    } as AskDwpResponse;
    expect(selectedWorkConversationRoute(response)).toBeNull();
    expect(
      selectedWorkConversationRoute({
        ...response,
        state: 'COMPLETED',
        agentRegistry: { entryKey: 'UNEXPECTED_AGENT' },
      } as AskDwpResponse)
    ).toBeNull();
  });
});
