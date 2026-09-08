import { describe, expect, it, vi } from 'vitest';

import {
  askSelectedWorkStream,
  selectedWorkConversationRoute,
  type SelectedWorkQuestion,
} from './agent-selected-work-api';
import type { AskDwpResponse } from './agent-runtime-api';

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

describe('selected-work governed Ask boundary', () => {
  it('submits only the question and exact binding through the existing stream client', async () => {
    const client = vi.fn().mockResolvedValue({ state: 'ABSTAINED' });
    const controller = new AbortController();
    const progress = vi.fn();
    await askSelectedWorkStream(input, { signal: controller.signal, onProgress: progress }, client);
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
      { signal: controller.signal, onProgress: progress }
    );
    expect(JSON.stringify(client.mock.calls)).not.toContain('opaque');
  });

  it('binds the approval expert and exact task version and obligation', async () => {
    const client = vi.fn().mockResolvedValue({});
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
