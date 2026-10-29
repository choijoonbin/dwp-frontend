import type { Page } from '@playwright/test';

import {
  conversationDisplayPreference,
  fulfillMessagingRoute as fulfill,
  messagingMessage as message,
} from './messaging-ui-contracts';
import { mockShellSession } from './shell-session';

import type {
  MessagingAttachment,
  MessagingConversation,
  MessagingConversationDetail,
  MessagingConversationDisplayPreference,
  MessagingDisplayPreference,
  MessagingMember,
  MessagingMemberRole,
  MessagingMessage,
  MessagingPerson,
} from '@dwp-frontend/shared-utils';

export const CONVERSATION_ID = '71000000-0000-0000-0000-000000000001';
export const SECOND_CONVERSATION_ID = '71000000-0000-0000-0000-000000000002';
export const OWNER_MESSAGE_ID = '72000000-0000-0000-0000-000000000001';
export const COLLEAGUE_MESSAGE_ID = '72000000-0000-0000-0000-000000000002';
export const OLD_REPLY_MESSAGE_ID = '72000000-0000-0000-0000-000000000003';

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

export const COLLEAGUE: MessagingPerson = {
  userId: 43,
  personPublicId: 'person-alex',
  emailAddress: 'alex.park@sk.com',
  displayName: 'Alex Park',
  jobTitle: 'Service Delivery Manager',
  organizationName: 'Service Delivery',
  presenceState: 'BUSY',
};

export type SendRequest = {
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
  directoryPeople: MessagingPerson[];
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
  discardedAttachmentIds: string[];
  displayPreference: MessagingDisplayPreference;
  conversationDisplayPreferences: Map<string, MessagingConversationDisplayPreference>;
  nextMessage: number;
  nextAttachment: number;
  nextConversation: number;
};

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
    messageId: OLD_REPLY_MESSAGE_ID,
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
    directoryPeople: [COLLEAGUE],
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
    discardedAttachmentIds: [],
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

export function addIncidentConversation(state: MessagingFixtureState) {
  const incidentMessage = message({
    messageId: '72000000-0000-0000-0000-000000000020',
    conversationId: SECOND_CONVERSATION_ID,
    body: 'Incident room is ready.',
    sequence: 1,
    createdAt: '2026-08-19T08:45:00Z',
  });
  state.conversations.push({
    ...state.conversations[0]!,
    conversationId: SECOND_CONVERSATION_ID,
    conversationKey: 'incident-response',
    name: 'Incident response',
    topic: 'Operational incident coordination',
    unreadCount: 0,
    lastMessage: incidentMessage,
    lastMessageAt: incidentMessage.createdAt,
  });
  state.messages.set(SECOND_CONVERSATION_ID, [incidentMessage]);
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

export function findMessage(
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

export async function mockMessaging(page: Page): Promise<MessagingFixtureState> {
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

    if (path === '/api/messaging/v1/privacy-preferences' && method === 'GET') {
      return fulfill(route, {
        readReceiptsEnabled: true,
        presenceSharingEnabled: true,
        version: 0,
      });
    }
    if (path === '/api/messaging/v1/presence/heartbeat' && method === 'PUT') {
      return route.fulfill({ status: 204 });
    }

    if (path === '/api/messaging/v1/conversations' && method === 'GET') {
      const page = Number(url.searchParams.get('page') ?? 0);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 30);
      return fulfill(route, {
        items: state.conversations.slice(page * pageSize, (page + 1) * pageSize),
        total: state.conversations.length,
        page,
        pageSize,
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

    if (path === '/api/messaging/v1/people/page' && method === 'GET') {
      const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
      const organization = (url.searchParams.get('organization') ?? '').toLocaleLowerCase();
      const jobTitle = (url.searchParams.get('jobTitle') ?? '').toLocaleLowerCase();
      const presence = url.searchParams.get('presence') ?? 'ALL';
      const candidates = state.directoryPeople.filter((person) => {
        const searchable = [
          person.displayName,
          person.emailAddress,
          person.jobTitle,
          person.organizationName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();
        return (
          (!query || searchable.includes(query)) &&
          (!organization || person.organizationName?.toLocaleLowerCase().includes(organization)) &&
          (!jobTitle || person.jobTitle?.toLocaleLowerCase().includes(jobTitle))
        );
      });
      const start = Number(url.searchParams.get('cursor') ?? url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 30);
      const end = Math.min(start + limit, candidates.length);
      const items = candidates
        .slice(start, end)
        .filter((person) => presence === 'ALL' || person.presenceState === presence);
      return fulfill(route, {
        items,
        total: candidates.length,
        hasMore: end < candidates.length,
        nextCursor: end < candidates.length ? String(end) : null,
        nextOffset: end < candidates.length ? end : null,
        presence: {
          authority: 'LIVE',
          evaluatedAt: '2026-10-27T07:00:00Z',
          leaseTtlSeconds: 75,
          refreshAfterSeconds: 20,
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

    const discardAttachment = path.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/attachments\/([^/]+)$/u
    );
    if (discardAttachment && method === 'DELETE') {
      const attachmentId = decodeURIComponent(discardAttachment[2]!);
      state.discardedAttachmentIds.push(attachmentId);
      state.attachments.delete(attachmentId);
      return fulfill(route, null);
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
