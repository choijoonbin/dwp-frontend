import { useEffect } from 'react';
import { getEventStream } from '@dwp-frontend/shared-utils/axios-instance';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  NOTIFICATION_LIVE_EVENT,
  NOTIFICATION_SYNC_RESET_EVENT,
  isNotificationCursorResetError,
  parseNotificationConnectionStateSignal,
  parseNotificationLiveSignal,
  parseNotificationSyncResetSignal,
  publishNotificationConnectionState,
  toNotificationApiError,
  type NotificationConnectionStateSignal,
  type NotificationLiveSignal,
  type NotificationSyncResetSignal,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { getTenantId } from '@dwp-frontend/shared-utils/tenant-util';

const NOTIFICATION_STREAM_URL = '/api/notifications/v1/stream';
const LIVE_CHANNEL_PREFIX = 'dwp:notification-live:v2';
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

type LiveChannelMessage =
  | { kind: 'notification.changed'; signal: NotificationLiveSignal }
  | { kind: 'notification.connection'; signal: NotificationConnectionStateSignal }
  | { kind: 'notification.connection-request' }
  | { kind: 'notification.sync-reset'; signal: NotificationSyncResetSignal };

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

export function parseNotificationSyncResetChannelMessage(
  value: unknown
): NotificationSyncResetSignal | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<LiveChannelMessage>;
  if (message.kind !== 'notification.sync-reset') return null;
  return parseNotificationSyncResetSignal(message.signal);
}

export function parseNotificationConnectionChannelMessage(
  value: unknown
): NotificationConnectionStateSignal | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<LiveChannelMessage>;
  if (message.kind !== 'notification.connection') return null;
  return parseNotificationConnectionStateSignal(message.signal);
}

export function isNotificationConnectionRequest(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.kind === 'notification.connection-request' && Object.keys(record).length === 1;
}

export function notificationStreamUrl(cursor: string | null): string {
  return cursor
    ? `${NOTIFICATION_STREAM_URL}?after=${encodeURIComponent(cursor)}`
    : NOTIFICATION_STREAM_URL;
}

export function newestNotificationCursor(current: string | null, candidate: string): string {
  if (!current) return candidate;
  return BigInt(candidate) > BigInt(current) ? candidate : current;
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
    const coordinated = Boolean(navigator.locks && channel);
    const lockName = `${channelName}:leader`;
    const cursorStorageKey = `${channelName}:cursor`;
    let reconnectCursor = readStoredCursor(cursorStorageKey);
    let connectionState: NotificationConnectionStateSignal['state'] = 'polling';
    let ownsStream = false;

    const rememberCursor = (signal: NotificationLiveSignal) => {
      reconnectCursor = newestNotificationCursor(reconnectCursor, signal.changeVersion);
      storeCursor(cursorStorageKey, reconnectCursor);
    };

    const dispatch = (signal: NotificationLiveSignal) => {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_LIVE_EVENT, { detail: signal }));
    };

    const resetCursor = () => {
      reconnectCursor = null;
      removeStoredCursor(cursorStorageKey);
    };

    const dispatchSyncReset = (signal: NotificationSyncResetSignal) => {
      resetCursor();
      window.dispatchEvent(new CustomEvent(NOTIFICATION_SYNC_RESET_EVENT, { detail: signal }));
    };

    const updateConnectionState = (
      state: NotificationConnectionStateSignal['state'],
      relay = false
    ) => {
      if (connectionState === state) return;
      connectionState = state;
      const signal = { state } satisfies NotificationConnectionStateSignal;
      publishNotificationConnectionState(signal);
      if (relay) {
        channel?.postMessage({
          kind: 'notification.connection',
          signal,
        } satisfies LiveChannelMessage);
      }
    };

    const broadcast = (signal: NotificationLiveSignal) => {
      rememberCursor(signal);
      dispatch(signal);
      channel?.postMessage({ kind: 'notification.changed', signal } satisfies LiveChannelMessage);
    };

    if (channel) {
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const signal = parseNotificationLiveChannelMessage(event.data);
        if (signal) {
          rememberCursor(signal);
          dispatch(signal);
          return;
        }
        const resetSignal = parseNotificationSyncResetChannelMessage(event.data);
        if (resetSignal) {
          dispatchSyncReset(resetSignal);
          return;
        }
        const connectionSignal = parseNotificationConnectionChannelMessage(event.data);
        if (connectionSignal) {
          updateConnectionState(connectionSignal.state);
          return;
        }
        if (isNotificationConnectionRequest(event.data) && connectionState === 'live') {
          channel.postMessage({
            kind: 'notification.connection',
            signal: { state: 'live' },
          } satisfies LiveChannelMessage);
        }
      };
      if (coordinated) {
        channel.postMessage({
          kind: 'notification.connection-request',
        } satisfies LiveChannelMessage);
      }
    }

    const consumeUntilDisconnected = async () => {
      await getEventStream(notificationStreamUrl(reconnectCursor), {
        signal: controller.signal,
        onOpen: () => updateConnectionState('live', coordinated),
        onMessage: (message) => {
          if (!LIVE_EVENTS.has(message.event)) return;
          const signal = parseNotificationLiveSignal(message.data);
          if (!signal) return;
          if (message.event === 'notification.connected') {
            rememberCursor(signal);
            updateConnectionState('live', coordinated);
            return;
          }
          updateConnectionState('live', coordinated);
          broadcast(signal);
        },
      });
    };

    const runReconnectLoop = async () => {
      ownsStream = true;
      let retryDelay = BASE_RETRY_DELAY_MS;
      try {
        while (!controller.signal.aborted) {
          try {
            await consumeUntilDisconnected();
            retryDelay = BASE_RETRY_DELAY_MS;
          } catch (error) {
            const notificationError = toNotificationApiError(error);
            if (isNotificationCursorResetError(notificationError)) {
              const signal = {
                errorCode: 'NOTIFICATION_SYNC_RESET_REQUIRED',
              } satisfies NotificationSyncResetSignal;
              dispatchSyncReset(signal);
              channel?.postMessage({
                kind: 'notification.sync-reset',
                signal,
              } satisfies LiveChannelMessage);
              retryDelay = BASE_RETRY_DELAY_MS;
            }
            // REST reconciliation remains authoritative while live hints are unavailable.
          } finally {
            if (!controller.signal.aborted) updateConnectionState('polling', coordinated);
          }
          if (controller.signal.aborted) return;
          await abortableDelay(withJitter(retryDelay), controller.signal);
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        }
      } finally {
        ownsStream = false;
      }
    };

    const start = async () => {
      if (navigator.locks && channel) {
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
      if (ownsStream && coordinated && connectionState === 'live') {
        channel?.postMessage({
          kind: 'notification.connection',
          signal: { state: 'polling' },
        } satisfies LiveChannelMessage);
      }
      publishNotificationConnectionState({ state: 'polling' });
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

function readStoredCursor(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    return value && /^(?:0|[1-9]\d*)$/u.test(value) ? value : null;
  } catch {
    return null;
  }
}

function storeCursor(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // In-memory recovery remains available when storage is blocked.
  }
}

function removeStoredCursor(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // The next reconnect still falls back to the in-memory reset cursor.
  }
}
