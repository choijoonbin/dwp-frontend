import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { getMailGovernedEventStream, getTenantId, useAuth } from '@dwp-frontend/shared-utils';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import { useMailGovernedAuthorityLease } from './mail-governed-authority-lease';

import type { EventStreamConfig, EventStreamMessage } from '@dwp-frontend/shared-utils';

const MAIL_EVENTS_URL = '/api/platform/v1/mail/events';
export const MAIL_LIVE_POLL_INTERVAL_MS = 30_000;
export const MAIL_LIVE_EVIDENCE_STALE_MS = 90_000;
export const MAIL_LIVE_INVALIDATION_WINDOW_MS = 250;
export const MAIL_LIVE_HEARTBEAT_TIMEOUT_MS = 45_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_AUTHORITY_TIMER_MS = 60_000;

type MailEventSubscriber = (url: string, config: EventStreamConfig) => Promise<void>;

export function mailEventStreamUrl(cursor: string | null) {
  if (!cursor) return MAIL_EVENTS_URL;
  return `${MAIL_EVENTS_URL}?${new URLSearchParams({ after: cursor }).toString()}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseMailLiveEvent(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as {
    sequence?: unknown;
    type?: unknown;
    threadId?: unknown;
    occurredAt?: unknown;
  };
  if (
    !Number.isSafeInteger(candidate.sequence) ||
    (candidate.sequence as number) < 0 ||
    typeof candidate.type !== 'string' ||
    !candidate.type.trim() ||
    candidate.type.length > 100 ||
    typeof candidate.threadId !== 'string' ||
    !UUID_PATTERN.test(candidate.threadId) ||
    typeof candidate.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(candidate.occurredAt))
  ) {
    return null;
  }
  return {
    sequence: candidate.sequence as number,
    type: candidate.type,
    threadId: candidate.threadId,
    occurredAt: candidate.occurredAt,
  };
}

export function mailEventInvalidatesQueries(message: EventStreamMessage) {
  return message.event === 'mail' && parseMailLiveEvent(message.data) !== null;
}

export function mailLiveReconnectDelay(attempt: number, random = Math.random()) {
  const exponential = Math.min(1_000 * 2 ** Math.max(0, Math.min(attempt, 5)), 30_000);
  const jitter = 0.8 + Math.min(1, Math.max(0, random)) * 0.4;
  return Math.min(MAX_RECONNECT_DELAY_MS, Math.round(exponential * jitter));
}

export function shouldRunMailLiveConnection(
  online: boolean,
  visibilityState: DocumentVisibilityState
) {
  return online && visibilityState === 'visible';
}

export function mailLiveEvidenceIsStale({
  live,
  visibilityState,
  latestEvidenceAt,
  now,
  staleAfterMs,
}: {
  live: boolean;
  visibilityState: DocumentVisibilityState;
  latestEvidenceAt: number;
  now: number;
  staleAfterMs: number;
}) {
  return (
    visibilityState === 'visible' &&
    !live &&
    latestEvidenceAt > 0 &&
    now - latestEvidenceAt > staleAfterMs
  );
}

export function createBoundedMailInvalidator(
  invalidate: () => void | Promise<unknown>,
  delayMs = MAIL_LIVE_INVALIDATION_WINDOW_MS
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timeout !== null) return;
      timeout = globalThis.setTimeout(() => {
        timeout = null;
        void invalidate();
      }, delayMs);
    },
    dispose() {
      if (timeout !== null) globalThis.clearTimeout(timeout);
      timeout = null;
    },
  };
}

export function mailCursorStorageKey(tenantId: string | number, userId: string | number) {
  return `dwp:mail-live:v1:${tenantId}:${userId}:cursor`;
}

export function readMailEventCursor(storage: Pick<Storage, 'getItem'>, key: string) {
  try {
    const value = storage.getItem(key);
    const parsed = value && /^(?:0|[1-9]\d*)$/u.test(value) ? Number(value) : Number.NaN;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? String(parsed) : null;
  } catch {
    return null;
  }
}

export function storeMailEventCursor(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  cursor: string
) {
  try {
    storage.setItem(key, cursor);
  } catch {
    // The in-memory cursor still protects reconnects while this Mail page remains mounted.
  }
}

export function MailLiveInvalidationBridge({
  subscribe = getMailGovernedEventStream,
  pollIntervalMs = MAIL_LIVE_POLL_INTERVAL_MS,
  staleAfterMs = MAIL_LIVE_EVIDENCE_STALE_MS,
  heartbeatTimeoutMs = MAIL_LIVE_HEARTBEAT_TIMEOUT_MS,
}: {
  subscribe?: MailEventSubscriber;
  pollIntervalMs?: number;
  staleAfterMs?: number;
  heartbeatTimeoutMs?: number;
} = {}) {
  const { t } = useTranslation('mail');
  const auth = useAuth();
  const queryClient = useQueryClient();
  const authorityLease = useMailGovernedAuthorityLease();
  const [evidenceStale, setEvidenceStale] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) return undefined;
    let disposed = false;
    let live = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    let authorityTimer: ReturnType<typeof setTimeout> | null = null;
    let streamController: AbortController | null = null;
    const storageKey = mailCursorStorageKey(getTenantId(), auth.user.userId);
    let cursor = readMailEventCursor(window.sessionStorage, storageKey);
    const latestMailEvidenceAt = () =>
      queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.queryKey[0] === 'mail')
        .reduce((latest, query) => Math.max(latest, query.state.dataUpdatedAt), 0);
    const updateStaleState = () => {
      if (disposed) return;
      const latest = latestMailEvidenceAt();
      setEvidenceStale(
        mailLiveEvidenceIsStale({
          live,
          visibilityState: document.visibilityState,
          latestEvidenceAt: latest,
          now: Date.now(),
          staleAfterMs,
        })
      );
    };
    const invalidator = createBoundedMailInvalidator(() =>
      queryClient.invalidateQueries({ queryKey: ['mail'] })
    );
    const authorityCurrent = () =>
      authorityLease.expiresAt === null || Date.now() < authorityLease.expiresAt;
    const canConnect = () =>
      authorityCurrent() &&
      shouldRunMailLiveConnection(window.navigator.onLine, document.visibilityState);

    const clearReconnect = () => {
      if (reconnectTimer !== null) globalThis.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const clearHeartbeat = () => {
      if (heartbeatTimer !== null) globalThis.clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    };

    const watchHeartbeat = (controller: AbortController) => {
      clearHeartbeat();
      heartbeatTimer = globalThis.setTimeout(() => {
        if (streamController !== controller) return;
        live = false;
        controller.abort('mail-event-heartbeat-timeout');
        updateStaleState();
      }, heartbeatTimeoutMs);
    };

    const scheduleReconnect = () => {
      if (disposed || !canConnect() || reconnectTimer !== null) return;
      const delay = mailLiveReconnectDelay(reconnectAttempt++);
      reconnectTimer = globalThis.setTimeout(() => {
        reconnectTimer = null;
        startStream();
      }, delay);
    };

    const startStream = () => {
      if (disposed || streamController || !canConnect() || typeof ReadableStream === 'undefined') {
        return;
      }
      const controller = new AbortController();
      streamController = controller;
      watchHeartbeat(controller);
      void subscribe(mailEventStreamUrl(cursor), {
        signal: controller.signal,
        onOpen: () => {
          live = true;
          reconnectAttempt = 0;
          setEvidenceStale(false);
          watchHeartbeat(controller);
        },
        onMessage: (message) => {
          if (!authorityCurrent()) {
            expireAuthority();
            return;
          }
          if (live) watchHeartbeat(controller);
          const event = message.event === 'mail' ? parseMailLiveEvent(message.data) : null;
          if (!event) return;
          const nextCursor = String(event.sequence);
          if (cursor !== null && event.sequence <= Number(cursor)) return;
          cursor = nextCursor;
          storeMailEventCursor(window.sessionStorage, storageKey, cursor);
          if (mailEventInvalidatesQueries(message)) invalidator.schedule();
        },
      })
        .catch(() => undefined)
        .finally(() => {
          if (streamController !== controller) return;
          clearHeartbeat();
          streamController = null;
          live = false;
          updateStaleState();
          scheduleReconnect();
        });
    };

    const synchronize = () => {
      if (disposed) return;
      if (!canConnect()) {
        clearReconnect();
        clearHeartbeat();
        streamController?.abort();
        streamController = null;
        live = false;
        updateStaleState();
        return;
      }
      updateStaleState();
      startStream();
    };

    const expireAuthority = () => {
      if (disposed || authorityLease.expiresAt === null) return;
      const remaining = authorityLease.expiresAt - Date.now();
      if (remaining > 0) {
        authorityTimer = globalThis.setTimeout(
          expireAuthority,
          Math.min(remaining, MAX_AUTHORITY_TIMER_MS)
        );
        return;
      }
      clearReconnect();
      clearHeartbeat();
      live = false;
      streamController?.abort('mail-governed-authority-expired');
      streamController = null;
      updateStaleState();
    };

    const poll = globalThis.setInterval(() => {
      updateStaleState();
      if (!live && canConnect()) invalidator.schedule();
    }, pollIntervalMs);
    const unsubscribeCache = queryClient
      .getQueryCache()
      .subscribe(() => globalThis.queueMicrotask(updateStaleState));
    window.addEventListener('online', synchronize);
    window.addEventListener('offline', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    expireAuthority();
    synchronize();

    return () => {
      disposed = true;
      globalThis.clearInterval(poll);
      clearReconnect();
      clearHeartbeat();
      if (authorityTimer !== null) globalThis.clearTimeout(authorityTimer);
      streamController?.abort();
      invalidator.dispose();
      unsubscribeCache();
      window.removeEventListener('online', synchronize);
      window.removeEventListener('offline', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
    };
  }, [
    auth.isAuthenticated,
    auth.user,
    authorityLease.expiresAt,
    authorityLease.key,
    heartbeatTimeoutMs,
    pollIntervalMs,
    queryClient,
    staleAfterMs,
    subscribe,
  ]);

  if (!evidenceStale) return null;
  return (
    <InlineFeedback
      severity="warning"
      sx={{ mx: { xs: 1.5, md: 2.5 }, mt: 1.5 }}
      action={
        <ActionButton
          intent="quiet"
          size="small"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['mail'] })}
        >
          {t('live.refresh')}
        </ActionButton>
      }
    >
      {t('live.stale')}
    </InlineFeedback>
  );
}
