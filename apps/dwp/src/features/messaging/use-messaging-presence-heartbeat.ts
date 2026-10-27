import { useEffect, useRef } from 'react';
import {
  MESSAGING_PRESENCE_DEFAULT_LEASE_TIMING,
  MESSAGING_PRESENCE_RENEWAL_SAFETY_MARGIN_MS,
  MESSAGING_PRESENCE_REQUEST_TIMEOUT_MS,
  refreshMessagingPresence,
  type MessagingPresenceLeaseTiming,
} from '@dwp-frontend/shared-utils';

export const MESSAGING_PRESENCE_HEARTBEAT_INTERVAL_MS =
  MESSAGING_PRESENCE_DEFAULT_LEASE_TIMING.refreshAfterSeconds * 1_000;
export const MESSAGING_PRESENCE_MAX_RETRY_MS = 60_000;
const MESSAGING_PRESENCE_JITTER_RATIO = 0.1;

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

export function useMessagingPresenceHeartbeat(enabled = true): void {
  const requestInFlight = useRef<Promise<HeartbeatAttempt> | null>(null);
  const lastSuccessfulLease = useRef<SuccessfulLease | null>(null);

  useEffect(() => {
    let disposed = false;
    let active = false;
    let timeoutId: number | undefined;
    let consecutiveFailures = 0;
    let observedRequest: Promise<HeartbeatAttempt> | null = null;

    const canPublish = () => enabled && document.visibilityState === 'visible' && navigator.onLine;

    const stop = () => {
      if (timeoutId === undefined) return;
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    };

    const schedule = () => {
      if (disposed || !active || !canPublish() || timeoutId !== undefined) return;
      const lease = lastSuccessfulLease.current;
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
      if (disposed || !canPublish()) return;
      let pending = requestInFlight.current;
      if (!pending) {
        const requestStartedAt = Date.now();
        pending = refreshMessagingPresence().then(
          (timing): HeartbeatAttempt => ({ succeeded: true, requestStartedAt, timing }),
          (): HeartbeatAttempt => ({ succeeded: false, requestStartedAt })
        );
        requestInFlight.current = pending;
        void pending.finally(() => {
          if (requestInFlight.current === pending) requestInFlight.current = null;
        });
      }
      if (observedRequest === pending) return;
      observedRequest = pending;
      void pending.then((attempt) => {
        if (observedRequest === pending) observedRequest = null;
        if (disposed) return;
        if (attempt.succeeded) {
          consecutiveFailures = 0;
          lastSuccessfulLease.current = {
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
        stop();
        return;
      }
      if (active) return;
      active = true;
      publish();
    };

    synchronize();
    document.addEventListener('visibilitychange', synchronize);
    window.addEventListener('online', synchronize);
    window.addEventListener('offline', synchronize);

    return () => {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', synchronize);
      window.removeEventListener('online', synchronize);
      window.removeEventListener('offline', synchronize);
    };
  }, [enabled]);
}
