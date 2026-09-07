import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setMessagingTyping, subscribeMessagingRealtime } from '@dwp-frontend/shared-utils';

import type { MessagingRealtimeStatus } from '@dwp-frontend/shared-utils';

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
}: {
  conversationId: string | null;
  realtime?: MessagingRealtimeStatus | null;
  enabled: boolean;
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
  const endpoint = realtime?.endpoint ?? '';
  const transport = resolveMessagingTransport(realtime);

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

  useEffect(() => {
    if (!enabled || !conversationId) {
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

    const controller = new AbortController();
    const typingTimers = new Map<number, number>();

    const applyTypingSignal = (signal: {
      conversationId?: string;
      userId?: number;
      started?: boolean;
      expiresAt?: string;
    }) => {
      if (signal.conversationId !== conversationId || signal.userId === undefined) return;
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
      if (!signalConversationId || signalConversationId === conversationId) {
        void queryClient.invalidateQueries({
          queryKey: ['messaging', 'conversation', conversationId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['messaging', 'thread', conversationId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['messaging', 'read-receipts', conversationId],
        });
      }
    };

    const run = async () => {
      let attempt = 0;
      while (!controller.signal.aborted) {
        setConnection({
          state: attempt === 0 ? 'connecting' : 'reconnecting',
          reconnectAttempt: attempt,
        });
        try {
          await subscribeMessagingRealtime({
            endpoint,
            signal: controller.signal,
            onSignal: (signal) => {
              setConnection({ state: 'live', reconnectAttempt: 0 });
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
            },
          });
          attempt = 0;
        } catch {
          if (controller.signal.aborted) return;
          attempt += 1;
        }
        if (controller.signal.aborted) return;
        const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.min(attempt, 5), MAX_RETRY_DELAY_MS);
        await abortableDelay(withJitter(delay), controller.signal);
      }
    };

    void run();
    return () => {
      controller.abort();
      typingTimers.forEach((timer) => window.clearTimeout(timer));
      setTypingUserIds([]);
    };
  }, [conversationId, enabled, endpoint, online, queryClient, transport]);

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
