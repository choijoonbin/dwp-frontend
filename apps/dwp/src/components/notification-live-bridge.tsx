import { useEffect } from 'react';
import { getEventStream } from '@dwp-frontend/shared-utils/axios-instance';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  NOTIFICATION_LIVE_EVENT,
  parseNotificationLiveSignal,
  type NotificationLiveSignal,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { getTenantId } from '@dwp-frontend/shared-utils/tenant-util';

const NOTIFICATION_STREAM_URL = '/api/notifications/v1/stream';
const LIVE_CHANNEL_PREFIX = 'dwp:notification-live:v1';
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

type LiveChannelMessage = {
  kind: 'notification.changed';
  signal: NotificationLiveSignal;
};

export function notificationLiveChannelName(tenantId: string, userId: string | number): string {
  const normalizedTenantId = tenantId.trim();
  const normalizedUserId = String(userId).trim();
  if (!normalizedTenantId || !normalizedUserId) {
    throw new Error('Tenant and user IDs are required for notification live updates.');
  }
  return `${LIVE_CHANNEL_PREFIX}:${normalizedTenantId}:${normalizedUserId}`;
}

export function parseNotificationLiveChannelMessage(value: unknown): NotificationLiveSignal | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<LiveChannelMessage>;
  if (message.kind !== 'notification.changed') return null;
  return parseNotificationLiveSignal(message.signal);
}

/**
 * Owns one governed stream per browser profile. The elected tab reconciles SSE
 * version hints and relays content-free signals to the other open tabs.
 */
export function NotificationLiveBridge() {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user || typeof ReadableStream === 'undefined') return undefined;

    const controller = new AbortController();
    const tenantId = getTenantId();
    const channelName = notificationLiveChannelName(tenantId, user.userId);
    const channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName);
    const lockName = `${channelName}:leader`;

    const dispatch = (signal: NotificationLiveSignal) => {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_LIVE_EVENT, { detail: signal }));
    };

    const broadcast = (signal: NotificationLiveSignal) => {
      dispatch(signal);
      channel?.postMessage({ kind: 'notification.changed', signal } satisfies LiveChannelMessage);
    };

    if (channel) {
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const signal = parseNotificationLiveChannelMessage(event.data);
        if (signal) dispatch(signal);
      };
    }

    const consumeUntilDisconnected = async () => {
      await getEventStream(NOTIFICATION_STREAM_URL, {
        signal: controller.signal,
        onMessage: (message) => {
          if (!LIVE_EVENTS.has(message.event)) return;
          const signal = parseNotificationLiveSignal(message.data);
          if (signal) broadcast(signal);
        },
      });
    };

    const runReconnectLoop = async () => {
      let retryDelay = BASE_RETRY_DELAY_MS;
      while (!controller.signal.aborted) {
        try {
          await consumeUntilDisconnected();
          retryDelay = BASE_RETRY_DELAY_MS;
        } catch {
          // REST reconciliation remains authoritative while live hints are unavailable.
        }
        if (controller.signal.aborted) return;
        await abortableDelay(withJitter(retryDelay), controller.signal);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    };

    const start = async () => {
      if (navigator.locks) {
        await navigator.locks.request(
          lockName,
          { mode: 'exclusive', signal: controller.signal },
          runReconnectLoop
        );
        return;
      }
      await runReconnectLoop();
    };

    void start().catch(() => undefined);
    return () => {
      controller.abort();
      channel?.close();
    };
  }, [isAuthenticated, user]);

  return null;
}

const LIVE_EVENTS = new Set(['notification.connected', 'notification.changed', 'message']);

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
