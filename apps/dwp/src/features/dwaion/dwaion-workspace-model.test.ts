import { describe, expect, it } from 'vitest';

import { verifiedConversationId } from './dwaion-workspace-model';

describe('verifiedConversationId', () => {
  it('reuses only a conversation that was loaded successfully', () => {
    expect(verifiedConversationId('conversation-1', 'conversation-1')).toBe('conversation-1');
    expect(verifiedConversationId('conversation-1', undefined)).toBeUndefined();
    expect(verifiedConversationId('conversation-1', 'conversation-2')).toBeUndefined();
    expect(verifiedConversationId(null, 'conversation-1')).toBeUndefined();
  });
});
