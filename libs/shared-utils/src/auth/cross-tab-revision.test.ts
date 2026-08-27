import { describe, expect, it, vi } from 'vitest';

import { publishCrossTabRevision, subscribeCrossTabRevision } from './cross-tab-revision';

import type { CrossTabRevisionChannel } from './cross-tab-revision';

function fakeChannel() {
  let receiver: ((event: MessageEvent<unknown>) => void) | null = null;
  const channel: CrossTabRevisionChannel = {
    postMessage: vi.fn(),
    addEventListener: vi.fn((_type, listener) => {
      receiver = listener as (event: MessageEvent<unknown>) => void;
    }),
    removeEventListener: vi.fn(),
    close: vi.fn(),
  };
  return { channel, receive: (data: unknown) => receiver?.({ data } as MessageEvent<unknown>) };
}

describe('cross-tab revision channel', () => {
  it('publishes an opaque revision without authority payload', () => {
    const { channel } = fakeChannel();

    publishCrossTabRevision('provider-support', () => channel);

    expect(channel.postMessage).toHaveBeenCalledWith({
      kind: 'dwp-cache-revision',
      revision: expect.any(String),
    });
    expect(JSON.stringify(vi.mocked(channel.postMessage).mock.calls)).not.toContain('tenant');
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it('accepts only the closed revision message shape and releases the channel', () => {
    const { channel, receive } = fakeChannel();
    const listener = vi.fn();
    const unsubscribe = subscribeCrossTabRevision('provider-support', listener, () => channel);

    receive({ kind: 'dwp-cache-revision', revision: 'one', tenantId: 'leak' });
    receive({ kind: 'other', revision: 'two' });
    receive({ kind: 'dwp-cache-revision', revision: 'three' });

    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    expect(channel.removeEventListener).toHaveBeenCalledOnce();
    expect(channel.close).toHaveBeenCalledOnce();
  });
});
