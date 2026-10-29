import { describe, expect, it } from 'vitest';

import { messagingConversationHref } from './messaging-deep-link';

describe('messaging conversation deep links', () => {
  it('preserves the exact source message when one is available', () => {
    expect(
      messagingConversationHref({
        conversationId: 'conversation / 42',
        messageId: 'message / 7',
      })
    ).toBe('/messages/inbox?conversation=conversation+%2F+42&message=message+%2F+7');
  });

  it('keeps conversation-only navigation explicit for results without a message', () => {
    expect(messagingConversationHref({ conversationId: 'conversation-42', view: 'direct' })).toBe(
      '/messages/direct?conversation=conversation-42'
    );
  });
});
