import { useEffect, useState } from 'react';
import {
  NOTIFICATION_LIVE_EVENT,
  NOTIFICATION_SYNC_RESET_EVENT,
  parseNotificationLiveSignal,
  parseNotificationSyncResetSignal,
  type NotificationLiveSignal,
} from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationConnectionState = 'live' | 'polling' | 'offline';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

/**
 * The approved shell transport dispatches a content-free CustomEvent after SSE version
 * reconciliation. The feature never opens an ungoverned transport on its own.
 */
export function useNotificationLiveUpdates(
  onSignal: (signal: NotificationLiveSignal) => void
): NotificationConnectionState {
  const online = useOnlineStatus();
  const [seenLiveSignal, setSeenLiveSignal] = useState(false);

  useEffect(() => {
    const listener = (event: Event) => {
      const signal = parseNotificationLiveSignal((event as CustomEvent<unknown>).detail);
      if (!signal) return;
      setSeenLiveSignal(true);
      onSignal(signal);
    };
    window.addEventListener(NOTIFICATION_LIVE_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_LIVE_EVENT, listener);
  }, [onSignal]);

  if (!online) return 'offline';
  return seenLiveSignal ? 'live' : 'polling';
}

export function useNotificationSyncResetSignal(): {
  resetRequired: boolean;
  clearResetRequired: () => void;
} {
  const [resetRequired, setResetRequired] = useState(false);

  useEffect(() => {
    const listener = (event: Event) => {
      const signal = parseNotificationSyncResetSignal((event as CustomEvent<unknown>).detail);
      if (signal) setResetRequired(true);
    };
    window.addEventListener(NOTIFICATION_SYNC_RESET_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATION_SYNC_RESET_EVENT, listener);
  }, []);

  return {
    resetRequired,
    clearResetRequired: () => setResetRequired(false),
  };
}
