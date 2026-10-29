import { describe, expect, it } from 'vitest';

import {
  messagingConversationPageRequest,
  nextMessagingConversationPageParam,
} from './messaging-conversation-pagination';

const basePage = {
  items: [],
  total: 61,
  page: 0,
  pageSize: 30,
};

describe('messaging conversation pagination', () => {
  it('prefers the opaque cursor and sends it without advancing the legacy page', () => {
    expect(
      nextMessagingConversationPageParam({
        ...basePage,
        hasMore: true,
        nextCursor: 'v1.opaque-cursor',
        nextPage: 1,
      })
    ).toBe('v1.opaque-cursor');
    expect(messagingConversationPageRequest('v1.opaque-cursor')).toEqual({
      page: 0,
      cursor: 'v1.opaque-cursor',
    });
  });

  it('falls back to the legacy page contract when cursor fields are absent', () => {
    expect(nextMessagingConversationPageParam(basePage)).toBe(1);
    expect(messagingConversationPageRequest(1)).toEqual({ page: 1 });
    expect(nextMessagingConversationPageParam({ ...basePage, total: 30 })).toBeUndefined();
  });

  it('uses an additive nextPage fallback when a rolling response has no cursor', () => {
    expect(
      nextMessagingConversationPageParam({
        ...basePage,
        hasMore: true,
        nextCursor: null,
        nextPage: 7,
      })
    ).toBe(7);
    expect(
      nextMessagingConversationPageParam({
        ...basePage,
        hasMore: false,
        nextCursor: 'stale-cursor-must-not-continue',
        nextPage: null,
      })
    ).toBeUndefined();
  });
});
