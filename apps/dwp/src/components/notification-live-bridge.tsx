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
const LIVE_CHANNEL_NAME = 'dwp:notification-live:v1';
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

type LiveChannelMessage = {
  kind: 'notification.changed';
  signal: NotificationLiveSignal;
};

/**
 * Owns one governed stream per browser profile. The elected tab reconciles SSE
 * version hints and relays content-free signals to the other open tabs.
 */
export function NotificationLiveBridge() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || typeof ReadableStream === 'undefined') return undefined;

    const controller = new AbortController();
    const channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(LIVE_CHANNEL_NAME);
    const tenantId = getTenantId();
    const lockName = `${LIVE_CHANNEL_NAME}:${tenantId}`;

    const dispatch = (signal: NotificationLiveSignal) => {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_LIVE_EVENT, { detail: signal }));
    };

    const broadcast = (signal: NotificationLiveSignal) => {
      dispatch(signal);
      channel?.postMessage({ kind: 'notification.changed', signal } satisfies LiveChannelMessage);
    };

    if (channel) {
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const message = event.data as Partial<LiveChannelMessage> | null;
        if (message?.kind !== 'notification.changed') return;
        const signal = parseNotificationLiveSignal(message.signal);
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
  }, [isAuthenticated]);

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
