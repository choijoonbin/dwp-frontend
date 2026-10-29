import { useEffect, useRef } from 'react';
import {
  MESSAGING_PRESENCE_DEFAULT_LEASE_TIMING,
  MESSAGING_PRESENCE_RENEWAL_SAFETY_MARGIN_MS,
  MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS,
  refreshMessagingPresence,
  type MessagingPresenceLeaseTiming,
} from '@dwp-frontend/shared-utils';

import {
  MESSAGING_CROSS_TAB_LEASE_RENEW_MS,
  MessagingCrossTabLease,
  openMessagingBroadcastChannel,
} from './messaging-cross-tab-coordination';

export const MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS =
  MESSAGING_PRESENCE_DEFAULT_LEASE_TIMING.refreshAfterSeconds * 1_000;
export const MESSAGING_PRESENCE_MAX_RETRY_MS = 60_000;
const MESSAGING_PRESENCE_JITTER_RATIO = 0.1;

type MessagingPresenceIdentity = Readonly<{
  tenantId: string | number;
  userId: string | number;
}>;

type HeartbeatAttempt =
  | Readonly<{
      succeeded: true;
      requestStartedAt: number;
      timing: MessagingPresenceLeaseTiming;
    }>
  | Readonly<{
      succeeded: false;
      requestStartedAt: number;
    }>;

type SuccessfulLease = Readonly<{
  requestStartedAt: number;
  timing: MessagingPresenceLeaseTiming;
}>;

type PresenceScopeState = {
  identityScope: string | null;
  requestInFlight: Promise<HeartbeatAttempt> | null;
  lastSuccessfulLease: SuccessfulLease | null;
};

export function messagingPresenceHeartbeatDelayMs(
  consecutiveFailures: number,
  random = Math.random,
  refreshAfterMs = MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS
): number {
  const baseDelay = Math.min(
    MESSAGING_PRESENCE_MAX_RETRY_MS,
    refreshAfterMs * 2 ** Math.min(consecutiveFailures, 2)
  );
  const jitter = (random() * 2 - 1) * MESSAGING_PRESENCE_JITTER_RATIO;
  return Math.min(MESSAGING_PRESENCE_MAX_RETRY_MS, Math.round(baseDelay * (1 + jitter)));
}

export function useMessagingPresenceHeartbeat(
  enabled = true,
  identity?: MessagingPresenceIdentity | null
): void {
  const scopeStateRef = useRef<PresenceScopeState>({
    identityScope: null,
    requestInFlight: null,
    lastSuccessfulLease: null,
  });
  const identityScope = identity
    ? `${encodeURIComponent(String(identity.tenantId))}:${encodeURIComponent(String(identity.userId))}`
    : null;

  useEffect(() => {
    if (scopeStateRef.current.identityScope !== identityScope) {
      scopeStateRef.current = {
        identityScope,
        requestInFlight: null,
        lastSuccessfulLease: null,
      };
    }
    const scopeState = scopeStateRef.current;
    let disposed = false;
    let active = false;
    let leader = false;
    let timeoutId: number | undefined;
    let consecutiveFailures = 0;
    let observedRequest: Promise<HeartbeatAttempt> | null = null;
    const coordinationName = `presence-heartbeat:${identityScope ?? 'unresolved'}`;
    const lease = new MessagingCrossTabLease({ name: coordinationName });
    const channel = openMessagingBroadcastChannel(coordinationName);

    const canPublish = () =>
      enabled &&
      identityScope !== null &&
      document.visibilityState === 'visible' &&
      navigator.onLine;

    const stop = () => {
      if (timeoutId === undefined) return;
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    };

    const schedule = () => {
      if (disposed || !leader || !active || !canPublish() || timeoutId !== undefined) return;
      const lease = scopeState.lastSuccessfulLease;
      const refreshAfterMs =
        (lease?.timing.refreshAfterSeconds ??
          MESSAGING_PRESENCE_DEFAULT_LEASE_TIMING.refreshAfterSeconds) * 1_000;
      let delay = messagingPresenceHeartbeatDelayMs(
        consecutiveFailures,
        Math.random,
        refreshAfterMs
      );
      if (lease && consecutiveFailures === 0) {
        const latestFirstAttemptAt =
          lease.requestStartedAt +
          lease.timing.leaseTtlSeconds * 1_000 -
          MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS * 2 -
          MESSAGING_PRESENCE_RENEWAL_SAFETY_MARGIN_MS;
        const desiredAttemptAt = lease.requestStartedAt + delay;
        delay = Math.max(0, Math.min(desiredAttemptAt, latestFirstAttemptAt) - Date.now());
      } else if (lease && consecutiveFailures === 1) {
        const latestRetryAt =
          lease.requestStartedAt +
          lease.timing.leaseTtlSeconds * 1_000 -
          MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS -
          MESSAGING_PRESENCE_RENEWAL_SAFETY_MARGIN_MS;
        delay = Math.max(0, Math.min(delay, latestRetryAt - Date.now()));
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = undefined;
        publish();
      }, delay);
    };

    function publish() {
      if (disposed || !leader || !canPublish()) return;
      let pending = scopeState.requestInFlight;
      if (!pending) {
        const requestStartedAt = Date.now();
        pending = refreshMessagingPresence().then(
          (timing): HeartbeatAttempt => ({ succeeded: true, requestStartedAt, timing }),
          (): HeartbeatAttempt => ({ succeeded: false, requestStartedAt })
        );
        scopeState.requestInFlight = pending;
        void pending.finally(() => {
          if (scopeState.requestInFlight === pending) scopeState.requestInFlight = null;
        });
      }
      if (observedRequest === pending) return;
      observedRequest = pending;
      void pending.then((attempt) => {
        if (observedRequest === pending) observedRequest = null;
        if (disposed) return;
        if (attempt.succeeded) {
          consecutiveFailures = 0;
          scopeState.lastSuccessfulLease = {
            requestStartedAt: attempt.requestStartedAt,
            timing: attempt.timing,
          };
        } else {
          consecutiveFailures += 1;
        }
        schedule();
      });
    }

    const synchronize = () => {
      if (!canPublish()) {
        active = false;
        if (leader) {
          leader = false;
          lease.release();
          channel?.postMessage({ type: 'released' });
        }
        stop();
        return;
      }
      const ownsLease = leader ? lease.renew() : lease.claim();
      if (!ownsLease) {
        leader = false;
        active = false;
        stop();
        return;
      }
      leader = true;
      if (active) return;
      active = true;
      channel?.postMessage({ type: 'leader' });
      publish();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === lease.key) synchronize();
    };

    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'released') synchronize();
      };
    }

    synchronize();
    const electionId = window.setInterval(synchronize, MESSAGING_CROSS_TAB_LEASE_RENEW_MS);
    document.addEventListener('visibilitychange', synchronize);
    window.addEventListener('online', synchronize);
    window.addEventListener('offline', synchronize);
    window.addEventListener('storage', handleStorage);

    return () => {
      disposed = true;
      stop();
      window.clearInterval(electionId);
      if (leader) {
        lease.release();
        channel?.postMessage({ type: 'released' });
      }
      channel?.close();
      document.removeEventListener('visibilitychange', synchronize);
      window.removeEventListener('online', synchronize);
      window.removeEventListener('offline', synchronize);
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled, identityScope]);
}
