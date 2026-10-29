import { describe, expect, it } from 'vitest';

import {
  filterMessagingActivity,
  filterMessagingThreads,
  messagingActivityFilter,
} from './messaging-attention-model';

import type { MessagingActivityItem, MessagingThreadItem } from '@dwp-frontend/shared-utils';

const activity: MessagingActivityItem[] = [
  {
    id: 'MENTION:1',
    kind: 'MENTION',
    conversationId: 'conversation-1',
    conversationName: 'Operations',
    conversationType: 'CHANNEL',
    messageId: 'message-1',
    rootMessageId: null,
    actorName: 'Mina Kim',
    preview: 'Review the incident plan',
    protectedContent: false,
    occurredAt: '2026-10-28T00:00:00Z',
  },
  {
    id: 'REACTION:2',
    kind: 'REACTION',
    conversationId: 'conversation-2',
    conversationName: 'Direct message',
    conversationType: 'DIRECT',
    messageId: 'message-2',
    rootMessageId: null,
    actorName: 'Jun Lee',
    preview: '👍',
    protectedContent: false,
    occurredAt: '2026-10-27T00:00:00Z',
  },
  {
    id: 'SCHEDULE_FAILED:3',
    kind: 'SCHEDULE_FAILED',
    conversationId: 'conversation-3',
    conversationName: '',
    conversationType: 'DIRECT',
    messageId: null,
    rootMessageId: null,
    actorName: 'Scheduled delivery',
    preview: 'You no longer have access to this conversation.',
    protectedContent: false,
    occurredAt: '2026-10-26T00:00:00Z',
  },
];

const threads: MessagingThreadItem[] = [
  {
    rootMessageId: 'root-1',
    conversationId: 'conversation-1',
    conversationName: 'Operations',
    conversationType: 'CHANNEL',
    rootSenderName: 'Mina Kim',
    rootPreview: 'Incident decision',
    rootDeleted: false,
    protectedContent: false,
    replyCount: 3,
    latestReplyMessageId: 'reply-3',
    latestReplySenderName: 'Jun Lee',
    latestReplyAt: '2026-10-28T00:00:00Z',
  },
];

describe('messaging attention model', () => {
  it('normalizes filters and combines kind with text search', () => {
    expect(messagingActivityFilter('INVALID')).toBe('ALL');
    expect(messagingActivityFilter('MENTION')).toBe('MENTION');
    expect(messagingActivityFilter('SCHEDULE_FAILED')).toBe('SCHEDULE_FAILED');
    expect(filterMessagingActivity(activity, 'MENTION', 'incident')).toEqual([activity[0]]);
    expect(filterMessagingActivity(activity, 'REACTION', 'operations')).toEqual([]);
    expect(filterMessagingActivity(activity, 'SCHEDULE_FAILED', 'access')).toEqual([activity[2]]);
  });

  it('finds threads by conversation, root, or latest participant', () => {
    expect(filterMessagingThreads(threads, 'operations')).toEqual(threads);
    expect(filterMessagingThreads(threads, 'jun')).toEqual(threads);
    expect(filterMessagingThreads(threads, 'missing')).toEqual([]);
  });
});
