import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  addMessagingConversationMember,
  createMessagingAttachmentDownload,
  createMessagingAttachmentUpload,
  createMessagingConversation,
  deleteMessagingMessage,
  discardMessagingAttachment,
  getMessagingConversationMembers,
  getMessagingMessages,
  getMessagingThread,
  leaveMessagingConversation,
  parseMessagingRealtimeSignal,
  removeMessagingConversationMember,
  saveMessagingMessage,
  searchMessaging,
  sendMessagingMessage,
  setMessagingTyping,
  updateMessagingConversationSettings,
  updateMessagingConversationMemberRole,
  updateMessagingMessage,
  unsaveMessagingMessage,
  uploadMessagingAttachmentContent,
} from './messaging-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('messaging API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('sends a thread reply with its root message and idempotency key', async () => {
    const message = { messageId: 'message-1', conversationId: 'conversation-1', sequence: 8 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(message));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendMessagingMessage({
        conversationId: 'conversation-1',
        body: 'Thread reply',
        replyToMessageId: 'message-root',
        idempotencyKey: 'idempotency-1',
        attachmentIds: ['attachment-1'],
        mentionedUserIds: [202, 303],
      })
    ).resolves.toEqual(message);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/messages'
    );
    expect(JSON.parse(String(request.body))).toEqual({
      body: 'Thread reply',
      replyToMessageId: 'message-root',
      idempotencyKey: 'idempotency-1',
      attachmentIds: ['attachment-1'],
      mentionedUserIds: [202, 303],
    });
  });

  it('keeps attachment upload and download tokens behind governed API helpers', async () => {
    const uploadSession = {
      attachment: { attachmentId: 'attachment-1', status: 'QUARANTINED' },
      uploadUrl:
        '/api/messaging/v1/conversations/conversation-1/attachments/attachment-1/content?token=upload-token',
      expiresAt: '2026-08-20T01:00:00Z',
    };
    const clean = { attachmentId: 'attachment-1', status: 'CLEAN' };
    const grant = {
      attachmentId: 'attachment-1',
      filename: 'report.pdf',
      downloadUrl:
        '/api/messaging/v1/conversations/conversation-1/attachments/attachment-1/content?downloadToken=download-token',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(uploadSession))
      .mockResolvedValueOnce(jsonResponse(clean))
      .mockResolvedValueOnce(jsonResponse(grant));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createMessagingAttachmentUpload({
        conversationId: 'conversation-1',
        filename: 'report.pdf',
        contentType: 'application/pdf',
        sizeBytes: 6,
        idempotencyKey: 'upload-command-1',
      })
    ).resolves.toEqual(uploadSession);
    const content = new Blob(['report'], { type: 'application/pdf' });
    await expect(
      uploadMessagingAttachmentContent(uploadSession.uploadUrl, content)
    ).resolves.toEqual(clean);
    await expect(
      createMessagingAttachmentDownload('conversation-1', 'attachment-1')
    ).resolves.toEqual(grant);

    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).body).toBe(content);
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/attachments/attachment-1/download-grants'
    );
  });

  it('discards an unattached upload through its conversation scope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      discardMessagingAttachment('conversation 1', 'attachment/1')
    ).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation%201/attachments/attachment%2F1'
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('DELETE');
  });

  it('normalizes typed SSE events without trusting unstructured payloads', () => {
    expect(
      parseMessagingRealtimeSignal('message', {
        type: 'message.created',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        version: 3,
      })
    ).toEqual({
      kind: 'message.created',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      userId: undefined,
      started: undefined,
      occurredAt: undefined,
      changedAt: undefined,
      expiresAt: undefined,
      version: 3,
    });
    expect(parseMessagingRealtimeSignal('message', 'invalid')).toBeNull();

    expect(
      parseMessagingRealtimeSignal('TYPING_CHANGED', {
        conversationId: 'conversation-1',
        userId: 43,
        started: true,
        changedAt: '2026-08-19T09:00:00Z',
        expiresAt: '2026-08-19T09:00:08Z',
      })
    ).toMatchObject({
      kind: 'TYPING_CHANGED',
      conversationId: 'conversation-1',
      userId: 43,
      started: true,
      expiresAt: '2026-08-19T09:00:08Z',
    });
  });

  it('publishes ephemeral typing state without a durable message payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(setMessagingTyping('conversation 1', true)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation%201/typing'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      started: true,
    });
  });

  it('loads a thread through the dedicated replies endpoint', async () => {
    const thread = { root: { messageId: 'root' }, replies: [], total: 0 };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(thread));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMessagingThread('conversation 1', 'message/root', 50)).resolves.toEqual(thread);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation%201/messages/message%2Froot/replies?limit=50'
    );
  });

  it('loads earlier root messages with a durable sequence cursor', async () => {
    const page = { items: [], hasMore: true, nextBeforeSequence: 41 };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(page));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getMessagingMessages({ conversationId: 'conversation 1', beforeSequence: 92, limit: 50 })
    ).resolves.toEqual(page);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation%201/messages?limit=50&beforeSequence=92'
    );
  });

  it('uses optimistic versions for message edits and deletes', async () => {
    const message = { messageId: 'message-1', version: 4 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(message))
      .mockResolvedValueOnce(jsonResponse(message));
    vi.stubGlobal('fetch', fetchMock);

    await updateMessagingMessage({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      body: 'Updated',
      version: 3,
    });
    await deleteMessagingMessage({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      version: 4,
    });

    const editRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(editRequest.body))).toEqual({ body: 'Updated', version: 3 });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/messages/message-1?version=4'
    );
  });

  it('updates conversation preferences with an optimistic version', async () => {
    const settings = {
      conversationId: 'conversation-1',
      notificationLevel: 'MENTIONS' as const,
      favorite: true,
      pinned: false,
      version: 7,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(settings));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateMessagingConversationSettings(settings)).resolves.toEqual(settings);
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      notificationLevel: 'MENTIONS',
      favorite: true,
      pinned: false,
      version: 7,
    });
  });

  it('uses the private saved-item endpoints for save and remove', async () => {
    const saved = { message: { messageId: 'message-1' }, savedAt: '2026-08-19T00:00:00Z' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(saved))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveMessagingMessage('conversation-1', 'message-1')).resolves.toEqual(saved);
    await expect(unsaveMessagingMessage('conversation-1', 'message-1')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/messages/message-1/saved'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/messages/message-1/saved'
    );
  });

  it('creates a private collaboration conversation with a stable command key', async () => {
    const created = { conversation: { conversationId: 'conversation-2' }, idempotentReplay: false };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(created));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createMessagingConversation({
        name: 'Incident response',
        topic: 'Service recovery',
        type: 'CHANNEL',
        memberUserIds: [31, 42],
        idempotencyKey: 'conversation-command-1',
      })
    ).resolves.toEqual(created);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/messaging/v1/conversations');
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      name: 'Incident response',
      topic: 'Service recovery',
      type: 'CHANNEL',
      memberUserIds: [31, 42],
      idempotencyKey: 'conversation-command-1',
    });
  });

  it('searches only through the governed messaging API', async () => {
    const result = { backend: 'SQL_FALLBACK', results: {}, total: 0 };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(result));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      searchMessaging({ query: '프로젝트 검토', types: ['MESSAGE', 'CONVERSATION'], limit: 12 })
    ).resolves.toEqual(result);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/messaging/v1/search?q=%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8+%EA%B2%80%ED%86%A0&limit=12&types=MESSAGE%2CCONVERSATION'
    );
  });

  it('governs member changes with conversation and membership versions', async () => {
    const membership = {
      conversationId: 'conversation-1',
      conversationType: 'CHANNEL',
      conversationVersion: 5,
      members: [],
    };
    const mutation = { membership, idempotentReplay: false };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(membership))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(mutation))
      .mockResolvedValueOnce(jsonResponse(mutation))
      .mockResolvedValueOnce(jsonResponse(mutation))
      .mockResolvedValueOnce(jsonResponse(mutation));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMessagingConversationMembers('conversation-1')).resolves.toEqual(membership);
    await addMessagingConversationMember({
      conversationId: 'conversation-1',
      userId: 41,
      role: 'MEMBER',
      conversationVersion: 4,
    });
    await updateMessagingConversationMemberRole({
      conversationId: 'conversation-1',
      userId: 41,
      role: 'MODERATOR',
      version: 2,
    });
    await removeMessagingConversationMember({
      conversationId: 'conversation-1',
      userId: 41,
      version: 3,
    });
    await leaveMessagingConversation({ conversationId: 'conversation-1', version: 7 });

    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
      userId: 41,
      role: 'MEMBER',
      conversationVersion: 4,
    });
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body))).toEqual({
      role: 'MODERATOR',
      version: 2,
    });
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      '/api/messaging/v1/conversations/conversation-1/members/41?version=3'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[5]?.[1] as RequestInit).body))).toEqual({
      version: 7,
    });
  });
});
