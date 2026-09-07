import type { Page } from '@playwright/test';
import { mockShellSession } from './shell-session';
import { fulfillMessagingRoute, messagingMessage } from './messaging-ui-contracts';

import type { MessagingConversation, MessagingReadReceipt } from '@dwp-frontend/shared-utils';

export const RECEIPT_CONVERSATION = '71000000-0000-0000-0000-000000000001';
export const RECEIPT_OWN_MESSAGE = '72000000-0000-0000-0000-000000000001';
export const RECEIPT_OTHER_MESSAGE = '72000000-0000-0000-0000-000000000002';
export const RECEIPT_REPLY = '72000000-0000-0000-0000-000000000003';

export async function mockMessagingReceipts(page: Page, locale: 'en' | 'ko' = 'en') {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    personPublicId: 'person-mina',
    locale,
    displayName: locale === 'ko' ? '김민서' : 'Mina Kim',
    email: 'mina.kim@sk.com',
    permissions: ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
      resourceType: 'APP',
      resourceKey: 'APP.MESSAGING',
      permissionCode,
      effect: 'ALLOW' as const,
    })),
  });
  const messages = [
    messagingMessage({
      messageId: RECEIPT_OWN_MESSAGE,
      body: 'Please review the launch plan.',
      sequence: 1,
    }),
    messagingMessage({
      messageId: RECEIPT_OTHER_MESSAGE,
      body: 'I will review it this afternoon.',
      sequence: 3,
      senderUserId: 43,
      senderName: 'Alex Park',
      replyCount: 1,
    }),
  ];
  const reply = messagingMessage({
    messageId: RECEIPT_REPLY,
    body: 'The private thread reply.',
    sequence: 4,
    replyToMessageId: RECEIPT_OTHER_MESSAGE,
    senderUserId: 43,
    senderName: 'Alex Park',
  });
  const conversation: MessagingConversation = {
    conversationId: RECEIPT_CONVERSATION,
    conversationKey: 'launch',
    conversationType: 'GROUP',
    name: 'Launch coordination',
    topic: 'A private project conversation',
    visibility: 'PRIVATE',
    dataClassification: 'INTERNAL',
    lifecycleState: 'ACTIVE',
    memberCount: 4,
    unreadCount: 1,
    favorite: false,
    pinned: false,
    version: 1,
    lastMessage: messages[1],
    lastMessageAt: messages[1]!.createdAt,
  };
  const state = {
    messages,
    privacy: { readReceiptsEnabled: true, version: 0 },
    observations: [] as string[][],
    privacyRequests: [] as Array<{ readReceiptsEnabled: boolean; version: number }>,
    failPrivacy: false,
    failReceipts: false,
    receipt: {
      messageId: RECEIPT_OWN_MESSAGE,
      readCount: 1,
      unreadCount: 1,
      unavailableCount: 1,
      recipients: [
        { userId: 43, displayName: 'Alex Park', status: 'READ' },
        { userId: 44, displayName: 'Jordan Lee', status: 'UNREAD' },
        { userId: 45, displayName: 'Taylor Kim', status: 'UNAVAILABLE' },
      ],
    } as MessagingReadReceipt,
  };
  await page.route('**/api/messaging/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const fulfill = (data: unknown, status = 200) => fulfillMessagingRoute(route, data, status);
    if (path.endsWith('/privacy-preferences')) {
      if (method === 'PUT') {
        const input = route.request().postDataJSON();
        state.privacyRequests.push(input);
        if (state.failPrivacy || input.version !== state.privacy.version) return fulfill(null, 409);
        state.privacy = { ...input, version: input.version + 1 };
      }
      return fulfill(state.privacy);
    }
    if (path.endsWith('/read-receipts') && method === 'POST') {
      state.observations.push(route.request().postDataJSON().messageIds);
      return fulfill({ recorded: true });
    }
    if (path.endsWith('/read-receipts') || path.endsWith('/receipts')) {
      if (state.failReceipts) return fulfill(null, 503);
      return fulfill(path.endsWith('/receipts') ? state.receipt : [state.receipt]);
    }
    if (path === '/api/messaging/v1/conversations')
      return fulfill({ items: [conversation], total: 1, page: 0, pageSize: 30 });
    if (path.endsWith('/display-preferences') || path.endsWith('/display-preference'))
      return fulfill({
        conversationId: RECEIPT_CONVERSATION,
        layoutMode: 'INHERIT',
        density: 'INHERIT',
        theme: 'INHERIT',
        effectiveLayoutMode: 'COLLABORATIVE',
        effectiveDensity: 'COMFORTABLE',
        effectiveTheme: 'DEFAULT',
        showAvatars: true,
        timestampMode: 'ALWAYS',
        messagePreview: true,
        policyLocked: false,
        policyReason: null,
        version: 0,
      });
    if (path.endsWith('/settings'))
      return fulfill({
        conversationId: RECEIPT_CONVERSATION,
        notificationLevel: 'DEFAULT',
        favorite: false,
        pinned: false,
        version: 1,
      });
    if (path.endsWith('/messages'))
      return fulfill({ items: messages, hasMore: false, nextBeforeSequence: null });
    if (path.endsWith('/replies'))
      return fulfill({ root: messages[1], replies: [reply], total: 1 });
    if (path.endsWith('/read'))
      return fulfill({
        conversationId: RECEIPT_CONVERSATION,
        lastReadMessageId: RECEIPT_OTHER_MESSAGE,
        lastReadSequence: 3,
        lastReadAt: '2026-09-04T09:00:00Z',
        version: 2,
      });
    if (path.endsWith(`/conversations/${RECEIPT_CONVERSATION}`))
      return fulfill({
        conversation,
        messages,
        members: [42, 43, 44, 45].map((userId) => ({
          userId,
          displayName: userId === 42 ? 'Mina Kim' : 'Alex Park',
          emailAddress: `${userId}@sk.com`,
          presenceState: 'AVAILABLE',
          memberRole: 'MEMBER',
          membershipSource: 'DIRECT',
          notificationLevel: 'DEFAULT',
          favorite: false,
          pinned: false,
          lastReadSequence: 0,
        })),
        realtime: {
          mode: 'POLLING',
          state: 'READY',
          endpoint: '/api/messaging/v1/events',
          detail: '',
        },
      });
    return fulfill(null, 404);
  });
  return state;
}
