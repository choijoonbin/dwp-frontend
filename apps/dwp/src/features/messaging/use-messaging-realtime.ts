import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setMessagingTyping, subscribeMessagingRealtime } from '@dwp-frontend/shared-utils';

import {
  MESSAGING_CROSS_TAB_LEASE_RENEW_MS,
  MessagingCrossTabLease,
  openMessagingBroadcastChannel,
} from './messaging-cross-tab-coordination';
import {
  browserLocalStorage,
  browserSessionStorage,
  clearMessagingRealtimeCursor,
  messagingRealtimeCursorStorageKey,
  messagingRealtimeScopeKey,
  newestMessagingRealtimeCursor,
  normalizeMessagingRealtimeCursor,
  readMessagingRealtimeCursor,
  readMessagingRealtimeSharedCursor,
  storeMessagingRealtimeCursor,
  storeMessagingRealtimeSharedCursor,
} from './messaging-realtime-cursor';

import type { MessagingRealtimeSignal, MessagingRealtimeStatus } from '@dwp-frontend/shared-utils';

const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const TYPING_REFRESH_MS = 5_000;

export type MessagingConnectionState =
  'idle' | 'connecting' | 'live' | 'reconnecting' | 'polling' | 'offline';

export function resolveMessagingTransport(
  realtime?: MessagingRealtimeStatus | null
): 'sse' | 'polling' {
  return realtime?.mode.toUpperCase() === 'SSE' && realtime.endpoint.startsWith('/api/messaging/')
    ? 'sse'
    : 'polling';
}

export function useMessagingRealtime({
  conversationId,
  realtime,
  enabled,
  tenantId,
  userId,
}: {
  conversationId: string | null;
  realtime?: MessagingRealtimeStatus | null;
  enabled: boolean;
  tenantId?: string | number | null;
  userId?: string | number | null;
}): {
  state: MessagingConnectionState;
  reconnectAttempt: number;
  typingUserIds: number[];
} {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [connection, setConnection] = useState<{
    state: MessagingConnectionState;
    reconnectAttempt: number;
  }>({ state: 'idle', reconnectAttempt: 0 });
  const [typingUserIds, setTypingUserIds] = useState<number[]>([]);
  const conversationIdRef = useRef(conversationId);
  const previousCursorStorageKeyRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  const endpoint = realtime?.endpoint ?? '';
  const transport = resolveMessagingTransport(realtime);
  const identity =
    tenantId !== null && tenantId !== undefined && userId !== null && userId !== undefined
      ? { tenantId, userId }
      : null;
  const realtimeScope = identity ? messagingRealtimeScopeKey(identity) : null;
  const cursorStorageKey = identity ? messagingRealtimeCursorStorageKey(identity) : null;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => setTypingUserIds([]), [conversationId]);

  useEffect(() => {
    const previousKey = previousCursorStorageKeyRef.current;
    if (previousKey && previousKey !== cursorStorageKey) {
      clearMessagingRealtimeCursor(browserSessionStorage(), previousKey);
      clearMessagingRealtimeCursor(browserLocalStorage(), previousKey);
    }
    previousCursorStorageKeyRef.current = cursorStorageKey;
  }, [cursorStorageKey]);

  useEffect(() => {
    if (!enabled || !conversationIdRef.current || !realtimeScope || !cursorStorageKey) {
      setConnection({ state: 'idle', reconnectAttempt: 0 });
      setTypingUserIds([]);
      return undefined;
    }
    if (!online) {
      setConnection({ state: 'offline', reconnectAttempt: 0 });
      setTypingUserIds([]);
      return undefined;
    }
    if (transport !== 'sse' || typeof ReadableStream === 'undefined') {
      setConnection({ state: 'polling', reconnectAttempt: 0 });
      setTypingUserIds([]);
      return undefined;
    }

    const typingTimers = new Map<number, number>();
    const storage = browserSessionStorage();
    const sharedStorage = browserLocalStorage();
    const coordinationName = `realtime-stream:${realtimeScope}`;
    const channel = openMessagingBroadcastChannel(coordinationName);
    const lease = new MessagingCrossTabLease({ name: coordinationName });
    let cursor = newestMessagingRealtimeCursor(
      newestMessagingRealtimeCursor(
        readMessagingRealtimeCursor(storage, cursorStorageKey),
        readMessagingRealtimeSharedCursor(sharedStorage, cursorStorageKey)
      ),
      lease.cursor()
    );
    let disposed = false;
    let leader = false;
    let streamController: AbortController | null = null;
    let electionId: number | undefined;
    let currentConnection: {
      state: MessagingConnectionState;
      reconnectAttempt: number;
    } = { state: 'connecting', reconnectAttempt: 0 };

    const updateConnection = (
      next: { state: MessagingConnectionState; reconnectAttempt: number },
      broadcast = leader
    ) => {
      currentConnection = next;
      setConnection(next);
      if (broadcast) channel?.postMessage({ type: 'state', ...next, cursor });
    };

    const rememberCursor = (candidate: unknown, broadcast = leader) => {
      const next = newestMessagingRealtimeCursor(cursor, candidate);
      if (!next || next === cursor) return;
      cursor = next;
      storeMessagingRealtimeCursor(storage, cursorStorageKey, next);
      storeMessagingRealtimeSharedCursor(sharedStorage, cursorStorageKey, next);
      if (leader) lease.renew(Date.now(), next);
      if (broadcast) channel?.postMessage({ type: 'cursor', cursor: next });
    };

    const resetCursor = (broadcast = leader) => {
      if (cursor === null) return;
      cursor = null;
      clearMessagingRealtimeCursor(storage, cursorStorageKey);
      clearMessagingRealtimeCursor(sharedStorage, cursorStorageKey);
      if (leader) lease.clearCursor();
      if (broadcast) channel?.postMessage({ type: 'cursor-reset' });
    };

    const applyTypingSignal = (signal: {
      conversationId?: string;
      userId?: number;
      started?: boolean;
      expiresAt?: string;
    }) => {
      if (signal.conversationId !== conversationIdRef.current || signal.userId === undefined) {
        return;
      }
      const userId = signal.userId;
      const previousTimer = typingTimers.get(userId);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);
      typingTimers.delete(userId);

      const expiry = signal.expiresAt ? Date.parse(signal.expiresAt) : Number.NaN;
      if (!signal.started || !Number.isFinite(expiry) || expiry <= Date.now()) {
        setTypingUserIds((current) => current.filter((item) => item !== userId));
        return;
      }

      setTypingUserIds((current) => (current.includes(userId) ? current : [...current, userId]));
      typingTimers.set(
        userId,
        window.setTimeout(
          () => {
            typingTimers.delete(userId);
            setTypingUserIds((current) => current.filter((item) => item !== userId));
          },
          Math.max(0, expiry - Date.now()) + 100
        )
      );
    };

    const refresh = (signalConversationId?: string) => {
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] });
      const activeConversationId = conversationIdRef.current;
      if (!activeConversationId) return;
      if (!signalConversationId || signalConversationId === activeConversationId) {
        void queryClient.invalidateQueries({
          queryKey: ['messaging', 'conversation', activeConversationId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['messaging', 'thread', activeConversationId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['messaging', 'read-receipts', activeConversationId],
        });
      }
    };

    const applySignal = (signal: MessagingRealtimeSignal) => {
      updateConnection({ state: 'live', reconnectAttempt: 0 }, false);
      if (signal.kind === 'TYPING_CHANGED') {
        applyTypingSignal(signal);
        return;
      }
      if (signal.kind === 'messaging.privacy-preferences.updated') {
        void queryClient.invalidateQueries({
          queryKey: ['messaging', 'privacy-preferences'],
        });
      }
      if (!['connected', 'messaging.connected', 'heartbeat'].includes(signal.kind)) {
        refresh(signal.conversationId);
      }
    };

    const run = async (controller: AbortController) => {
      let attempt = 0;
      while (!controller.signal.aborted) {
        updateConnection({
          state: attempt === 0 ? 'connecting' : 'reconnecting',
          reconnectAttempt: attempt,
        });
        const attemptedCursor = cursor;
        try {
          await subscribeMessagingRealtime({
            endpoint,
            signal: controller.signal,
            after: attemptedCursor,
            onSignal: (signal) => {
              applySignal(signal);
              channel?.postMessage({ type: 'signal', signal });
            },
            onCursor: (nextCursor) => rememberCursor(nextCursor),
          });
          attempt = 0;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (attemptedCursor && isRejectedRealtimeCursor(error)) resetCursor();
          attempt += 1;
        }
        if (controller.signal.aborted) return;
        const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.min(attempt, 5), MAX_RETRY_DELAY_MS);
        await abortableDelay(withJitter(delay), controller.signal);
      }
    };

    const stopLeader = () => {
      streamController?.abort();
      streamController = null;
      if (leader) lease.release();
      leader = false;
    };

    const startLeader = () => {
      if (streamController) return;
      leader = true;
      streamController = new AbortController();
      void run(streamController);
    };

    const synchronize = () => {
      if (disposed) return;
      if (document.visibilityState !== 'visible') {
        if (leader) {
          stopLeader();
          channel?.postMessage({ type: 'released', cursor });
        }
        return;
      }
      rememberCursor(lease.cursor(), false);
      const ownsLease = leader ? lease.renew(Date.now(), cursor) : lease.claim(Date.now(), cursor);
      if (ownsLease) {
        startLeader();
        channel?.postMessage({ type: 'state', ...currentConnection, cursor });
        return;
      }
      if (leader) stopLeader();
      if (currentConnection.state === 'idle' || currentConnection.state === 'connecting') {
        updateConnection({ state: 'connecting', reconnectAttempt: 0 }, false);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === lease.key) synchronize();
    };

    if (!channel) {
      lease.claim(Date.now(), cursor);
      leader = true;
      streamController = new AbortController();
      void run(streamController);
    } else {
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (!isRealtimeChannelMessage(event.data)) return;
        if (event.data.type === 'signal') {
          applySignal(event.data.signal);
          return;
        }
        if (event.data.type === 'cursor') {
          rememberCursor(event.data.cursor, false);
          return;
        }
        if (event.data.type === 'cursor-reset') {
          resetCursor(false);
          return;
        }
        if (event.data.type === 'state') {
          if (event.data.cursor) rememberCursor(event.data.cursor, false);
          updateConnection(
            {
              state: event.data.state,
              reconnectAttempt: event.data.reconnectAttempt,
            },
            false
          );
          return;
        }
        if (event.data.cursor) rememberCursor(event.data.cursor, false);
        synchronize();
      };
      synchronize();
      electionId = window.setInterval(synchronize, MESSAGING_CROSS_TAB_LEASE_RENEW_MS);
      window.addEventListener('storage', handleStorage);
      document.addEventListener('visibilitychange', synchronize);
    }

    return () => {
      disposed = true;
      stopLeader();
      if (electionId !== undefined) window.clearInterval(electionId);
      channel?.postMessage({ type: 'released', cursor });
      channel?.close();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', synchronize);
      typingTimers.forEach((timer) => window.clearTimeout(timer));
      setTypingUserIds([]);
    };
  }, [cursorStorageKey, enabled, endpoint, online, queryClient, realtimeScope, transport]);

  return { ...connection, typingUserIds };
}

export function useMessagingTypingPublisher({
  conversationId,
  drafting,
  enabled,
}: {
  conversationId: string | null;
  drafting: boolean;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || !conversationId || !drafting) return undefined;

    const publish = () => {
      void setMessagingTyping(conversationId, true).catch(() => undefined);
    };
    publish();
    const refresh = window.setInterval(publish, TYPING_REFRESH_MS);

    return () => {
      window.clearInterval(refresh);
      void setMessagingTyping(conversationId, false).catch(() => undefined);
    };
  }, [conversationId, drafting, enabled]);
}

type MessagingRealtimeChannelMessage =
  | { type: 'signal'; signal: MessagingRealtimeSignal }
  | {
      type: 'state';
      state: MessagingConnectionState;
      reconnectAttempt: number;
      cursor?: string | null;
    }
  | { type: 'cursor'; cursor: string }
  | { type: 'cursor-reset' }
  | { type: 'released'; cursor?: string | null };

function isRealtimeChannelMessage(value: unknown): value is MessagingRealtimeChannelMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MessagingRealtimeChannelMessage> & {
    signal?: Partial<MessagingRealtimeSignal>;
    state?: unknown;
    reconnectAttempt?: unknown;
  };
  if (candidate.type === 'released') {
    return candidate.cursor == null || normalizeMessagingRealtimeCursor(candidate.cursor) !== null;
  }
  if (candidate.type === 'cursor-reset') return true;
  if (candidate.type === 'cursor') {
    return normalizeMessagingRealtimeCursor(candidate.cursor) !== null;
  }
  if (candidate.type === 'signal') {
    return Boolean(candidate.signal && typeof candidate.signal.kind === 'string');
  }
  return (
    candidate.type === 'state' &&
    typeof candidate.state === 'string' &&
    ['idle', 'connecting', 'live', 'reconnecting', 'polling', 'offline'].includes(
      candidate.state
    ) &&
    typeof candidate.reconnectAttempt === 'number' &&
    Number.isSafeInteger(candidate.reconnectAttempt) &&
    candidate.reconnectAttempt >= 0 &&
    (candidate.cursor == null || normalizeMessagingRealtimeCursor(candidate.cursor) !== null)
  );
}

function isRejectedRealtimeCursor(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { status?: unknown }).status === 400;
}

function withJitter(delay: number): number {
  return Math.round(delay * (0.8 + Math.random() * 0.4));
}

function abortableDelay(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, delay);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}
