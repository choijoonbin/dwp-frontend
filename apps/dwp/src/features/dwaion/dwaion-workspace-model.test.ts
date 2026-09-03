import { describe, expect, it } from 'vitest';

import type { AskDwpResponse } from '@dwp-frontend/shared-utils';

import {
  isGroundedFallbackResponse,
  isGroundedFallbackStatus,
  responseTone,
  verifiedConversationId,
} from './dwaion-workspace-model';

describe('verifiedConversationId', () => {
  it('reuses only a conversation that was loaded successfully', () => {
    expect(verifiedConversationId('conversation-1', 'conversation-1')).toBe('conversation-1');
    expect(verifiedConversationId('conversation-1', undefined)).toBeUndefined();
    expect(verifiedConversationId('conversation-1', 'conversation-2')).toBeUndefined();
    expect(verifiedConversationId(null, 'conversation-1')).toBeUndefined();
  });
});

describe('grounded fallback presentation', () => {
  const fallbackResponse = {
    state: 'COMPLETED',
    statusCode: 'ANSWER_GROUNDED_FALLBACK',
    modelRoute: {
      state: 'COMPLETED',
      provider: 'DWP_GROUNDED_FALLBACK',
    },
  } as AskDwpResponse;

  it('distinguishes deterministic evidence fallback from a normal model answer', () => {
    expect(isGroundedFallbackResponse(fallbackResponse)).toBe(true);
    expect(isGroundedFallbackStatus('ANSWER_GROUNDED_FALLBACK')).toBe(true);
    expect(isGroundedFallbackStatus('ANSWER_GROUNDED')).toBe(false);
    expect(responseTone(fallbackResponse)).toBe('info');
    expect(
      isGroundedFallbackResponse({
        ...fallbackResponse,
        modelRoute: { ...fallbackResponse.modelRoute, provider: 'AZURE_OPENAI' },
      })
    ).toBe(false);
    expect(
      isGroundedFallbackResponse({
        ...fallbackResponse,
        statusCode: 'ANSWER_GROUNDED',
      })
    ).toBe(false);
  });
});
