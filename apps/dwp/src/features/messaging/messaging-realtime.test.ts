import { describe, expect, it } from 'vitest';

import { resolveMessagingTransport } from './use-messaging-realtime';

describe('messaging realtime transport negotiation', () => {
  it('opens SSE only when the governed backend advertises it', () => {
    expect(
      resolveMessagingTransport({
        mode: 'SSE',
        endpoint: '/api/messaging/v1/realtime',
        state: 'AVAILABLE',
        detail: 'ready',
      })
    ).toBe('sse');
    expect(
      resolveMessagingTransport({
        mode: 'REST',
        endpoint: '/api/messaging/v1/realtime',
        state: 'READY_FOR_WEBSOCKET_GATEWAY',
        detail: 'planned',
      })
    ).toBe('polling');
  });

  it('rejects endpoints outside the governed messaging API boundary', () => {
    expect(
      resolveMessagingTransport({
        mode: 'SSE',
        endpoint: 'https://external.example/realtime',
        state: 'AVAILABLE',
        detail: 'invalid',
      })
    ).toBe('polling');
  });
});
