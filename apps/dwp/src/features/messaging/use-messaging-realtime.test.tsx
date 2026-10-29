// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  typing: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  subscribeMessagingRealtime: mocks.subscribe,
  setMessagingTyping: mocks.typing,
}));

import { useMessagingRealtime } from './use-messaging-realtime';
import {
  messagingRealtimeCursorStorageKey,
  readMessagingRealtimeSharedCursor,
  storeMessagingRealtimeSharedCursor,
} from './messaging-realtime-cursor';

type Subscription = {
  signal: AbortSignal;
  after?: string | null;
  onSignal: (signal: { kind: string; conversationId?: string }) => void;
  onCursor: (cursor: string) => void;
};

class TestBroadcastChannel {
  static readonly channels = new Map<string, Set<TestBroadcastChannel>>();
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(readonly name: string) {
    const members = TestBroadcastChannel.channels.get(name) ?? new Set();
    members.add(this);
    TestBroadcastChannel.channels.set(name, members);
  }

  postMessage(data: unknown) {
    TestBroadcastChannel.channels.get(this.name)?.forEach((member) => {
      if (member !== this) member.onmessage?.({ data } as MessageEvent<unknown>);
    });
  }

  close() {
    TestBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

function Harness({
  conversationId,
  tenantId = 7,
  userId = 42,
}: {
  conversationId: string;
  tenantId?: number;
  userId?: number;
}) {
  const connection = useMessagingRealtime({
    conversationId,
    realtime: {
      mode: 'SSE',
      endpoint: '/api/messaging/v1/stream',
      state: 'READY',
      detail: 'test',
    },
    enabled: true,
    tenantId,
    userId,
  });
  return <span>{connection.state}</span>;
}

describe('messaging realtime cross-tab coordination', () => {
  let firstHost: HTMLDivElement;
  let secondHost: HTMLDivElement;
  let firstRoot: Root;
  let secondRoot: Root;
  let firstMounted: boolean;
  let secondMounted: boolean;
  let subscriptions: Subscription[];

  beforeEach(() => {
    Object.assign(globalThis, {
      IS_REACT_ACT_ENVIRONMENT: true,
      BroadcastChannel: TestBroadcastChannel,
    });
    localStorage.clear();
    sessionStorage.clear();
    TestBroadcastChannel.channels.clear();
    subscriptions = [];
    mocks.subscribe.mockReset().mockImplementation(
      ({ signal, after, onSignal, onCursor }: Subscription) =>
        new Promise<void>((resolve) => {
          subscriptions.push({ signal, after, onSignal, onCursor });
          signal.addEventListener('abort', () => resolve(), { once: true });
        })
    );
    mocks.typing.mockReset().mockResolvedValue(undefined);
    firstHost = document.createElement('div');
    secondHost = document.createElement('div');
    document.body.append(firstHost, secondHost);
    firstRoot = createRoot(firstHost);
    secondRoot = createRoot(secondHost);
    firstMounted = true;
    secondMounted = true;
  });

  afterEach(async () => {
    if (firstMounted) await act(async () => firstRoot.unmount());
    if (secondMounted) await act(async () => secondRoot.unmount());
    firstHost.remove();
    secondHost.remove();
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens one global stream, relays signals, and transfers ownership', async () => {
    const firstClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const secondClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      firstRoot.render(
        <QueryClientProvider client={firstClient}>
          <Harness conversationId="conversation-1" />
        </QueryClientProvider>
      );
      secondRoot.render(
        <QueryClientProvider client={secondClient}>
          <Harness conversationId="conversation-2" />
        </QueryClientProvider>
      );
    });

    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    await act(async () => subscriptions[0]!.onSignal({ kind: 'heartbeat' }));
    await act(async () => subscriptions[0]!.onCursor('41'));
    expect(firstHost.textContent).toBe('live');
    expect(secondHost.textContent).toBe('live');

    await act(async () => firstRoot.unmount());
    firstMounted = false;
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    expect(subscriptions[1]?.after).toBe('41');
    expect(
      readMessagingRealtimeSharedCursor(
        localStorage,
        messagingRealtimeCursorStorageKey({ tenantId: 7, userId: 42 })
      )
    ).toBe('41');
  });

  it('does not share a stream lease or cursor channel across user identities', async () => {
    const firstClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const secondClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      firstRoot.render(
        <QueryClientProvider client={firstClient}>
          <Harness conversationId="conversation-1" userId={42} />
        </QueryClientProvider>
      );
      secondRoot.render(
        <QueryClientProvider client={secondClient}>
          <Harness conversationId="conversation-2" userId={43} />
        </QueryClientProvider>
      );
    });

    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  });

  it('resumes from scoped crash evidence after the prior lease has disappeared', async () => {
    const storageKey = messagingRealtimeCursorStorageKey({ tenantId: 7, userId: 42 });
    storeMessagingRealtimeSharedCursor(localStorage, storageKey, '41');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      firstRoot.render(
        <QueryClientProvider client={client}>
          <Harness conversationId="conversation-1" />
        </QueryClientProvider>
      );
    });

    expect(mocks.subscribe.mock.calls[0]?.[0]).toMatchObject({ after: '41' });
  });

  it('clears a server-rejected resume cursor before reconnecting', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const storageKey = messagingRealtimeCursorStorageKey({ tenantId: 7, userId: 42 });
    storeMessagingRealtimeSharedCursor(localStorage, storageKey, '999');
    mocks.subscribe.mockRejectedValueOnce({ status: 400 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      firstRoot.render(
        <QueryClientProvider client={client}>
          <Harness conversationId="conversation-1" />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });
    expect(mocks.subscribe.mock.calls[0]?.[0]).toMatchObject({ after: '999' });

    await act(async () => vi.advanceTimersByTimeAsync(2_000));

    expect(mocks.subscribe.mock.calls[1]?.[0]).toMatchObject({ after: null });
    expect(localStorage.getItem(storageKey)).toBeNull();
    await act(async () => firstRoot.unmount());
    firstMounted = false;
    vi.useRealTimers();
  });
});
