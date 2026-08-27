import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

import type {
  MessagingConversation,
  MessagingConversationDetail,
  MessagingAttachment,
  MessagingConversationDisplayPreference,
  MessagingDisplayPreference,
  MessagingMember,
  MessagingMemberRole,
  MessagingMessage,
  MessagingPerson,
} from '@dwp-frontend/shared-utils';

const CONVERSATION_ID = '71000000-0000-0000-0000-000000000001';
const OWNER_MESSAGE_ID = '72000000-0000-0000-0000-000000000001';
const COLLEAGUE_MESSAGE_ID = '72000000-0000-0000-0000-000000000002';

const MESSAGING_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MESSAGING',
  permissionCode,
  effect: 'ALLOW' as const,
}));

const CURRENT_MEMBER: MessagingMember = {
  userId: 42,
  personPublicId: 'person-mina',
  emailAddress: 'mina.kim@sk.com',
  displayName: 'Mina Kim',
  jobTitle: 'Network Operations Lead',
  organizationName: 'Network Operations',
  presenceState: 'AVAILABLE',
  memberRole: 'OWNER',
  membershipSource: 'DIRECT',
  notificationLevel: 'DEFAULT',
  favorite: false,
  pinned: false,
  lastReadAt: null,
};

const COLLEAGUE: MessagingPerson = {
  userId: 43,
  personPublicId: 'person-alex',
  emailAddress: 'alex.park@sk.com',
  displayName: 'Alex Park',
  jobTitle: 'Service Delivery Manager',
  organizationName: 'Service Delivery',
  presenceState: 'BUSY',
};

type SendRequest = {
  body: string;
  replyToMessageId?: string | null;
  idempotencyKey: string;
  attachmentIds: string[];
  mentionedUserIds: number[];
};

type CreateRequest = {
  name: string;
  topic?: string | null;
  type: 'GROUP' | 'CHANNEL';
  memberUserIds: number[];
  idempotencyKey: string;
};

type MessagingFixtureState = {
  conversations: MessagingConversation[];
  messages: Map<string, MessagingMessage[]>;
  replies: Map<string, MessagingMessage[]>;
  sentRequests: SendRequest[];
  createdRequests: CreateRequest[];
  reactionRequests: Array<{ messageId: string; emoji: string }>;
  savedMessageIds: string[];
  editedBodies: string[];
  deletedMessageIds: string[];
  memberRoleRequests: Array<{ userId: number; role: MessagingMemberRole; version: number }>;
  managedMemberRole: MessagingMemberRole;
  attachments: Map<string, MessagingAttachment>;
  uploadedAttachmentIds: string[];
  displayPreference: MessagingDisplayPreference;
  conversationDisplayPreferences: Map<string, MessagingConversationDisplayPreference>;
  nextMessage: number;
  nextAttachment: number;
  nextConversation: number;
};

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
}

function message(input: Partial<MessagingMessage> & Pick<MessagingMessage, 'messageId' | 'body'>) {
  return {
    conversationId: CONVERSATION_ID,
    senderUserId: 42,
    senderPersonPublicId: CURRENT_MEMBER.personPublicId,
    senderName: CURRENT_MEMBER.displayName,
    contentType: 'TEXT' as const,
    messageKind: 'USER' as const,
    replyToMessageId: null,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-08-19T08:30:00Z',
    sequence: 1,
    version: 1,
    reactions: [],
    attachments: [],
    replyCount: 0,
    rootPreview: null,
    ...input,
  } satisfies MessagingMessage;
}

function createFixtureState(): MessagingFixtureState {
  const ownerMessage = message({
    messageId: OWNER_MESSAGE_ID,
    body: 'Confirm the launch checklist before noon.',
    replyCount: 1,
  });
  const colleagueMessage = message({
    messageId: COLLEAGUE_MESSAGE_ID,
    body: 'The customer briefing deck is ready.',
    senderUserId: COLLEAGUE.userId,
    senderPersonPublicId: COLLEAGUE.personPublicId,
    senderName: COLLEAGUE.displayName,
    sequence: 2,
    createdAt: '2026-08-19T08:35:00Z',
  });
  const initialReply = message({
    messageId: '72000000-0000-0000-0000-000000000003',
    body: 'I checked the rollout and security sections.',
    senderUserId: COLLEAGUE.userId,
    senderPersonPublicId: COLLEAGUE.personPublicId,
    senderName: COLLEAGUE.displayName,
    replyToMessageId: OWNER_MESSAGE_ID,
    sequence: 3,
    createdAt: '2026-08-19T08:40:00Z',
  });
  const conversation: MessagingConversation = {
    conversationId: CONVERSATION_ID,
    conversationKey: 'launch-coordination',
    conversationType: 'CHANNEL',
    name: 'Launch coordination',
    topic: 'Customer launch readiness and decisions',
    visibility: 'PRIVATE',
    dataClassification: 'INTERNAL',
    linkedSpaceKey: null,
    linkedSpaceName: null,
    lifecycleState: 'ACTIVE',
    memberCount: 2,
    unreadCount: 1,
    favorite: false,
    pinned: false,
    lastMessage: colleagueMessage,
    lastMessageAt: colleagueMessage.createdAt,
    version: 1,
  };

  return {
    conversations: [conversation],
    messages: new Map([[CONVERSATION_ID, [ownerMessage, colleagueMessage]]]),
    replies: new Map([[OWNER_MESSAGE_ID, [initialReply]]]),
    sentRequests: [],
    createdRequests: [],
    reactionRequests: [],
    savedMessageIds: [],
    editedBodies: [],
    deletedMessageIds: [],
    memberRoleRequests: [],
    managedMemberRole: 'MEMBER',
    attachments: new Map(),
    uploadedAttachmentIds: [],
    displayPreference: {
      layoutMode: 'AUTO',
      density: 'COMFORTABLE',
      theme: 'DEFAULT',
      showAvatars: true,
      timestampMode: 'SMART',
      messagePreview: true,
      version: 1,
      policy: {
        allowedThemes: ['DEFAULT', 'MIST', 'SAGE', 'ROSE'],
        allowPersonalBackgrounds: false,
        allowThemeSharing: false,
        version: 1,
      },
    },
    conversationDisplayPreferences: new Map(),
    nextMessage: 10,
    nextAttachment: 1,
    nextConversation: 2,
  };
}

function detailFor(
  state: MessagingFixtureState,
  conversationId: string
): MessagingConversationDetail {
  const conversation = state.conversations.find((item) => item.conversationId === conversationId);
  if (!conversation) throw new Error(`Unknown mocked conversation: ${conversationId}`);
  const messages = (state.messages.get(conversationId) ?? []).slice(-80);
  const lastMessage = messages.at(-1) ?? null;
  return structuredClone({
    conversation: {
      ...conversation,
      lastMessage,
      lastMessageAt: lastMessage?.createdAt ?? conversation.lastMessageAt,
    },
    members: [
      CURRENT_MEMBER,
      {
        ...COLLEAGUE,
        memberRole: 'MEMBER',
        membershipSource: 'DIRECT',
        notificationLevel: 'DEFAULT',
        favorite: false,
        pinned: false,
        lastReadAt: null,
      },
    ],
    messages,
    realtime: {
      mode: 'POLLING',
      endpoint: '/api/messaging/v1/stream',
      state: 'AVAILABLE',
      detail: 'Deterministic E2E transport',
    },
  } satisfies MessagingConversationDetail);
}

function findMessage(
  state: MessagingFixtureState,
  messageId: string
): MessagingMessage | undefined {
  for (const messages of state.messages.values()) {
    const found = messages.find((item) => item.messageId === messageId);
    if (found) return found;
  }
  for (const replies of state.replies.values()) {
    const found = replies.find((item) => item.messageId === messageId);
    if (found) return found;
  }
  return undefined;
}

function replaceMessage(state: MessagingFixtureState, nextMessage: MessagingMessage) {
  for (const [conversationId, messages] of state.messages) {
    const index = messages.findIndex((item) => item.messageId === nextMessage.messageId);
    if (index >= 0) {
      state.messages.set(conversationId, messages.with(index, nextMessage));
      return;
    }
  }
  for (const [rootMessageId, replies] of state.replies) {
    const index = replies.findIndex((item) => item.messageId === nextMessage.messageId);
    if (index >= 0) {
      state.replies.set(rootMessageId, replies.with(index, nextMessage));
      return;
    }
  }
}

async function mockMessaging(page: Page): Promise<MessagingFixtureState> {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: CURRENT_MEMBER.userId,
    personPublicId: CURRENT_MEMBER.personPublicId,
    locale: 'en',
    displayName: CURRENT_MEMBER.displayName,
    jobTitle: CURRENT_MEMBER.jobTitle ?? undefined,
    email: CURRENT_MEMBER.emailAddress,
    permissions: MESSAGING_PERMISSIONS,
  });
  const state = createFixtureState();

  await page.route('**/api/messaging/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/messaging/v1/conversations' && method === 'GET') {
      return fulfill(route, {
        items: state.conversations,
        total: state.conversations.length,
        page: 0,
        pageSize: 60,
      });
    }

    if (path === '/api/messaging/v1/conversations' && method === 'POST') {
      const payload = request.postDataJSON() as CreateRequest;
      state.createdRequests.push(payload);
      const conversationId = `71000000-0000-0000-0000-${String(state.nextConversation++).padStart(12, '0')}`;
      const createdAt = '2026-08-19T09:30:00Z';
      const conversation: MessagingConversation = {
        conversationId,
        conversationKey: `created-${state.nextConversation}`,
        conversationType: payload.type,
        name: payload.name,
        topic: payload.topic ?? null,
        visibility: 'PRIVATE',
        dataClassification: 'INTERNAL',
        linkedSpaceKey: null,
        linkedSpaceName: null,
        lifecycleState: 'ACTIVE',
        memberCount: 1 + payload.memberUserIds.length,
        unreadCount: 0,
        favorite: false,
        pinned: false,
        lastMessage: null,
        lastMessageAt: null,
        version: 1,
      };
      state.conversations.push(conversation);
      state.messages.set(conversationId, []);
      return fulfill(route, {
        conversation: {
          conversationId,
          type: payload.type,
          name: payload.name,
          topic: payload.topic ?? null,
          visibility: 'PRIVATE',
          lifecycleState: 'ACTIVE',
          createdAt,
          members: [
            {
              userId: CURRENT_MEMBER.userId,
              personPublicId: CURRENT_MEMBER.personPublicId,
              displayName: CURRENT_MEMBER.displayName,
              emailAddress: CURRENT_MEMBER.emailAddress,
              role: 'OWNER',
            },
          ],
        },
        idempotentReplay: false,
      });
    }

    if (path === '/api/messaging/v1/search' && method === 'GET') {
      const query = url.searchParams.get('q') ?? '';
      return fulfill(route, {
        backend: 'SQL_FALLBACK',
        query,
        limit: Number(url.searchParams.get('limit') ?? 20),
        total: 3,
        results: {
          conversations: [
            {
              resultType: 'CONVERSATION',
              conversationId: CONVERSATION_ID,
              conversationType: 'CHANNEL',
              name: 'Launch coordination',
              snippet: 'Customer launch readiness',
            },
          ],
          messages: [
            {
              resultType: 'MESSAGE',
              messageId: COLLEAGUE_MESSAGE_ID,
              conversationId: CONVERSATION_ID,
              conversationName: 'Launch coordination',
              senderName: COLLEAGUE.displayName,
              snippet: 'The customer briefing deck is ready.',
              createdAt: '2026-08-19T08:35:00Z',
            },
          ],
          people: [COLLEAGUE],
        },
      });
    }

    if (path === '/api/messaging/v1/people' && method === 'GET') {
      return fulfill(route, [COLLEAGUE]);
    }

    const members = path.match(/^\/api\/messaging\/v1\/conversations\/([^/]+)\/members$/u);
    if (members && method === 'GET') {
      return fulfill(route, {
        conversationId: decodeURIComponent(members[1]!),
        conversationType: 'CHANNEL',
        conversationVersion: 1,
        members: [
          {
            userId: CURRENT_MEMBER.userId,
            personPublicId: CURRENT_MEMBER.personPublicId,
            displayName: CURRENT_MEMBER.displayName,
            emailAddress: CURRENT_MEMBER.emailAddress,
            jobTitle: CURRENT_MEMBER.jobTitle,
            organizationName: CURRENT_MEMBER.organizationName,
            role: 'OWNER',
            membershipSource: 'DIRECT',
            historyStartSequence: 0,
            membershipStartedAt: '2026-08-19T08:00:00Z',
            version: 1,
          },
          {
            userId: COLLEAGUE.userId,
            personPublicId: COLLEAGUE.personPublicId,
            displayName: COLLEAGUE.displayName,
            emailAddress: COLLEAGUE.emailAddress,
            jobTitle: COLLEAGUE.jobTitle,
            organizationName: COLLEAGUE.organizationName,
            role: state.managedMemberRole,
            membershipSource: 'DIRECT',
            historyStartSequence: 0,
            membershipStartedAt: '2026-08-19T08:05:00Z',
            version: 2,
          },
        ],
      });
    }

    const memberRole = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/members\/(\d+)\/role$/u
    );
    if (memberRole && method === 'PUT') {
      const payload = request.postDataJSON() as { role: MessagingMemberRole; version: number };
      const userId = Number(memberRole[2]);
      state.memberRoleRequests.push({ userId, ...payload });
      state.managedMemberRole = payload.role;
      return fulfill(route, {
        membership: {
          conversationId: decodeURIComponent(memberRole[1]!),
          conversationType: 'CHANNEL',
          conversationVersion: 2,
          members: [
            {
              userId: CURRENT_MEMBER.userId,
              personPublicId: CURRENT_MEMBER.personPublicId,
              displayName: CURRENT_MEMBER.displayName,
              emailAddress: CURRENT_MEMBER.emailAddress,
              role: 'OWNER',
              membershipSource: 'DIRECT',
              historyStartSequence: 0,
              membershipStartedAt: '2026-08-19T08:00:00Z',
              version: 1,
            },
            {
              userId,
              personPublicId: COLLEAGUE.personPublicId,
              displayName: COLLEAGUE.displayName,
              emailAddress: COLLEAGUE.emailAddress,
              role: payload.role,
              membershipSource: 'DIRECT',
              historyStartSequence: 0,
              membershipStartedAt: '2026-08-19T08:05:00Z',
              version: payload.version + 1,
            },
          ],
        },
        idempotentReplay: false,
      });
    }

    const readCursor = path.match(/^\/api\/messaging\/v1\/conversations\/([^/]+)\/read-cursor$/u);
    if (readCursor && method === 'POST') {
      const conversationId = decodeURIComponent(readCursor[1]!);
      const { messageId } = request.postDataJSON() as { messageId: string };
      const readMessage = findMessage(state, messageId);
      return fulfill(route, {
        conversationId,
        lastReadMessageId: messageId,
        lastReadSequence: readMessage?.sequence ?? 0,
        lastReadAt: '2026-08-19T09:00:00Z',
        version: 2,
      });
    }

    if (path === '/api/messaging/v1/display-preferences' && method === 'GET') {
      return fulfill(route, state.displayPreference);
    }
    if (path === '/api/messaging/v1/display-preferences' && method === 'PUT') {
      const payload = request.postDataJSON() as Omit<MessagingDisplayPreference, 'policy'>;
      state.displayPreference = {
        ...state.displayPreference,
        ...payload,
        version: payload.version + 1,
      };
      return fulfill(route, state.displayPreference);
    }

    const displayPreference = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/display-preference$/u
    );
    if (displayPreference && method === 'GET') {
      const conversationId = decodeURIComponent(displayPreference[1]!);
      return fulfill(route, conversationDisplayPreference(state, conversationId));
    }
    if (displayPreference && method === 'PUT') {
      const conversationId = decodeURIComponent(displayPreference[1]!);
      const current = conversationDisplayPreference(state, conversationId);
      const payload = request.postDataJSON() as Pick<
        MessagingConversationDisplayPreference,
        'layoutMode' | 'density' | 'theme' | 'version'
      >;
      const saved: MessagingConversationDisplayPreference = {
        ...current,
        ...payload,
        effectiveLayoutMode:
          payload.layoutMode === 'CONVERSATIONAL' ? 'CONVERSATIONAL' : 'COLLABORATIVE',
        effectiveDensity:
          payload.density === 'COMPACT' ? 'COMPACT' : state.displayPreference.density,
        effectiveTheme: payload.theme === 'INHERIT' ? state.displayPreference.theme : payload.theme,
        version: payload.version + 1,
      };
      state.conversationDisplayPreferences.set(conversationId, saved);
      return fulfill(route, saved);
    }
    if (displayPreference && method === 'DELETE') {
      const conversationId = decodeURIComponent(displayPreference[1]!);
      state.conversationDisplayPreferences.delete(conversationId);
      return fulfill(route, conversationDisplayPreference(state, conversationId));
    }

    const settings = path.match(/^\/api\/messaging\/v1\/conversations\/([^/]+)\/settings$/u);
    if (settings && method === 'GET') {
      return fulfill(route, {
        conversationId: decodeURIComponent(settings[1]!),
        notificationLevel: 'DEFAULT',
        favorite: false,
        pinned: false,
        version: 1,
      });
    }
    if (settings && method === 'PUT') {
      const payload = request.postDataJSON() as {
        notificationLevel: 'DEFAULT' | 'MENTIONS' | 'MUTE';
        favorite: boolean;
        pinned: boolean;
        version: number;
      };
      return fulfill(route, {
        conversationId: decodeURIComponent(settings[1]!),
        ...payload,
        version: payload.version + 1,
      });
    }

    const meetingCapability = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/meetings\/capabilities$/u
    );
    if (meetingCapability && method === 'GET') {
      return fulfill(route, {
        available: true,
        provider: 'LIVEKIT',
        unavailableReason: null,
        audio: true,
        video: true,
        screenShare: true,
        participantList: true,
        tokenTtlSeconds: 300,
      });
    }

    const currentMeeting = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/meetings\/current$/u
    );
    if (currentMeeting && method === 'GET') {
      return fulfill(route, { session: null });
    }

    const meetingHistory = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/meetings\/history$/u
    );
    if (meetingHistory && method === 'GET') {
      return fulfill(route, {
        items: [
          {
            sessionId: '74000000-0000-0000-0000-000000000001',
            conversationId: decodeURIComponent(meetingHistory[1]!),
            provider: 'LIVEKIT',
            startedByUserId: COLLEAGUE.userId,
            startedByName: COLLEAGUE.displayName,
            startedAt: '2026-08-19T07:00:00Z',
            endedByUserId: CURRENT_MEMBER.userId,
            endedByName: CURRENT_MEMBER.displayName,
            endedAt: '2026-08-19T07:24:00Z',
            durationSeconds: 1440,
          },
        ],
      });
    }

    const createAttachment = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/attachments\/uploads$/u
    );
    if (createAttachment && method === 'POST') {
      const conversationId = decodeURIComponent(createAttachment[1]!);
      const payload = request.postDataJSON() as {
        filename: string;
        contentType: string;
        sizeBytes: number;
      };
      const attachmentId = `73000000-0000-0000-0000-${String(state.nextAttachment++).padStart(12, '0')}`;
      const attachment: MessagingAttachment = {
        attachmentId,
        filename: payload.filename,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes,
        status: 'QUARANTINED',
        rejectionReason: null,
        createdAt: '2026-08-19T09:05:00Z',
        version: 1,
      };
      state.attachments.set(attachmentId, attachment);
      return fulfill(route, {
        attachment,
        uploadUrl: `/api/messaging/v1/conversations/${conversationId}/attachments/${attachmentId}/content?token=upload-token`,
        expiresAt: '2026-08-19T09:15:00Z',
      });
    }

    const attachmentContent = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/attachments\/([^/]+)\/content$/u
    );
    if (attachmentContent && method === 'PUT') {
      const attachmentId = decodeURIComponent(attachmentContent[2]!);
      const current = state.attachments.get(attachmentId);
      if (!current) return fulfill(route, null, 404);
      const clean = { ...current, status: 'CLEAN' as const, version: current.version + 2 };
      state.attachments.set(attachmentId, clean);
      state.uploadedAttachmentIds.push(attachmentId);
      return fulfill(route, clean);
    }
    if (attachmentContent && method === 'GET' && url.searchParams.has('downloadToken')) {
      return route.fulfill({
        status: 200,
        contentType: 'text/plain',
        headers: { 'Content-Disposition': 'attachment; filename="launch-notes.txt"' },
        body: 'security-reviewed attachment',
      });
    }

    const attachmentDownload = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/attachments\/([^/]+)\/download-grants$/u
    );
    if (attachmentDownload && method === 'POST') {
      const conversationId = decodeURIComponent(attachmentDownload[1]!);
      const attachmentId = decodeURIComponent(attachmentDownload[2]!);
      const attachment = state.attachments.get(attachmentId);
      if (!attachment) return fulfill(route, null, 404);
      return fulfill(route, {
        attachmentId,
        filename: attachment.filename,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        downloadUrl: `/api/messaging/v1/conversations/${conversationId}/attachments/${attachmentId}/content?downloadToken=download-token`,
        expiresAt: '2026-08-19T09:16:00Z',
      });
    }

    const thread = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/messages\/([^/]+)\/replies$/u
    );
    if (thread && method === 'GET') {
      const rootMessageId = decodeURIComponent(thread[2]!);
      const root = findMessage(state, rootMessageId);
      if (!root) return fulfill(route, null, 404);
      const replies = state.replies.get(rootMessageId) ?? [];
      return fulfill(route, { root, replies, total: replies.length });
    }

    const history = path.match(/^\/api\/messaging\/v1\/conversations\/([^/]+)\/messages$/u);
    if (history && method === 'GET') {
      const conversationId = decodeURIComponent(history[1]!);
      const beforeSequence = Number(
        url.searchParams.get('beforeSequence') ?? Number.MAX_SAFE_INTEGER
      );
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const eligible = (state.messages.get(conversationId) ?? [])
        .filter((item) => !item.replyToMessageId && (item.sequence ?? 0) < beforeSequence)
        .sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
      const items = eligible.slice(-limit);
      return fulfill(route, {
        items,
        hasMore: eligible.length > items.length,
        nextBeforeSequence: eligible.length > items.length ? (items[0]?.sequence ?? null) : null,
      });
    }

    const reaction = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/messages\/([^/]+)\/reactions$/u
    );
    if (reaction && method === 'POST') {
      const messageId = decodeURIComponent(reaction[2]!);
      const { emoji } = request.postDataJSON() as { emoji: string };
      state.reactionRequests.push({ messageId, emoji });
      const current = findMessage(state, messageId);
      if (!current) return fulfill(route, null, 404);
      const existing = current.reactions.find((item) => item.emoji === emoji);
      const reactions = existing
        ? current.reactions.map((item) =>
            item.emoji === emoji ? { ...item, mine: true, count: item.count + 1 } : item
          )
        : [...current.reactions, { emoji, count: 1, mine: true }];
      const updated = { ...current, reactions };
      replaceMessage(state, updated);
      return fulfill(route, updated);
    }

    const saved = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/messages\/([^/]+)\/saved$/u
    );
    if (saved && method === 'POST') {
      const messageId = decodeURIComponent(saved[2]!);
      const savedMessage = findMessage(state, messageId);
      if (!savedMessage) return fulfill(route, null, 404);
      state.savedMessageIds.push(messageId);
      return fulfill(route, {
        message: savedMessage,
        conversationName: 'Launch coordination',
        conversationType: 'CHANNEL',
        savedAt: '2026-08-19T09:10:00Z',
      });
    }

    const send = path.match(/^\/api\/messaging\/v1\/conversations\/([^/]+)\/messages$/u);
    if (send && method === 'POST') {
      const conversationId = decodeURIComponent(send[1]!);
      const payload = request.postDataJSON() as SendRequest;
      state.sentRequests.push(payload);
      const nextMessage = message({
        messageId: `72000000-0000-0000-0000-${String(state.nextMessage++).padStart(12, '0')}`,
        conversationId,
        body: payload.body,
        replyToMessageId: payload.replyToMessageId ?? null,
        sequence: state.nextMessage,
        createdAt: `2026-08-19T09:${String(state.nextMessage).padStart(2, '0')}:00Z`,
        attachments: (payload.attachmentIds ?? [])
          .map((attachmentId) => state.attachments.get(attachmentId))
          .filter((attachment): attachment is MessagingAttachment => Boolean(attachment)),
      });
      if (payload.replyToMessageId) {
        const replies = state.replies.get(payload.replyToMessageId) ?? [];
        state.replies.set(payload.replyToMessageId, [...replies, nextMessage]);
        const root = findMessage(state, payload.replyToMessageId);
        if (root) replaceMessage(state, { ...root, replyCount: replies.length + 1 });
      } else {
        state.messages.set(conversationId, [
          ...(state.messages.get(conversationId) ?? []),
          nextMessage,
        ]);
      }
      return fulfill(route, nextMessage);
    }

    const messageAction = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/messages\/([^/]+)$/u
    );
    if (messageAction && method === 'PUT') {
      const messageId = decodeURIComponent(messageAction[2]!);
      const payload = request.postDataJSON() as { body: string; version: number };
      const current = findMessage(state, messageId);
      if (!current) return fulfill(route, null, 404);
      const updated = {
        ...current,
        body: payload.body,
        editedAt: '2026-08-19T09:20:00Z',
        version: payload.version + 1,
      };
      state.editedBodies.push(payload.body);
      replaceMessage(state, updated);
      return fulfill(route, updated);
    }
    if (messageAction && method === 'DELETE') {
      const messageId = decodeURIComponent(messageAction[2]!);
      const current = findMessage(state, messageId);
      if (!current) return fulfill(route, null, 404);
      const deleted = {
        ...current,
        body: '',
        deletedAt: '2026-08-19T09:25:00Z',
        version: current.version + 1,
      };
      state.deletedMessageIds.push(messageId);
      replaceMessage(state, deleted);
      return fulfill(route, deleted);
    }

    const detail = path.match(/^\/api\/messaging\/v1\/conversations\/([^/]+)$/u);
    if (detail && method === 'GET') {
      return fulfill(route, detailFor(state, decodeURIComponent(detail[1]!)));
    }

    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ERROR',
        message: `Unhandled messaging E2E route: ${method} ${path}`,
      }),
    });
  });

  return state;
}

async function openConversation(page: Page) {
  await page.goto(`/messages/inbox?conversation=${CONVERSATION_ID}`);
  await expect(page.getByRole('heading', { name: 'Launch coordination' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Compose message' })).toBeVisible();
}

function conversationDisplayPreference(
  state: MessagingFixtureState,
  conversationId: string
): MessagingConversationDisplayPreference {
  return (
    state.conversationDisplayPreferences.get(conversationId) ?? {
      conversationId,
      layoutMode: 'INHERIT',
      density: 'INHERIT',
      theme: 'INHERIT',
      effectiveLayoutMode: 'COLLABORATIVE',
      effectiveDensity: state.displayPreference.density,
      effectiveTheme: state.displayPreference.theme,
      showAvatars: state.displayPreference.showAvatars,
      timestampMode: state.displayPreference.timestampMode,
      messagePreview: state.displayPreference.messagePreview,
      policyLocked: false,
      policyReason: null,
      version: 0,
    }
  );
}

function messageRow(page: Page, body: string): Locator {
  return page
    .getByText(body, { exact: true })
    .locator('xpath=ancestor::*[.//button[@aria-label="Add reaction"]][1]');
}

async function expectInsideViewport(locator: Locator, page: Page) {
  await locator.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

test('composer sends with Enter, preserves Shift+Enter, and ignores Enter during IME composition', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);
  const composer = page.getByRole('textbox', { name: 'Compose message' });

  await composer.fill('Sent with Enter');
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.body).toBe('Sent with Enter');
  await expect(page.getByText('Sent with Enter', { exact: true })).toBeVisible();

  const sentBeforeMultiline = state.sentRequests.length;
  await composer.fill('Line one');
  await composer.press('Shift+Enter');
  await composer.type('Line two');
  await expect(composer).toHaveValue('Line one\nLine two');
  expect(state.sentRequests).toHaveLength(sentBeforeMultiline);
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.body).toBe('Line one\nLine two');

  const sentBeforeComposition = state.sentRequests.length;
  await composer.fill('Korean composition');
  await composer.dispatchEvent('compositionstart', { data: '한' });
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.length).toBe(sentBeforeComposition);
  await composer.dispatchEvent('compositionend', { data: '한' });
  await composer.fill('Korean composition complete');
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.body).toBe('Korean composition complete');
});

test('composer offers searchable expressions, structured mentions, and conversation meeting history', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);
  const composer = page.getByRole('textbox', { name: 'Compose message' });

  await page.getByRole('button', { name: 'Open emoji' }).click();
  const expressionSearch = page.getByRole('textbox', {
    name: 'Search emoji or work expression',
  });
  await expect(expressionSearch).toBeVisible();
  await expressionSearch.fill('review');
  await page.getByRole('button', { name: 'Reviewing', exact: true }).click();
  await expect(composer).toHaveValue('👀');

  await composer.fill('@');
  const mentionSuggestions = page.getByRole('listbox', { name: 'Mention suggestions' });
  await expect(mentionSuggestions).toBeVisible();
  await expect(mentionSuggestions.getByText(COLLEAGUE.jobTitle!, { exact: false })).toBeVisible();
  await mentionSuggestions.getByText(COLLEAGUE.displayName, { exact: true }).click();
  await expect(composer).toHaveValue(`@${COLLEAGUE.displayName} `);
  await composer.type('please review this.');
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.mentionedUserIds).toEqual([COLLEAGUE.userId]);

  await page.getByRole('button', { name: 'Start or join a meeting', exact: true }).click();
  const meetingDialog = page.getByRole('dialog', { name: /Conversation meeting/ });
  await expect(meetingDialog.getByText('Recent meetings', { exact: true })).toBeVisible();
  await expect(meetingDialog.getByText(COLLEAGUE.displayName, { exact: true })).toBeVisible();
  await expect(meetingDialog.getByText('24 min', { exact: false })).toBeVisible();
});

test('security-scanned attachment-only messages are delivered and downloaded through a grant', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.getByRole('button', { name: 'Attach file' }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'launch-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('security-reviewed attachment'),
    });

  await expect(page.getByText(/Ready to attach$/u)).toBeVisible();
  await expect.poll(() => state.uploadedAttachmentIds).toHaveLength(1);

  await page.getByRole('textbox', { name: 'Compose message' }).press('Enter');

  await expect
    .poll(() => state.sentRequests.at(-1)?.attachmentIds)
    .toEqual([state.uploadedAttachmentIds[0]]);
  expect(state.sentRequests.at(-1)?.body).toBe('');
  const downloadButton = page.getByRole('button', { name: 'Download launch-notes.txt' });
  await expect(downloadButton).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('launch-notes.txt');
});

test('message actions expose labelled reactions, thread replies, save, edit, delete, and meeting entry', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  let ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await ownerRow.getByRole('button', { name: 'Add reaction' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Search emoji or work expression' })
  ).toBeVisible();
  await page.getByRole('tab', { name: 'People' }).click();
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thanks', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Work' }).click();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reviewing', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'People' }).click();
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await expect
    .poll(() => state.reactionRequests.at(-1))
    .toEqual({
      messageId: OWNER_MESSAGE_ID,
      emoji: '👍',
    });

  ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await ownerRow.getByRole('button', { name: 'Save for later' }).click();
  await expect.poll(() => state.savedMessageIds).toContain(OWNER_MESSAGE_ID);
  await expect(page.getByText('Message saved for later.')).toBeVisible();

  ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await ownerRow.getByRole('button', { name: 'Reply in thread' }).click();
  const thread = page.getByRole('region', { name: 'Thread' });
  await expect(thread).toBeVisible();
  await expect(thread.getByText('I checked the rollout and security sections.')).toBeVisible();
  const threadComposer = thread.getByRole('textbox', { name: 'Compose thread reply' });
  await threadComposer.fill('Reply sent from the thread');
  await threadComposer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.replyToMessageId).toBe(OWNER_MESSAGE_ID);
  await expect(thread.getByText('Reply sent from the thread', { exact: true })).toBeVisible();
  await thread.getByRole('button', { name: 'Close thread' }).click();
  await expect(thread).toBeHidden();

  ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await ownerRow.getByRole('button', { name: 'Edit message' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit message' });
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole('textbox', { name: 'Message' }).fill('Launch checklist confirmed.');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => state.editedBodies.at(-1)).toBe('Launch checklist confirmed.');
  await expect(page.getByText('Launch checklist confirmed.', { exact: true })).toBeVisible();

  ownerRow = messageRow(page, 'Launch checklist confirmed.');
  await ownerRow.hover();
  await ownerRow.getByRole('button', { name: 'Delete message' }).click();
  const deleteDialog = page.getByRole('alertdialog', { name: 'Delete this message?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete message' }).click();
  await expect.poll(() => state.deletedMessageIds).toContain(OWNER_MESSAGE_ID);
  await expect(page.getByText('This message was deleted', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Start or join a meeting', exact: true }).click();
  const meetingDialog = page.getByRole('dialog', { name: /Conversation meeting/ });
  await expect(meetingDialog).toBeVisible();
  await expect(meetingDialog.getByText('Ready to start a meeting')).toBeVisible();
  await expect(meetingDialog.getByRole('button', { name: 'Start meeting' })).toBeEnabled();
  await meetingDialog.getByRole('button', { name: 'Close' }).dispatchEvent('click');
  await expect(meetingDialog).toBeHidden();
});

test('new conversation dialog supports group and channel modes and command search opens with Ctrl or Cmd K', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  const searchDialog = page.getByRole('dialog', { name: 'Messenger search' });
  await expect(searchDialog).toBeVisible();
  await searchDialog
    .getByRole('textbox', { name: 'Search conversations, messages, or people' })
    .fill('launch');
  await expect(searchDialog.getByText('Conversations', { exact: true })).toBeVisible();
  await expect(searchDialog.getByText('Messages', { exact: true })).toBeVisible();
  await expect(searchDialog.getByText('People', { exact: true })).toBeVisible();
  await searchDialog.getByText('Launch coordination', { exact: true }).click();
  await expect(searchDialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`conversation=${CONVERSATION_ID}`, 'u'));

  await page.getByRole('button', { name: 'New conversation' }).click();
  const createDialog = page.getByRole('dialog', { name: 'New group or channel' });
  await expect(createDialog).toBeVisible();
  const groupMode = createDialog.getByRole('button', { name: 'Group conversation' });
  const channelMode = createDialog.getByRole('button', { name: 'Channel' });
  await expect(groupMode).toHaveAttribute('aria-pressed', 'true');
  await expect(createDialog.getByRole('textbox', { name: 'Group name' })).toBeVisible();
  await channelMode.click();
  await expect(channelMode).toHaveAttribute('aria-pressed', 'true');
  await createDialog.getByRole('textbox', { name: 'Channel name' }).fill('Release room');
  await createDialog
    .getByRole('textbox', { name: 'Topic (optional)' })
    .fill('Daily launch decisions');
  await createDialog.getByRole('button', { name: 'Create conversation' }).click();
  await expect.poll(() => state.createdRequests.at(-1)?.type).toBe('CHANNEL');
  expect(state.createdRequests.at(-1)).toMatchObject({
    name: 'Release room',
    topic: 'Daily launch decisions',
    memberUserIds: [],
  });
  await expect(page.getByRole('heading', { name: 'Release room' })).toBeVisible();
});

test('conversation owners can govern member roles from the conversation context', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.getByRole('button', { name: 'Manage members' }).click();
  const dialog = page.getByRole('dialog', { name: /Conversation members/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Alex Park')).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Role for Alex Park' }).click();
  await page.getByRole('option', { name: 'Moderator' }).click();

  await expect
    .poll(() => state.memberRoleRequests.at(-1))
    .toEqual({ userId: COLLEAGUE.userId, role: 'MODERATOR', version: 2 });
  await expect(dialog.getByRole('button', { name: 'Remove Alex Park' })).toBeVisible();
});

test('personal display settings persist per conversation and globally without affecting peers', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop display preference contract');
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.getByRole('button', { name: 'Conversation settings' }).click();
  await page.getByRole('tab', { name: 'Display' }).click();
  await expect(
    page.getByText('Only tenant-approved, low-saturation presets are applied to your view.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Mist' }).click();
  await expect
    .poll(() => state.conversationDisplayPreferences.get(CONVERSATION_ID)?.theme)
    .toBe('MIST');

  await page.getByRole('button', { name: 'All conversations' }).click();
  await page.getByRole('button', { name: 'Compact' }).click();
  await expect.poll(() => state.displayPreference.density).toBe('COMPACT');
  await page.screenshot({
    path: testInfo.outputPath('messaging-display-preferences.png'),
    fullPage: true,
  });
});

test('long conversations load earlier history without replacing the current timeline', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  state.messages.set(
    CONVERSATION_ID,
    Array.from({ length: 105 }, (_, index) =>
      message({
        messageId: `73000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
        body: `History ${String(index + 1).padStart(3, '0')}`,
        sequence: index + 1,
        createdAt: `2026-08-18T${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00Z`,
      })
    )
  );

  await openConversation(page);
  const timeline = page.getByRole('feed', { name: 'Messages' });
  await expect(page.getByText('History 105', { exact: true })).toBeAttached();
  await expect(page.getByText('History 006', { exact: true })).toHaveCount(0);
  await timeline.evaluate((element) => {
    element.scrollTop = 0;
  });
  const retainedMessage = page.getByText('History 026', { exact: true });
  const retainedTopBefore = (await retainedMessage.boundingBox())?.y;
  expect(retainedTopBefore).toBeDefined();
  await page.getByRole('button', { name: 'Load earlier messages' }).click();
  await expect(page.getByText('History 006', { exact: true })).toBeAttached();
  await expect(page.getByText('History 105', { exact: true })).toBeAttached();
  const retainedTopAfter = (await retainedMessage.boundingBox())?.y;
  expect(retainedTopAfter).toBeDefined();
  expect(Math.abs(retainedTopAfter! - retainedTopBefore!)).toBeLessThanOrEqual(2);
});

test('narrow viewport keeps the main composer and thread composer reachable without clipping', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile geometry contract');
  await mockMessaging(page);
  await openConversation(page);

  const mainComposer = page.getByRole('textbox', { name: 'Compose message' });
  await expectInsideViewport(mainComposer, page);
  const ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.getByRole('button', { name: 'Reply in thread' }).click();

  const thread = page.getByRole('region', { name: 'Thread' });
  const threadComposer = thread.getByRole('textbox', { name: 'Compose thread reply' });
  await expectInsideViewport(thread, page);
  await expectInsideViewport(thread.getByRole('button', { name: 'Close thread' }), page);
  await expectInsideViewport(threadComposer, page);

  const geometry = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.documentWidth - geometry.viewportWidth).toBeLessThanOrEqual(1);

  const composerBox = await threadComposer.boundingBox();
  expect(composerBox).not.toBeNull();
  const composerIsTopmost = await page.evaluate(
    ({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return Boolean(target?.closest('[aria-label="Compose thread reply"]'));
    },
    {
      x: composerBox!.x + composerBox!.width / 2,
      y: composerBox!.y + composerBox!.height / 2,
    }
  );
  expect(composerIsTopmost).toBe(true);
});
